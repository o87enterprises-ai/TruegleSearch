// Which page each pill mode lives on, carrying whatever was typed.
// One map, so every pill on every page sends the same text to the same place.
export function routeFor(mode, text = '') {
  const q = (text || '').trim();
  const qs = q ? `q=${encodeURIComponent(q)}` : '';
  if (mode === 'black') return `/chat${qs ? `?${qs}` : ''}`;
  if (mode === 'yellow') return `/feed${qs ? `?${qs}` : ''}`;
  if (mode === 'tube') return `/tube${qs ? `?${qs}` : ''}`;
  return `/search?mode=${mode}${qs ? `&${qs}` : ''}`;
}
