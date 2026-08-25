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
  // /creators (the roster) is the yellow pill's page. An individual creator
  // page stays ORANGE — matched below, and this must not be a startsWith or it
  // would swallow /creator/:slug and repaint every creator page yellow.
  // /feed keeps its colour too: the page is parked, not deleted, so a direct
  // link still themes correctly.
  if (pathname === '/extract' || pathname === '/creators'
    || pathname.startsWith('/feed')) return 'yellow';
  if (pathname.startsWith('/creator/')) return 'orange';
  if (pathname === '/search' || pathname.startsWith('/search/')) {
    return new URLSearchParams(search).get('mode') || 'blue';
  }
  return 'blue';
}
