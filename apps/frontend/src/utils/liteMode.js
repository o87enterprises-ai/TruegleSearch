// LITE MODE — less GPU/CPU work, same features.
//
// Turns off the expensive visuals (glass blur, decorative background animation, framer-motion
// movement) and nothing else: every page, player, search and map feature still works.
// 'auto' (default) switches it on for phones, weak hardware, data-saver and reduced-motion
// users; Settings lets anyone force it on or off. Stored on this device only.

const KEY = 'tg_lite_mode';           // 'on' | 'off' | absent = auto
const EVENT = 'tg-lite-change';

const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };

export const getLitePref = () => { const v = read(); return v === 'on' || v === 'off' ? v : 'auto'; };

const autoWantsLite = () => {
  try {
    const n = navigator;
    const weak = (n.hardwareConcurrency || 8) <= 4 || (n.deviceMemory || 8) <= 4;
    const phone = !!window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth < 768;
    const saver = !!n.connection?.saveData;
    const reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return weak || phone || saver || reduced;
  } catch { return false; }
};

export const isLiteActive = () => {
  const p = getLitePref();
  return p === 'on' || (p === 'auto' && autoWantsLite());
};

/** Applies the current choice to <html>. Call before first paint and after any change. */
export function applyLite() {
  const on = isLiteActive();
  document.documentElement.classList.toggle('tg-lite', on);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: on }));
  return on;
}

export function setLitePref(pref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref);
  } catch { /* private mode: applies for this visit only */ }
  return applyLite();
}

export const onLiteChange = (fn) => {
  const h = (e) => fn(!!e.detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
};
