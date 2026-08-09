import { useLocation } from 'react-router-dom';

// Which mode colour the CURRENT page is wearing.
//
// Derived from the URL rather than threaded through context, because the
// pages already treat `?mode=` as the source of truth — anything that reads
// this hook stays in sync automatically, including surfaces rendered above
// <Routes> (the persistent mini-player) that no page can hand state to.
//
// 'brand' is not a mode: it means "this page has no single colour", which is
// true of the landing page and the share/watch pages. Callers render it as
// the Truegle rainbow rather than picking an arbitrary mode colour.
export const BRAND = 'brand';

const LANDING = new Set(['/', '/de', '/es', '/fr', '/nl', '/pt']);

export function usePageMode() {
  const { pathname, search } = useLocation();

  if (LANDING.has(pathname)) return BRAND;
  if (pathname === '/w' || pathname === '/w/') return BRAND;
  if (pathname === '/chat') return 'black';
  if (pathname === '/green') return 'green';
  // /shorts redirects to Tube; this only colours the frame for the instant
  // before the redirect lands, so it should be Tube's colour, not OSINT's.
  if (pathname === '/shorts') return 'tube';
  if (pathname === '/tube') return 'tube';
  if (pathname === '/extract') return 'yellow';
  if (pathname.startsWith('/creator/')) return 'orange';
  if (pathname === '/search' || pathname.startsWith('/search/')) {
    return new URLSearchParams(search).get('mode') || 'blue';
  }
  return 'blue';
}
