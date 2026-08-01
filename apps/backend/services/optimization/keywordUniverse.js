/**
 * Keyword universe — the evergreen, in-niche topic backlog the engine draws
 * from. This is the machine-readable encoding of drafts/content-scaffold/
 * long-tail-keywords.md (40 low-competition, high-intent question keywords).
 *
 * Used two ways:
 *   1. As the fallback topic pool when the anonymous demand signal
 *      (search_queries trending) has nothing new/safe to publish.
 *   2. To MAP a real trending query onto an on-brand evergreen topic — so we
 *      publish about the topic, never echo a raw user query.
 *
 * Slugs already present in blogPosts.jsx are skipped automatically at runtime
 * (blogPosts.jsx is the source of truth for what's published), so no "done"
 * flag is kept here.
 */

module.exports = [
  // Cluster 1 — Private search
  { slug: 'is-duckduckgo-really-private', question: 'Is DuckDuckGo really private?', intent: 'Honest pros/cons; where it still leaks; alternatives including Truegle', cluster: 'private-search' },
  { slug: 'does-incognito-hide-history-from-isp', question: 'Does incognito mode hide your search history from your ISP?', intent: 'Myth-bust; what incognito does and does not do', cluster: 'private-search' },
  { slug: 'stop-google-tracking-searches', question: 'How do I stop Google from tracking my searches?', intent: 'Step-by-step account and browser settings', cluster: 'private-search' },
  { slug: 'most-private-search-engine-2026', question: 'What is the most private search engine in 2026?', intent: 'Comparison with a threat-model framing', cluster: 'private-search' },
  { slug: 'can-search-engine-see-my-ip', question: 'Can a search engine see my IP address?', intent: 'What metadata leaks; VPN/DNS fixes', cluster: 'private-search' },
  { slug: 'set-private-search-engine-default-mobile', question: 'How to set a private search engine as default on iPhone or Android', intent: 'Mobile-specific walkthrough', cluster: 'private-search' },
  { slug: 'is-it-safe-to-search-without-a-vpn', question: 'Is it safe to search without a VPN?', intent: 'When you need one, when you do not', cluster: 'private-search' },
  { slug: 'how-do-private-search-engines-make-money', question: 'Do private search engines make money?', intent: 'Contextual ads vs tracking; business models', cluster: 'private-search' },

  // Cluster 2 — Bias & filter bubbles
  { slug: 'how-to-get-unbiased-search-results', question: 'How do I get unbiased search results?', intent: 'Practical method plus perspective modes', cluster: 'bias' },
  { slug: 'why-different-google-results', question: 'Why do two people get different Google results?', intent: 'Personalization explained', cluster: 'bias' },
  { slug: 'are-ai-search-answers-biased', question: 'Are AI search answers biased?', intent: 'Answer-engine bubble; verify sources', cluster: 'bias' },
  { slug: 'how-to-check-if-a-news-source-is-biased', question: 'How to check if a news source is biased', intent: 'Practical checklist', cluster: 'bias' },
  { slug: 'least-biased-news-aggregator', question: 'What is the least biased news aggregator?', intent: 'Multi-perspective approach', cluster: 'bias' },
  { slug: 'how-to-fact-check-a-viral-claim', question: 'How to fact-check a viral claim', intent: 'Verification workflow', cluster: 'bias' },
  { slug: 'does-google-censor-search-results', question: 'Does Google censor search results?', intent: 'Ranking vs removal; how to compare', cluster: 'bias' },
  { slug: 'search-results-without-personalization', question: 'How to see search results without personalization', intent: 'Signed-out plus non-tracking method', cluster: 'bias' },

  // Cluster 3 — OSINT (lawful, ethics-first)
  { slug: 'best-free-osint-tools-for-beginners', question: 'What are the best free OSINT tools for beginners?', intent: 'Curated, lawful starter kit', cluster: 'osint' },
  { slug: 'how-to-find-information-about-someone-legally', question: 'How to find information about someone online (legally)', intent: 'Ethics-first, public-records only', cluster: 'osint' },
  { slug: 'what-is-osint-and-how-is-it-used', question: 'What is OSINT and how is it used?', intent: 'Definition plus use cases', cluster: 'osint' },
  { slug: 'reverse-image-search-to-verify-a-photo', question: 'How to do a reverse image search to verify a photo', intent: 'Step-by-step with TinEye/Yandex/Google', cluster: 'osint' },
  { slug: 'check-if-email-in-data-breach', question: 'How to check if my email was in a data breach', intent: 'Have I Been Pwned walkthrough', cluster: 'osint' },
  { slug: 'remove-metadata-from-photos', question: 'How to remove metadata from photos before sharing', intent: 'ExifTool plus phone settings', cluster: 'osint' },
  { slug: 'what-can-someone-find-from-my-username', question: 'What can someone find out from my username?', intent: 'Self-exposure audit', cluster: 'osint' },
  { slug: 'how-to-use-google-dorks-safely', question: 'How to use Google dorks safely', intent: 'Advanced operators, lawful use', cluster: 'osint' },

  // Cluster 4 — Access & censorship
  { slug: 'how-to-access-blocked-websites-safely', question: 'How to access blocked websites safely', intent: 'VPN/Tor/DNS with legality caveats', cluster: 'access' },
  { slug: 'is-using-a-vpn-legal', question: 'Is using a VPN legal?', intent: 'Depends-on-jurisdiction explainer', cluster: 'access' },
  { slug: 'vpn-vs-tor-difference', question: 'What is the difference between a VPN and Tor?', intent: 'When to use which', cluster: 'access' },
  { slug: 'how-to-browse-anonymously', question: 'How to browse anonymously', intent: 'Layered approach', cluster: 'access' },
  { slug: 'is-tor-safe-to-use', question: 'Is Tor safe to use?', intent: 'Realistic risks plus safe practice', cluster: 'access' },
  { slug: 'how-to-use-encrypted-dns', question: 'How to use encrypted DNS (DNS-over-HTTPS)', intent: 'Setup per browser/OS', cluster: 'access' },
  { slug: 'no-logs-vpn-how-to-verify', question: 'What is a no-logs VPN and how do I verify one?', intent: 'Audits, jurisdiction, red flags', cluster: 'access' },
  { slug: 'view-a-website-without-a-trace', question: 'How to view a website without leaving a trace', intent: 'Proxy/archive/anonymous-view', cluster: 'access' },

  // Cluster 5 — Ads, rewards & how Truegle works
  { slug: 'contextual-vs-targeted-ads-privacy', question: 'Are contextual ads better for privacy than targeted ads?', intent: 'Explainer; why Truegle uses contextual', cluster: 'how-truegle-works' },
  { slug: 'how-websites-make-money-without-tracking', question: 'How do websites make money without tracking you?', intent: 'Contextual/subscriptions/affiliates', cluster: 'how-truegle-works' },
  { slug: 'what-is-a-metasearch-engine', question: 'What does "metasearch engine" mean?', intent: 'Definition; how aggregation works', cluster: 'how-truegle-works' },
  { slug: 'can-you-get-paid-to-search-the-web', question: 'Can you get paid to search the web?', intent: 'Honest take; offer-based rewards, caveats', cluster: 'how-truegle-works' },
  { slug: 'block-ads-without-hurting-sites', question: 'How to block ads without hurting the sites you like', intent: 'Ethics of adblock; contextual alternative', cluster: 'how-truegle-works' },
  { slug: 'what-is-an-ad-rewards-program', question: 'What is an ad rewards program and is it worth it?', intent: 'Realistic expectations', cluster: 'how-truegle-works' },
  { slug: 'how-does-a-search-engine-rank-results', question: 'How does a search engine rank results?', intent: 'Ranking basics; where bias enters', cluster: 'how-truegle-works' },
  { slug: 'why-search-results-full-of-seo-spam', question: 'Why are my search results full of ads and SEO spam?', intent: 'Cause plus how to find human-written content', cluster: 'how-truegle-works' },
];
