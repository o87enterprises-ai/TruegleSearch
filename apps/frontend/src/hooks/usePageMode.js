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
  if (pathname === '/red') return 'red';
  // /shorts redirects to Tube; this only colours the frame for the instant
  // before the redirect lands, so it should be Tube's colour, not OSINT's.
  if (pathname === '/shorts') return 'tube';
  if (pathname === '/tube') return 'tube';
  // /feed/tube is TUBE, not Feed — it is Tube's content on the feed layout, and
  // it sets mode="tube" on the shell itself, so anything reading the page mode
  // for chrome has to agree or the two disagree on screen. Checked BEFORE the
  // /feed prefix below, which would otherwise swallow it.
  if (pathname === '/feed/tube') return 'tube';
  // /feed is the yellow pill's page again (the pill was repointed at /creators
  // for a while, which left the feed reachable only by typing the URL).
  // /creators keeps the colour too — it is a creator roster reached from the
  // feed's Browse row now rather than from a pill of its own. An individual
  // creator page stays ORANGE, matched below, and that must not be a startsWith
  // or it would swallow /creator/:slug and repaint every creator page yellow.
  if (pathname === '/extract' || pathname === '/creators'
    || pathname.startsWith('/feed')) return 'yellow';
  if (pathname.startsWith('/creator/')) return 'orange';
  if (pathname === '/search' || pathname.startsWith('/search/')) {
    return new URLSearchParams(search).get('mode') || 'blue';
  }
  return 'blue';
}
