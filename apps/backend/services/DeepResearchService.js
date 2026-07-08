/**
 * DeepResearchService — Nephesh deep-dive research pipeline
 *
 * "All corners of the web": gathers material from the self-hosted SearXNG
 * instance across web, news, social (Reddit/Twitter/HN/forums), and video
 * engines, pulls YouTube transcripts (podcasts, interviews, commentary) for
 * the top video hits, then has Nephesh synthesize a multi-perspective
 * research report that cites only the gathered sources.
 *
 * Every stage degrades gracefully: a missing SearXNG category, a rate-limited
 * transcript, or an offline Nephesh box narrows the material or fails over to
 * interim providers — it never 500s the request. The report is stamped with
 * the Truegle attribution layers (visible block + metadata + invisible
 * watermark) because deep research is a Truegle Co. product output.
 */

const SearchService = require('./SearchService');
const UnifiedAIService = require('./UnifiedAIService');
const { fetchTranscript } = require('./TranscriptService');
const { DEEP_RESEARCH_PROMPT } = require('../prompts/nepheshPrompts');
const attribution = require('../utils/nepheshAttribution');
const logger = require('../utils/logger');

const MAX_SOURCES_PER_CHANNEL = 8;
const MAX_TRANSCRIPTS = 2;
const MAX_TRANSCRIPT_CHARS = 4000;
const MAX_SNIPPET_CHARS = 400;

class DeepResearchService {
  constructor() {
    this.searchService = new SearchService();
  }

  /**
   * Run a deep-dive research pass.
   * @param {string} query
   * @param {object} options - { mode, maxTranscripts }
   * @returns {Promise<object>} { report, sources, channels, provider, ... }
   */
  async research(query, options = {}) {
    const mode = options.mode || 'blue';
    const maxTranscripts = Math.min(options.maxTranscripts ?? MAX_TRANSCRIPTS, 4);

    const material = await this.gatherMaterial(query, maxTranscripts);
    if (material.sources.length === 0) {
      throw new Error('No research material could be gathered (search providers unavailable)');
    }

    const corpus = this.buildCorpus(query, mode, material);
    const response = await this.synthesize(corpus, mode);

    return {
      report: response.content,
      provider: response.provider,
      model: response.model,
      nephesh_attribution: response.nephesh_attribution,
      sources: material.sources.map((s, i) => ({
        index: i,
        title: s.title,
        url: s.url,
        domain: s.domain,
        channel: s.channel,
        sourceName: s.sourceName,
      })),
      channels: material.channelStatus,
      transcriptsUsed: material.transcriptsUsed,
    };
  }

  /**
   * Gather raw material from every available channel in parallel.
   */
  async gatherMaterial(query, maxTranscripts) {
    const svc = this.searchService;
    const channels = [
      {
        name: 'web',
        run: () => svc.performSearXNGSearch(query, {}).then((d) => svc.formatSearXNGResults(d)),
      },
      {
        name: 'news',
        run: () =>
          svc
            .performSearXNGCategorySearch(query, 'news', {})
            .then((d) => svc.formatSearXNGResults(d)),
      },
      {
        name: 'social',
        run: () =>
          svc
            .performSearXNGCategorySearch(query, 'social media', {})
            .then((d) => svc.formatSearXNGCategoryResults(d, 'social media')),
      },
      {
        name: 'videos',
        run: () =>
          svc
            .performSearXNGCategorySearch(query, 'videos', {})
            .then((d) => svc.formatSearXNGCategoryResults(d, 'videos')),
      },
    ];

    const settled = await Promise.allSettled(channels.map((c) => c.run()));

    const sources = [];
    const channelStatus = {};
    let videoResults = [];

    settled.forEach((result, i) => {
      const name = channels[i].name;
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        const items = result.value.slice(0, MAX_SOURCES_PER_CHANNEL);
        channelStatus[name] = items.length;
        if (name === 'videos') videoResults = items;
        items.forEach((item) => {
          sources.push({
            title: item.title,
            url: item.url,
            domain: item.domain,
            snippet: (item.snippet || '').slice(0, MAX_SNIPPET_CHARS),
            sourceName: item.sourceName,
            channel: name,
            videoId: item.videoId || null,
          });
        });
      } else {
        channelStatus[name] = 0;
        logger.warn(`Deep research channel unavailable: ${name}`, {
          error: result.reason?.message,
        });
      }
    });

    // YouTube transcripts for the top video hits — podcasts, interviews,
    // commentary. Sequential on purpose: parallel watch-page hits trip
    // YouTube's rate limiting on datacenter IPs much faster.
    let transcriptsUsed = 0;
    for (const video of videoResults) {
      if (transcriptsUsed >= maxTranscripts) break;
      if (!video.videoId) continue;
      try {
        const segments = await fetchTranscript(video.videoId);
        const text = segments.map((s) => s.text).join(' ').slice(0, MAX_TRANSCRIPT_CHARS);
        const src = sources.find((s) => s.videoId === video.videoId);
        if (src && text) {
          src.transcript = text;
          src.channel = 'video-transcript';
          transcriptsUsed += 1;
        }
      } catch (err) {
        logger.debug('Deep research transcript skipped:', {
          videoId: video.videoId,
          reason: err.code || err.message,
        });
      }
    }

    return { sources, channelStatus, transcriptsUsed };
  }

  /**
   * Assemble the indexed research corpus handed to the model.
   */
  buildCorpus(query, mode, material) {
    const blocks = material.sources.map((s, i) => {
      const lines = [
        `[${i}] ${s.title}`,
        `    channel: ${s.channel} | source: ${s.sourceName || s.domain || 'unknown'} | url: ${s.url}`,
      ];
      if (s.snippet) lines.push(`    excerpt: ${s.snippet}`);
      if (s.transcript) lines.push(`    transcript (truncated): ${s.transcript}`);
      return lines.join('\n');
    });

    return `RESEARCH QUESTION: ${query}
ACTIVE SEARCH MODE: ${mode}

GATHERED MATERIAL (${material.sources.length} sources; cite by [index]):

${blocks.join('\n\n')}`;
  }

  /**
   * Synthesize the report — Nephesh first, interim providers as failover.
   */
  async synthesize(corpus, mode) {
    const messages = [{ role: 'user', content: corpus }];
    const options = {
      system: DEEP_RESEARCH_PROMPT,
      mode,
      temperature: 0.4,
      max_tokens: 3000,
    };

    const order = ['nephesh', ...UnifiedAIService.getAvailableProviders()].filter(
      (name, i, arr) => arr.indexOf(name) === i
    );

    let lastError = null;
    for (const name of order) {
      const provider = UnifiedAIService.getProvider(name);
      if (!provider || !provider.isAvailable?.()) continue;
      try {
        const response = await UnifiedAIService.callProvider(name, messages, options);
        logger.info('Deep research synthesized:', { provider: name, mode });
        // Deep research is a Truegle Co. product output — always carries the
        // Nephesh attribution layers, whichever engine served this request.
        return attribution.stampResponse({ ...response, provider: name });
      } catch (error) {
        logger.warn(`Deep research provider ${name} failed:`, { error: error.message });
        lastError = error;
      }
    }
    throw new Error(`Deep research synthesis failed. Last error: ${lastError?.message}`);
  }
}

module.exports = DeepResearchService;
