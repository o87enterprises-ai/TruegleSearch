// Android app: when the user leaves, the whole app floats over other apps (Picture-in-Picture).
// This tags <html> with `tg-pip` while floating so CSS can hide chrome that is unusable at that size.
export function initPip() {
  try {
    const pip = window.Capacitor?.Plugins?.TrueglePip;
    if (!pip) return; // web / iOS: nothing to do
    pip.addListener('pip', (e) => {
      document.documentElement.classList.toggle('tg-pip', !!e?.active);
    });
  } catch { /* non-fatal */ }
}
