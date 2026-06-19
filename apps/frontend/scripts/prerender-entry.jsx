import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import About from '../src/pages/About.jsx';
import PrivacyPolicy from '../src/pages/PrivacyPolicy.jsx';
import TermsOfService from '../src/pages/TermsOfService.jsx';
import Advertise from '../src/pages/Advertise.jsx';
import HomeStaticContent from './seo/HomeStaticContent.jsx';

// Real page components for About/Privacy/Terms/Advertise (so the prerendered
// snapshot can never drift from what the live route actually renders — they
// have no browser-only API access at render time, just text/links, so
// renderToStaticMarkup is safe). The landing page is the exception: it's
// 1200+ lines of canvas/window-touching animation, unsafe to render in Node,
// so "/" gets the dedicated static-only HomeStaticContent instead.
const PAGES = {
  '/': { Component: HomeStaticContent, useRouter: false },
  '/about': { Component: About, useRouter: true },
  '/privacy': { Component: PrivacyPolicy, useRouter: true },
  '/terms': { Component: TermsOfService, useRouter: true },
  '/advertise': { Component: Advertise, useRouter: true },
};

export const ROUTES = Object.keys(PAGES);

export function renderRoute(route) {
  const entry = PAGES[route];
  if (!entry) throw new Error(`No prerender content registered for "${route}"`);
  const { Component, useRouter } = entry;
  const element = useRouter ? (
    <MemoryRouter initialEntries={[route]}>
      <Component />
    </MemoryRouter>
  ) : (
    <Component />
  );
  return renderToStaticMarkup(element);
}
