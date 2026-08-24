/**
 * Curated source-characteristic lists — the data behind Truegle's mode ranking.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 *
 * The bias map used to be an object literal inline in SearchService.detectBias
 * with 115 domains. Three things were wrong with it, all of them silent:
 *
 *   1. DUPLICATE KEYS. `theintercept.com` and `substack.com` each appeared
 *      twice. In an object literal the last one wins, so The Intercept was
 *      'alternative' and never 'left' — nobody could see that from reading it.
 *      Here every category is an ARRAY and `buildIndex()` THROWS on a duplicate,
 *      so the same mistake becomes a boot failure instead of a quiet override.
 *
 *   2. EXACT-MATCH ONLY. Lookup was `biasMap[domain]`, so `edition.cnn.com`,
 *      `amp.cnn.com` and `news.yahoo.com` matched nothing at all. Real result
 *      sets are full of subdomains, so even listed outlets missed constantly.
 *      `classify()` now matches the registrable domain and any subdomain.
 *
 *   3. PLATFORMS TREATED AS SOURCES. `medium.com`, `substack.com`,
 *      `wordpress.com` and `blogspot.com` were labelled 'independent', and
 *      `rumble.com` / `odysee.com` / `bitchute.com` were labelled
 *      'alternative'. These are hosts, not voices: the bias of a Medium post is
 *      whatever its author is. They now resolve to 'platform', which carries no
 *      editorial claim.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS AND IS NOT
 *
 * This is a HEURISTIC used to LABEL and RE-RANK inside a mode the user chose.
 * It is never used to remove a result. Nothing here is filtered out of a normal
 * search; green mode's AI-content filter is a separate list, and purple only
 * narrows when the user explicitly picks perspectives.
 *
 * Any list like this is contestable, and pretending otherwise would be the
 * "editorial thumb on the scale" this project exists to avoid. So:
 *
 *   - Categories describe an outlet's ORIENTATION or FUNDING MODEL, not whether
 *     it is truthful. 'alternative' is not an insult and 'mainstream' is not an
 *     endorsement.
 *   - 'conspiracy' is the one pejorative-sounding label, and it is deliberately
 *     reserved for outlets whose core output is claims contradicted by primary
 *     evidence. It is still never filtered out — red-pill ranks it HIGHEST,
 *     because a user in that mode is explicitly asking for it.
 *   - Unlisted is 'unknown', NOT 'neutral'. Those are different claims: "we have
 *     no data" versus "we assessed this as non-partisan". Conflating them is
 *     what made mode re-ranking a no-op.
 *   - EDIT THIS FILE FREELY. It is data, not logic. Add, move, or delete a
 *     domain and the ranking changes with no code edit.
 *
 * Lists lean US/UK because the source-classification literature does, with
 * European and Brazilian outlets added since those are real traffic sources for
 * Truegle. Coverage outside the anglosphere is thin and known to be thin.
 */

// ── Partisan orientation ────────────────────────────────────────────────────

const LEFT = [
  'cnn.com', 'msnbc.com', 'nytimes.com', 'washingtonpost.com', 'huffpost.com',
  'theguardian.com', 'slate.com', 'vox.com', 'thedailybeast.com',
  'motherjones.com', 'thenation.com', 'salon.com', 'thinkprogress.org',
  'commondreams.org', 'democracynow.org', 'jacobin.com', 'newrepublic.com',
  'talkingpointsmemo.com', 'rawstory.com', 'alternet.org', 'truthout.org',
  'inthesetimes.com', 'theatlantic.com', 'newyorker.com', 'vanityfair.com',
  'buzzfeednews.com', 'dailykos.com', 'theroot.com', 'prospect.org',
  'currentaffairs.org', 'theintercept.com', 'boingboing.net', 'wonkette.com',
  'mediamatters.org', 'crooksandliars.com', 'lawfaremedia.org',
  // Europe
  'independent.co.uk', 'mirror.co.uk', 'newstatesman.com', 'lemonde.fr',
  'liberation.fr', 'mediapart.fr', 'taz.de', 'sueddeutsche.de', 'zeit.de',
  'volkskrant.nl', 'trouw.nl', 'elpais.com', 'repubblica.it',
  // Brazil
  'cartacapital.com.br', 'brasil247.com',
];

