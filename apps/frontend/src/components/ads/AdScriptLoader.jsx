// Adsterra popunder/social-bar scripts removed: they inject dynamic inline
// scripts that violate CSP and can render 18+ content tags in safe-search mode.
// Revenue is now served exclusively via iframe-based banner formats (banner300x250,
// banner728x90, banner468x60) which do not inject inline scripts.
export default function AdScriptLoader() {
  return null;
}
