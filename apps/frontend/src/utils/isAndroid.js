// Same shape as isIOS.js, for the same reason: Android has its own rule
// about when a script may turn sound on without a direct tap behind it
// (Firefox for Android's "Autoplay" setting commonly blocks autoplay WITH
// sound by default; Chrome for Android enforces its own Media Engagement
// Index). "Works on iPhone" turned out not to mean "works on Android" —
// see startsMutedWithoutGesture in TrueglePlayer.jsx.
export const IS_ANDROID = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);