const RIGHT = [
  'foxnews.com', 'breitbart.com', 'dailywire.com', 'nypost.com', 'wsj.com',
  'nationalreview.com', 'theblaze.com', 'townhall.com', 'redstate.com',
  'thefederalist.com', 'washingtonexaminer.com', 'washingtontimes.com',
  'newsmax.com', 'oann.com', 'americanthinker.com', 'conservativereview.com',
  'theamericanconservative.com', 'powerlineblog.com', 'legalinsurrection.com',
  'pjmedia.com', 'dailysignal.com', 'westernjournal.com', 'dailycaller.com',
  'freebeacon.com', 'spectator.org', 'thepostmillennial.com', 'justthenews.com',
  'hotair.com', 'twitchy.com', 'cnsnews.com', 'lifesitenews.com',
  'thegatewaypundit.com', 'reason.com', 'mises.org', 'fee.org',
  'city-journal.org', 'quillette.com', 'unherd.com',
  // Europe
  'telegraph.co.uk', 'dailymail.co.uk', 'thesun.co.uk', 'spectator.co.uk',
  'lefigaro.fr', 'valeursactuelles.com', 'welt.de', 'bild.de', 'nzz.ch',
  'telegraaf.nl', 'elmundo.es', 'abc.es',
  // Brazil
  'gazetadopovo.com.br', 'oantagonista.com.br',
];

// ── Assessed centre and evidence-first ──────────────────────────────────────

const CENTER = [
  'bbc.com', 'bbc.co.uk', 'npr.org', 'thehill.com', 'politico.com', 'axios.com',
  'bloomberg.com', 'fortune.com', 'usatoday.com', 'cbsnews.com',
  'abcnews.go.com', 'nbcnews.com', 'time.com', 'newsweek.com', 'economist.com',
  'ft.com', 'csmonitor.com', 'thetimes.co.uk', 'realclearpolitics.com',
  'marketwatch.com', 'businessinsider.com', 'forbes.com', 'cnbc.com',
  'semafor.com', 'thedispatch.com', 'straitstimes.com', 'japantimes.co.jp',
  // Europe
  'euronews.com', 'dw.com', 'france24.com', 'lesechos.fr', 'faz.net',
  'spiegel.de', 'handelsblatt.com', 'nrc.nl', 'nos.nl', 'ad.nl',
  'elconfidencial.com', 'corriere.it', 'irishtimes.com', 'thelocal.se',
  // Brazil
  'globo.com', 'g1.globo.com', 'estadao.com.br', 'folha.uol.com.br', 'uol.com.br',
];

const UNBIASED = [
  // Wire services — the closest thing to a raw feed
  'reuters.com', 'apnews.com', 'afp.com', 'pa.media', 'agenciabrasil.ebc.com.br',
  // Public-service and legislative record
  'pbs.org', 'c-span.org', 'parliament.uk', 'europarl.europa.eu',
  // Fact-checking
  'factcheck.org', 'snopes.com', 'politifact.com', 'fullfact.org',
  'truthorfiction.com', 'leadstories.com', 'aosfatos.org',
  // Reference and primary research
  'wikipedia.org', 'wikisource.org', 'ourworldindata.org', 'pewresearch.org',
  'gallup.com', 'statista.com', 'census.gov', 'bls.gov', 'cdc.gov', 'nih.gov',
  'who.int', 'un.org', 'worldbank.org', 'imf.org', 'oecd.org', 'europa.eu',
  'nature.com', 'science.org', 'thelancet.com', 'nejm.org', 'bmj.com',
  'pubmed.ncbi.nlm.nih.gov', 'arxiv.org', 'ssrn.com', 'jstor.org',
  'doi.org', 'plos.org', 'sciencedirect.com', 'springer.com',
  'nasa.gov', 'noaa.gov', 'esa.int', 'usgs.gov', 'nist.gov',
  'courtlistener.com', 'supremecourt.gov', 'archives.gov', 'loc.gov',
];

