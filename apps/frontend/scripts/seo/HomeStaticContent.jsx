import React from 'react';

// Crawler-visible content for "/", injected at build time by
// scripts/prerender.mjs. Real visitors never linger on this — the live
// LandingPage mounts over it on first paint, exactly as it always has.
// This exists only so a crawler that doesn't run JS (or budgets it tightly,
// like most automated network-review screens) sees real text instead of an
// empty <div id="root">. Copy here is pulled from index.html's own meta
// description / og tags and About.jsx's search-mode descriptions, so it
// can't drift into saying something the live site doesn't.

const SEARCH_MODES = [
  { name: 'Blue', description: 'Standard relevance across major providers.' },
  { name: 'Green', description: 'The same results, with AI-generated content sources filtered out.' },
  { name: 'Red', description: 'Surfaces independent and alternative sources ahead of mainstream ones.' },
  { name: 'Purple', description: 'Strictly filters results to the perspectives you choose.' },
  { name: 'Ocean', description: 'A research/OSINT toolkit for lawful investigative lookups.' },
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
          <strong>{mode.name}</strong> — {mode.description}
        </li>
      ))}
    </ul>
    <nav>
      <a href="/search">Start searching</a>
      <a href="/about">About Truegle</a>
      <a href="/privacy">Privacy Policy</a>
      <a href="/terms">Terms of Service</a>
      <a href="/advertise">Advertise on Truegle</a>
    </nav>
  </div>
);

export default HomeStaticContent;
