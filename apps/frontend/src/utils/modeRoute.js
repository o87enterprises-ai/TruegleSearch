// Search modes that own a path of their own — the link people share and land
// back on — rather than living as ?mode= on /search.
export const MODE_PATHS = { red: '/red', green: '/green' };

/**
 * The address of a search in `mode`, carrying `params` (a URLSearchParams, an
 * object, or a query string). Red → /red, Green → /green, Blue → /search,
 * anything else → /search?mode=…. Any `mode` already in `params` is dropped
 * so the two can never disagree.
 */
export function searchPath(mode, params = '') {
  const p = new URLSearchParams(params);
  p.delete('mode');
  const own = MODE_PATHS[mode];
  if (!own && mode && mode !== 'blue') p.set('mode', mode);
  const qs = p.toString();
  return `${own || '/search'}${qs ? `?${qs}` : ''}`;
}

// Which page each pill mode lives on, carrying whatever was typed.
// One map, so every pill on every page sends the same text to the same place.
export function routeFor(mode, text = '') {
  const q = (text || '').trim();
  const qs = q ? `q=${encodeURIComponent(q)}` : '';
  if (mode === 'black') return `/chat${qs ? `?${qs}` : ''}`;
  if (mode === 'yellow') return `/feed${qs ? `?${qs}` : ''}`;
  if (mode === 'tube') return `/tube${qs ? `?${qs}` : ''}`;
  // Blue keeps ?mode=blue here, as it always has from the pill.
  if (mode === 'blue') return `/search?mode=blue${qs ? `&${qs}` : ''}`;
  return searchPath(mode, qs);
}
