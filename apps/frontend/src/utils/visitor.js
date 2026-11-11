// Is this probably a program rather than a person? Used to decide whether to
// AUTO-START work on a visitor's behalf (the landing Feed card opens and starts
// its top-posts load by itself). A crawler, a prerender pass, a headless
// browser or a link-preview fetcher gets none of that: it would only cost a
// slow scrape for nobody.
//
// Conservative on purpose: when in doubt it says "bot", and a real person who
// is misread still has the card one press away. No server round trip, no
// cookie, no fingerprinting — it reads two things the browser volunteers.

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|prerender|puppeteer|playwright|phantom|facebookexternalhit|embedly|google-?other|bingpreview|wget|curl/i;

export function isLikelyBot() {
  // No browser (SSR / the build's prerender): not a person, so no auto-start.
  if (typeof navigator === 'undefined') return true;
  if (navigator.webdriver) return true;
  return BOT_UA.test(String(navigator.userAgent || ''));
}
