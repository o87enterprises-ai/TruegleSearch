import React from 'react';
import { Link } from 'react-router-dom';
import LegalPage, { LegalSection } from '../components/LegalPage';
import FaqBlock from '../components/FaqBlock';
import EmailSignup from '../components/EmailSignup';

/**
 * Content-hub PILLAR page — "The Ultimate Digital Privacy & OSINT Resource Hub".
 *
 * A 3,000+ word evergreen guide that anchors the privacy/OSINT topic cluster:
 * it links out to Truegle's related blog posts (the "cluster" articles) and,
 * over time, they link back here. Rendered with the same LegalPage layout as
 * About/Privacy/Terms so it prerenders to static HTML for crawlers (no
 * browser-only APIs). Carries its own Article + FAQPage JSON-LD.
 *
 * Nothing here touches the live search engine — it's a standalone content route.
 */

const PAGE_URL = 'https://truegle.info/privacy-resource-hub';
const PAGE_TITLE = 'The Ultimate Digital Privacy & OSINT Resource Hub';
const PAGE_DESC =
  'A comprehensive 2026 guide to digital privacy and open-source intelligence: why privacy matters, the top privacy-first search engines, essential OSINT tools, how to bypass censorship safely, and a surveillance reading list.';

const FAQ = [
  {
    q: 'What is the difference between digital privacy and OSINT?',
    a: 'Digital privacy is about controlling what others can collect and infer about you. OSINT (open-source intelligence) is the practice of gathering and analyzing publicly available information. They are two sides of the same coin: understanding how much can be learned from open sources is exactly what teaches you how to protect your own footprint.',
  },
  {
    q: 'What is the most private search engine?',
    a: 'There is no single winner — it depends on your threat model. Truegle aggregates multiple engines without tracking you; DuckDuckGo and Startpage are popular no-log options; a self-hosted SearXNG instance gives you the most control. The guide above compares ten of them.',
  },
  {
    q: 'Is using OSINT tools legal?',
    a: 'Collecting information that is publicly available is generally legal in most jurisdictions, but how you use it can cross legal lines (harassment, stalking, unauthorized access, or breaching a site’s terms). Always research and follow the laws that apply to you, and only investigate what you are authorized to.',
  },
  {
    q: 'Is it legal to bypass censorship with a VPN or Tor?',
    a: 'In many countries VPNs and Tor are legal and widely used for privacy; in some they are restricted or banned. The legality depends entirely on where you are. Understand your local laws before relying on any circumvention tool, and prioritize your physical safety over access.',
  },
  {
    q: 'How is Truegle different from Google?',
    a: "Truegle is unbiased, serves results from multiple engines, and doesn't track users.",
  },
];

