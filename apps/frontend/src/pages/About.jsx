import React from 'react';
import LegalPage, { LegalSection } from '../components/LegalPage';

const About = () => (
  <LegalPage title="About Truegle" lastUpdated="June 15, 2026">
    <p>
      Truegle is a privacy-first search engine built on a simple belief: you deserve to see the
      web without a filter bubble deciding what you're allowed to find. No tracking, no
      profiling, no hidden agenda — just results.
    </p>

    <LegalSection heading="Search Modes">
      <p>Truegle lets you choose how results are ranked and filtered:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li><strong>Blue</strong> — Standard relevance across major providers.</li>
        <li><strong>Green</strong> — The same results, with AI-generated content sources filtered out.</li>
        <li><strong>Red</strong> — Surfaces independent and alternative sources ahead of mainstream ones.</li>
        <li><strong>Purple</strong> — Strictly filters results to the perspectives you choose.</li>
        <li><strong>Ocean</strong> — A research/OSINT toolkit for lawful investigative lookups.</li>
      </ul>
    </LegalSection>

    <LegalSection heading="Privacy by Default">
      <p>
        We don't store your searches on our servers or build a profile of you. Any search history
        is kept locally on your device and fully under your control. Read more in our{' '}
        <a href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>.
      </p>
    </LegalSection>

    <LegalSection heading="Contact">
      <p>
        We'd love to hear from you. Reach us at{' '}
        <a href="mailto:truegleai@proton.me" className="text-blue-400 hover:text-blue-300">
          truegleai@proton.me
        </a>
        .
      </p>
    </LegalSection>
  </LegalPage>
);

export default About;
