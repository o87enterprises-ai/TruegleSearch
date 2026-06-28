/**
 * Cloudflare Pages Function — first-party Adsterra Popunder proxy
 *
 * Route: GET /pop
 * Fetches the Adsterra anti-adblock popunder script server-side and
 * returns it as a first-party response so browser Tracking Prevention
 * doesn't block its storage/cookie access.
 *
 * Script origin: millionairelucidlytransmitted.com (Adsterra delivery domain)
 * Zone: Popunder_1 — truegle.info
 */

const POPUNDER_SCRIPT = 'https://millionairelucidlytransmitted.com/03/50/81/03508109c0353dafe874e4f377262a99.js';

export async function onRequestGet({ request }) {
  let upstream;
  try {
    upstream = await fetch(POPUNDER_SCRIPT, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') ?? 'Mozilla/5.0',
        'Referer': 'https://truegle.info/',
        'Accept': 'application/javascript, */*;q=0.9',
      },
    });
  } catch {
    return new Response('', { status: 502 });
  }

  if (!upstream.ok) {
    return new Response('', { status: upstream.status });
  }

  const js = await upstream.text();

  return new Response(js, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    },
  });
}
