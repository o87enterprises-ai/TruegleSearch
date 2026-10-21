// iPhone, iPod, and iPad — iPadOS reports itself as a Mac, so touch points
// give it away. Every browser on iOS is WebKit and shares its media rules.
export const IS_IOS = typeof navigator !== 'undefined' && (
  /iP(hone|od|ad)/.test(navigator.userAgent)
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
);
