#!/usr/bin/env node
// Runs after `vite build`. Vite ships truegle.info as a pure client-rendered
// SPA: every route's raw HTML is just <div id="root"></div> plus a script
// tag. That's invisible to any crawler that doesn't execute JS (or budgets
// it tightly), which is the confirmed root cause behind both the Impact.com
// Marketplace decline and `site:truegle.info` returning nothing — see
// IMPACT_MARKETPLACE_DECLINE_CONTEXT.md, hypothesis H1.
//
// This script renders a handful of public, content-bearing routes to real
// HTML at build time (via esbuild + react-dom/server, not a headless
// browser — no Chromium dependency to break in a CI build image) and writes
// each one as a static dist/<route>/index.html with its own <title>/meta
// description. Cloudflare Pages serves an exact static-file match before
// falling back to the SPA shell, so these are picked up automatically. The
// live app is untouched: createRoot().render() still does a full client
// paint over the prerendered markup on load, same as before.

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');

const META = {
  '/': {
    title: 'Truegle - Unbiased, Transparent & Secure Search',
    description:
      'The unbiased, transparent, and secure search engine. Get multiple perspectives on any topic without algorithmic bias or tracking.',
  },
  '/about': {
    title: 'About Truegle — Unbiased, Transparent & Secure Search',
    description:
      "Truegle is a privacy-first search engine built on a simple belief: you deserve to see the web without a filter bubble deciding what you're allowed to find.",
  },
  '/privacy': {
    title: 'Privacy Policy — Truegle',
    description:
      'How Truegle collects, uses, and protects your data. No tracking, no profiling, no selling your data.',
  },
  '/terms': {
    title: 'Terms of Service — Truegle',
    description:
      'The terms governing your use of Truegle Search, including acceptable use, accounts, payments, and the Rewards Program.',
  },
  '/privacy-resource-hub': {
    title: 'The Ultimate Digital Privacy & OSINT Resource Hub — Truegle',
    description:
      'A comprehensive 2026 guide to digital privacy and OSINT: why privacy matters, the top privacy-first search engines, essential OSINT tools, how to bypass censorship safely, and a surveillance reading list.',
  },
};

function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function setMetaContent(html, selectorAttr, selectorValue, content) {
  const re = new RegExp(`(<meta ${selectorAttr}="${selectorValue}" content=")[^"]*(")`, 'i');
  return html.replace(re, `$1${escapeAttr(content)}$2`);
}

function buildPageHtml(baseHtml, route, renderedMarkup) {
  const { title, description, lang } = META[route];
  // TRAILING SLASH ON PURPOSE. Every route prerender.mjs handles is written to
  // dist/<route>/index.html, which Cloudflare Pages serves at a trailing-slash
  // URL and 308-redirects the no-slash form to. The canonical must name the URL
  // that is actually served, or Google sees the page at /about/ pointing its
  // canonical at /about, follows that to a 308 back to /about/, and indexes both
  // — which is exactly the duplication that showed up in Search Console. Root
  // stays "/". Keep this in step with public/sitemap.xml.
  const canonicalUrl = `https://truegle.info${route === '/' ? '/' : `${route}/`}`;

  let html = baseHtml;
  // Localized pages: set the document language so crawlers and hreflang agree.
  if (lang) {
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${escapeAttr(lang)}"`);
  }
  // Title
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(title)}</title>`);
  // Meta description / og / twitter
  html = setMetaContent(html, 'name', 'description', description);
  html = setMetaContent(html, 'property', 'og:title', title);
  html = setMetaContent(html, 'property', 'og:description', description);
  html = setMetaContent(html, 'name', 'twitter:title', title);
  html = setMetaContent(html, 'name', 'twitter:description', description);
  // Canonical + og:url
  html = html.replace(/<link rel="canonical" href="[^"]*"/, `<link rel="canonical" href="${canonicalUrl}"`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${canonicalUrl}$2`);
  // Real content for crawlers; the live bundle still replaces this on mount.
  //
  // The comment markers bound that content so functions/_middleware.js can swap
  // it for a route's own text. "/" is the file every client-side route is
  // rewritten to (dist/_index is a copy of it), so without them /green and
  // friends were served the HOMEPAGE'S static body under their own title.
  html = html.replace('<div id="root"></div>', `<div id="root"><!--truegle-static-->${renderedMarkup}<!--/truegle-static--></div>`);
  // base: './' in vite.config.js makes every asset path relative, which only
  // resolves correctly when the HTML is served from the site root. Once the
  // same markup is written to dist/about/index.html, relative paths would
  // resolve against /about/ instead and 404. Make every local asset path
  // absolute so the page works at any depth.
  html = html.replace(/(href|src)="\.\//g, '$1="/');

  return html;
}