const PrivacyResourceHub = () => {
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': PAGE_URL,
    url: PAGE_URL,
    headline: PAGE_TITLE,
    description: PAGE_DESC,
    datePublished: '2026-07-28',
    dateModified: '2026-07-28',
    author: { '@type': 'Organization', '@id': 'https://truegle.info/#organization', name: 'Truegle' },
    publisher: { '@id': 'https://truegle.info/#organization' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': PAGE_URL },
    image: { '@type': 'ImageObject', url: 'https://truegle.info/og-image.png', width: 1200, height: 630 },
  };

  return (
    <LegalPage title={PAGE_TITLE} lastUpdated="2026-07-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />

      <p className="text-lg text-gray-200">
        Digital privacy stopped being a niche concern a long time ago. In 2026, nearly every
        click, search, purchase, and step you take is logged somewhere — often by companies you
        have never heard of and never agreed to deal with. This hub is a comprehensive, plain-
        English guide to taking that power back: understanding why privacy matters, choosing tools
        that don't spy on you, learning the open-source intelligence (OSINT) techniques that
        investigators use, accessing information safely when it's blocked, and going deeper with a
        curated reading list. It's long on purpose — bookmark it and come back.
      </p>

      <nav aria-label="On this page" className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
        <p className="font-semibold text-white mb-2">On this page</p>
        <ol className="list-decimal list-inside space-y-1 text-gray-300">
          <li><a href="#why-privacy" className="text-blue-400 hover:text-blue-300">Why Privacy Matters in 2026</a></li>
          <li><a href="#search-engines" className="text-blue-400 hover:text-blue-300">Top 10 Privacy-First Search Engines</a></li>
          <li><a href="#osint-tools" className="text-blue-400 hover:text-blue-300">Essential OSINT Tools for Researchers</a></li>
          <li><a href="#bypass-censorship" className="text-blue-400 hover:text-blue-300">How to Bypass Censorship Safely</a></li>
          <li><a href="#reading-list" className="text-blue-400 hover:text-blue-300">Reading List: Books &amp; Docs on Surveillance</a></li>
        </ol>
      </nav>

      <div className="my-6">
        <EmailSignup variant="sidebar" />
      </div>

      <LegalSection heading="Why Privacy Matters in 2026">
        <p id="why-privacy">
          It is tempting to shrug at privacy with the old line, "I have nothing to hide." But
          privacy was never about hiding wrongdoing — it is about control. Privacy is the right to
          decide who knows what about you, and when. You draw the curtains at night not because
          something illicit is happening, but because the inside of your home is nobody's business
          by default. The digital world stripped away those curtains without asking, and 2026 is
          the year the consequences became impossible to ignore.
        </p>
        <p>
          Consider what a modern data profile actually contains. It is not just your name and
          email. It is your precise location history stitched together from your phone, the times
          you wake and sleep, the medical conditions implied by what you search, your political
          leanings inferred from what you read, your income bracket estimated from your purchases,
          and the social graph of everyone you talk to. None of these facts is secret on its own.
          The danger is in the aggregation: assembled together, they predict your behavior and, in
          the hands of an advertiser, a data broker, an insurer, an employer, or a government, they
          give someone leverage over you that you never consented to hand out.
        </p>
        <h3 className="text-lg font-semibold text-white">The surveillance economy, briefly</h3>
        <p>
          Most "free" online services are free because <em>you</em> are the product. The business
          model — often called surveillance capitalism — is to collect as much behavioral data as
          possible, build predictive profiles, and sell access to those predictions. Every tracker,
          cookie, fingerprinting script, and "sign in with" button is a straw in the same milkshake.
          The result is a filter bubble: the information you see is quietly shaped by what an
          algorithm thinks will keep you engaged, not by what is true or important. We wrote a whole
          explainer on this — see{' '}
          <Link to="/blog/what-is-a-filter-bubble" className="text-blue-400 hover:text-blue-300">What Is a Filter Bubble</Link>{' '}
          and{' '}
          <Link to="/blog/why-multiple-perspectives-matter" className="text-blue-400 hover:text-blue-300">Why Seeing Multiple Perspectives Makes You Better Informed</Link>.
        </p>
        <h3 className="text-lg font-semibold text-white">Why it is worse now</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>AI supercharges inference.</strong> Machine-learning models can now derive sensitive traits — health, sexuality, emotional state — from data that looks harmless, so "anonymized" data is rarely anonymous.</li>
          <li><strong>Data breaches are routine.</strong> Everything collected about you eventually leaks. The only data that can't be stolen from a company is the data it never collected.</li>
          <li><strong>Cross-device tracking is the norm.</strong> Your phone, laptop, TV, and car are increasingly linked into one profile.</li>
          <li><strong>Chilling effects are real.</strong> People self-censor what they search, read, and say when they believe they're being watched — which quietly narrows public discourse.</li>
        </ul>
        <p>
          The good news: privacy is not all-or-nothing, and you do not need to become a hermit. Small,
          deliberate choices — the search engine you use, the browser settings you change once, the
          tools below — meaningfully reduce how much of you is for sale. That is what the rest of this
          guide is for.
        </p>
        <h3 className="text-lg font-semibold text-white">A 20-minute privacy starter checklist</h3>
        <p>
          If you do nothing else, do these. Each takes a couple of minutes and pays off every day
          afterward. They are ordered by impact-per-effort, so start at the top and go as far down as
          you have time for.
        </p>
        <ol className="list-decimal list-inside space-y-1">
          <li><strong>Switch your default search engine</strong> to a no-track option (see the next section) in every browser you use.</li>
          <li><strong>Install a content blocker</strong> such as uBlock Origin to stop trackers and malvertising before they load.</li>
          <li><strong>Use a privacy-respecting browser</strong> — Firefox with strict tracking protection, Brave, or the Tor Browser for sensitive work.</li>
          <li><strong>Turn on encrypted DNS</strong> (DNS-over-HTTPS) in your browser or operating system.</li>
          <li><strong>Audit your account permissions</strong> — revoke third-party apps and ad-personalization settings you never use.</li>
          <li><strong>Move sensitive conversations to Signal</strong>, which is end-to-end encrypted by default.</li>
          <li><strong>Check your email at Have I Been Pwned</strong> and change any password that shows up in a breach.</li>
          <li><strong>Adopt a password manager</strong> so every account has a unique, strong password.</li>
        </ol>
        <p>
          None of this requires technical skill, and none of it costs money. Privacy done well is
          mostly a set of one-time defaults, not a daily chore.
        </p>
      </LegalSection>

      <LegalSection heading="Top 10 Privacy-First Search Engines">
        <p id="search-engines">
          Your search engine sees your unfiltered curiosity — the questions you would never say out
          loud. That makes it the single highest-leverage privacy upgrade most people can make. Here
          are ten engines that respect your privacy far more than the mainstream default, with honest
          notes on the trade-offs. There is no universal "best"; pick based on your priorities.
        </p>
        <ol className="list-decimal list-inside space-y-3">
          <li>
            <strong>Truegle</strong> — that's us. Truegle is an unbiased, privacy-first metasearch
            engine: it aggregates results from multiple providers through a self-hosted layer,
            labels sources, offers perspective modes so you can compare viewpoints, and does not
            track, profile, or sell your queries. It also lets you open results anonymously through
            a proxy. Best for people who want breadth <em>and</em> transparency. See{' '}
            <Link to="/blog/unbiased-search-engine-how-truegle-works" className="text-blue-400 hover:text-blue-300">how Truegle works</Link>.
          </li>
          <li>
            <strong>DuckDuckGo</strong> — the best-known no-track option. Easy, mainstream-friendly,
            with solid results (partly sourced from Bing) and strong browser extensions. A great
            first step away from Google.
          </li>
          <li>
            <strong>Startpage</strong> — serves Google's results without Google's tracking, acting as
            a privacy intermediary. Good if you specifically want Google-quality results privately.
          </li>
          <li>
            <strong>Brave Search</strong> — runs on its own independent index (not just reselling Big
            Tech results), which is rare and valuable for reducing bias. No tracking; optional AI
            summaries.
          </li>
          <li>
            <strong>SearXNG</strong> — a free, open-source metasearch engine you can self-host. If
            you run your own instance, no third party sees your queries at all. Maximum control, some
            setup effort. (Truegle's own aggregation layer is built on this lineage.)
          </li>
          <li>
            <strong>Mojeek</strong> — one of the few engines with a genuinely independent crawler and
            index. Smaller coverage, but truly not dependent on Google or Bing.
          </li>
          <li>
            <strong>Mullvad Leta</strong> — from the privacy-focused Mullvad VPN team, a minimalist
            no-log search front end. Pairs naturally with their VPN.
          </li>
          <li>
            <strong>Kagi</strong> — a paid, ad-free search engine. Because you pay with money instead
            of data, its incentives are aligned with the user. Excellent results and customization;
            the trade-off is the subscription.
          </li>
          <li>
            <strong>MetaGer</strong> — a nonprofit German metasearch engine that emphasizes privacy
            and transparency, with an optional anonymizing proxy for opening results.
          </li>
          <li>
            <strong>Whoogle</strong> — a self-hostable, open-source front end that gives you Google
            results with ads and tracking stripped out. Like SearXNG, best when you run it yourself.
          </li>
        </ol>
        <p>
          <strong>How to choose:</strong> if you want zero setup, start with DuckDuckGo or Truegle.
          If you want an independent index to escape Big Tech bias, look at Brave or Mojeek. If you
          want total control and can self-host, run SearXNG or Whoogle. And whatever you pick, set it
          as your browser's default so privacy is the path of least resistance. Our guide to{' '}
          <Link to="/blog/how-to-search-privately" className="text-blue-400 hover:text-blue-300">searching privately</Link>{' '}
          walks through the browser settings that matter.
        </p>
      </LegalSection>

      <LegalSection heading="Essential OSINT Tools for Researchers">
        <p id="osint-tools">
          Open-source intelligence (OSINT) is the discipline of collecting and analyzing information
          that is already public — websites, social media, public records, leaked-and-indexed data,
          metadata, and more. Journalists, security researchers, fact-checkers, and investigators use
          it to verify claims and uncover connections. Learning OSINT has a second benefit: seeing how
          easily open data reveals a person is the fastest way to understand — and shrink — your own
          exposure. Everything below is legal to <em>use</em> for legitimate research; how you apply
          it is your responsibility (see the ethics note at the end of this section).
        </p>
        <h3 className="text-lg font-semibold text-white">Reconnaissance &amp; aggregation</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>OSINT Framework</strong> — a curated, categorized directory of hundreds of free tools; the best starting map of the landscape.</li>
          <li><strong>Maltego</strong> — the industry-standard link-analysis tool for visualizing relationships between people, domains, emails, and infrastructure. A free community edition exists.</li>
          <li><strong>SpiderFoot</strong> — an open-source automation engine that queries 200+ data sources about a target (domain, IP, email, name) and correlates the results.</li>
          <li><strong>Recon-ng</strong> — a modular, command-line reconnaissance framework for people who like a scripted, repeatable workflow.</li>
        </ul>
        <h3 className="text-lg font-semibold text-white">People, usernames &amp; email</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Sherlock</strong> — checks whether a username exists across hundreds of social platforms in one pass.</li>
          <li><strong>theHarvester</strong> — gathers emails, subdomains, and names associated with a domain from public sources.</li>
          <li><strong>Have I Been Pwned</strong> — tells you if an email or password has appeared in a known data breach. Everyone should check their own.</li>
          <li><strong>Hunter.io</strong> — finds and verifies professional email addresses tied to a domain (freemium).</li>
        </ul>
        <h3 className="text-lg font-semibold text-white">Infrastructure, domains &amp; devices</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Shodan</strong> — a search engine for internet-connected devices and services; invaluable for security research and understanding attack surface.</li>
          <li><strong>WHOIS &amp; DNS lookups</strong> — reveal domain registration, hosting, and record history; the bread-and-butter of any investigation.</li>
          <li><strong>Google Dorking</strong> — using advanced search operators (site:, filetype:, intitle:) to surface exposed documents and pages. Truegle supports the same operators.</li>
        </ul>
        <h3 className="text-lg font-semibold text-white">Media, metadata &amp; archives</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>ExifTool</strong> — reads (and strips) the hidden metadata in photos and documents — camera model, GPS coordinates, timestamps. Use it on your own files before sharing them.</li>
          <li><strong>Reverse image search</strong> — Google Images, TinEye, and Yandex help verify where an image really came from and debunk fakes.</li>
          <li><strong>The Wayback Machine</strong> — the Internet Archive's snapshots let you see deleted or altered pages as they once were; essential for accountability work.</li>
        </ul>
        <p>
          Truegle's own <Link to="/search?mode=ocean" className="text-blue-400 hover:text-blue-300">Ocean (OSINT) mode</Link>{' '}
          bundles lawful public-records lookups for domains, emails, usernames, and phone numbers into
          the search experience, so you can start an investigation without wiring up a dozen separate
          tools.
        </p>
        <h3 className="text-lg font-semibold text-white">A simple verification workflow</h3>
        <p>
          Tools are only as good as the method behind them. When you are trying to verify a claim or
          an image, a repeatable workflow beats ad-hoc searching: start by identifying exactly what you
          are trying to confirm, then find the <em>primary</em> source rather than a report about it —
          the original document, dataset, photo, or account. Check when and where a piece of media
          actually originated using reverse image search and metadata, and corroborate across at least
          two independent sources that do not simply cite each other. Preserve what you find with an
          archive link before it can change or disappear, and write down your reasoning so someone else
          could retrace your steps. This is the same discipline that keeps you from being fooled — and
          it is exactly why Truegle labels sources and lets you compare perspectives side by side.
        </p>
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <strong>Ethics &amp; legality:</strong> OSINT collects public information, but public does
          not mean consequence-free. Using these tools to stalk, harass, dox, or gain unauthorized
          access is illegal and harmful. Only investigate what you are authorized to, follow the laws
          in your jurisdiction and each service's terms, and treat the people behind the data as
          people. The point of learning this is to inform and protect — including protecting yourself.
        </p>
      </LegalSection>

      <LegalSection heading="How to Bypass Censorship Safely">
        <p id="bypass-censorship">
          Access to information is uneven around the world. Governments, networks, schools, and
          workplaces block content for reasons ranging from the reasonable to the repressive. If you
          need to reach information that has been blocked, the following approaches can help — but
          <strong> safety and legality come first</strong>. In some countries, circumvention tools are
          restricted or illegal, and using them can carry real personal risk. Understand your local
          laws and your own threat model before you rely on anything here.
        </p>
        <h3 className="text-lg font-semibold text-white">The main techniques</h3>
        <ul className="list-disc list-inside space-y-2">
          <li>
            <strong>A reputable VPN.</strong> A virtual private network encrypts your traffic and
            routes it through a server elsewhere, hiding the destination from your local network and
            your location from the destination. Choose an audited, no-log provider (Mullvad and Proton
            VPN are frequently recommended for their track records) and avoid "free" VPNs, which often
            monetize your data — the exact thing you're trying to avoid.
          </li>
          <li>
            <strong>The Tor Browser.</strong> Tor routes your traffic through several volunteer relays,
            making it very hard to trace back to you. It's the strongest widely available anonymity
            tool for reading and publishing. Where Tor itself is blocked, <strong>bridges</strong>
            {' '}(unlisted entry points) and pluggable transports can help you connect.
          </li>
          <li>
            <strong>Encrypted DNS.</strong> Switching to DNS-over-HTTPS or DNS-over-TLS (via providers
            like Quad9 or Cloudflare's 1.1.1.1) stops the most basic form of blocking, where a network
            simply refuses to resolve a domain name.
          </li>
          <li>
            <strong>Mirrors, proxies &amp; archives.</strong> Blocked pages are often reachable through
            a mirror site, a web proxy, or the Wayback Machine's archived copy. Truegle's anonymous
            "view" proxy lets you open a result without the destination seeing your address.
          </li>
          <li>
            <strong>Purpose-built circumvention apps.</strong> Tools such as Psiphon and Lantern are
            designed specifically to get around network censorship in restrictive environments.
          </li>
        </ul>
        <h3 className="text-lg font-semibold text-white">Staying safe while you do it</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Know the law where you are.</strong> This is the single most important step. In some places the tool itself is the risk.</li>
          <li><strong>Use encrypted messaging</strong> (Signal) for sensitive conversations, and compartmentalize identities where needed.</li>
          <li><strong>Keep software updated.</strong> Outdated browsers and apps are the most common way anonymity is broken.</li>
          <li><strong>Don't log in.</strong> Reaching blocked content anonymously means nothing if you then sign into an account that identifies you.</li>
          <li><strong>Prefer safety over access.</strong> No article is worth your physical security. If in doubt, don't.</li>
        </ul>
        <p>
          For the everyday-privacy version of this — reducing tracking even when nothing is blocked —
          see our practical guide to{' '}
          <Link to="/blog/how-to-search-privately" className="text-blue-400 hover:text-blue-300">searching privately</Link>{' '}
          and{' '}
          <Link to="/blog/search-without-tracking-alternative-to-google" className="text-blue-400 hover:text-blue-300">searching without tracking</Link>.
        </p>
      </LegalSection>

      <LegalSection heading="Reading List: Books & Docs on Surveillance">
        <p id="reading-list">
          If this guide sparked your interest, the works below go deeper. They range from rigorous
          non-fiction to primary-source documentation, and together they explain both how the modern
          surveillance apparatus was built and what to do about it.
        </p>
        <h3 className="text-lg font-semibold text-white">Books</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong><em>The Age of Surveillance Capitalism</em></strong> — Shoshana Zuboff. The definitive account of how behavioral data became the raw material of a trillion-dollar economy.</li>
          <li><strong><em>Data and Goliath</em></strong> — Bruce Schneier. A clear, practical map of mass surveillance and concrete steps to push back, from a leading security technologist.</li>
          <li><strong><em>Permanent Record</em></strong> — Edward Snowden. A firsthand account of mass surveillance from the inside, and why he chose to disclose it.</li>
          <li><strong><em>No Place to Hide</em></strong> — Glenn Greenwald. The story of the Snowden disclosures and their implications for press freedom and privacy.</li>
          <li><strong><em>The Filter Bubble</em></strong> — Eli Pariser. The book that named the problem of algorithmic personalization narrowing what we see.</li>
          <li><strong><em>Dragnet Nation</em></strong> — Julia Angwin. A journalist's hands-on experiment in trying to live privately in a tracked world.</li>
          <li><strong><em>Weapons of Math Destruction</em></strong> — Cathy O'Neil. How opaque algorithms make consequential decisions about people at scale, often unfairly.</li>
          <li><strong><em>Surveillance Valley</em></strong> — Yasha Levine. A critical history of the internet's entanglement with military and intelligence interests.</li>
        </ul>
        <h3 className="text-lg font-semibold text-white">Guides &amp; primary sources</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>EFF's Surveillance Self-Defense</strong> — the Electronic Frontier Foundation's free, practical, regularly updated guide to protecting yourself online. Start here.</li>
          <li><strong>Access Now's Digital Security Helpline</strong> — free security help for activists, journalists, and civil society worldwide.</li>
          <li><strong>The Snowden archive</strong> — the primary-source documents behind the 2013 disclosures, as reported by major outlets and the National Security Archive.</li>
          <li><strong>Privacy Guides (privacyguides.org)</strong> — a community-maintained, non-commercial catalog of vetted privacy tools and how-tos.</li>
          <li><strong>The Citizen Lab reports</strong> — meticulous research on targeted surveillance, spyware, and censorship around the world.</li>
        </ul>
        <p>
          Read critically, cross-check claims, and — fittingly — look them up from more than one
          source. That habit, more than any single tool, is what keeps you genuinely well informed.
        </p>
      </LegalSection>

      <div className="mt-10 p-6 rounded-2xl border border-blue-500/30 bg-white/5 text-center">
        <p className="text-lg font-medium text-white mb-3">
          Ready to search without bias or tracking?
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-500 to-cyan-500 hover:opacity-90 text-white transition-opacity"
        >
          Search with Truegle
        </Link>
      </div>

      <div className="my-8">
        <EmailSignup variant="sidebar" />
      </div>

      <FaqBlock faq={FAQ} pageUrl={PAGE_URL} />

      <div className="pt-6 mt-4 border-t border-gray-800">
        <Link to="/blog" className="text-sm text-blue-400 hover:text-blue-300">
          ← Explore the Truegle blog
        </Link>
      </div>
    </LegalPage>
  );
};

export default PrivacyResourceHub;
