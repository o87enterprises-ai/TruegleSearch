const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/env');
const paidBudget = require('./PaidProviderBudget');
const { AI_CONTENT_DOMAINS } = require('../data/aiContentDomains');
const sourceBias = require('../data/sourceBias');
const QueryInterpreter = require('./QueryInterpreter');
const UnifiedAIService = require('./UnifiedAIService');

// YouTube's Data API returns titles/descriptions HTML-entity-encoded
// (e.g. "&#39;" for an apostrophe) since they're meant for HTML embeds —
// decode before they reach the frontend, which renders them as plain text.
const NAMED_HTML_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      return Number.isNaN(code) ? match : String.fromCodePoint(code);
    }
    return NAMED_HTML_ENTITIES[entity] ?? match;
  });
}

class SearchService {
  constructor() {
    // Green-mode AI-content blocklist. Seed list + optional env-provided extras
    // (AI_CONTENT_DOMAINS="a.com,b.com"). Stored lowercased in a Set for O(1) lookup.
    const envDomains = (process.env.AI_CONTENT_DOMAINS || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    this.aiContentDomains = new Set(
      [...AI_CONTENT_DOMAINS, ...envDomains].map((d) => d.toLowerCase())
    );

    // Google Custom Search
    this.googleApiKey = config.searchApis.google.apiKey;
    this.googleSearchEngineId = config.searchApis.google.searchEngineId;
    this.googleBaseUrl = 'https://www.googleapis.com/customsearch/v1';

    // Bing Search API
    this.bingApiKey = config.searchApis.bing.apiKey;
    this.bingBaseUrl = 'https://api.bing.microsoft.com/v7.0/search';

    // News API
    this.newsApiKey = config.searchApis.news.apiKey;
    this.newsBaseUrl = 'https://newsapi.org/v2/everything';

    // YouTube Data API
    this.youtubeApiKey = config.searchApis.youtube.apiKey;
    this.youtubeBaseUrl = 'https://www.googleapis.com/youtube/v3/search';

    // Unsplash API (images)
    this.unsplashAccessKey = config.unsplash && config.unsplash.accessKey;

    // Brave Search API (whole-web fallback)
    this.braveApiKey = config.brave && config.brave.apiKey;
    this.braveBaseUrl = 'https://api.search.brave.com/res/v1/web/search';

    // SerpAPI (Google whole-web fallback)
    this.serpApiKey = config.serp && config.serp.apiKey;
    this.serpBaseUrl = 'https://serpapi.com/search';
    // Calls per UTC day this deployment is ALLOWED to pay for. Zero unless
    // somebody set SERP_DAILY_LIMIT — see config/env.js and
    // services/PaidProviderBudget.js for why a key alone is not permission.
    this.serpDailyLimit = (config.serp && config.serp.dailyLimit) || 0;

    // SearXNG (self-hosted metasearch, no API key needed)
    this.searxngUrl = config.searxng && config.searxng.url;
    // Opt-in: when SEARXNG_PRIMARY=true, SearXNG is queried first and the paid
    // API providers (Google/Bing/Brave) only run as a fallback when SearXNG is
    // offline or returns fewer than SEARXNG_PRIMARY_MIN web results. Default off
    // → unchanged behavior (all providers fire in parallel).
    this.searxngPrimary = !!(config.searxng && config.searxng.primary);
    this.searxngPrimaryMin = (config.searxng && config.searxng.primaryMin) || 5;

    // Anonymous "proxied page view" (Startpage-style). When the SearXNG host runs
    // a result proxy (Morty / SearXNG `result_proxy`), the JSON API still returns
    // raw URLs — proxification only happens in SearXNG's HTML template. So we
    // replicate SearXNG's own `proxify()` here to attach a signed proxy link to
    // each result. Off unless both URL + key are set → no behavior change.
    this.resultProxyUrl = config.searxng && config.searxng.resultProxyUrl;
    // settings.yml stores result_proxy.key as `!!binary "<base64>"` (raw bytes),
    // so decode the same base64 string back to bytes for the HMAC.
    this.resultProxyKey = config.searxng && config.searxng.resultProxyKey
      ? Buffer.from(config.searxng.resultProxyKey, 'base64')
      : null;

    // Rate limiting configuration
    this.rateLimits = {
      google: 100, // requests per minute
      bing: 1000, // requests per minute
      news: 500, // requests per day
      youtube: 100, // requests per minute
    };

    this.requestTimestamps = {
      google: [],
      bing: [],
      news: [],
      youtube: [],
    };

    // Memoize AI acronym expansions (and negative "no expansion" results) so a
    // repeated unknown-acronym query never re-hits the AI provider.
    this._acronymCache = new Map();
  }

  /**
   * Perform search across multiple sources.
   * mode: 'blue-pill' | 'red-pill' | 'purple' | 'ocean'
   */
  async performSearch(query, filters, mode = 'blue-pill') {
    try {
      console.log('🔍 SearchService.performSearch called with:', { query, filters, mode });

      // Ocean mode: OSINT-only pipeline — no web search
      if (mode === 'ocean') {
        return this.performOsintSearch(query, filters);
      }

      const isRedPill = mode === 'red-pill';
      const isPurple = mode === 'purple';
      // Green: same retrieval as blue-pill, but AI-generated-content domains are
      // filtered out of the final results (Green mode promises 0 AI results).
      const isGreen = mode === 'green';

      // Site-keyword shortcuts: on the standard web modes, a leading/trailing
      // keyword like "… yt" or "git …" is stripped from the query and its site
      // is boosted to the top of the results (see boostDomain use below).
      let boostDomain = null;
      if (mode === 'blue-pill' || isGreen) {
        const sk = QueryInterpreter.detectSiteKeyword(query);
        if (sk) {
          boostDomain = sk.domain;
          query = sk.cleanedQuery;
          console.log(`🔗 Site-keyword "${sk.keyword}" → boosting ${boostDomain}, query now "${query}"`);
        }
      }

      const searchPromises = [];
      // Results that are fetched + formatted synchronously (SearXNG-primary mode)
      // rather than via the searchPromises/Promise.allSettled batch below.
      const preformattedResults = [];

      // Promises pushed here are only consumed by Promise.allSettled further
      // down — but there are `await`s between push and allSettled (the
      // SearXNG-primary call). A rejection landing inside that gap has no
      // handler attached yet, which Node treats as an unhandled rejection and
      // kills the process. Attach a no-op catch BRANCH (not a replacement) so
      // the rejection is always observed; allSettled still records 'rejected'.
      const deferSettle = (p) => { p.catch(() => {}); return p; };

      const searchWeb = filters.category === 'all' || filters.category === 'web';
      const searchNews = filters.category === 'all' || filters.category === 'news' || isRedPill;
      const searchVideos = filters.category === 'all' || filters.category === 'videos';
      const searchImages = filters.category === 'images';
      const searchSocial = filters.category === 'social';

      if (searchImages) {
        // SearXNG images: free, self-hosted, aggregates Bing Images / Google Images /
        // Unsplash / Flickr / etc. — always try first, no API key needed.
        if (this.searxngUrl) {
          searchPromises.push(deferSettle(this.performSearXNGCategorySearch(query, 'images', filters)));
        }
        const hasGoogleImages = !!(this.googleApiKey && this.googleSearchEngineId);
        const hasBraveImages = !!this.braveApiKey;
        if (hasGoogleImages) {
          searchPromises.push(this.performGoogleImageSearch(query, filters));
        }
        if (hasBraveImages) {
          searchPromises.push(this.performBraveImageSearch(query, filters));
        }
        // Unsplash is generic stock photography — only last resort with no other source.
        if (!hasGoogleImages && !hasBraveImages && !this.searxngUrl && this.unsplashAccessKey) {
          searchPromises.push(this.performUnsplashSearch(query, filters));
        }
      }

      if (searchSocial) {
        // SearXNG social media: aggregates Reddit, Twitter/X, HN, etc. — free, no key.
        if (this.searxngUrl) {
          searchPromises.push(deferSettle(this.performSearXNGCategorySearch(query, 'social media', filters)));
        }
        if (this.googleApiKey && this.googleSearchEngineId) {
          searchPromises.push(this.performGoogleSearch(
            `${query} site:reddit.com OR site:twitter.com OR site:facebook.com`,
            { ...filters, perPage: 10 }
          ));
        }
      }

      // SearXNG videos: free alternative/supplement to the YouTube Data API
      if (searchVideos && this.searxngUrl) {
        searchPromises.push(deferSettle(this.performSearXNGCategorySearch(query, 'videos', filters)));
      }

      if (searchWeb) {
        // SearXNG-primary mode (opt-in): query the self-hosted metasearch first
        // and skip the paid API providers when it returns enough results. Not
        // used for red-pill, which depends on Brave's alternative-media querying.
        let searxngServed = false;
        if (this.searxngPrimary && this.searxngUrl && !isRedPill) {
          try {
            const sx = await this.performSearXNGSearch(query, filters);
            const sxResults = this.formatSearXNGResults(sx);
            if (sxResults.length >= this.searxngPrimaryMin) {
              preformattedResults.push(...sxResults);
              searxngServed = true;
              console.log(`🔎 SearXNG-primary served ${sxResults.length} web results`);
            } else {
              console.log(`🔎 SearXNG-primary thin (${sxResults.length} < ${this.searxngPrimaryMin}) — falling back to API providers`);
            }
          } catch {
            // Offline/error — fall through to the API providers below.
          }
        }

        if (!searxngServed) {
          if (this.googleApiKey && this.googleSearchEngineId) {
            searchPromises.push(this.performGoogleSearch(query, filters));
          }
          if (this.bingApiKey) {
            searchPromises.push(this.performBingSearch(query, filters));
          }
          // Parallel-mode SearXNG (skipped above only when it ran as primary).
          if (this.searxngUrl && !this.searxngPrimary) {
            searchPromises.push(this.performSearXNGSearch(query, filters));
          }
          if (this.braveApiKey) {
            searchPromises.push(this.performBraveSearch(query, filters));

            if (isRedPill) {
              // Red pill: use Brave (whole-web index) with alternative-media query terms
              // Brave indexes rumble/substack/odysee — Google CSE typically does not
              searchPromises.push(this.performBraveSearch(
                `${query} site:substack.com OR site:rumble.com OR site:odysee.com OR site:zerohedge.com OR site:rt.com OR site:corbettreport.com`,
                { ...filters, perPage: 10 }
              ));
              searchPromises.push(this.performBraveSearch(
                `${query} censored suppressed alternative independent whistleblower`,
                { ...filters, perPage: 10 }
              ));
            }
          } else if (isRedPill && this.googleApiKey && this.googleSearchEngineId) {
            // Brave not available — fall back to Google for alternative terms
            searchPromises.push(this.performGoogleSearch(
              `${query} "censored" OR "suppressed" OR "alternative view" OR "independent analysis"`,
              { ...filters, perPage: 5 }
            ));
            searchPromises.push(this.performGoogleSearch(
              `${query} site:theintercept.com OR site:thegrayzone.com OR site:mintpressnews.com OR site:corbettreport.com`,
              { ...filters, perPage: 5 }
            ));
          }
        }
      }

      // Site-keyword shortcut: run one site-scoped query so target-site results
      // are guaranteed present to boost to the top, even if the open web search
      // wouldn't have surfaced them. Uses whichever web provider is configured.
      if (searchWeb && boostDomain) {
        const scoped = `${query} site:${boostDomain}`;
        if (this.braveApiKey) {
          searchPromises.push(this.performBraveSearch(scoped, { ...filters, perPage: 8 }));
        } else if (this.googleApiKey && this.googleSearchEngineId) {
          searchPromises.push(this.performGoogleSearch(scoped, { ...filters, perPage: 8 }));
        }
      }

      // Acronym expansion: on the standard web modes, run a supplemental search
      // for the expanded form so the authoritative entity surfaces (typing "dea"
      // should find the DEA). Curated dictionary is synchronous; the AI fallback
      // only fires for a bare uppercase unknown acronym and is timeout-bounded.
      if (searchWeb && (mode === 'blue-pill' || isGreen)) {
        let expanded = null;
        const acr = QueryInterpreter.detectAcronym(query);
        if (acr) {
          expanded = QueryInterpreter.buildExpandedQuery(query, acr);
        } else {
          const unknown = QueryInterpreter.looksLikeUnknownAcronym(query);
          if (unknown) {
            const aiExpansion = await this.aiExpandAcronym(unknown);
            if (aiExpansion) {
              expanded = QueryInterpreter.buildExpandedQuery(query, { token: unknown, expansion: aiExpansion });
            }
          }
        }
        if (expanded && expanded.toLowerCase() !== query.toLowerCase()) {
          console.log(`🔤 Acronym expansion: "${query}" → supplemental "${expanded}"`);
          if (this.braveApiKey) {
            searchPromises.push(this.performBraveSearch(expanded, { ...filters, perPage: 8 }));
          } else if (this.googleApiKey && this.googleSearchEngineId) {
            searchPromises.push(this.performGoogleSearch(expanded, { ...filters, perPage: 8 }));
          }
        }
      }

      if (searchNews) {
        if (this.newsApiKey) {
          searchPromises.push(this.performNewsSearch(query, filters));
        }
      }

      if (searchVideos) {
        if (this.youtubeApiKey) {
          searchPromises.push(this.performYoutubeSearch(query, filters));
          if (isRedPill) {
            searchPromises.push(this.performYoutubeSearch(
              `${query} independent documentary whistleblower`,
              { ...filters, perPage: 5 }
            ));
          }
        }
        // Resilient video fallback for the dedicated Videos tab only
        // (category === 'videos', not 'all'). The YouTube Data API on this project
        // is frequently 403/quota-limited, which silently left the Videos tab
        // empty (searchWeb is false for a non-web category, so nothing else ran).
        // Pull videos via Brave constrained to YouTube; youtube.com links
        // categorize as 'videos' downstream. Scoped to the Videos tab so the mixed
        // 'all' feed isn't flooded with 20 youtube links and we don't add a Brave
        // call to every all-search.
        if (filters.category === 'videos') {
          if (this.braveApiKey) {
            searchPromises.push(this.performBraveSearch(`${query} site:youtube.com`, { ...filters, perPage: 20 }));
          } else if (this.googleApiKey && this.googleSearchEngineId) {
            searchPromises.push(this.performGoogleSearch(`${query} site:youtube.com`, { ...filters, perPage: 20 }));
          }
        }
      }

      console.log(`📦 Total search promises: ${searchPromises.length}`);

      const results = await Promise.allSettled(searchPromises);
      let combinedResults = this.combineResults(results);

      // Merge SearXNG-primary results (fetched outside the promise batch), de-duped by URL.
      if (preformattedResults.length) {
        const seen = new Set(combinedResults.map((r) => r.url));
        combinedResults = [
          ...combinedResults,
          ...preformattedResults.filter((r) => r.url && !seen.has(r.url)),
        ];
      }
      console.log(`🔗 Combined results: ${combinedResults.length}`);

      // ── THE ONE PAID FALLBACK, AND WHAT IT COSTS ────────────────────────
      //
      // This fired on `webResultCount < 5`, which sounds conservative and is
      // not: SearXNG is a self-hosted metasearch on a small box, and "fewer
      // than five results" describes most of a cold afternoon. Every one of
      // those was a billable SerpApi call, uncapped and unlogged, which is why
      // the first anyone heard of it was the vendor's exhaustion email.
      //
      // Two changes. It now fires only when the free providers returned
      // NOTHING — thin results are still results, and paying to pad them is
      // not worth real money — and it must claim a slot from the daily budget,
      // which is zero unless SERP_DAILY_LIMIT says otherwise.
      const webResultCount = combinedResults.filter(r => r.category === 'web').length;
      if (searchWeb && webResultCount === 0 && this.serpApiKey) {
        const budget = paidBudget.claim('serpapi', this.serpDailyLimit);
        if (!budget.ok) {
          console.log(`⚡ SerpAPI fallback SKIPPED — ${budget.reason}`);
        } else {
        console.log(`⚡ SerpAPI fallback triggered (0 web results, ${budget.used}/${budget.limit} today)`);
        try {
          const serpData = await this.performSerpSearch(query, filters);
          const serpResults = this.formatSerpResults(serpData);
          const existingUrls = new Set(combinedResults.map(r => r.url));
          const newResults = serpResults.filter(r => !existingUrls.has(r.url));
          combinedResults = [...combinedResults, ...newResults];
          console.log(`⚡ SerpAPI added ${newResults.length} results`);
        } catch (err) {
          console.error('SerpAPI fallback error:', err.message);
        }
        }
      }

      // Quoted-phrase broadening. A query like '"grown shit" mac dre' makes the
      // web providers (Brave/Google) do strict exact-phrase matching, which can
      // return very few results and starve the category tabs — especially Videos,
      // which are just youtube.com links surfaced by the web providers (the
      // dedicated YouTube API is not configured). When a quoted query comes back
      // thin, re-run the de-quoted variant and merge in anything new. Exact-match
      // results were fetched first and still rank highest via relevance scoring.
      if (/["']/.test(query) && combinedResults.length < 12) {
        const broadened = query.replace(/["']/g, ' ').replace(/\s+/g, ' ').trim();
        if (broadened && broadened !== query) {
          console.log(`🔁 Thin quoted-query result (${combinedResults.length}) — broadening to "${broadened}"`);
          const broadenPromises = [];
          if (this.braveApiKey) broadenPromises.push(this.performBraveSearch(broadened, filters));
          if (this.googleApiKey && this.googleSearchEngineId) broadenPromises.push(this.performGoogleSearch(broadened, filters));
          if (this.youtubeApiKey) broadenPromises.push(this.performYoutubeSearch(broadened, filters));
          if (broadenPromises.length) {
            try {
              const broadenResults = this.combineResults(await Promise.allSettled(broadenPromises));
              const seen = new Set(combinedResults.map((r) => r.url));
              const extra = broadenResults.filter((r) => r.url && !seen.has(r.url));
              combinedResults = [...combinedResults, ...extra];
              console.log(`🔁 Broaden merged ${extra.length} extra results (total ${combinedResults.length})`);
            } catch (broadenErr) {
              console.error('Quoted-query broaden failed:', broadenErr.message);
            }
          }
        }
      }

      // Anonymous view: extend proxied page views to the fallback providers
      // (SearXNG results already carry proxyUrl from format time).
      combinedResults = this.attachProxyUrls(combinedResults);

      let categorizedResults = this.categorizeByBias(combinedResults);
      console.log(`🏷️  Categorized results: ${categorizedResults.length}`);

      const perspectives = Array.isArray(filters.perspectives) ? filters.perspectives.filter(Boolean) : [];

      // Purple mode: strict perspective filter — ONLY results matching the
      // selected perspective(s), strictly date-ranked. No padding with
      // unrelated "neutral" results — if the filter is sparse, it stays sparse.
      if (isPurple && perspectives.length > 0) {
        const mapped = this.mapPerspectivesToBias(perspectives);
        const filtered = categorizedResults.filter(r => mapped.includes(r.bias));
        console.log(`🟣 Purple strict filter: ${filtered.length} results for perspectives [${perspectives.join(',')}]`);

        // Undated rows sort LAST on a date sort in either direction. They are
        // not old and they are not new; putting them at one end because
        // `new Date(null)` happens to be 1970 would be an accident, not a
        // decision.
        return [...filtered].sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          const diff = new Date(b.date) - new Date(a.date);
          return filters.order === 'asc' ? -diff : diff;
        });
      }

      // Red-pill LENS RERUN — the Rabbit Hole fold that replaced the
      // Perspectives page. Same perspective ids, but this is a narrowing of a
      // rabbit-hole search rather than a different mode, so it keeps red-pill's
      // own ranking (alternative/independent sources boosted) instead of
      // purple's pure date sort.
      //
      // 'neutral' is excluded deliberately: on the fold it is the default
      // selection, i.e. "no lens", and treating it as a filter would quietly
      // strip every labelled source from an ordinary red-pill search.
      //
      // If the lens empties the set entirely, the unfiltered results stand. The
      // fold already tells the user how many results read that way — zero of
      // twenty is information; an empty page after pressing "search again" is
      // just a dead end at the exact moment they asked for more.
      if (isRedPill && perspectives.some((p) => p !== 'neutral')) {
        const mapped = this.mapPerspectivesToBias(perspectives.filter((p) => p !== 'neutral'));
        const filtered = categorizedResults.filter(r => mapped.includes(r.bias));
        console.log(`🔴 Red lens rerun: ${filtered.length}/${categorizedResults.length} for [${perspectives.join(',')}] → ${mapped.join(',')}`);
        if (filtered.length > 0) categorizedResults = filtered;
      }

      let finalResults = this.sortAndFilter(categorizedResults, filters);

      // Default ranking: combined relevance + recency + source diversity, so
      // switching category/filters with the same query always re-ranks. Skipped
      // when the user explicitly asked for a pure date sort (sortAndFilter already
      // handled that above). Red-pill blends in a bias-tier weight so alternative/
      // independent sources rank above mainstream ones, instead of a crude tier sort.
      if (filters.sortBy !== 'date') {
        finalResults = this.rankResults(query, finalResults, { boostAlternative: isRedPill });
      }

      // Green mode: strip results from known AI-generated-content domains.
      if (isGreen) {
        const before = finalResults.length;
        finalResults = finalResults.filter((r) => !this.isAiContentDomain(r.url || r.domain));
        console.log(`🟢 Green AI-filter: removed ${before - finalResults.length} AI-content result(s)`);
      }

      // Site-keyword shortcut: pull results from the target site to the top,
      // keeping everything else below (Google-style boost, not a full redirect).
      if (boostDomain && searchWeb) {
        finalResults = this.boostDomainToTop(finalResults, boostDomain);
      }

      // Self-brand recognition: on the standard web modes, pin Truegle's own
      // site at #1 for brand queries so searching "truegle" (or a misspelling)
      // surfaces us first instead of third-party mentions further down.
      if ((mode === 'blue-pill' || isGreen) && searchWeb) {
        finalResults = this.pinOfficialResult(query, finalResults);
      }

      console.log(`✨ Final results: ${finalResults.length}`);
      return finalResults;
    } catch (error) {
      console.error('SearchService error:', error);
      throw new Error('Search service unavailable');
    }
  }

  /**
   * Map purple-mode UI perspective IDs to internal bias tiers
   */
  mapPerspectivesToBias(perspectives) {
    const map = {
      conservative: 'right',
      libertarian: 'right',
      liberal: 'left',
      progressive: 'left',
      centrist: 'center',
      bipartisan: 'center',
      religious: 'right',
      secular: 'center',
      scientific: 'unbiased',
      skeptical: 'unbiased',
      mainstream: 'mainstream',
      alternative: 'alternative',
      conspiracy: 'conspiracy',
      independent: 'independent',
      neutral: 'neutral',
      // faith/societal catch-alls
      spiritual: 'alternative',
      new_world: 'conspiracy',
      old_world: 'alternative',
      universal: 'center',
      atheist: 'unbiased',
      government: 'mainstream',
      community: 'neutral',
      traditional: 'right',
      // economic
      local_economy: 'alternative',
      global_economics: 'mainstream',
      investors: 'center',
      consumers: 'neutral',
      small_business: 'alternative',
      corporate: 'mainstream',
    };
    // 'neutral' expands to include 'unknown'. Unlisted sources used to BE
    // 'neutral', so a purple search for a neutral perspective matched them; now
    // that the two are distinguished, the filter has to name both or it would
    // silently return only the handful of explicitly-assessed neutral sites.
    const EXPAND = { neutral: ['neutral', 'unknown', 'platform'] };
    const biases = [...new Set(
      perspectives.flatMap((p) => {
        const bias = map[p] || 'neutral';
        return EXPAND[bias] || [bias];
      }),
    )];
    return biases;
  }

  /**
   * TF-based relevance score (0-1): term frequency in title+snippet, with a
   * boost for an exact phrase match and for query terms appearing in the title.
   */
  calculateRelevance(query, result) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return 0;

    const queryTerms = q.replace(/[^\w\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2);
    if (queryTerms.length === 0) return 0;

    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const docText = `${title} ${snippet}`;
    const docTerms = docText.replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (docTerms.length === 0) return 0;

    let matchScore = 0;
    queryTerms.forEach((term) => {
      const count = docTerms.filter((t) => t === term || t.includes(term)).length;
      matchScore += count / docTerms.length;
    });

    let score = Math.min(matchScore / queryTerms.length, 1);
    if (docText.includes(q)) score = Math.min(score + 0.2, 1);
    if (queryTerms.some((term) => title.includes(term))) score = Math.min(score + 0.15, 1);
    return score;
  }

  /**
   * Recency score (0-1): newer results score higher, decaying over roughly a year.
   *
   * UNDATED MEANS UNDATED. Every normaliser above used to stamp
   * `new Date().toISOString()` on a result whose provider gave no publish date
   * — SearXNG does this for most rows — so "we don't know when" arrived here
   * indistinguishable from "published in the last hour" and scored 1 instead
   * of the 0.3 this function has always had waiting for it. Undated results
   * were therefore ranked as the freshest thing on the page, and the Tube
   * results could not show a date at all without printing today's date over a
   * video from 2019.
   */
  calculateRecency(dateStr, isTimeSensitive = false) {
    // FRESHNESS ONLY COUNTS WHEN FRESHNESS WAS ASKED FOR, and an unknown date
    // is not a black mark.
    //
    // REPORTED: "how do tides work" returned a games-industry redundancy story
    // and a Bitcoin piece above the actual answer. Both are the same bug. This
    // used to score every result on age no matter what the question was, and
    // gave an undated result 0.3 — a PENALTY — while a news item with a real
    // timestamp got 0.75 or better. SearXNG's web results mostly carry no date;
    // the news providers always do. So on a question with nothing time-sensitive
    // about it, the news won on freshness nobody had asked for.
    //
    // (That got worse, not better, when result dates stopped being fabricated.
    // Undated results used to be stamped with `new Date()` and scored 1.0, which
    // made recency a no-op differentiator. Telling the truth about a missing
    // date exposed the weighting underneath it.)
    //
    // 0.5 is deliberately the MIDDLE of the scale rather than zero: unknown
    // should neither help nor hurt.
    if (!isTimeSensitive) return 0.5;
    if (!dateStr) return 0.5;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 0.5;
    const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 1) return 1;
    if (daysDiff < 7) return 0.9;
    if (daysDiff < 30) return 0.75;
    if (daysDiff < 90) return 0.6;
    if (daysDiff < 365) return 0.4;
    return 0.2;
  }

  /**
   * Does this question actually want something recent?
   *
   * Same list PrivateSearchService has used all along — kept in step rather than
   * invented again, because two services disagreeing about what "latest" means
   * is how one of them ends up ranking differently from the other for no reason
   * anybody can see.
   */
  isTimeSensitiveQuery(query) {
    const q = String(query || '').toLowerCase();
    if (!q) return false;
    const now = new Date().getFullYear();
    const years = [now - 1, now, now + 1].map(String);
    return [
      'news', 'latest', 'today', 'recent', 'current', 'now', 'breaking',
      'update', 'tonight', 'this week', 'this year', 'live', 'score',
      ...years,
    ].some((term) => q.includes(term));
  }

  /**
   * Diversity score (0-1): penalizes repeat results from the same domain so one
   * site can't dominate a results page.
   */
  calculateDiversity(domain, domainCounts) {
    const count = domainCounts.get(domain) || 0;
    if (count === 0) return 1;
    return Math.max(Math.pow(0.5, count), 0.1);
  }

  /**
   * Bias-tier weight (0-1) used only in red-pill mode to favor alternative/
   * independent sources over mainstream ones without a crude tier-only sort.
   */
  biasTierWeight(bias) {
    const weights = {
      conspiracy: 1,
      alternative: 0.9,
      independent: 0.8,
      // 'unknown' means "not in the curated lists" — which, on balance, means a
      // site that is not one of the corporate outlets we bothered to name. In a
      // mode whose whole request is "show me something other than the usual
      // suspects", that deserves to sit above assessed-centrist and well above
      // mainstream. It must ALSO differ from the default fallback: when every
      // result scored the same 0.5, this whole term became a constant and the
      // re-rank could not reorder anything.
      unknown: 0.65,
      neutral: 0.5,
      platform: 0.5,
      center: 0.45,
      unbiased: 0.4,
      left: 0.35,
      right: 0.35,
      mainstream: 0.1,
    };
    return weights[bias] !== undefined ? weights[bias] : 0.65;
  }

  /**
   * Detect if a query is navigational — a short brand/service name lookup
   * where the user wants the official website, not editorial commentary about it.
   */
  isNavigationalQuery(query) {
    const q = (query || '').trim();
    const words = q.split(/\s+/);
    if (words.length > 3) return false;
    // Exclude informational question patterns
    if (/^(what|how|why|when|who|where|is|are|was|were|will|can|does|do|did|define|explain)\b/i.test(q)) return false;
    return true;
  }

  /**
   * Score how "official" a result URL is for a navigational query.
   * High score = the official/homepage result (e.g. aws.amazon.com for "aws").
   * Social media profile pages and deeply nested paths score near zero.
   */
  calculateNavigationalScore(query, result) {
    // Shared scorer — same logic the instant-answer navigational card uses,
    // so ranking and the "Official site" pick can never disagree.
    return QueryInterpreter.scoreNavigationalMatch(query, result.url);
  }

  /**
   * Rank results by combined relevance + recency + source diversity — the
   * default "most relevant / most recent first" ranking. In red-pill mode,
   * `boostAlternative` blends in a bias-tier weight so alternative/independent
   * sources rank above mainstream ones.
   *
   * Navigational queries (short brand-name lookups like "AWS", "cloudflare")
   * get a strong navigational-score component so the official homepage always
   * surfaces at the top instead of social-media profiles or job boards.
   */
  rankResults(query, results, { boostAlternative = false } = {}) {
    if (!results || results.length === 0) return [];

    const isNavigational = this.isNavigationalQuery(query);
    const isTimeSensitive = this.isTimeSensitiveQuery(query);

    // TWO PASSES, AND THE SECOND ONE IS THE POINT.
    //
    // calculateDiversity gives the FIRST result from a domain 1.0 and halves it
    // for each one after — which is right, but "first" was whatever order the
    // providers happened to answer in. News results arrive as a block, each on
    // its own domain, so every one of them scored a perfect 1.0 while genuinely
    // good results further down were marked as duplicates of a domain they were
    // simply later than. That is not diversity; it is a prize for being early.
    //
    // Ordering by relevance before applying it means "first from a domain" is
    // the BEST from that domain, which is what the penalty was always meant to
    // express.
    const base = results.map((result) => ({
      result,
      domain: result.domain || this.extractDomain(result.url || ''),
      relevanceScore: this.calculateRelevance(query, result),
      recencyScore: this.calculateRecency(result.date, isTimeSensitive),
    }));
    base.sort((a, b) => b.relevanceScore - a.relevanceScore);

    const domainCounts = new Map();
    const scored = base.map(({ result, domain, relevanceScore, recencyScore }) => {
      const diversityScore = this.calculateDiversity(domain, domainCounts);
      domainCounts.set(domain, (domainCounts.get(domain) || 0) + 1);

      // RELEVANCE IS THE MAJORITY OF THE SCORE, which it was not: at 0.5 against
      // recency's 0.35 and diversity's 0.15, the two supporting signals together
      // outweighed the one that answers the question. A result matching 0.16 of
      // the query beat one matching 0.60 of it, which is the reported bug
      // exactly.
      //
      // Recency's weight only bites on a time-sensitive question now — on any
      // other, calculateRecency returns the same 0.5 for everything, so the term
      // is a constant and cannot reorder anything.
      let finalScore = relevanceScore * 0.6 + recencyScore * 0.25 + diversityScore * 0.15;

      if (isNavigational) {
        const navScore = this.calculateNavigationalScore(query, result);
        // Navigational queries: nav score dominates (70 %), quality signals fill the rest
        finalScore = finalScore * 0.3 + navScore * 0.7;
      }

      if (boostAlternative) {
        finalScore = finalScore * 0.6 + this.biasTierWeight(result.bias) * 0.4;
      }

      return { ...result, relevanceScore, recencyScore, diversityScore, finalScore };
    });

    scored.sort((a, b) => b.finalScore - a.finalScore);
    return scored;
  }

  /**
   * Self-brand recognition. When the query is a Truegle brand/misspelling query,
   * ensure the official truegle.info result sits at position 0: de-dupe any
   * truegle.info entry the providers already returned, then prepend the
   * canonical result. Non-brand queries pass through untouched.
   */
  pinOfficialResult(query, results) {
    if (!QueryInterpreter.isBrandQuery(query)) return results;

    const official = QueryInterpreter.buildOfficialResult();
    const deduped = (results || []).filter((r) => {
      const domain = (r.domain || this.extractDomain(r.url || '')).toLowerCase();
      return domain !== official.domain;
    });
    return [official, ...deduped];
  }

  /**
   * Stable-partition results so those on `domain` (or a subdomain of it) come
   * first while preserving each group's existing relevance order. Powers the
   * site-keyword shortcut's boost-to-top without discarding other results.
   */
  boostDomainToTop(results, domain) {
    if (!domain || !Array.isArray(results)) return results;
    const target = domain.toLowerCase();
    const onSite = [];
    const rest = [];
    for (const r of results) {
      const d = (r.domain || this.extractDomain(r.url || '')).toLowerCase();
      if (d === target || d.endsWith(`.${target}`)) onSite.push(r);
      else rest.push(r);
    }
    return [...onSite, ...rest];
  }

  /**
   * AI fallback for an unknown acronym: ask for the single most common full
   * form, memoized (including negative results). Bounded by a short timeout so a
   * slow/unavailable AI provider never delays search — on any failure it resolves
   * to null and search proceeds with the original query unchanged.
   */
  async aiExpandAcronym(token) {
    const key = token.toLowerCase();
    if (this._acronymCache.has(key)) return this._acronymCache.get(key);

    let expansion = null;
    let timer;
    try {
      const prompt =
        `Expand the acronym "${token}" to its single most common full form ` +
        `(for example "DEA" -> "Drug Enforcement Administration"). If it is not a ` +
        `well-known acronym, reply exactly NONE. Reply with ONLY the expansion or NONE.`;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('acronym-expand-timeout')), 2500);
      });
      const resp = await Promise.race([
        UnifiedAIService.chat(prompt, 'general', { maxTokens: 30, temperature: 0 }),
        timeout,
      ]);
      const text = (resp?.content || resp?.response || '').trim();
      if (text && !/^none$/i.test(text) && text.length <= 80 && /[a-z]/i.test(text)) {
        expansion = text.toLowerCase();
      }
    } catch (error) {
      // Non-fatal: log and fall back to the original query.
      console.warn('Acronym AI expansion failed (non-fatal):', error.message);
    } finally {
      clearTimeout(timer);
    }

    this._acronymCache.set(key, expansion);
    return expansion;
  }

  /**
   * OSINT-only search pipeline for ocean mode.
   * Returns investigation-focused results only (domain intel, social profiles, etc.)
   */
  async performOsintSearch(query, filters) {
    const searchPromises = [];

    // Search for digital footprint: social profiles, domain info, leaked data mentions
    if (this.googleApiKey && this.googleSearchEngineId) {
      searchPromises.push(this.performGoogleSearch(
        `"${query}" site:linkedin.com OR site:twitter.com OR site:facebook.com OR site:instagram.com OR site:github.com`,
        { ...filters, perPage: 10 }
      ));
      searchPromises.push(this.performGoogleSearch(
        `"${query}" whois OR "domain registration" OR "IP address" OR "email leak" OR "data breach"`,
        { ...filters, perPage: 5 }
      ));
      searchPromises.push(this.performGoogleSearch(
        `"${query}" site:pastebin.com OR site:haveibeenpwned.com OR site:dehashed.com OR site:intelx.io`,
        { ...filters, perPage: 5 }
      ));
    }
    if (this.braveApiKey) {
      searchPromises.push(this.performBraveSearch(
        `"${query}" site:linkedin.com OR site:twitter.com OR site:github.com`,
        { ...filters, perPage: 5 }
      ));
    }

    const results = await Promise.allSettled(searchPromises);
    const combined = this.combineResults(results);
    const categorized = this.categorizeByBias(combined);

    // Tag all results as osint category
    return categorized.map(r => ({ ...r, category: 'osint', isOsint: true }));
  }

  /**
   * Perform Google Custom Search
   */
  async performGoogleSearch(query, filters) {
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      throw new Error('Google Search API not configured');
    }

    // Google Custom Search API only allows num 1-10
    const googlePerPage = Math.min(filters.perPage || 10, 10);

    const params = {
      key: this.googleApiKey,
      cx: this.googleSearchEngineId,
      q: query,
      num: googlePerPage,
      start: ((filters.page || 1) - 1) * googlePerPage + 1,
    };

    // Safe search: 'safe' (default) | 'blur' | 'off'
    if (filters.safeSearch === 'off') {
      // no safe param = unrestricted
    } else if (filters.safeSearch === 'blur') {
      params.safe = 'medium';
    } else {
      params.safe = 'active'; // 'safe' or anything else defaults to on
    }

    // Localization: restrict results + interface language to the user's locale
    if (filters.language) {
      params.lr = `lang_${filters.language}`; // restrict to documents in this language
      params.hl = filters.language; // interface/host language
    }
    if (filters.country) {
      params.gl = filters.country.toLowerCase(); // geolocation boost (e.g. 'br')
    }

    try {
      const response = await axios.get(this.googleBaseUrl, { params, timeout: 8000 });
      return response.data;
    } catch (error) {
      console.error(
        'Google Search API error:',
        JSON.stringify(error.response?.data, null, 2) || error.message
      );

      if (error.response?.status === 403) {
        throw new Error('Google API key invalid or quota exceeded');
      }
      if (error.response?.status === 429) {
        throw new Error('Google API rate limit exceeded');
      }
      if (error.response?.status === 400) {
        console.error('Google 400 error - Bad request. Query might be invalid.');
        throw new Error('Google Search bad request');
      }

      throw new Error('Google Search service unavailable');
    }
  }

  /**
   * Perform Google Image Search (real photos via Custom Search, searchType=image).
   * Uses the same Google API key/CSE as web search — no separate key required.
   */
  async performGoogleImageSearch(query, filters) {
    if (!this.googleApiKey || !this.googleSearchEngineId) {
      throw new Error('Google Search API not configured');
    }

    const googlePerPage = Math.min(filters.perPage || 10, 10);
    const params = {
      key: this.googleApiKey,
      cx: this.googleSearchEngineId,
      q: query,
      searchType: 'image',
      num: googlePerPage,
      start: ((filters.page || 1) - 1) * googlePerPage + 1,
    };

    if (filters.safeSearch === 'off') {
      // no safe param = unrestricted
    } else if (filters.safeSearch === 'blur') {
      params.safe = 'medium';
    } else {
      params.safe = 'active';
    }

    if (filters.language) {
      params.lr = `lang_${filters.language}`;
      params.hl = filters.language;
    }
    if (filters.country) {
      params.gl = filters.country.toLowerCase();
    }

    try {
      const response = await axios.get(this.googleBaseUrl, { params, timeout: 8000 });
      return { ...response.data, _source: 'google-images' };
    } catch (error) {
      console.error(
        'Google Image Search API error:',
        JSON.stringify(error.response?.data, null, 2) || error.message
      );
      if (error.response?.status === 403) {
        throw new Error('Google API key invalid or quota exceeded');
      }
      if (error.response?.status === 429) {
        throw new Error('Google API rate limit exceeded');
      }
      throw new Error('Google Image Search service unavailable');
    }
  }

  formatGoogleImageResults(data) {
    if (!data || !data.items) return [];
    return data.items.map((item) => ({
      title: item.title || 'Untitled Image',
      url: item.image?.contextLink || item.link,
      snippet: item.snippet || '',
      source: 'google-images',
      sourceName: 'Google Images',
      date: null,   // Google Images carries no publish date — see UNDATED below
      image: item.link || null,
      thumbnail: item.image?.thumbnailLink || null,
      favicon: null,
      domain: this.extractDomain(item.image?.contextLink || item.link || ''),
      category: 'images',
      verified: true,
    }));
  }

  /**
   * Perform Brave Image Search (real photos). Uses the same Brave API key as
   * web search — no separate key required.
   */
  async performBraveImageSearch(query, filters) {
    if (!this.braveApiKey) {
      throw new Error('Brave Search API not configured');
    }

    const params = {
      q: query,
      count: Math.min(filters.perPage || 20, 50),
      safesearch: filters.safeSearch === 'off' ? 'off' : filters.safeSearch === 'blur' ? 'moderate' : 'strict',
    };
    if (filters.country) params.country = filters.country;
    if (filters.language) params.search_lang = filters.language;

    try {
      const response = await axios.get('https://api.search.brave.com/res/v1/images/search', {
        headers: { 'X-Subscription-Token': this.braveApiKey, Accept: 'application/json' },
        params,
        timeout: 8000,
      });
      return { ...response.data, _source: 'brave-images' };
    } catch (error) {
      console.error('Brave Image Search API error:', error.response?.data || error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Brave API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('Brave API rate limit exceeded');
      }
      throw new Error('Brave Image Search service unavailable');
    }
  }

  formatBraveImageResults(data) {
    if (!data || !data.results) return [];
    return data.results.map((item) => {
      const pageUrl = item.url || item.source || '';
      const imageUrl = item.properties?.url || item.thumbnail?.original || item.thumbnail?.src || null;
      return {
        title: item.title || 'Untitled Image',
        url: pageUrl,
        snippet: item.title || '',
        source: 'brave-images',
        sourceName: 'Brave Images',
        date: item.page_age || item.age || null,
        image: imageUrl,
        thumbnail: item.thumbnail?.src || null,
        favicon: null,
        domain: this.extractDomain(pageUrl),
        category: 'images',
        verified: true,
      };
    });
  }

  /**
   * Perform Bing Web Search
   */
  async performBingSearch(query, filters) {
    if (!this.bingApiKey) {
      throw new Error('Bing Search API not configured');
    }

    const headers = {
      'Ocp-Apim-Subscription-Key': this.bingApiKey,
    };

    const params = {
      q: query,
      count: filters.perPage || 10,
      offset: ((filters.page || 1) - 1) * (filters.perPage || 10),
      mkt: 'en-US',
      safesearch: filters.safeSearch === 'off' ? 'Off' : filters.safeSearch === 'blur' ? 'Moderate' : 'Strict',
    };

    // Add date range filter
    if (filters.dateRange && filters.dateRange !== 'any') {
      params.freshness = this.formatBingDateRange(filters.dateRange);
    }

    try {
      const response = await axios.get(this.bingBaseUrl, { headers, params, timeout: 8000 });
      return response.data;
    } catch (error) {
      console.error(
        'Bing Search API error:',
        error.response?.data || error.message
      );

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Bing API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('Bing API rate limit exceeded');
      }

      throw new Error('Bing Search service unavailable');
    }
  }

  /**
   * Perform Brave Search (whole-web, no domain restrictions)
   */
  async performBraveSearch(query, filters) {
    if (!this.braveApiKey) {
      throw new Error('Brave Search API not configured');
    }

    const params = {
      q: query,
      count: Math.min(filters.perPage || 10, 20),
      offset: ((filters.page || 1) - 1) * (filters.perPage || 10),
      safesearch: filters.safeSearch === 'off' ? 'off' : filters.safeSearch === 'blur' ? 'moderate' : 'strict',
    };

    if (filters.dateRange && filters.dateRange !== 'any') {
      const rangeMap = { day: 'pd', week: 'pw', month: 'pm', year: 'py' };
      if (rangeMap[filters.dateRange]) params.freshness = rangeMap[filters.dateRange];
    }

    // Localization
    if (filters.language) params.search_lang = filters.language;
    if (filters.country) params.country = filters.country;

    try {
      const response = await axios.get(this.braveBaseUrl, {
        headers: { 'X-Subscription-Token': this.braveApiKey, Accept: 'application/json' },
        params,
        timeout: 8000,
      });
      return { ...response.data, _source: 'brave' };
    } catch (error) {
      console.error('Brave Search API error:', error.response?.data || error.message);
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new Error('Brave API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('Brave API rate limit exceeded');
      }
      throw new Error('Brave Search service unavailable');
    }
  }

  /**
   * Perform SearXNG metasearch (self-hosted, aggregates Google/Bing/DDG/Brave/etc.)
   */
  /**
   * Build a signed anonymous-view proxy URL for a result, mirroring SearXNG's
   * own `proxify()` (Morty contract: `?mortyurl=<url>&mortyhash=<hmac>`).
   * Returns null when the result proxy isn't configured so callers can omit it.
   * @param {string} targetUrl  The destination URL to proxy.
   * @returns {string|null}
   */
  buildResultProxyUrl(targetUrl) {
    if (!this.resultProxyUrl || !targetUrl) return null;
    // Mirror SearXNG: protocol-relative URLs are normalized to https.
    const url = targetUrl.startsWith('//') ? `https:${targetUrl}` : targetUrl;
    const params = new URLSearchParams({ mortyurl: url });
    if (this.resultProxyKey) {
      const mortyhash = crypto
        .createHmac('sha256', this.resultProxyKey)
        .update(url)
        .digest('hex');
      params.set('mortyhash', mortyhash);
    }
    const sep = this.resultProxyUrl.includes('?') ? '&' : '?';
    return `${this.resultProxyUrl}${sep}${params.toString()}`;
  }

  /**
   * Attach an anonymous-view `proxyUrl` to every result that doesn't already
   * have one (SearXNG results get theirs at format time). This extends anonymous
   * view to the fallback providers (Brave/Google/Bing/News/SerpAPI). No-op when
   * the result proxy isn't configured, and skips image results (their page URL
   * isn't what the user views).
   * @param {Array} results
   * @returns {Array} the same array, mutated in place
   */
  attachProxyUrls(results) {
    if (!this.resultProxyUrl || !Array.isArray(results)) return results;
    for (const r of results) {
      if (!r.proxyUrl && r.category !== 'images' && r.url && /^https?:\/\//i.test(r.url)) {
        r.proxyUrl = this.buildResultProxyUrl(r.url);
      }
    }
    return results;
  }

  /**
   * The user's safe-search choice, in the numbers SearXNG speaks.
   *
   * REPORTED: with Safe Search turned OFF, adult sites were still being
   * filtered out — against the whole premise of the product. This is why.
   * SearXNG is the PRIMARY provider, and neither of the two functions that
   * query it sent a `safesearch` parameter at all. Every other provider was
   * wired up (Brave, Google, Bing, SerpAPI, Unsplash all map it); the one that
   * actually answers most searches was left to apply whatever default sits in
   * its own settings.yml, and the visitor's choice reached it never.
   *
   * SearXNG's scale is 0 none / 1 moderate / 2 strict.
   *
   * NOTE THE OTHER HALF: this sends the request. The instance can still
   * override it — if settings.yml pins `safe_search: 2`, the box enforces
   * strict no matter what we ask for. Both ends have to agree.
   */
  searxngSafeSearch(filters) {
    if (filters.safeSearch === 'off') return 0;
    if (filters.safeSearch === 'blur') return 1;
    return 2;
  }

  async performSearXNGSearch(query, filters) {
    if (!this.searxngUrl) {
      throw new Error('SearXNG not configured');
    }

    const params = {
      q: query,
      format: 'json',
      pageno: filters.page || 1,
      safesearch: this.searxngSafeSearch(filters),
    };

    try {
      const response = await axios.get(`${this.searxngUrl}/search`, {
        params,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'TruegleSearch/1.0',
        },
        // Short timeout on purpose: SearXNG is self-hosted and may be offline.
        // It must never add latency or risk the serverless function timeout —
        // the API providers (Brave/Google/News/YouTube) cover search regardless.
        timeout: 4500,
      });
      return { ...response.data, _source: 'searxng' };
    } catch (error) {
      // Expected and non-fatal when the self-hosted SearXNG host is offline.
      // Search still succeeds via the API providers, so warn (don't error).
      console.warn('SearXNG unavailable (non-fatal, API providers cover search):', error.response?.status || error.code || error.message);
      throw new Error('SearXNG unavailable');
    }
  }

  formatSearXNGResults(data) {
    if (!data || !data.results) return [];

    return data.results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.content || '',
      source: 'searxng',
      // Show the aggregated engine so users know the provenance, but make clear
      // it came through Truegle's self-hosted metasearch (no direct tracking).
      sourceName: item.engine ? `${item.engine} · via Truegle` : 'Truegle Metasearch',
      date: item.publishedDate || null,
      image: item.img_src || null,
      favicon: null,
      domain: this.extractDomain(item.url),
      category: 'web',
      verified: true,
      proxyUrl: this.buildResultProxyUrl(item.url),
    }));
  }

  /**
   * SearXNG category search — passes the `categories` param so the instance
   * routes to the right engines (images / videos / social media / news).
   * @param {string} searxCategory  SearXNG category string, e.g. 'images', 'videos', 'social media'
   */
  async performSearXNGCategorySearch(query, searxCategory, filters) {
    if (!this.searxngUrl) throw new Error('SearXNG not configured');

    const params = {
      q: query,
      format: 'json',
      categories: searxCategory,
      pageno: filters.page || 1,
      safesearch: this.searxngSafeSearch(filters),
    };

    try {
      const response = await axios.get(`${this.searxngUrl}/search`, {
        params,
        headers: {
          'ngrok-skip-browser-warning': 'true',
          'User-Agent': 'TruegleSearch/1.0',
        },
        timeout: 5000,
      });
      return { ...response.data, _source: `searxng-${searxCategory.replace(' ', '-')}` };
    } catch (error) {
      console.warn(`SearXNG ${searxCategory} unavailable:`, error.response?.status || error.code || error.message);
      throw new Error(`SearXNG ${searxCategory} unavailable`);
    }
  }

  /**
   * Format SearXNG category results into the unified result shape.
   * SearXNG returns different fields per category:
   *   images  → img_src, thumbnail_src, source (domain), resolution
   *   videos  → iframe_src, thumbnail, length, publishedDate
   *   social  → same as web but engines are reddit/twitter/HN/etc.
   */
  formatSearXNGCategoryResults(data, searxCategory) {
    if (!data || !data.results) return [];

    return data.results
      .filter((item) => item.url)
      .map((item) => {
        const base = {
          title: item.title || item.url,
          url: item.url,
          snippet: item.content || '',
          source: 'searxng',
          sourceName: item.engine ? `${item.engine} · via Truegle` : 'Truegle Metasearch',
          date: item.publishedDate || null,
          favicon: null,
          domain: this.extractDomain(item.url),
          verified: true,
          proxyUrl: this.buildResultProxyUrl(item.url),
        };

        if (searxCategory === 'images') {
          return {
            ...base,
            image: item.img_src || item.thumbnail_src || null,
            thumbnail: item.thumbnail_src || item.img_src || null,
            resolution: item.resolution || null,
            photographer: item.source || null,
            category: 'images',
          };
        }

        if (searxCategory === 'videos') {
          // Extract YouTube video ID if present so the frontend can build a thumbnail
          let videoId = null;
          try {
            const u = new URL(item.url);
            if (u.hostname.includes('youtube.com')) videoId = u.searchParams.get('v');
            else if (u.hostname === 'youtu.be') videoId = u.pathname.slice(1);
          } catch { /* ignore */ }

          return {
            ...base,
            image: videoId
              ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
              : (item.thumbnail || null),
            thumbnail: item.thumbnail || null,
            iframeSrc: item.iframe_src || null,
            duration: item.length || null,
            videoId,
            category: 'videos',
          };
        }

        // social media — tag with platform name from engine field
        return {
          ...base,
          image: item.img_src || null,
          category: 'social',
        };
      });
  }

  formatBraveResults(data) {
    if (!data || !data.web || !data.web.results) return [];

    return data.web.results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.description || '',
      source: 'brave',
      sourceName: 'Brave Search',
      date: item.page_age || null,
      image: item.thumbnail?.src || null,
      favicon: item.profile?.img || null,
      domain: this.extractDomain(item.url),
      category: 'web',
      verified: true,
    }));
  }

  /**
   * Perform SerpAPI search (whole-web Google results, used as fallback only)
   */
  async performSerpSearch(query, filters) {
    if (!this.serpApiKey) {
      throw new Error('SerpAPI not configured');
    }

    const params = {
      api_key: this.serpApiKey,
      q: query,
      num: Math.min(filters.perPage || 10, 10),
      start: ((filters.page || 1) - 1) * (filters.perPage || 10),
      safe: filters.safeSearch === 'off' ? 'off' : 'active',
      engine: 'google',
    };

    if (filters.dateRange && filters.dateRange !== 'any') {
      const rangeMap = { day: 'd1', week: 'w1', month: 'm1', year: 'y1' };
      if (rangeMap[filters.dateRange]) params.tbs = `qdr:${rangeMap[filters.dateRange]}`;
    }

    try {
      const response = await axios.get(this.serpBaseUrl, { params, timeout: 10000 });
      return { ...response.data, _source: 'serp' };
    } catch (error) {
      console.error('SerpAPI error:', error.response?.data || error.message);
      throw new Error('SerpAPI unavailable');
    }
  }

  formatSerpResults(data) {
    if (!data || !data.organic_results) return [];

    return data.organic_results.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet || '',
      source: 'serp',
      sourceName: 'Google (via SerpAPI)',
      date: item.date || null,
      image: item.thumbnail || null,
      favicon: item.favicon || null,
      domain: this.extractDomain(item.link),
      category: 'web',
      verified: true,
    }));
  }

  /**
   * Perform News API Search
   */
  async performNewsSearch(query, filters) {
    if (!this.newsApiKey) {
      throw new Error('News API not configured');
    }

    // NewsAPI only supports this subset of language codes; fall back to English otherwise
    const NEWS_SUPPORTED_LANGS = [
      'ar', 'de', 'en', 'es', 'fr', 'he', 'it', 'nl', 'no', 'pt', 'ru', 'sv', 'ud', 'zh',
    ];
    const newsLanguage = NEWS_SUPPORTED_LANGS.includes(filters.language)
      ? filters.language
      : 'en';

    const params = {
      apiKey: this.newsApiKey,
      q: query,
      pageSize: filters.perPage || 20,
      page: filters.page || 1,
      sortBy: filters.sortBy === 'date' ? 'publishedAt' : 'relevancy',
      language: newsLanguage,
    };

    // Add date range filter
    if (filters.dateRange && filters.dateRange !== 'any') {
      const dateFrom = this.calculateDateFrom(filters.dateRange);
      params.from = dateFrom;
    }

    try {
      const response = await axios.get(this.newsBaseUrl, { params, timeout: 8000 });
      return response.data;
    } catch (error) {
      console.error('News API error:', JSON.stringify(error.response?.data, null, 2) || error.message);

      if (error.response?.status === 401) {
        throw new Error('News API key invalid');
      }
      if (error.response?.status === 429) {
        throw new Error('News API rate limit exceeded');
      }

      throw new Error('News service unavailable');
    }
  }

  /**
   * Perform YouTube Search
   */
  async performYoutubeSearch(query, filters) {
    if (!this.youtubeApiKey) {
      throw new Error('YouTube API not configured');
    }

    const runSearch = async (q) => {
      const params = {
        key: this.youtubeApiKey,
        part: 'snippet',
        q,
        type: 'video',
        maxResults: filters.perPage || 25,
        order: filters.sortBy === 'views' ? 'viewCount' : 'relevance',
      };

      // Add date range filter
      if (filters.dateRange && filters.dateRange !== 'any') {
        const dateAfter = this.calculateDateFrom(filters.dateRange);
        params.publishedAfter = new Date(dateAfter).toISOString();
      }

      const response = await axios.get(this.youtubeBaseUrl, { params, timeout: 8000 });
      return response.data;
    };

    try {
      const data = await runSearch(query);

      // A strict/quoted query (e.g. '"grown shit" mac dre') can over-constrain
      // YouTube into 0-1 hits, leaving the Videos tab nearly empty for an
      // otherwise findable query. When the strict result set is thin, also run a
      // broadened query (quote operators stripped) and MERGE: strict hits stay
      // first (most precise), broadened extras fill the rest, deduped by id.
      const want = filters.perPage || 25;
      const strictCount = (data.items || []).length;
      if (strictCount < Math.min(5, want) && /["']/.test(query)) {
        const broadened = query.replace(/["']/g, ' ').replace(/\s+/g, ' ').trim();
        if (broadened && broadened !== query) {
          console.log(`📺 YouTube: thin strict result (${strictCount}), merging broadened "${broadened}"`);
          try {
            const more = await runSearch(broadened);
            const seen = new Set((data.items || []).map((i) => i.id?.videoId).filter(Boolean));
            const extra = (more.items || []).filter(
              (i) => i.id?.videoId && !seen.has(i.id.videoId)
            );
            data.items = [...(data.items || []), ...extra].slice(0, want);
          } catch (broadenErr) {
            console.error('YouTube broadened retry failed:', broadenErr.message);
          }
        }
      }

      // Enrich with duration + view counts via a videos.list call (search.list omits these)
      try {
        const ids = (data.items || [])
          .map((i) => i.id?.videoId)
          .filter(Boolean);
        if (ids.length) {
          const detailsResp = await axios.get(
            'https://www.googleapis.com/youtube/v3/videos',
            {
              params: {
                key: this.youtubeApiKey,
                part: 'contentDetails,statistics',
                id: ids.join(','),
              },
              timeout: 8000,
            }
          );
          const detailMap = {};
          (detailsResp.data.items || []).forEach((d) => {
            detailMap[d.id] = d;
          });
          data.items = (data.items || []).map((i) => ({
            ...i,
            contentDetails: detailMap[i.id?.videoId]?.contentDetails,
            statistics: detailMap[i.id?.videoId]?.statistics,
          }));
        }
      } catch (enrichErr) {
        console.error('YouTube details enrichment failed:', enrichErr.message);
      }

      return data;
    } catch (error) {
      console.error(
        'YouTube API error:',
        error.response?.data || error.message
      );

      if (error.response?.status === 403) {
        throw new Error('YouTube API key invalid or quota exceeded');
      }
      if (error.response?.status === 429) {
        throw new Error('YouTube API rate limit exceeded');
      }

      throw new Error('YouTube service unavailable');
    }
  }

  /**
   * Perform Unsplash image search
   */
  async performUnsplashSearch(query, filters) {
    if (!this.unsplashAccessKey) {
      throw new Error('Unsplash API not configured');
    }

    const params = {
      query,
      per_page: Math.min(filters.perPage || 20, 30),
      page: filters.page || 1,
      client_id: this.unsplashAccessKey,
    };

    // Apply content filter mapping
    if (filters.safeSearch !== 'off') {
      params.content_filter = 'high';
    }

    try {
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params,
        timeout: 8000,
      });
      // Tag the response so detectSource can identify it
      return { ...response.data, _source: 'unsplash' };
    } catch (error) {
      console.error('Unsplash API error:', error.response?.data || error.message);
      throw new Error('Unsplash service unavailable');
    }
  }

  formatUnsplashResults(data) {
    if (!data || !data.results) return [];

    return data.results.map((photo) => ({
      title: photo.alt_description || photo.description || 'Untitled Photo',
      url: photo.links?.html || `https://unsplash.com/photos/${photo.id}`,
      snippet: photo.description || photo.alt_description || '',
      source: 'unsplash',
      sourceName: 'Unsplash',
      date: photo.created_at || null,
      image: photo.urls?.regular || photo.urls?.small || null,
      thumbnail: photo.urls?.thumb || null,
      favicon: null,
      domain: 'unsplash.com',
      category: 'images',
      verified: true,
      photographer: photo.user?.name || null,
      photographerUrl: photo.user?.links?.html || null,
    }));
  }

  /**
   * Format search results into consistent format
   */
  formatResults(data, source) {
    switch (source) {
      case 'google':
        return this.formatGoogleResults(data);
      case 'bing':
        return this.formatBingResults(data);
      case 'news':
        return this.formatNewsResults(data);
      case 'youtube':
        return this.formatYouTubeResults(data);
      case 'unsplash':
        return this.formatUnsplashResults(data);
      case 'brave':
        return this.formatBraveResults(data);
      case 'searxng':
        return this.formatSearXNGResults(data);
      case 'searxng-images':
        return this.formatSearXNGCategoryResults(data, 'images');
      case 'searxng-videos':
        return this.formatSearXNGCategoryResults(data, 'videos');
      case 'searxng-social-media':
        return this.formatSearXNGCategoryResults(data, 'social media');
      case 'google-images':
        return this.formatGoogleImageResults(data);
      case 'brave-images':
        return this.formatBraveImageResults(data);
      default:
        return [];
    }
  }

  formatGoogleResults(googleData) {
    if (!googleData || !googleData.items) return [];

    return googleData.items.map((item) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'google',
      sourceName: 'Google',
      date: item.date || null,
      image: item.pagemap?.cse_image?.[0]?.src || null,
      favicon: item.pagemap?.cse_thumbnail?.[0]?.src || null,
      domain: this.extractDomain(item.link),
      category: 'web',
      verified: true,
    }));
  }

  /**
   * Combine results from multiple search sources
   */
  combineResults(results) {
    const combined = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const source = this.detectSource(result.value);
        const formatted = this.formatResults(result.value, source);
        combined.push(...formatted);
      }
    });

    // Remove duplicates based on URL
    const uniqueResults = combined.filter(
      (result, index, self) =>
        index === self.findIndex((r) => r.url === result.url)
    );

    return uniqueResults;
  }

  /**
   * Detect source from API response
   */
  detectSource(data) {
    // Explicit _source tags first: Google Images shares `kind: 'customsearch#search'`
    // with plain Google web results, so it must be checked before the generic check below.
    if (data._source === 'unsplash') return 'unsplash';
    if (data._source === 'brave') return 'brave';
    if (data._source === 'searxng') return 'searxng';
    if (data._source === 'google-images') return 'google-images';
    if (data._source === 'brave-images') return 'brave-images';
    if (data._source && data._source.startsWith('searxng-')) return data._source;
    if (data.items && data.kind === 'customsearch#search') return 'google';
    if (data.webPages && data._type === 'SearchResponse') return 'bing';
    if (data.articles && data.status === 'ok') return 'news';
    if (data.items && data.kind === 'youtube#searchListResponse') return 'youtube';
    return 'unknown';
  }

  /**
   * Categorize results by bias
   */
  categorizeByBias(results) {
    const biasLabels = {
      left: 'Left-Leaning',
      right: 'Right-Leaning',
      center: 'Center',
      unbiased: 'Fact-Based',
      neutral: 'Unknown',
      mainstream: 'Mainstream Media',
      alternative: 'Alternative Media',
      conspiracy: 'Fringe / Conspiracy',
      independent: 'Independent',
      platform: 'User Platform',
      unknown: 'Unrated',
    };

    return results.map((result) => {
      // 'unknown' (no data), never 'neutral' (assessed non-partisan).
      const bias = this.detectBias(result) || 'unknown';
      const category = this.detectCategory(result);

      return {
        ...result,
        bias,
        biasLabel: biasLabels[bias] || 'Unknown Bias',
        category: category || result.category || 'web',
      };
    });
  }

  /**
   * Source characteristics for one result, from the curated lists in
   * data/sourceBias.js.
   *
   * The 115-domain object literal that used to live here had duplicate keys
   * (last one silently won) and matched exact hostnames only, so `edition.cnn.com`
   * resolved to nothing. Both are fixed in that module; it also refuses to load
   * if a domain is claimed by two categories.
   *
   * Returns null when nothing is known, so the caller can record 'unknown'
   * rather than asserting 'neutral'.
   */
  detectBias(result) {
    const domain = result.domain || this.extractDomain(result.url || '');

    const curated = sourceBias.classify(domain);
    if (curated) return curated;


    // Keyword-based bias detection for unlisted domains
    const url = (result.url || '').toLowerCase();
    const title = (result.title || '').toLowerCase();
    const snippet = (result.snippet || '').toLowerCase();
    const text = `${url} ${title} ${snippet}`;

    // Conspiracy / fringe signals
    if (/deep.?state|new.?world.?order|illuminati|crisis.?actor|flat.?earth|plandemic|great.?reset.?exposed|chemtrail|microchip.?vaccine|5g.?covid/i.test(text))
      return 'conspiracy';

    // Alternative / suppressed signals
    if (/censored|suppressed|shadow.?ban|banned|they.?don.?t.?want|mainstream.?media.?lies|msm.?lies|whistleblower|leaked|cover.?up|truth.?about/i.test(text))
      return 'alternative';

    // Left-leaning signals
    if (/systemic.?racism|white.?privilege|defund.?police|social.?justice|equity.?diversity|climate.?justice|reproductive.?rights|transgender.?rights/i.test(text))
      return 'left';

    // Right-leaning signals
    if (/make.?america.?great|maga|election.?fraud|illegal.?immigration|second.?amendment|woke.?agenda|deep.?state|patriot.?movement|conservative.?values/i.test(text))
      return 'right';

    // Mainstream signals (large institutional sites)
    if (/\.gov\b|\.edu\b/.test(url)) return 'unbiased';

    return null; // unlisted — caller records 'unknown', not 'neutral'
  }

  /**
   * Detect category based on URL and content
   */
  detectCategory(result) {
    const url = result.url || '';
    const title = result.title || '';

    if (url.includes('youtube.com') || url.includes('vimeo.com')) {
      return 'videos';
    }

    if (
      url.includes('reddit.com') ||
      url.includes('twitter.com') ||
      url.includes('facebook.com')
    ) {
      return 'social';
    }

    if (
      url.includes('shop') ||
      url.includes('buy') ||
      url.includes('store') ||
      url.includes('amazon')
    ) {
      return 'shopping';
    }

    if (
      title.toLowerCase().includes('music') ||
      url.includes('spotify') ||
      url.includes('soundcloud')
    ) {
      return 'music';
    }

    return result.category || 'web';
  }

  /**
   * Sort and filter results
   */
  sortAndFilter(results, filters) {
    let filtered = results;

    // Apply bias filter
    if (filters.bias !== 'all') {
      filtered = filtered.filter((result) => result.bias === filters.bias);
    }

    // Apply category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(
        (result) => result.category === filters.category
      );
    }

    // Sort results
    if (filters.sortBy === 'date') {
      filtered.sort((a, b) => {
        const aDate = new Date(a.date);
        const bDate = new Date(b.date);
        return filters.order === 'desc' ? bDate - aDate : aDate - bDate;
      });
    }

    return filtered;
  }


  /**
   * Extract domain from URL
   */
  extractDomain(url) {
    try {
      // Anchored: the old `.replace('www.', '')` was a substring replace, so
      // `wwww.x.com` became `w.x.com` and any host containing "www." anywhere
      // was corrupted mid-string.
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'unknown.com';
    }
  }

  /**
   * Green mode: is this URL/domain a known AI-generated-content source?
   * Matches the registrable domain and any subdomain (blocklisted "x.com"
   * also blocks "blog.x.com").
   */
  isAiContentDomain(urlOrDomain) {
    if (!urlOrDomain || this.aiContentDomains.size === 0) return false;
    let host;
    try {
      host = urlOrDomain.includes('://')
        ? new URL(urlOrDomain).hostname
        : urlOrDomain;
    } catch {
      host = urlOrDomain;
    }
    host = String(host).toLowerCase().replace(/^www\./, '');
    if (this.aiContentDomains.has(host)) return true;
    // Subdomain match: blog.example.com -> example.com
    for (const blocked of this.aiContentDomains) {
      if (host === blocked || host.endsWith(`.${blocked}`)) return true;
    }
    return false;
  }

  /**
   * Calculate date from range
   */
  calculateDateFrom(dateRange) {
    const now = new Date();
    const ranges = {
      hour: new Date(now - 60 * 60 * 1000),
      day: new Date(now - 24 * 60 * 60 * 1000),
      week: new Date(now - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now - 30 * 24 * 60 * 60 * 1000),
      year: new Date(now - 365 * 24 * 60 * 60 * 1000),
    };

    return ranges[dateRange]?.toISOString().split('T')[0] || null;
  }

  /**
   * Format Bing date range
   */
  formatBingDateRange(dateRange) {
    const ranges = {
      hour: 'Day',
      day: 'Day',
      week: 'Week',
      month: 'Month',
    };

    return ranges[dateRange] || '';
  }

  formatNewsResults(newsData) {
    if (!newsData || !newsData.articles) return [];

    return newsData.articles.map((article) => ({
      title: article.title,
      url: article.url,
      snippet: article.description,
      source: 'news',
      sourceName: 'News API',
      date: article.publishedAt || null,
      image: article.urlToImage || null,
      favicon: null,
      domain: this.extractDomain(article.url),
      category: 'news',
      verified: true,
    }));
  }

  formatYouTubeResults(youtubeData) {
    if (!youtubeData || !youtubeData.items) return [];

    return youtubeData.items.map((item) => ({
      title: decodeHtmlEntities(item.snippet.title),
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      snippet: decodeHtmlEntities(item.snippet.description),
      source: 'youtube',
      sourceName: 'YouTube',
      channel: decodeHtmlEntities(item.snippet.channelTitle) || 'YouTube',
      date: item.snippet.publishedAt || null,
      image: item.snippet.thumbnails?.high?.url || null,
      favicon: null,
      domain: 'youtube.com',
      category: 'videos',
      duration: this.parseYouTubeDuration(item.contentDetails?.duration),
      views: item.statistics?.viewCount
        ? Number(item.statistics.viewCount)
        : null,
      verified: true,
    }));
  }

  /**
   * Convert an ISO-8601 duration (e.g. "PT1H2M3S") to "h:mm:ss" / "m:ss".
   */
  parseYouTubeDuration(iso) {
    if (!iso) return null;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return null;
    const h = parseInt(m[1] || '0', 10);
    const min = parseInt(m[2] || '0', 10);
    const s = parseInt(m[3] || '0', 10);
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(min)}:${pad(s)}` : `${min}:${pad(s)}`;
  }

  formatBingResults(bingData) {
    if (!bingData || !bingData.webPages || !bingData.webPages.value) return [];

    return bingData.webPages.value.map((item) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      source: 'bing',
      sourceName: 'Bing',
      date: item.dateLastCrawled || null,
      image: null,
      favicon: null,
      domain: this.extractDomain(item.url),
      category: 'web',
      verified: true,
    }));
  }

  /**
   * Get available search sources and their status
   */
  async getAvailableSources() {
    const sources = [
      {
        id: 'google',
        name: 'Google Search',
        enabled: !!this.googleApiKey && !!this.googleSearchEngineId,
        requiresAuth: true,
        description: 'Web search results from Google',
        configured: !!this.googleApiKey && !!this.googleSearchEngineId,
      },
      {
        id: 'bing',
        name: 'Bing Search',
        enabled: !!this.bingApiKey,
        requiresAuth: true,
        description: 'Web search results from Bing',
        configured: !!this.bingApiKey,
      },
      {
        id: 'news',
        name: 'News API',
        enabled: !!this.newsApiKey,
        requiresAuth: true,
        description: 'News articles from various sources',
        configured: !!this.newsApiKey,
      },
      {
        id: 'youtube',
        name: 'YouTube',
        enabled: !!this.youtubeApiKey,
        requiresAuth: true,
        description: 'Video content from YouTube',
        configured: !!this.youtubeApiKey,
      },
      {
        id: 'searxng',
        name: 'SearXNG (self-hosted)',
        enabled: !!this.searxngUrl,
        requiresAuth: false,
        description: this.searxngPrimary
          ? 'Primary metasearch (self-hosted)'
          : 'Metasearch fallback (self-hosted)',
        configured: !!this.searxngUrl,
      },
    ];

    return sources;
  }

  /**
   * Get health status of search services
   */
  async getHealthStatus() {
    const sources = await this.getAvailableSources();
    const healthStatus = {};

    for (const source of sources) {
      if (source.enabled) {
        try {
          // Test each source with a simple query
          switch (source.id) {
            case 'google':
              await this.performGoogleSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            case 'bing':
              await this.performBingSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            case 'news':
              await this.performNewsSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            case 'youtube':
              await this.performYoutubeSearch('test', { perPage: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            case 'searxng':
              await this.performSearXNGSearch('test', { page: 1 });
              healthStatus[source.id] = 'healthy';
              break;
            default:
              healthStatus[source.id] = 'configured';
          }
        } catch (error) {
          console.error(`Health check failed for ${source.id}:`, error.message);
          healthStatus[source.id] = 'unhealthy';
        }
      } else {
        healthStatus[source.id] = 'not_configured';
      }
    }

    return healthStatus;
  }
}

module.exports = SearchService;