const NEUTRAL = [
  // Assessed non-partisan: technical, reference, and service sites. This is a
  // POSITIVE assessment — unlisted domains are 'unknown', not these.
  'stackoverflow.com', 'stackexchange.com', 'github.com', 'gitlab.com',
  'developer.mozilla.org', 'w3.org', 'ietf.org', 'rfc-editor.org',
  'kernel.org', 'python.org', 'nodejs.org', 'rust-lang.org', 'golang.org',
  'archive.org', 'openstreetmap.org', 'wolframalpha.com', 'britannica.com',
  'dictionary.com', 'merriam-webster.com', 'investopedia.com',
  'mayoclinic.org', 'clevelandclinic.org', 'medlineplus.gov',
  'consumerreports.org', 'wirecutter.com', 'goodreads.com', 'imdb.com',
];

// ── Corporate / institutional scale ─────────────────────────────────────────

const MAINSTREAM = [
  'google.com', 'bing.com', 'yahoo.com', 'msn.com', 'aol.com',
  'news.google.com', 'apple.com', 'microsoft.com', 'amazon.com', 'meta.com',
  'linkedin.com', 'sky.com', 'itv.com', 'nbcuniversal.com', 'warnerbros.com',
  'disney.com', 'people.com', 'variety.com', 'hollywoodreporter.com',
  'entrepreneur.com', 'inc.com', 'fastcompany.com', 'wired.com',
  'techcrunch.com', 'theverge.com', 'cnet.com', 'zdnet.com', 'engadget.com',
  'mashable.com', 'gizmodo.com', 'arstechnica.com',
];

// ── Non-corporate press ─────────────────────────────────────────────────────

const ALTERNATIVE = [
  'racket.news', 'thegrayzone.com', 'mintpressnews.com', 'consortiumnews.com',
  'off-guardian.org', 'globalresearch.ca', 'unlimitedhangout.com',
  'corbettreport.com', 'zerohedge.com', 'banned.video', 'brighteon.com',
  'rt.com', 'sputniknews.com', 'strategic-culture.org', 'unz.com',
  'lewrockwell.com', 'antiwar.com', 'counterpunch.org', 'scheerpost.com',
  'thecanary.co', 'declassifieduk.org', 'novaramedia.com', 'wsws.org',
  'thelastamericanvagabond.com', 'childrenshealthdefense.org',
  'thefreethoughtproject.com', 'reclaimthenet.org', 'thecradle.co',
  'electronicintifada.net', 'mondoweiss.net', 'jacobinlat.com',
  'propublica.org', 'bellingcat.com', 'occrp.org', 'icij.org',
  'themarkup.org', 'documentcloud.org', '404media.co', 'thebaffler.com',
  'aeon.co', 'nakedcapitalism.com',
];

const INDEPENDENT = [
  // Individual journalists and small newsrooms operating outside a corporate
  // parent. Distinct from ALTERNATIVE, which is outlet-scale non-corporate press.
  'taibbi.substack.com', 'greenwald.substack.com', 'bariweiss.substack.com',
  'commonsense.news', 'thefp.com', 'mattyglesias.substack.com',
  'astralcodexten.substack.com', 'slatestarcodex.com', 'lesswrong.com',
  'marginalrevolution.com', 'stratechery.com', 'pluralistic.net',
  'danluu.com', 'jvns.ca', 'simonwillison.net', 'schneier.com',
  'krebsonsecurity.com', 'troyhunt.com', 'daringfireball.net',
];

