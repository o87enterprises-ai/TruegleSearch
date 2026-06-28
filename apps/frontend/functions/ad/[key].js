/**
 * Cloudflare Pages Function — first-party Adsterra invoke.js proxy
 *
 * Route: GET /ad/:key
 * Fetches Adsterra's invoke.js from highperformanceformat.com server-side,
 * rewrites any HPF domain references to ads.truegle.info (our first-party
 * CNAME to Adsterra's CDN), and returns the script as if it came from
 * truegle.info. This makes all ad-related requests appear first-party to
 * the browser, bypassing Edge/Firefox Tracking Prevention storage blocks.
 *
 * ads.truegle.info is already a CNAME to Adsterra's delivery network, so
 * the rewritten URLs resolve correctly without any additional DNS config.
 */

const HPF_ORIGIN = 'https://www.highperformanceformat.com';
const FIRST_PARTY_AD_DOMAIN = 'ads.truegle.info';

// Adsterra placement keys are 32-char lowercase hex strings
const KEY_RE = /^[a-f0-9]{32}$/;

export async function onRequestGet({ params, request }) {
  const { key } = params;

  if (!KEY_RE.test(key)) {
    return new Response('Not found', { status: 404 });
  }

  const upstreamUrl = `${HPF_ORIGIN}/${key}/invoke.js`;

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') ?? 'Mozilla/5.0',
        'Referer': 'https://truegle.info/',
        'Accept': 'application/javascript, */*;q=0.9',
        'Accept-Language': request.headers.get('Accept-Language') ?? 'en-US,en;q=0.9',
      },
    });
  } catch {
    return new Response('', { status: 502 });
  }

  if (!upstream.ok) {
    return new Response('', { status: upstream.status });
  }

  let js = await upstream.text();

  // Rewrite all HPF domain references → ads.truegle.info so every subsequent
  // request the script makes (impression pixels, secondary scripts, click trackers)
  // also stays first-party from the browser's perspective.
  js = js.replaceAll('www.highperformanceformat.com', FIRST_PARTY_AD_DOMAIN);
  js = js.replaceAll('highperformanceformat.com', FIRST_PARTY_AD_DOMAIN);

  return new Response(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Cache for 1 hour — invoke.js changes rarely; keeps origin requests low
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'Vary': 'Accept-Encoding',
    },
  });
}
