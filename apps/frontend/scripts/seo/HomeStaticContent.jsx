import React from 'react';

// Crawler-visible content for "/", injected at build time by
// scripts/prerender.mjs. Real visitors never linger on this — the live
// LandingPage mounts over it on first paint, exactly as it always has.
// This exists only so a crawler that doesn't run JS (or budgets it tightly,
// like most automated network-review screens) sees real text instead of an
// empty <div id="root">. Copy here is pulled from index.html's own meta
// description / og tags and About.jsx's search-mode descriptions, so it
// can't drift into saying something the live site doesn't.

// Same wording as the live cards (components/landing/ModesAndTrending.jsx).
// Each mode names its own address, so the crawler can follow it.
const SEARCH_MODES = [
  { name: 'Blue', description: 'The lens most major platforms use: widely accepted, mainstream sources first.' },
  { name: 'Green', href: '/green', description: 'Search with no AI at all. Nothing is generated and no model runs on your query.' },
  { name: 'Red', href: '/red', description: 'Independent voices and sources that challenge the official narrative, with Wonderland to isolate one perspective at a time.' },
  { name: 'Ocean', description: 'A research and OSINT toolkit for lawful investigative lookups.' },
];

// What else lives on the site, as plain links. The blog used to be reachable
// only through the sitemap, which is why Google never accepted a post.
const SURFACES = [
  { href: '/tube', name: 'True Tube', description: 'Video, reels and audio from across the web in one player, with no ads.' },
  { href: '/feed', name: 'Feed', description: 'Reddit, Mastodon, Bluesky and news in one timeline.' },
  { href: '/chat', name: 'Chat', description: 'Ask TrueGLE, an unbiased AI, through the lenses you choose.' },
  { href: '/creators', name: 'Creators', description: 'Independent channels playing in True Tube.' },
];

const GUIDES = [
  { href: '/blog/what-is-a-filter-bubble/', name: 'What is a filter bubble, and how to escape it' },
  { href: '/blog/why-multiple-perspectives-matter/', name: 'Why seeing multiple perspectives makes you better informed' },
  { href: '/blog/bias-free-search-results-perspective-modes/', name: 'How perspective modes show the full picture' },
  { href: '/blog/how-to-get-unbiased-search-results/', name: 'How to get unbiased search results' },
  { href: '/blog/how-to-search-privately/', name: 'How to search privately' },
  { href: '/blog/stop-google-tracking-searches/', name: 'How to stop Google tracking your searches' },
];

const HomeStaticContent = () => (
  <div id="seo-home">
    <div id="seo-stars" aria-hidden="true" />
    <img id="seo-logo" src="/truegle.png" alt="Truegle logo" />
    <h1>Truegle — Unbiased, Transparent &amp; Secure Search</h1>
    <p>
      Search without bias. Discover truth from multiple perspectives. No tracking, no
      cookies, no hidden agendas.
    </p>
    <h2>Why Truegle?</h2>
    <p>
      Truegle is a privacy-first search engine built on a simple belief: you deserve to
      see the web without a filter bubble deciding what you're allowed to find. Every
      search aggregates results from multiple providers with source identification, bias
      detection, and full transparency about where each result came from.
    </p>
    <h2>Search modes</h2>
    <ul>
      {SEARCH_MODES.map((mode) => (
        <li key={mode.name}>
          {mode.href ? <a href={mode.href}><strong>{mode.name}</strong></a> : <strong>{mode.name}</strong>} — {mode.description}
        </li>
      ))}
    </ul>
    <h2>More on Truegle</h2>
    <ul>
      {SURFACES.map((x) => (
        <li key={x.href}><a href={x.href}><strong>{x.name}</strong></a> — {x.description}</li>
      ))}
    </ul>
    <h2>Guides</h2>
    <ul>
      {GUIDES.map((g) => (
        <li key={g.href}><a href={g.href}>{g.name}</a></li>
      ))}
      <li><a href="/blog/">All articles</a></li>
    </ul>
    <nav>
      <a href="/search">Start searching</a>
      <a href="/about/">About Truegle</a>
      <a href="/developers/">API</a>
      <a href="/privacy-resource-hub/">Privacy and OSINT resource hub</a>
      <a href="/privacy/">Privacy Policy</a>
      <a href="/terms/">Terms of Service</a>
    </nav>
  </div>
);

export default HomeStaticContent;
