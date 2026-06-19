import React from 'react';
import LegalPage, { LegalSection } from '../components/LegalPage';

const PrivacyPolicy = () => (
  <LegalPage title="Privacy Policy" lastUpdated="June 15, 2026">
    <p>
      Truegle Search ("Truegle", "we", "us") is a privacy-first search engine. This
      policy explains what information we do and do not collect when you use{' '}
      <strong>truegle.info</strong> and our related services. Our guiding principle is
      simple: <strong>no tracking, no profiling, no selling your data.</strong>
    </p>

    <LegalSection heading="Searches">
      <p>
        We do <strong>not</strong> store your search queries on our servers, and we do not
        build a profile of you or your search history. Queries are sent to our backend only
        to retrieve results from search providers, and are not retained afterward.
      </p>
      <p>
        If you choose to enable <em>Search History</em> in Settings, your recent searches are
        saved <strong>locally on your device only</strong> for your convenience. You can clear
        this history, or wipe all local data, at any time from Settings. History is off-limits
        to us because it never leaves your browser.
      </p>
    </LegalSection>

    <LegalSection heading="Information We Collect">
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Account information (optional):</strong> If you create an account, we store
          your email address and an encrypted password (or, if you sign in with Google, the
          basic profile information Google provides). An account is not required to search.
        </li>
        <li>
          <strong>Usage tokens:</strong> For freemium features we track a per-account or
          per-session token balance to enforce usage limits.
        </li>
        <li>
          <strong>Technical data:</strong> Like most web services, our servers process standard
          request data (such as IP address and browser type) transiently to deliver results,
          prevent abuse, and apply rate limits. We do not use this to identify or track you.
        </li>
      </ul>
    </LegalSection>

    <LegalSection heading="Cookies & Local Storage">
      <p>
        We use your browser's local storage to remember your settings (such as search mode and
        safe-search preference) and, for signed-in users, an authentication token to keep you
        logged in. Advertising partners (see below) may set their own cookies. You can clear all
        Truegle local data at any time from Settings.
      </p>
    </LegalSection>

    <LegalSection heading="Third-Party Services">
      <p>To provide search and related features, we send requests to third parties, including:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Search & content providers</strong> (e.g. Google, Brave, news and video APIs)
          to fetch the results you request.
        </li>
        <li>
          <strong>Google AdSense</strong> and other advertising networks, which may use cookies
          to serve ads. See Google's{' '}
          <a
            href="https://policies.google.com/technologies/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            advertising policies
          </a>
          .
        </li>
        <li>
          <strong>Stripe</strong> for payment processing. Card details are handled by Stripe and
          never stored on our servers.
        </li>
        <li>
          <strong>OAuth providers</strong> (e.g. Google) if you choose to sign in with them.
        </li>
      </ul>
      <p>
        These providers process data under their own privacy policies. We share only what is
        necessary to fulfill your request.
      </p>
    </LegalSection>

    <LegalSection heading="Rewards Program (Opt-In)">
      <p>
        The Rewards Program is a separate, <strong>opt-in</strong> feature that pays you a small
        cash reward for ads you genuinely view while waiting on search results. It is off by
        default and has no effect on your account unless you turn it on in Settings or at{' '}
        <strong>truegle.info/rewards</strong>.
      </p>
      <p>If you opt in, we additionally collect:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Ad view duration:</strong> how long a specific ad was actually visible on your
          screen, measured server-side, so we can verify and pay rewards honestly. We do not
          record which pages you searched or what you searched for as part of this measurement —
          only the ad and the zone it appeared in.
        </li>
        <li>
          <strong>Reward balance and history:</strong> a ledger of earned amounts, your running
          balance, and any payout requests you submit (including the destination you provide,
          such as a PayPal email).
        </li>
      </ul>
      <p>
        This data is used solely to operate the Rewards Program (calculating and paying rewards,
        preventing abuse of the program, and processing payout requests) and is not sold or
        shared with advertisers. You can opt out at any time from Settings or the Rewards
        dashboard; opting out stops new tracking immediately but does not erase the historical
        ledger needed to account for rewards already paid or owed.
      </p>
    </LegalSection>

    <LegalSection heading="Your Choices & Rights">
      <ul className="list-disc pl-6 space-y-2">
        <li>Search without an account.</li>
        <li>Turn local search history on or off, and clear it at any time.</li>
        <li>Wipe all local data from your device from Settings.</li>
        <li>
          Request deletion of your account and associated data by emailing us at{' '}
          <a href="mailto:truegleai@proton.me" className="text-blue-400 hover:text-blue-300">
            truegleai@proton.me
          </a>
          .
        </li>
      </ul>
    </LegalSection>

    <LegalSection heading="Children's Privacy">
      <p>
        Truegle is not directed to children under 13, and we do not knowingly collect personal
        information from them.
      </p>
    </LegalSection>

    <LegalSection heading="Changes to This Policy">
      <p>
        We may update this policy from time to time. Material changes will be reflected by the
        "Last updated" date above.
      </p>
    </LegalSection>

    <LegalSection heading="Contact">
      <p>
        Questions about privacy? Email{' '}
        <a href="mailto:truegleai@proton.me" className="text-blue-400 hover:text-blue-300">
          truegleai@proton.me
        </a>
        .
      </p>
    </LegalSection>
  </LegalPage>
);

export default PrivacyPolicy;