const CONSPIRACY = [
  'infowars.com', 'naturalnews.com', 'activistpost.com', 'beforeitsnews.com',
  'whatreallyhappened.com', 'henrymakow.com', 'rense.com', 'veterans-today.com',
  'thepeoplesvoice.tv', 'neonnettle.com', 'davidicke.com', 'ancient-code.com',
  'collective-evolution.com', 'disclose.tv', 'newspunch.com', 'yournewswire.com',
  'stateofthenation.co', 'bibliotecapleyades.net', 'godlikeproductions.com',
];

// ── Hosts, not voices ───────────────────────────────────────────────────────

const PLATFORM = [
  // The bias of a page here is whatever its author is, so claiming one for the
  // whole host is wrong. Explicit per-author entries above still win, because
  // classify() prefers the longest (most specific) match.
  'substack.com', 'medium.com', 'wordpress.com', 'blogspot.com', 'ghost.io',
  'tumblr.com', 'patreon.com', 'locals.com', 'buttondown.email', 'beehiiv.com',
  'youtube.com', 'rumble.com', 'odysee.com', 'bitchute.com', 'vimeo.com',
  'dailymotion.com', 'twitch.tv', 'soundcloud.com', 'spotify.com',
  'reddit.com', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com',
  'tiktok.com', 'threads.net', 'mastodon.social', 'bsky.app', 'telegram.org',
  'quora.com', 'linktr.ee', 'notion.site', 'wixsite.com', 'weebly.com',
];

const CATEGORIES = {
  left: LEFT,
  right: RIGHT,
  center: CENTER,
  unbiased: UNBIASED,
  neutral: NEUTRAL,
  mainstream: MAINSTREAM,
  alternative: ALTERNATIVE,
  independent: INDEPENDENT,
  conspiracy: CONSPIRACY,
  platform: PLATFORM,
};

/**
 * Flatten the categories into one lookup, refusing to start if a domain is
 * claimed twice. The old object-literal map silently kept the last value; a
 * contradiction in curated data is a mistake worth surfacing loudly.
 */
function buildIndex() {
  const index = new Map();
  const clashes = [];
  for (const [category, domains] of Object.entries(CATEGORIES)) {
    for (const raw of domains) {
      const domain = String(raw).trim().toLowerCase().replace(/^www\./, '');
      const existing = index.get(domain);
      if (existing && existing !== category) {
        clashes.push(`${domain}: "${existing}" vs "${category}"`);
        continue;
      }
      index.set(domain, category);
    }
  }
  if (clashes.length) {
    throw new Error(
      'sourceBias.js: a domain is listed under two categories — pick one:\n  ' +
        clashes.join('\n  '),
    );
  }
  return index;
}

const INDEX = buildIndex();

/**
 * Hostname → category, matching the registrable domain and any subdomain, so
 * `edition.cnn.com` resolves like `cnn.com`. The MOST SPECIFIC match wins,
 * which is what lets `greenwald.substack.com` be 'independent' while
 * `substack.com` itself stays 'platform'.
 *
 * Returns null when the host is not listed. Callers must treat that as
 * "unknown", never as "neutral".
 */
function classify(hostname) {
  if (!hostname || typeof hostname !== 'string') return null;
  let host = hostname.trim().toLowerCase();
  if (host.includes('://')) {
    try { host = new URL(host).hostname; } catch { /* fall through */ }
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '').split(':')[0];
  if (!host) return null;

  // Walk from the full host inward: a.b.example.com → b.example.com →
  // example.com. The first hit is therefore the longest possible match.
  const parts = host.split('.');
  for (let i = 0; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.');
    const hit = INDEX.get(candidate);
    if (hit) return hit;
  }
  return null;
}

/** Every category name, for validation and tests. */
const CATEGORY_NAMES = Object.keys(CATEGORIES);

/** How many domains are curated, per category — surfaced in health output. */
function stats() {
  const out = {};
  for (const [category, domains] of Object.entries(CATEGORIES)) out[category] = domains.length;
  out.total = INDEX.size;
  return out;
}

module.exports = { classify, stats, CATEGORY_NAMES, CATEGORIES };
