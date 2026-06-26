import React from 'react';
import { LegalSection } from '../components/LegalPage';

/**
 * Blog / editorial content — the single source of truth for both the live
 * React pages (Blog.jsx, BlogPost.jsx) and the build-time prerenderer
 * (scripts/prerender-entry.jsx). Keep bodies to plain text/links/lists so they
 * render identically in the browser and in Node's renderToStaticMarkup (no
 * browser-only APIs).
 *
 * Each post: { slug, title, description, date, readingTime, body }.
 * Order matters — newest first (the index renders them in array order).
 */
export const BLOG_POSTS = [
  {
    slug: 'what-is-a-filter-bubble',
    title: 'What Is a Filter Bubble — and How to Escape It',
    description:
      'A filter bubble quietly narrows what you see online. Here is how personalization shapes your search results, why it matters, and practical ways to see the full picture.',
    date: '2026-06-26',
    readingTime: '4 min read',
    body: (
      <>
        <p>
          A "filter bubble" is the invisible bordered version of the internet you
          end up living in when algorithms decide what you're most likely to
          click — and then show you more of it. Over time, the web stops being a
          window onto everything and becomes a mirror reflecting what a model
          already thinks you believe.
        </p>
        <LegalSection heading="How filter bubbles form">
          <p>
            Most mainstream search and feed products personalize results using
            signals like your location, past clicks, watch time, and an
            advertising profile assembled across thousands of sites. Two people
            searching the same words can get materially different results. That's
            great for engagement metrics and ad targeting — and quietly corrosive
            for an honest picture of a topic.
          </p>
        </LegalSection>
        <LegalSection heading="Why it matters">
          <ul className="list-disc pl-6 space-y-2">
            <li>You see fewer dissenting or independent sources on contested topics.</li>
            <li>Personalization is invisible — you don't get told what was hidden.</li>
            <li>The profile that powers it is built by tracking you across the web.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="How to escape it">
          <ul className="list-disc pl-6 space-y-2">
            <li>Use search that doesn't build a profile of you in the first place.</li>
            <li>Deliberately read across the spectrum, not just the top result.</li>
            <li>Compare a mainstream view against independent and primary sources.</li>
          </ul>
          <p>
            This is the whole reason Truegle exists. Our search modes let you
            choose how results are ranked — including modes that surface
            independent and alternative sources ahead of the usual top ten — and
            we don't track you to do it. Read more{' '}
            <a href="/about" className="text-blue-400 hover:text-blue-300">about how Truegle works</a>.
          </p>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'how-to-search-privately',
    title: 'How to Search Privately: A Practical Guide',
    description:
      'Private search is more than incognito mode. A practical, no-nonsense guide to reducing tracking, profiling, and data collection every time you search the web.',
    date: '2026-06-26',
    readingTime: '5 min read',
    body: (
      <>
        <p>
          "Private browsing" mode mostly hides your history from other people who
          use your device. It does very little to stop the sites, search engines,
          and ad networks on the other end from logging and profiling you. Real
          search privacy takes a few deliberate choices.
        </p>
        <LegalSection heading="1. Start with a search engine that doesn't profile you">
          <p>
            If a search engine's business model is advertising, your queries are
            the product. Choose one that doesn't store your searches server-side
            or build an advertising profile from them. Truegle keeps any search
            history local to your device, under your control — not on our servers.
          </p>
        </LegalSection>
        <LegalSection heading="2. Cut down on cross-site tracking">
          <ul className="list-disc pl-6 space-y-2">
            <li>Use a browser that blocks third-party cookies by default.</li>
            <li>Add a reputable content blocker to stop tracking scripts.</li>
            <li>Clear cookies periodically, or use containers to isolate sites.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="3. Mind the metadata">
          <p>
            Your IP address and User-Agent travel with every request. A VPN or
            privacy-respecting DNS can reduce what your network and the sites you
            visit can infer about you. The goal isn't paranoia — it's removing the
            easy, passive data collection that happens by default.
          </p>
        </LegalSection>
        <LegalSection heading="4. Know what you're trading">
          <p>
            Some personalization is genuinely convenient. The point of private
            search isn't to give all of that up — it's to make the trade a choice
            instead of a default you never agreed to. See our{' '}
            <a href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>{' '}
            for exactly what Truegle does and doesn't collect.
          </p>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'why-multiple-perspectives-matter',
    title: 'Why Seeing Multiple Perspectives Makes You Better Informed',
    description:
      'One ranked list of "best" results hides as much as it reveals. Why surfacing multiple perspectives — mainstream, independent, and alternative — leads to better judgment.',
    date: '2026-06-26',
    readingTime: '4 min read',
    body: (
      <>
        <p>
          Every search engine makes an editorial choice the moment it ranks one
          result above another. That choice is usually invisible, presented as a
          neutral list of "the best" answers. But on any contested topic, the
          ordering itself is an argument about what's credible.
        </p>
        <LegalSection heading="The problem with a single ranked list">
          <p>
            When ten links from a similar set of sources fill your first page, a
            whole landscape of independent reporting, primary documents, and
            dissenting expert opinion can sit on page four — effectively invisible.
            You're not lied to; you're just shown a narrow slice and left to assume
            it's the whole.
          </p>
        </LegalSection>
        <LegalSection heading="What multiple perspectives gives you">
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Calibration</strong> — you see where the consensus is and where it's genuinely contested.</li>
            <li><strong>Primary sources</strong> — closer to the facts than a summary of a summary.</li>
            <li><strong>Independence</strong> — viewpoints that don't all share the same incentives.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="How Truegle does it">
          <p>
            Truegle's modes let you decide how results are ranked — from standard
            relevance to modes that deliberately surface independent and
            alternative sources ahead of the mainstream — so you can triangulate
            instead of trusting a single list. It's the same web; you just get to
            see more of it. Try it on your next search, or read more{' '}
            <a href="/about" className="text-blue-400 hover:text-blue-300">about Truegle</a>.
          </p>
        </LegalSection>
      </>
    ),
  },
];

/** Look up a single post by slug (used by the post page + prerenderer). */
export function getPostBySlug(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}