async function main() {
  const baseHtmlPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(baseHtmlPath)) {
    throw new Error(`${baseHtmlPath} not found — run \`vite build\` before prerender.mjs`);
  }
  const baseHtml = fs.readFileSync(baseHtmlPath, 'utf8');

  const bundlePath = path.join(__dirname, `.prerender-bundle-${Date.now()}.mjs`);
  await build({
    entryPoints: [path.join(__dirname, 'prerender-entry.jsx')],
    outfile: bundlePath,
    bundle: true,
    format: 'esm',
    platform: 'node',
    jsx: 'automatic',
    packages: 'external', // resolve react/react-dom/react-router-dom natively in this Node process
    logLevel: 'silent',
  });

  try {
    const { ROUTES, renderRoute, ROUTE_META } = await import(`file://${bundlePath}`);

    // Blog routes ship their META from the bundle (single source of truth in
    // src/content/blogPosts.jsx); merge it into the static META above.
    Object.assign(META, ROUTE_META || {});

    for (const route of ROUTES) {
      const markup = renderRoute(route);
      const html = buildPageHtml(baseHtml, route, markup);

      const outPath = route === '/' ? baseHtmlPath : path.join(distDir, route.slice(1), 'index.html');
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, html);
      console.log(`[prerender] wrote ${path.relative(root, outPath)}`);
    }

    // Fail the build if blog prerender files are missing — catches deployment
    // config regressions where the prerender step runs but its output isn't
    // included in the Pages artifact.
    const blogDir = path.join(distDir, 'blog');
    if (!fs.existsSync(blogDir) || !fs.existsSync(path.join(blogDir, 'what-is-a-filter-bubble', 'index.html'))) {
      throw new Error('FAIL: blog prerender missing — dist/blog/ was not created. Check prerender-entry.jsx and the Cloudflare Pages build command.');
    }

    // Cloudflare Pages doesn't support a 404 status on _redirects rewrites —
    // only 200/30x are allowed. Its real 404 mechanism is a top-level
    // 404.html: without one, Pages assumes a pure SPA and routes every
    // unmatched path to index.html with 200 (the soft-404 this fix targets).
    // With one present, unmatched paths get this file's body with a genuine
    // 404 status, while the _redirects 200 rules still whitelist real SPA
    // routes ahead of it. The live app still repaints on mount either way.
    fs.copyFileSync(baseHtmlPath, path.join(distDir, '404.html'));
    console.log('[prerender] wrote dist/404.html');

    // _redirects rules can't target *any* .html file: Cloudflare Pages
    // unconditionally redirects "/foo.html" -> "/foo" (see "Serving Pages" docs),
    // so a 200 rewrite to /index.html (or /_index.html) just 308s again on top of
    // it, and its _redirects validator separately false-positives wildcard rules
    // pointing at "index.html" as an "infinite loop" and silently drops them
    // (github.com/cloudflare/workers-sdk/issues/11824). Targeting an extension-less
    // file sidesteps both; _headers sets its Content-Type since Pages can't infer
    // one from the extension-less name.
    fs.copyFileSync(baseHtmlPath, path.join(distDir, '_index'));
    console.log('[prerender] wrote dist/_index');
  } finally {
    fs.rmSync(bundlePath, { force: true });
  }
}

main().catch((err) => {
  console.error('[prerender] failed:', err);
  process.exit(1);
});
