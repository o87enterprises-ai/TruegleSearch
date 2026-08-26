import React from 'react';
import LegalPage, { LegalSection } from '../components/LegalPage';

/* This page is a factual description of what the product does, not marketing.
 * It went stale once already — it described AdSense cookies and an ad-funded
 * rewards program for two months after advertising was removed on 2026-08-24,
 * and it said nothing at all about embedded players, which are the one place a
 * third party genuinely sees the visitor's IP. If you change what Truegle
 * collects, embeds, or calls out to, change this page in the same commit.
 */

const PrivacyPolicy = () => (
  <LegalPage title="Privacy Policy" lastUpdated="August 26, 2026">
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
        Search providers are queried <strong>by our server, not by your browser</strong>. The
        provider therefore sees a request from Truegle, not from you — your IP address is not
        passed on to them.
      </p>
      <p>
        If you choose to enable <em>Search History</em> in Settings, your recent searches are
        saved <strong>locally on your device only</strong> for your convenience. You can clear
        this history, or wipe all local data, at any time from Settings. History is off-limits
        to us because it never leaves your browser.
      </p>
    </LegalSection>

    <LegalSection heading="Advertising: none">
      <p>
        Truegle carries <strong>no advertising of any kind</strong> — no banners, no sponsored
        results, no affiliate placements, and no ad-network code. There are no advertising
        partners, so none can set cookies, read this page, or receive anything about you. This
        is enforced by an automated check that fails our build if ad-network code reappears.
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
          <strong>Usage limits:</strong> For features with a free-use cap we track a
          per-account or per-session counter, solely to enforce that cap.
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
        <strong>Truegle sets no cookies.</strong> There is no cookie-consent banner on this site
        because there is nothing to consent to.
      </p>
      <p>
        We do use your browser's local storage to remember your settings (such as search mode
        and safe-search preference) and, for signed-in users, an authentication token to keep
        you logged in. That data stays on your device and is readable only by Truegle. You can
        clear all Truegle local data at any time from Settings.
      </p>
    </LegalSection>

    <LegalSection heading="Embedded Players & Media">
      <p>
        When you play something in the Truegle player, Reels, or Tube, the media is delivered
        to your browser <strong>directly by the platform that hosts it</strong> — YouTube,
        Vimeo, TikTok, X, Rumble, Odysee, Dailymotion, Reddit or SoundCloud. Truegle does not
        relay the stream. This means that platform{' '}
        <strong>sees your IP address and can log the request</strong>, exactly as it would if
        you opened the video on its own site. We would rather say so plainly than let the
        surrounding page imply otherwise.
      </p>
      <p>What we do to limit what those embeds can learn:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          YouTube plays from <strong>youtube-nocookie.com</strong>, which does not set tracking
          cookies unless you press play.
        </li>
        <li>
          <strong>No third-party player scripts run on Truegle pages.</strong> X clips, for
          example, load as a plain frame rather than through X's widget script, so no platform
          code can read the page around it, your settings, or your session.
        </li>
        <li>
          Every embed is <strong>sandboxed</strong>: it cannot navigate your tab away, and it
          cannot reach Truegle's storage.
        </li>
        <li>Do Not Track is signalled to platforms that honour it.</li>
      </ul>
      <p>
        <strong>What this does not do is hide your IP from the platform.</strong> No search
        engine can do that for you; a reputable VPN or Tor can. If you would rather not appear
        at those hosts at all, don't open the embed — the original link is always shown.
      </p>
    </LegalSection>

    <LegalSection heading="Analytics">
      <p>
        Our only measurement is <strong>Cloudflare Web Analytics</strong>, chosen because it
        sets no cookies, does no fingerprinting, and builds no cross-site profile. It reports
        aggregate page views and page-load timings, and it cannot see your search queries —
        queries never appear in the URLs it reports. There is no user identifier to leak,
        because none is created.
      </p>
      <p>
        It also honours <strong>Do Not Track</strong> and <strong>Global Privacy Control</strong>:
        if your browser sends either signal, the beacon is never loaded.
      </p>
    </LegalSection>

    <LegalSection heading="Third-Party Services">
      <p>To provide search and related features, we send requests to third parties, including:</p>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong>Search &amp; content providers</strong> (e.g. Google, Brave, news, map and
          video APIs) to fetch the results you request. These are called from our servers, so
          the provider sees Truegle rather than you.
        </li>
        <li>
          <strong>Media platforms</strong> whose players you choose to open — see{' '}
          <em>Embedded Players &amp; Media</em> above. These are the exception to the line
          above: they are loaded by your browser and do see your IP.
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
