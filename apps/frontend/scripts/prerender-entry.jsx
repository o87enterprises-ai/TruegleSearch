import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import About from '../src/pages/About.jsx';
import PrivacyPolicy from '../src/pages/PrivacyPolicy.jsx';
import TermsOfService from '../src/pages/TermsOfService.jsx';
import Advertise from '../src/pages/Advertise.jsx';
import PrivacyResourceHub from '../src/pages/PrivacyResourceHub.jsx';
import Blog from '../src/pages/Blog.jsx';
import BlogPost from '../src/pages/BlogPost.jsx';
import HomeStaticContent from './seo/HomeStaticContent.jsx';
import LocalizedHomeContent, { TRANSLATIONS, LOCALES } from './seo/LocalizedHomeContent.jsx';
import { BLOG_POSTS } from '../src/content/blogPosts.jsx';

// Real page components for About/Privacy/Terms/Advertise/Blog (so the
// prerendered snapshot can never drift from what the live route actually
// renders — they have no browser-only API access at render time, just
// text/links, so renderToStaticMarkup is safe). The landing page is the
// exception: it's 1200+ lines of canvas/window-touching animation, unsafe to
// render in Node, so "/" gets the dedicated static-only HomeStaticContent.
const PAGES = {
  '/': { Component: HomeStaticContent, useRouter: false },
  '/about': { Component: About, useRouter: true },
  '/privacy': { Component: PrivacyPolicy, useRouter: true },
  '/terms': { Component: TermsOfService, useRouter: true },
  '/advertise': { Component: Advertise, useRouter: true },
  '/privacy-resource-hub': { Component: PrivacyResourceHub, useRouter: true },
  '/blog': { Component: Blog, useRouter: true },
};

// Build-time META for the blog routes so scripts/prerender.mjs can stamp each
// page's <title>/description without duplicating content. The static routes'
// META still lives in prerender.mjs; these get merged in.
export const ROUTE_META = {
  '/blog': {
    title: 'Truegle Blog — Private Search, Filter Bubbles & Seeing the Web Clearly',
    description:
      'Notes on private search, filter bubbles, and seeing the web without a filter — from the team building Truegle, the unbiased and privacy-first search engine.',
  },
};

// Localized landing pages for the top non-English, high-CPM/high-reach markets.
// Each ships its own <html lang> + translated <title>/description so it ranks
// for native-language queries in those regions (hreflang cluster lives in
// index.html and applies to every prerendered page).
for (const lang of LOCALES) {
  const route = `/${lang}`;
  PAGES[route] = { Component: LocalizedHomeContent, useRouter: false, props: { lang } };
  ROUTE_META[route] = {
    title: TRANSLATIONS[lang].title,
    description: TRANSLATIONS[lang].description,
    lang,
  };
}

// One prerendered route per blog post, each rendered with its slug prop so no
// route matching is needed in Node.
for (const post of BLOG_POSTS) {
  const route = `/blog/${post.slug}`;
  PAGES[route] = { Component: BlogPost, useRouter: true, props: { slug: post.slug } };
  ROUTE_META[route] = {
    title: `${post.title} — Truegle`,
    description: post.description,
  };
}

export const ROUTES = Object.keys(PAGES);

export function renderRoute(route) {
  const entry = PAGES[route];
  if (!entry) throw new Error(`No prerender content registered for "${route}"`);
  const { Component, useRouter, props } = entry;
  const element = useRouter ? (
    <MemoryRouter initialEntries={[route]}>
      <Component {...(props || {})} />
    </MemoryRouter>
  ) : (
    <Component {...(props || {})} />
  );
  return renderToStaticMarkup(element);
}
