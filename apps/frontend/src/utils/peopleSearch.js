// FREE PEOPLE-SEARCH LOOKUPS, PRE-FILLED.
//
// Deep links into each site's own public search page, built from the name
// and phone the investigation already parsed — so nobody has to find the site
// and retype the subject. LINKS ONLY: Truegle's server never fetches these
// pages. They sit behind bot walls, scraping them breaks their terms, and a
// server-side request would send the subject's name from our box to theirs.
// The visitor opens the page themselves, as they would have anyway.
//
// US-centric by nature (every site here indexes US public records), so phone
// links are built only for North American numbers.

const words = (name) => String(name || '').trim().split(/\s+/).filter(Boolean);
const enc = encodeURIComponent;

/** A "first … last" name a people-search site can take, or null. */
export function personName(name) {
  const w = words(name).filter((x) => /^[\p{L}'-]+$/u.test(x));
  if (w.length < 2) return null;
  return { first: w[0], last: w[w.length - 1], full: w.join(' ') };
}

/** 10 NANP digits (area code + number), or null. */
export function usPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return d.length === 10 ? d : null;
}

export function nameLookups(name) {
  const p = personName(name);
  if (!p) return [];
  const dash = `${p.first}-${p.last}`;
  return [
    { site: 'Whitepages', url: `https://www.whitepages.com/name/${enc(dash)}` },
    { site: 'TruePeopleSearch', url: `https://www.truepeoplesearch.com/results?name=${enc(p.full)}` },
    { site: 'FastPeopleSearch', url: `https://www.fastpeoplesearch.com/name/${enc(dash.toLowerCase())}` },
    { site: "That's Them", url: `https://thatsthem.com/name/${enc(dash)}` },
    { site: 'ZabaSearch', url: `https://www.zabasearch.com/people/${enc(p.first)}+${enc(p.last)}/` },
    { site: 'Radaris', url: `https://radaris.com/p/${enc(p.first)}/${enc(p.last)}/` },
    { site: 'Nuwber', url: `https://nuwber.com/search?name=${enc(p.full)}` },
    { site: 'Google (exact name)', url: `https://www.google.com/search?q=${enc(`"${p.full}"`)}` },
  ];
}

export function phoneLookups(raw) {
  const d = usPhone(raw);
  if (!d) return [];
  const a = d.slice(0, 3); const b = d.slice(3, 6); const c = d.slice(6);
  return [
    { site: 'Whitepages', url: `https://www.whitepages.com/phone/1-${a}-${b}-${c}` },
    { site: 'TruePeopleSearch', url: `https://www.truepeoplesearch.com/resultphone?phoneno=${enc(`(${a})${b}-${c}`)}` },
    { site: 'FastPeopleSearch', url: `https://www.fastpeoplesearch.com/${a}-${b}-${c}` },
    { site: "That's Them", url: `https://thatsthem.com/phone/${a}-${b}-${c}` },
    { site: 'Sync.ME', url: `https://sync.me/search/?number=1${d}` },
    { site: 'Google (exact number)', url: `https://www.google.com/search?q=${enc(`"${a}-${b}-${c}" OR "(${a}) ${b}-${c}"`)}` },
  ];
}

// Sites that refuse to be framed (X-Frame-Options / CSP frame-ancestors).
// Verify skips the doomed preview for these and goes straight to the
// leaving-Truegle notice. Every people-search site is on it, plus the social
// networks the username sweep lists.
const UNFRAMEABLE = [
  'whitepages.com', 'truepeoplesearch.com', 'fastpeoplesearch.com', 'thatsthem.com',
  'zabasearch.com', 'radaris.com', 'nuwber.com', 'sync.me', 'google.com',
  'facebook.com', 'instagram.com', 'x.com', 'twitter.com', 'tiktok.com', 'reddit.com',
  'github.com', 'linkedin.com', 'youtube.com', 'pinterest.com', 'snapchat.com',
  'threads.net', 'medium.com', 'twitch.tv', 'telegram.me', 't.me', 'spotify.com',
];
export function knownUnframeable(url) {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return UNFRAMEABLE.some((d) => h === d || h.endsWith(`.${d}`));
  } catch { return true; }
}
