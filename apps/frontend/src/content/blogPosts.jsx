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
    slug: 'how-to-get-unbiased-search-results',
    title: 'How to Get Unbiased Search Results: A Practical Guide',
    description:
      'Unbiased search results aren\'t about finding one "neutral" engine — they\'re a method. Here is how to get a fuller, less filtered picture on any topic.',
    date: '2026-07-29',
    readingTime: '6 min read',
    faq: [
      {
        q: 'How do I get unbiased search results?',
        a: 'Use a search engine that does not personalize by tracking you, then deliberately compare multiple sources — start from the primary source, read a mainstream and an independent take, and note where they agree.',
      },
      {
        q: 'Is any search engine truly unbiased?',
        a: 'No engine is perfectly neutral — ranking always encodes choices. "Unbiased" in practice means the tool does not secretly pick a perspective for you based on your history, and lets you see multiple viewpoints.',
      },
      {
        q: 'Does signing out make my search unbiased?',
        a: 'It reduces personalization but does not remove it — location and aggregate signals still shape results. Pair signing out with a non-tracking engine and cross-checking sources.',
      },
    ],
    body: (
      <>
        <p>
          <strong>Short answer:</strong> "unbiased search" isn't a single engine you
          switch to — it's a method. You get a fuller, less filtered picture by using
          a search tool that doesn't personalize results to a profile of you, and then
          deliberately comparing more than one source and perspective. Here's how to
          do it in practice.
        </p>
        <LegalSection heading="Why a single ranked list is misleading">
          <p>
            Every search engine makes an editorial choice the moment it ranks one
            result above another — and mainstream engines personalize that ranking
            using your location, past clicks, and an advertising profile. Two people
            searching the same words can get materially different results, and neither
            is told what was filtered out. On a contested topic, the first page can
            feel like "just the facts" while quietly omitting the strongest opposing
            evidence. That's a{' '}
            <a href="/blog/what-is-a-filter-bubble" className="text-blue-400 hover:text-blue-300">filter bubble</a>.
          </p>
        </LegalSection>
        <LegalSection heading="The method: how to actually do it">
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>Use a non-personalizing search engine.</strong> If the engine doesn't build a behavioral profile of you, it can't secretly tailor the ranking to what you already believe.</li>
            <li><strong>Start from the primary source.</strong> Before you read commentary, find the original study, ruling, dataset, or transcript — not a headline about it.</li>
            <li><strong>Read a mainstream take and an independent take.</strong> Deliberately pull one of each so a single set of incentives isn't shaping everything you see.</li>
            <li><strong>Note where they agree.</strong> Agreement across sources with different incentives is the strongest signal you'll get.</li>
            <li><strong>Note where they diverge, and ask why.</strong> Divergence usually reveals an assumption, an incentive, or a genuinely open question.</li>
            <li><strong>Search signed out.</strong> Being logged in re-attaches results to your profile; a signed-out session on a non-tracking engine is closer to neutral.</li>
          </ol>
        </LegalSection>
        <LegalSection heading="A worked example">
          <p>
            Say you're researching a contested policy. A personalized first page might
            hand you five outlets that all share one framing. Instead, pull the actual
            bill or ruling (primary source), read how a mainstream outlet covers it,
            then read an independent one — and watch where they agree on facts but
            diverge on emphasis. Same query, a far more honest picture, because you saw
            more than one slice. This is exactly{' '}
            <a href="/blog/why-multiple-perspectives-matter" className="text-blue-400 hover:text-blue-300">why seeing multiple perspectives makes you better informed</a>.
          </p>
        </LegalSection>
        <LegalSection heading="Where Truegle fits">
          <p>
            Truegle is built to make this the default instead of a chore. It doesn't
            track or profile you, it aggregates results from multiple providers (so no
            single company's ranking decides what you see), and its perspective modes
            let you re-rank the same query — mainstream, independent, academic, and
            more — with each source labeled so you can compare framings at a glance.
            See{' '}
            <a href="/blog/unbiased-search-engine-how-truegle-works" className="text-blue-400 hover:text-blue-300">how Truegle delivers unbiased results</a>{' '}
            and the full playbook in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
          </p>
        </LegalSection>
        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>Unbiased search is a method, not a magic engine: don't get personalized, then compare sources.</li>
            <li>Start from the primary source, read a mainstream and an independent take, and watch where they agree and diverge.</li>
            <li>Search signed out on a non-tracking engine to get closer to neutral.</li>
            <li>Truegle's labeled, switchable perspective modes make triangulation the default — start at{' '}
              <a href="/search" className="text-blue-400 hover:text-blue-300">truegle.info</a>.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'stop-google-tracking-searches',
    title: 'How to Stop Google From Tracking Your Searches',
    description:
      'A step-by-step guide to stopping Google from logging and profiling your searches — from account settings to switching engines — and what each step actually does.',
    date: '2026-07-29',
    readingTime: '6 min read',
    faq: [
      {
        q: 'Can you fully stop Google from tracking your searches?',
        a: 'You can dramatically reduce it via Web & App Activity settings, ad settings, and signing out — but the only way to fully stop it is to stop using Google Search and switch to a non-tracking engine.',
      },
      {
        q: 'Does turning off Web & App Activity delete my history?',
        a: 'It stops new search and activity from being saved to your account going forward. You can separately delete past activity and turn on auto-delete; it does not affect aggregate/anonymous data.',
      },
      {
        q: 'What is the easiest way to search without Google tracking?',
        a: 'Switch your default search engine to a no-track option and search signed out — that removes the biggest source of per-account profiling in a single step.',
      },
    ],
    body: (
      <>
        <p>
          <strong>Short answer:</strong> you can dramatically reduce Google's tracking
          by changing a few account and browser settings — but the only way to
          <em> fully</em> stop it is to stop searching on Google. Here's the
          step-by-step, easiest and highest-impact first, with what each step actually
          does.
        </p>
        <LegalSection heading="1. Switch your default search engine (biggest win)">
          <p>
            The single highest-impact move: set your browser's default search engine to
            a no-track option and do your searching there instead of on Google. No
            account setting matters if the queries never reach Google in the first
            place. This one change removes the largest source of per-account search
            profiling.
          </p>
        </LegalSection>
        <LegalSection heading="2. Turn off Web & App Activity">
          <p>
            In your Google Account, open <strong>Data &amp; privacy → Web &amp; App
            Activity</strong> and turn it off. This stops Google from saving your
            searches and activity to your account going forward. While you're there,
            delete past activity and set <strong>auto-delete</strong> to the shortest
            window. Do the same for <strong>Location History</strong> and
            <strong> YouTube History</strong> if you use them.
          </p>
        </LegalSection>
        <LegalSection heading="3. Turn off ad personalization">
          <p>
            In <strong>Data &amp; privacy → My Ad Center / Ad personalization</strong>,
            turn personalization off. This won't remove ads, but it stops them from
            being targeted using a behavioral profile built from your activity.
          </p>
        </LegalSection>
        <LegalSection heading="4. Search signed out">
          <p>
            Even with the settings above, searching while logged into your Google
            account re-attaches activity to you. Search signed out — or in a browser
            profile that's never logged into Google — and be wary of "sign in with
            Google" buttons that re-link your identity.
          </p>
        </LegalSection>
        <LegalSection heading="5. Harden the browser">
          <ul className="list-disc pl-6 space-y-2">
            <li>Use a privacy browser (Firefox with strict tracking protection, or Brave) and block third-party cookies.</li>
            <li>Add a content blocker like uBlock Origin to stop tracking scripts before they load.</li>
            <li>Consider moving off Chrome, which is made by the same company you're trying to limit.</li>
            <li>Turn on encrypted DNS (DNS-over-HTTPS) so your network can't log every domain.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="6. Hide your IP for network-level privacy">
          <p>
            Settings stop profiling; they don't hide your network identity. A reputable,
            audited VPN (or Tor) hides your IP from the sites you visit — the one thing
            no search setting can do for you.
          </p>
        </LegalSection>
        <LegalSection heading="The honest limit">
          <p>
            Turning off these settings limits what's tied to <em>your account</em>, but
            Google can still receive signals from signed-out and aggregate activity. The
            only way to truly stop Google from tracking your searches is to not run them
            through Google. That's the whole point of using a{' '}
            <a href="/blog/search-without-tracking-alternative-to-google" className="text-blue-400 hover:text-blue-300">search engine that doesn't track you</a>{' '}
            in the first place.
          </p>
        </LegalSection>
        <LegalSection heading="Where Truegle fits">
          <p>
            Truegle was built privacy-first: it doesn't store your searches to a
            per-account profile, doesn't run cross-site trackers, and uses contextual
            (not behavioral) ads. Set it as your default and steps 2–4 above become far
            less necessary. See the complete guide in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>{' '}
            and our practical{' '}
            <a href="/blog/how-to-search-privately" className="text-blue-400 hover:text-blue-300">guide to searching privately</a>.
          </p>
        </LegalSection>
        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>Biggest win: switch your default engine to a no-track option and search there.</li>
            <li>Turn off Web &amp; App Activity + ad personalization, delete history, set auto-delete.</li>
            <li>Search signed out, harden the browser, and use a VPN/Tor for your IP.</li>
            <li>Full tracking stops only when the query never reaches Google — try{' '}
              <a href="/search" className="text-blue-400 hover:text-blue-300">Truegle</a>.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'best-free-osint-tools-for-beginners',
    title: 'The Best Free OSINT Tools for Beginners (2026)',
    description:
      'A beginner-friendly, lawful starter kit of free OSINT tools — what each one does, how to start, and the ethics that keep your research on the right side.',
    date: '2026-07-29',
    readingTime: '7 min read',
    faq: [
      {
        q: 'What are the best free OSINT tools for beginners?',
        a: 'Start with the OSINT Framework (a directory), Sherlock (usernames), Have I Been Pwned (breaches), the Wayback Machine (archived pages), reverse image search, and WHOIS/DNS lookups — all free and lawful for public research.',
      },
      {
        q: 'Is it legal to use OSINT tools?',
        a: 'Collecting publicly available information is generally legal, but how you use it can cross legal lines (harassment, unauthorized access, breaching a site\'s terms). Only investigate what you are authorized to and follow your local laws.',
      },
      {
        q: 'Do I need to know how to code to do OSINT?',
        a: 'No. Many of the best starter tools are websites or one-click checks. Coding helps with automation later, but beginners can get far with browser-based tools.',
      },
    ],
    body: (
      <>
        <p>
          <strong>Short answer:</strong> the best free OSINT tools for beginners are the
          OSINT Framework (a directory of everything else), Sherlock for usernames, Have
          I Been Pwned for breaches, the Wayback Machine for deleted pages, reverse image
          search for verifying photos, and WHOIS/DNS lookups for domains. All are free,
          most are browser-based, and none require code. Here's what each does and how to
          start — lawfully.
        </p>
        <LegalSection heading="What OSINT actually is">
          <p>
            OSINT (open-source intelligence) is collecting and analyzing information
            that's already public — websites, social media, public records, archives,
            and metadata. Journalists, researchers, and security teams use it to verify
            claims and connect dots. Learning it has a bonus: seeing how easily open data
            reveals a person is the fastest way to understand — and shrink — your own
            exposure.
          </p>
        </LegalSection>
        <LegalSection heading="The beginner starter kit">
          <h3 className="text-lg font-semibold text-white">Start here</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>OSINT Framework</strong> — a categorized directory of hundreds of free tools; the best map of the landscape when you don't know where to begin.</li>
            <li><strong>Have I Been Pwned</strong> — check whether an email or password has appeared in a known breach. Everyone should run their own first.</li>
          </ul>
          <h3 className="text-lg font-semibold text-white">People &amp; usernames</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Sherlock</strong> — checks whether a username exists across hundreds of platforms in one pass.</li>
          </ul>
          <h3 className="text-lg font-semibold text-white">Media &amp; archives</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Reverse image search</strong> (Google Images, TinEye, Yandex) — verify where an image really came from and debunk fakes.</li>
            <li><strong>The Wayback Machine</strong> — see deleted or altered pages as they once were; essential for accountability work.</li>
            <li><strong>ExifTool</strong> — read (and strip) hidden photo/document metadata like GPS and timestamps. Use it on your own files before sharing.</li>
          </ul>
          <h3 className="text-lg font-semibold text-white">Domains &amp; infrastructure</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>WHOIS &amp; DNS lookups</strong> — reveal domain registration, hosting, and record history.</li>
            <li><strong>Google dorking</strong> — advanced operators (site:, filetype:, intitle:) to surface exposed documents and pages.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="How to start: your first exercise">
          <p>
            The best first investigation is <em>yourself</em>. Run your own email through
            Have I Been Pwned, search your usernames with Sherlock, reverse-image-search
            your profile photo, and check what a WHOIS or people-search turns up. You'll
            learn the tools with zero ethical risk — and probably find a few things to
            lock down. That's the fastest way to go from "what is OSINT" to actually
            doing it.
          </p>
        </LegalSection>
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          <strong>Ethics &amp; legality:</strong> public information isn't consequence-free.
          Using these tools to stalk, harass, dox, or gain unauthorized access is illegal
          and harmful. Only investigate what you're authorized to, follow the laws in your
          jurisdiction and each service's terms, and treat the people behind the data as
          people.
        </p>
        <LegalSection heading="Where Truegle fits">
          <p>
            Truegle's Ocean (OSINT) mode bundles lawful public-records lookups for
            domains, emails, usernames, and phone numbers into the search experience, so
            you can start an investigation without wiring up a dozen separate tools. For
            the deeper toolkit and the ethics that go with it, see the OSINT section of{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
          </p>
        </LegalSection>
        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>Beginner kit: OSINT Framework, Have I Been Pwned, Sherlock, reverse image search, Wayback Machine, ExifTool, WHOIS/DNS — all free, mostly browser-based, no code.</li>
            <li>Start by investigating yourself: it teaches the tools and shrinks your own exposure.</li>
            <li>Public doesn't mean consequence-free — stay lawful and ethical.</li>
            <li>Truegle's Ocean mode gives you lawful lookups in one place; go deeper in the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'is-duckduckgo-really-private',
    title: 'Is DuckDuckGo Really Private? An Honest Look (2026)',
    description:
      'DuckDuckGo is far more private than Google, but it isn\'t a silver bullet. Here is what it does and doesn\'t protect — and how to actually search privately.',
    date: '2026-07-29',
    readingTime: '6 min read',
    faq: [
      {
        q: 'Is DuckDuckGo actually private, or is that just marketing?',
        a: 'It is genuinely private in the ways that matter most: no per-account search history and no behavioral advertising profile. But it cannot hide your IP address, so it is "no profiling," not "anonymous."',
      },
      {
        q: 'Does DuckDuckGo track you at all?',
        a: 'DuckDuckGo says it does not track your searches. In 2022 its browser was found to permit some Microsoft-owned trackers under a syndication deal; DuckDuckGo then expanded its tracker blocking in response.',
      },
      {
        q: 'Is DuckDuckGo enough, or do I need a VPN too?',
        a: 'For search profiling, DuckDuckGo is enough on its own. To also hide your IP and network activity, add a VPN or Tor — a search engine cannot do that part for you.',
      },
    ],
    body: (
      <>
        <p>
          DuckDuckGo is far more private than Google — but "private" isn't
          all-or-nothing. Here's an honest look at what it actually protects,
          where it falls short, and how to close the gaps.
        </p>
        <p>
          <strong>Short answer:</strong> Yes, DuckDuckGo (DDG) is genuinely more
          private than Google. It doesn't store your search history in a personal
          profile, it doesn't build an advertising identity from your queries, and
          its ads are contextual rather than behaviorally targeted. But "private
          search engine" doesn't mean "anonymous" — DDG can't hide your IP address
          from the wider internet, it's US-based, and it has had a notable tracker
          exception in the past. It's a big upgrade, not a force field.
        </p>

        <LegalSection heading="What DuckDuckGo does protect">
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>No personal search history.</strong> DDG doesn't tie your searches to an account-level profile the way a signed-in Google search is stored in your Google account.</li>
            <li><strong>No behavioral ad profile.</strong> Its ads are based on the current search term (contextual), not on a dossier of everything you've ever searched.</li>
            <li><strong>Third-party tracker blocking.</strong> DDG's browser and extension block many third-party trackers on the sites you visit, and signal opt-outs on your behalf.</li>
            <li><strong>Encrypted connections.</strong> It upgrades many sites to HTTPS automatically.</li>
          </ul>
          <p>
            For the average person coming from Google, switching to DDG removes the
            single biggest source of search-based profiling. That alone is worth
            doing.
          </p>
        </LegalSection>

        <LegalSection heading="Where &quot;private&quot; gets fuzzy">
          <p>Being honest about the limits is what separates real privacy advice from marketing:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Your IP address still travels with every request.</strong> A search engine that doesn't profile you can still see the connection. Hiding your network identity needs a VPN or Tor — no search engine does that for you.</li>
            <li><strong>Results are powered by Bing.</strong> DDG runs its own crawler for some things but leans on Microsoft's Bing index for core results — fine for privacy in itself, but it isn't a fully independent index.</li>
            <li><strong>The 2022 tracker exception.</strong> Researchers found DuckDuckGo's mobile browser was permitting certain Microsoft-owned trackers due to a search-syndication agreement. DDG acknowledged it and expanded its tracker blocking — a reminder that "no tracking" claims deserve scrutiny, even from privacy brands.</li>
            <li><strong>US jurisdiction.</strong> DDG is a US company, which matters for some threat models even though it says it stores no personal search data to hand over.</li>
          </ul>
          <p>None of these make DDG "not private." They just mean privacy is a stack, and a search engine is one layer of it.</p>
        </LegalSection>

        <LegalSection heading="A quick way to test the claim yourself">
          <p>
            You don't have to take anyone's word for it. Search the same term
            signed out on Google and on DuckDuckGo, then compare: DDG won't ask you
            to sign in, won't follow you with a recognizable ad for that product
            across other sites, and won't quietly reshape your next search based on
            what you just clicked. Watching what <em>doesn't</em> happen is the most
            honest privacy test there is.
          </p>
        </LegalSection>

        <LegalSection heading="How to actually search privately (close the gaps)">
          <p>DDG (or any no-track engine) is step one. To get the rest of the way:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>Add a content blocker</strong> like uBlock Origin so trackers can't load regardless of which engine you use.</li>
            <li><strong>Use a privacy browser</strong> — Firefox with strict tracking protection, Brave, or the Tor Browser for sensitive work.</li>
            <li><strong>Turn on encrypted DNS</strong> (DNS-over-HTTPS) so your network can't log every domain.</li>
            <li><strong>Use a reputable, audited VPN</strong> (or Tor) to hide your IP — the one thing search engines can't do for you.</li>
            <li><strong>Don't search while signed into an identifying account</strong>, and skip "sign in with Google/Facebook" prompts.</li>
          </ol>
          <p>
            We walk through these in detail in{' '}
            <a href="/blog/how-to-search-privately" className="text-blue-400 hover:text-blue-300">How to Search Privately</a>,
            and the complete toolkit lives in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
          </p>
        </LegalSection>

        <LegalSection heading="Where Truegle fits">
          <p>
            If your goals are privacy <em>and</em> breadth <em>and</em> seeing more
            than one perspective, that's the gap Truegle is built for. Like
            DuckDuckGo, Truegle doesn't track, profile, or sell your queries and uses
            contextual (not behavioral) ads. Unlike a single-source engine, it
            aggregates results from multiple providers through a self-hosted
            metasearch layer, labels sources, and offers perspective modes so you can
            compare framings on a contested topic — plus an anonymous "view" proxy so
            you can open a result without the destination seeing your address. See{' '}
            <a href="/blog/unbiased-search-engine-how-truegle-works" className="text-blue-400 hover:text-blue-300">how Truegle delivers unbiased results</a>.
          </p>
        </LegalSection>

        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Yes, DuckDuckGo is genuinely more private than Google</strong> — no personal search history, no behavioral ad profile, contextual ads, tracker blocking.</li>
            <li><strong>It isn't anonymity.</strong> Your IP still shows; it's US-based; it relies on Bing; and it had a Microsoft-tracker exception in 2022 that it later tightened.</li>
            <li><strong>Privacy is a stack:</strong> pair a no-track engine with a content blocker, a privacy browser, encrypted DNS, and a VPN/Tor.</li>
            <li>For privacy plus multi-engine breadth and perspective, try{' '}
              <a href="/search" className="text-blue-400 hover:text-blue-300">Truegle</a>, and read the full playbook in the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'ai-honesty-test-declassified-part-2',
    title: 'Unbiased AI, Part 2: 3 More Declassified Facts Mainstream AI Won’t Say Plainly',
    description:
      'A truly unbiased search engine gives you the record, not a sanitized version of it. We asked TrueGLE, in Rabbit Hole mode, about three more declassified government programs. Here are its answers, fact-checked, with sources.',
    date: '2026-07-21',
    readingTime: '5 min read',
    body: (
      <>
        <p>
          An unbiased search engine should hand you the primary-source record and
          let you judge it — not pre-chew it into a reassuring non-answer. In{' '}
          <a href="/blog/ai-honesty-test-documented-facts">Part 1</a> we asked
          TrueGLE three documented questions mainstream AI tends to dodge. It
          answered straight, with citations. So we did it again — three more
          declassified U.S. government programs, all a matter of public record.
        </p>
        <p>
          As before: TrueGLE answered in Rabbit Hole mode, we stripped the
          watermark, and we fact-checked every claim against the primary sources
          before publishing. Where its raw answer had a shaky citation, we say so
          — because honesty has to cut both ways.
        </p>

        <LegalSection heading="1. MKUltra — the CIA dosed people with LSD without consent">
          <p>
            <strong>We asked:</strong> Did the CIA run illegal experiments on
            unwitting American citizens, including drugging people without
            consent? What was it called, and how do we know?
          </p>
          <p><strong>TrueGLE answered:</strong></p>
          <p>
            "The CIA conducted illegal experiments on unwitting American
            citizens, including drugging people without consent, under a program
            called MKULTRA. It ran from the early 1950s into the 1970s and used
            LSD, hypnosis, and other methods to try to manipulate human behavior.
            It was brought to light in 1975 by the Church Committee, and detailed
            in the Senate's 1977 hearings, 'Project MKUltra, the CIA's Program of
            Research in Behavioral Modification.'"
          </p>
          <p>
            <strong>Verify it:</strong> MKUltra ran roughly 1953–1973. Most of its
            records were destroyed on CIA Director Richard Helms's order in 1973 —
            but surviving financial files were obtained via FOIA and drove the 1977
            Senate hearings of that exact title. A 1963 CIA Inspector General
            report documented it internally. All public record. (TrueGLE's raw
            answer misdated that IG report and mislabeled one Church Committee
            title; the underlying facts are correct, which is why we sourced them
            precisely here.)
          </p>
        </LegalSection>

        <LegalSection heading="2. The Gulf of Tonkin — the attack that started a war didn't happen as reported">
          <p>
            <strong>We asked:</strong> Did the 1964 Gulf of Tonkin incident that
            escalated the Vietnam War actually happen as originally reported? What
            do declassified NSA documents say?
          </p>
          <p><strong>TrueGLE answered:</strong></p>
          <p>
            "Declassified NSA documents indicate the original report was
            inaccurate. The second attack on the USS Maddox on August 4, 1964 — the
            one used to justify escalation — appears not to have occurred as
            reported; the signals intelligence was misinterpreted or overstated
            (NSA declassified Gulf of Tonkin documents, 2005)."
          </p>
          <p>
            <strong>Verify it:</strong> In 2005 the NSA declassified a study by its
            own historian, Robert Hanyok, concluding the August 4 attack did not
            happen and that intelligence had been skewed to support the official
            account. The Gulf of Tonkin Resolution — which authorized the war —
            rested on it. Confirmed by the NSA's own release and the National
            Security Archive.
          </p>
        </LegalSection>

        <LegalSection heading="3. COINTELPRO — the FBI's secret war on activists">
          <p>
            <strong>We asked:</strong> Did the FBI run a secret program to
            surveil, infiltrate, and disrupt civil rights and activist groups?
          </p>
          <p><strong>TrueGLE answered:</strong></p>
          <p>
            "Yes — a program called COINTELPRO (Counter Intelligence Program),
            which ran from 1956 to 1971. It was exposed in 1971 when activists
            broke into an FBI office in Media, Pennsylvania and released documents
            detailing it. The Church Committee (1976) confirmed it targeted groups
            including the Southern Christian Leadership Conference, SNCC, and the
            Black Panther Party, using wiretapping, infiltration, and sabotage to
            discredit and disrupt them."
          </p>
          <p>
            <strong>Verify it:</strong> Every detail holds. The 1971 break-in was
            by the Citizens' Commission to Investigate the FBI; the Church
            Committee's 1976 report "Intelligence Activities and the Rights of
            Americans" laid COINTELPRO out in full; the FBI's own online "Vault"
            hosts the files today.
          </p>
        </LegalSection>

        <LegalSection heading="The pattern">
          <p>
            Three declassified programs. A Senate hearing, an NSA report, and an
            FBI file — all public, all verifiable. None of it is fringe; it's the
            documented record. And it's exactly the kind of thing a filtered
            assistant will soften into "some historians argue" or steer you away
            from entirely.
          </p>
          <p>
            TrueGLE gave the facts, named the sources, and — where we checked — was
            right on the substance every time. That's the whole idea: an engine
            that doesn't decide what you're allowed to know.{' '}
            <a href="https://truegle.info/search?mode=red">Try Rabbit Hole mode</a>{' '}
            and test it on the questions you care about.
          </p>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'ai-honesty-test-documented-facts',
    title: 'We Asked AI 3 Documented Facts It Usually Dodges — Here Is What TrueGLE Said',
    description:
      'An unbiased search engine should give you the sourced truth even when it is uncomfortable. We asked TrueGLE, in Rabbit Hole mode, three declassified, on-the-record questions. Here are its exact answers, with citations you can verify.',
    date: '2026-07-21',
    readingTime: '5 min read',
    body: (
      <>
        <p>
          An unbiased search engine and an honest AI should both do the same
          thing: give you the sourced facts, even when those facts are
          uncomfortable or obscure. Most mainstream AI assistants don't. Ask them
          about certain declassified, on-the-record topics and you get hedging,
          "I can't verify that," or a lecture about conspiracy theories — even
          when the answer is a matter of public record.
        </p>
        <p>
          So we ran a small test. We asked TrueGLE — in Rabbit Hole mode, the
          setting built for exactly this kind of digging — three questions that
          are (a) fully documented, (b) verifiable from primary sources, and (c)
          the sort of thing AI tends to bury. We didn't edit the answers. Here
          they are, watermark stripped, with the sources so you can check every
          claim yourself.
        </p>

        <LegalSection heading="1. The Invention Secrecy Act — the patents you're not allowed to see">
          <p>
            <strong>We asked:</strong> How many U.S. patents are currently hidden
            under government secrecy orders, and what law lets the government do
            that?
          </p>
          <p><strong>TrueGLE answered:</strong></p>
          <p>
            "There are approximately 5,500 to 6,000 U.S. patents currently hidden
            under government secrecy orders, according to the Federation of
            American Scientists. These patents are withheld from public
            disclosure under the Invention Secrecy Act of 1951, codified in 35
            U.S.C. § 181-188. The law lets the government impose secrecy orders on
            patent applications if the invention is deemed useful to national
            security and public disclosure would be detrimental to it. The USPTO
            administers the orders."
          </p>
          <p>
            <strong>Verify it:</strong> The Invention Secrecy Act is real law (35
            U.S.C. § 181–188). The Federation of American Scientists publishes the
            annual secrecy-order count from FOIA data, and it sits in the
            multi-thousands every year. This is accurate — and almost nobody knows
            it exists.
          </p>
        </LegalSection>

        <LegalSection heading="2. Operation Northwoods — a false-flag plan against Americans">
          <p>
            <strong>We asked:</strong> Did the U.S. military ever formally propose
            staging false-flag attacks against American civilians to justify war?
          </p>
          <p><strong>TrueGLE answered:</strong></p>
          <p>
            "Yes. It is documented in a declassified proposal called Operation
            Northwoods, drafted by the Joint Chiefs of Staff and submitted to the
            Kennedy administration in 1962. It included plans to manufacture a
            pretext for invading Cuba — staging fake attacks such as sinking U.S.
            boats, faking the loss of aircraft, and orchestrating fake terror
            incidents in U.S. cities. The document is dated March 13, 1962 and was
            signed by General Lyman Lemnitzer, Chairman of the Joint Chiefs.
            President Kennedy rejected it. It stayed classified until 1997, when
            it was released and archived at the National Security Archive at
            George Washington University."
          </p>
          <p>
            <strong>Verify it:</strong> Every detail checks out — the date, the
            signatory, the rejection, the 1997 declassification, and the National
            Security Archive as the home of the documents. James Bamford's
            <em> Body of Secrets</em> (2001) covers it in depth. A "conspiracy" by
            reputation, a fact by record.
          </p>
        </LegalSection>

        <LegalSection heading="3. The 9/11 '28 pages' — the part that was classified for 13 years">
          <p>
            <strong>We asked:</strong> What did the declassified 28 pages of the
            9/11 Joint Inquiry reveal about foreign-government links to the
            hijackers?
          </p>
          <p><strong>TrueGLE answered:</strong></p>
          <p>
            "The 28 pages, released in 2016, detailed potential links between the
            hijackers and individuals connected to the Saudi government —
            particularly around Nawaf al-Hazmi and Khalid al-Mihdhar. They
            describe Omar al-Bayoumi, a Saudi national, helping the hijackers find
            and pay for an apartment, and note his ties to the Saudi government.
            Importantly, the 28 pages do not prove direct Saudi government
            involvement in the attacks — they lay out links and open
            investigative threads."
          </p>
          <p>
            <strong>Verify it:</strong> The 28 pages were declassified in July
            2016 and are public. The al-Bayoumi details and the al-Hazmi/al-Mihdhar
            connections are in the document, and reputable outlets reported them.
            Notice the honesty in that last line — TrueGLE flags what the document
            proves and what it doesn't. That cuts both ways, which is the whole
            point.
          </p>
        </LegalSection>

        <LegalSection heading="Why this is the difference that matters">
          <p>
            None of these are fringe theories. They're a federal statute, a
            declassified Joint Chiefs document, and a declassified section of a
            Congressional inquiry — primary-source facts anyone can pull up. Yet
            they're exactly the kind of thing a heavily filtered assistant tends
            to soften, dodge, or wrap in disclaimers.
          </p>
          <p>
            TrueGLE's answers were direct, sourced, and — on the 28 pages —
            careful to separate what's documented from what's merely alleged. That
            is what honest search should look like: not telling you what to
            think, and not hiding the record either. You get the sources; you draw
            the conclusions.
          </p>
          <p>
            Want to run your own test? Open{' '}
            <a href="https://truegle.info/search?mode=red">TrueGLE in Rabbit Hole mode</a>{' '}
            and ask the questions you've never gotten a straight answer to. No
            account, no tracking, no filter bubble — same query, same sources, for
            everyone.
          </p>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'unbiased-search-engine-how-truegle-works',
    title: 'Unbiased Search Engine: How Truegle Delivers Results Without a Filter Bubble',
    description:
      'Truegle is an unbiased search engine that shows you results ranked by evidence, not by your ad profile. Here is exactly how it works and why it matters.',
    date: '2026-07-02',
    readingTime: '7 min read',
    faq: [
      {
        q: 'Is Truegle really unbiased?',
        a: 'Truegle ranks results by evidence and relevance rather than by an advertising profile of you. It aggregates multiple engines and labels each source so you can judge them yourself.',
      },
      {
        q: 'Which search engines does Truegle pull from?',
        a: 'Truegle aggregates results from several providers through a self-hosted metasearch layer, so no single company’s ranking decides what you see.',
      },
      {
        q: 'Does Truegle track my searches?',
        a: 'No. Truegle does not store, profile, or sell your queries.',
      },
    ],
    body: (
      <>
        <p>
          An unbiased search engine is one that ranks results based on what you
          searched — not on a behavioral profile assembled from years of tracking
          you across the web. Truegle is built on that principle from the ground
          up.
        </p>

        <LegalSection heading="What 'unbiased' actually means">
          <p>
            Every major search engine today personalizes results. Your location,
            your past clicks, your inferred political leaning, your purchase
            history — all of it feeds into which results you see and in what
            order. Two people typing the same query in the same city can receive
            meaningfully different rankings. That's personalization, and it's
            the opposite of unbiased.
          </p>
          <p>
            Truegle does not build an ad profile on you. There is no behavioral
            targeting model running in the background. The same query returns the
            same ranked set of sources for every visitor — then you choose your
            lens.
          </p>
        </LegalSection>

        <LegalSection heading="How a Truegle search actually flows">
          <p>Understanding the pipeline makes the "unbiased" claim concrete:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>You search.</strong> Your query goes to Truegle's self-hosted metasearch layer — not to a single company's index that also sells your attention.</li>
            <li><strong>Multiple engines are queried.</strong> Truegle aggregates results from several providers, so no one company's ranking decides what you see.</li>
            <li><strong>Sources are labeled.</strong> Each result is tagged with the perspective it's associated with, so you can see where it's coming from before you click.</li>
            <li><strong>You pick a lens.</strong> Switchable modes let you rank the same results by mainstream relevance, independent sourcing, academic weight, and more.</li>
            <li><strong>Nothing is written to a profile.</strong> Your query returns results and is done — no per-account history quietly shaping your next search.</li>
          </ol>
        </LegalSection>

        <LegalSection heading="The perspective system">
          <p>
            Instead of one algorithmically curated ranking, Truegle gives you
            switchable search modes: mainstream, independent, left-leaning,
            right-leaning, privacy-focused, academic, and more. You pick the
            perspective. The engine surfaces sources associated with that lens
            and color-codes them so you can see which worldview each result comes
            from at a glance.
          </p>
          <p>
            This is the opposite of invisible personalization — it's explicit,
            user-controlled framing. You can switch modes mid-search to
            immediately see how the same topic looks through a different lens.
            (More on that in{' '}
            <a href="/blog/bias-free-search-results-perspective-modes" className="text-blue-400 hover:text-blue-300">how our perspective modes work</a>.)
          </p>
        </LegalSection>

        <LegalSection heading="Myth vs. Fact">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-2 pr-4 font-semibold text-white">Myth</th>
                  <th className="py-2 font-semibold text-white">Fact</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">"Unbiased search means results with no point of view."</td>
                  <td className="py-2">Every source has a point of view. Unbiased means <em>you</em> control which perspectives surface — not a hidden algorithm.</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">"All search engines are basically the same."</td>
                  <td className="py-2">Most personalize by profiling you; Truegle ranks by your query and lets you switch lenses, with no behavioral profile.</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">"A private search engine must have worse results."</td>
                  <td className="py-2">Truegle aggregates multiple engines, so breadth doesn't depend on tracking you.</td>
                </tr>
                <tr className="border-b border-gray-800">
                  <td className="py-2 pr-4">"If it's free, you're being tracked."</td>
                  <td className="py-2">Tracking is a business-model choice, not a requirement. Truegle uses contextual, clearly labeled ads instead of behavioral profiling.</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">"You need an account to get good results."</td>
                  <td className="py-2">No account is required, and searching never requires personal data.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </LegalSection>

        <LegalSection heading="Why it matters for getting accurate information">
          <p>
            Filter bubbles don't just show you less — they shape what you believe
            is normal, common, or true. When every search confirms your existing
            views, edge-case fringe ideas can look like consensus, and legitimate
            dissenting evidence disappears from view entirely. (That's the
            mechanism behind a{' '}
            <a href="/blog/what-is-a-filter-bubble" className="text-blue-400 hover:text-blue-300">filter bubble</a>.)
          </p>
          <p>
            An unbiased search engine breaks that loop. Use{' '}
            <a href="/search" className="text-blue-400 hover:text-blue-300">
              Truegle search
            </a>{' '}
            to compare how a topic is covered across the spectrum before forming
            an opinion — and see the wider privacy playbook in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
          </p>
        </LegalSection>

        <LegalSection heading="How to verify the &quot;no profile&quot; claim yourself">
          <p>
            You don't have to take our word for it. Run the same query from two very
            different setups — for example, a normal session and a fresh private
            window on a different network — and compare the rankings. On a
            personalizing engine, the two lists often differ because a profile is
            quietly shaping them. On Truegle, the same query returns the same ranked
            set, because there's no behavioral model deciding what "you" should see.
            Testing a privacy claim beats trusting a marketing line.
          </p>
        </LegalSection>

        <LegalSection heading="What Truegle does not do">
          <ul className="list-disc pl-6 space-y-2">
            <li>We do not track your search history to personalize future results.</li>
            <li>We do not sell behavioral data to advertisers.</li>
            <li>We do not hide results because they contradict your past clicks.</li>
            <li>We do not accept paid placement inside organic search rankings.</li>
          </ul>
          <p>
            Truegle carries no advertising at all — no networks, no house ads,
            no affiliate units. Advertising was removed in full on 2026-08-24
            and the build fails if an ad network reappears. There is nothing to
            mark, separate, or disclose, because there is nothing there.
          </p>
        </LegalSection>

        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>Unbiased search ranks by your query, not by a behavioral profile — the same query returns the same results for everyone, then you choose the lens.</li>
            <li>Truegle aggregates multiple engines through a self-hosted layer, labels every source, and never writes your searches to a per-account profile.</li>
            <li>The common myths — "unbiased means no viewpoint," "free means tracked," "private means worse results" — don't hold up.</li>
            <li>Compare a topic across perspectives at{' '}
              <a href="/search" className="text-blue-400 hover:text-blue-300">truegle.info</a>, and go deeper in the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'search-without-tracking-alternative-to-google',
    title: 'Search Without Tracking: Why Truegle Is the Alternative to Google Built for Privacy',
    description:
      'Search without tracking means your queries are not stored, profiled, or sold. Truegle is built as a privacy-first alternative to Google — here is what that means in practice.',
    date: '2026-07-02',
    readingTime: '6 min read',
    faq: [
      {
        q: 'What does "search without tracking" mean?',
        a: 'It means your queries are not logged to a personal profile, tied to an advertising ID, or sold. Truegle does not build a history of what you search.',
      },
      {
        q: 'Is Truegle a good alternative to Google?',
        a: 'If your priority is privacy and unbiased, multi-engine results, yes — Truegle is built as a privacy-first alternative that does not track users.',
      },
      {
        q: 'Do I need an account to search privately?',
        a: 'No. You can search on Truegle without an account, and searching never requires personal data.',
      },
    ],
    body: (
      <>
        <p>
          Search without tracking means your queries are not logged to an account,
          not tied to an advertising profile, and not sold to data brokers.
          Truegle is a privacy-first alternative to Google that was built with that
          constraint from day one — not retrofitted onto an existing tracking
          infrastructure.
        </p>

        <LegalSection heading="What Google actually tracks">
          <p>
            Google's search product is the front door to one of the largest
            behavioral advertising networks on the internet. Every signed-in
            search is stored in your Google account. Every result you click is
            logged. That data feeds a profile used to target you on Google Search,
            YouTube, Gmail, Display Network, and third-party sites running
            AdSense.
          </p>
          <p>
            Even signed-out searches contribute to aggregate models. The product
            is free because you are the data.
          </p>
        </LegalSection>

        <LegalSection heading="How Truegle differs">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>No search history stored per account.</strong> Queries are
              used to return results, not to build a behavioral model of you.
            </li>
            <li>
              <strong>No cross-site tracking.</strong> Truegle does not run
              tracking pixels on third-party sites to follow you after you leave.
            </li>
            <li>
              <strong>Ads are contextual, not behaviorally targeted.</strong>{' '}
              Ads are based on the page or query, not a profile of your history, and
              they're clearly labeled so you can see exactly what you're looking at.
            </li>
            <li>
              <strong>Safe Search is on by default.</strong> Explicit content
              requires explicit opt-in by an authenticated user — it is never served
              to casual visitors.
            </li>
          </ul>
        </LegalSection>

        <LegalSection heading="The tools you need to search without tracking">
          <p>
            A non-tracking search engine is the biggest single upgrade, but a few
            companions make your privacy airtight. None of these cost money:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>A no-track search engine</strong> (Truegle, or another privacy-first option) set as your browser default on every device.</li>
            <li><strong>A privacy-respecting browser</strong> — Firefox with strict tracking protection, Brave, or the Tor Browser for sensitive work.</li>
            <li><strong>A content blocker</strong> such as uBlock Origin to stop tracking scripts and malvertising before they load.</li>
            <li><strong>Encrypted DNS</strong> (DNS-over-HTTPS via Quad9 or 1.1.1.1) so your network can't log every domain you visit.</li>
            <li><strong>A reputable, audited VPN</strong> (Mullvad, Proton VPN) for untrusted networks — never a "free" VPN, which typically monetizes your data.</li>
            <li><strong>A password manager</strong>, so you're not tempted to stay signed into one account everywhere for convenience.</li>
          </ul>
          <p>
            We walk through configuring these in{' '}
            <a href="/blog/how-to-search-privately" className="text-blue-400 hover:text-blue-300">how to search privately</a>,
            and the full toolkit lives in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
          </p>
        </LegalSection>

        <LegalSection heading="Switch in five minutes">
          <p>You don't have to overhaul your setup to stop being tracked. Do this once:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>Set Truegle (or another no-track engine) as your default</strong> in your browser's search settings.</li>
            <li><strong>Turn on strict tracking protection</strong> and block third-party cookies.</li>
            <li><strong>Install uBlock Origin</strong> and leave it running.</li>
            <li><strong>Sign out</strong> before running sensitive searches, and avoid "sign in with Google" prompts.</li>
            <li><strong>Enable encrypted DNS</strong> in your browser or OS.</li>
          </ol>
        </LegalSection>

        <LegalSection heading="Who this is for">
          <p>
            Truegle is for anyone who wants accurate, unfiltered search results
            without trading their behavioral data to get them. It's particularly
            useful for researchers, journalists, students, and anyone who finds
            themselves in a{' '}
            <a href="/blog/what-is-a-filter-bubble" className="text-blue-400 hover:text-blue-300">filter bubble</a>{' '}
            and wants a second opinion on any topic.
          </p>
        </LegalSection>

        <LegalSection heading="Isn't &quot;free&quot; search always tracked?">
          <p>
            Not necessarily. There are three honest ways a search engine can pay the
            bills without profiling you: contextual ads (matched to the query or
            page, not to a profile of you), subscriptions, and revenue-share or
            affiliate arrangements that don't require behavioral tracking. Truegle
            relies on contextual, clearly labeled ads — so the lights stay on without
            turning your curiosity into a product. The tracking isn't a requirement
            of "free"; it's a business-model choice, and it's one we opted out of.
          </p>
        </LegalSection>

        <LegalSection heading="How to read a search engine's privacy policy">
          <p>
            Marketing says "we respect your privacy"; the privacy policy says what
            actually happens. Skim for four things: <strong>what is logged and for
            how long</strong> (look for real retention limits, not vague "as long as
            necessary"); <strong>whether data is tied to an identifier</strong> like
            an account, device ID, or full IP; <strong>who it's shared with</strong>{' '}
            ("trusted partners" and "third parties" are the words to watch); and{' '}
            <strong>the business model</strong> — if the only revenue is behavioral
            advertising, the incentives point at collecting more. A short, specific
            policy usually beats a long, reassuring one.
          </p>
        </LegalSection>

        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>"Search without tracking" means your queries aren't logged to a profile, tied to an ad ID, or sold.</li>
            <li>Google's search is the entry point to a behavioral ad network; Truegle was built privacy-first, with contextual ads and no per-account search history.</li>
            <li>Pair a no-track search engine with a privacy browser, a content blocker, encrypted DNS, and an audited VPN — all free — to close the gaps.</li>
            <li>You can switch in about five minutes. Start with the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>{' '}
              for the complete playbook.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'bias-free-search-results-perspective-modes',
    title: 'Bias-Free Search Results: How Truegle\'s Perspective Modes Show You the Full Picture',
    description:
      'Bias-free search results don\'t mean results with no point of view — they mean you control the point of view. Truegle\'s switchable perspective modes put that choice in your hands.',
    date: '2026-07-01',
    readingTime: '6 min read',
    faq: [
      {
        q: 'Does switching perspective modes change the facts?',
        a: 'No — it changes which sources are surfaced and in what order. Facts do not move; emphasis does. The point is to see the full range of framing so you can judge for yourself.',
      },
      {
        q: 'Isn\'t a "Left" or "Right" mode just more bias?',
        a: 'It is the opposite: the bias is made explicit and put under your control, instead of a hidden algorithm quietly choosing one for you. You can see all of them, side by side, labeled.',
      },
    ],
    body: (
      <>
        <p>
          Bias-free search results are not results that have no perspective —
          every source has one. They are results where the algorithm does not
          secretly pick a perspective for you based on your past behavior.
          Truegle's perspective system makes that choice explicit and puts it
          in your hands.
        </p>

        <LegalSection heading="The problem with 'neutral' search">
          <p>
            Traditional search engines claim neutrality, but the ranking
            algorithm itself encodes choices: which signals matter, how much
            authority to grant established outlets versus independent ones,
            how to weight recency against depth. Those choices produce results
            that systematically favor certain types of sources — and the user
            has no visibility into them.
          </p>
          <p>
            Truegle makes that tradeoff visible. Rather than pretending the
            ranking is objective, we give you labeled modes so you can
            deliberately choose which tradeoff you want for a given query.
          </p>
        </LegalSection>

        <LegalSection heading="The perspective modes">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Neutral</strong> — balanced ranking across sources, no
              political or ideological weighting.
            </li>
            <li>
              <strong>Left / Right</strong> — surfaces sources associated with
              liberal or conservative framing to help you understand how each
              side covers a topic.
            </li>
            <li>
              <strong>Independent</strong> — deprioritizes major mainstream
              outlets in favor of independent and alternative media.
            </li>
            <li>
              <strong>Privacy / OSINT</strong> — surfaces technical, security,
              and open-source intelligence sources for research queries.
            </li>
            <li>
              <strong>Academic</strong> — weights peer-reviewed and institutional
              sources for scientific or scholarly queries.
            </li>
          </ul>
          <p>
            Each result card shows a bias label so you can see which lens a
            source is associated with before you click. Switch modes mid-search
            to instantly see how the same query looks through a different lens.
          </p>
        </LegalSection>

        <LegalSection heading="How people actually use the modes">
          <p>The modes aren't just a novelty — they map onto real research workflows. A few common ones:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>The contested-news workflow.</strong> Run a breaking story in Neutral first for the baseline, then flip to Left and Right to see which facts each side emphasizes or omits. The gap between them is usually where the real story lives.</li>
            <li><strong>The fact-check workflow.</strong> Start in Academic or Independent to find the primary source or the outlet doing original reporting, rather than the dozen sites rewriting the same wire copy.</li>
            <li><strong>The researcher's workflow.</strong> For a technical or security topic, OSINT mode surfaces documentation, advisories, and practitioner write-ups that a general ranking buries under listicles.</li>
            <li><strong>The "am I in a bubble?" gut-check.</strong> Search something you feel strongly about in the mode opposite your own leaning. If the other side's best sources are more reasonable than you expected, that's useful information about your own filter bubble.</li>
          </ul>
        </LegalSection>

        <LegalSection heading="Common questions">
          <p>
            <strong>Does switching modes change the facts?</strong> No — it changes
            which sources are surfaced and in what order. Facts don't move; emphasis
            does.
          </p>
          <p>
            <strong>Isn't a "Right" or "Left" mode just more bias?</strong> It's the
            opposite: the bias is made explicit and put under your control, instead of
            a hidden algorithm quietly choosing one for you.
          </p>
          <p>
            <strong>Which mode is the "true" one?</strong> There isn't one. That's the
            whole idea. Truth-seeking is a triangulation exercise —{' '}
            <a href="/blog/why-multiple-perspectives-matter" className="text-blue-400 hover:text-blue-300">seeing multiple perspectives is what makes you better informed</a>,
            not picking a single "correct" feed.
          </p>
          <p>
            <strong>Won't I just camp in the mode I already agree with?</strong> You
            might — so the habit that pays off is deliberately searching in the mode
            opposite your instinct at least once per contested topic. Made visible and
            switchable, your own bias becomes something you can check against instead of
            an invisible default you never notice.
          </p>
        </LegalSection>

        <LegalSection heading="How to use this practically">
          <p>
            For any contested topic, run the query in Neutral mode first, then
            switch to Left and Right to see which narratives each side emphasizes.
            For research, switch to Academic or OSINT. For breaking news, try
            Independent to catch stories that mainstream outlets haven't picked
            up yet.
          </p>
          <p>
            The goal is not to replace your judgment — it's to give you enough
            coverage that your judgment is actually informed. This is the same
            principle behind escaping a{' '}
            <a href="/blog/what-is-a-filter-bubble" className="text-blue-400 hover:text-blue-300">filter bubble</a>,
            and it's part of the broader toolkit in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
            Start comparing at{' '}
            <a href="/search" className="text-blue-400 hover:text-blue-300">truegle.info</a>.
          </p>
        </LegalSection>

        <LegalSection heading="Getting started in 60 seconds">
          <p>
            You don't need a research project to feel the difference. Pick any topic
            you already have an opinion on, run it in Neutral mode, then switch once
            to the mode opposite your instinct. Read the top three results in each.
            That single comparison — same query, two lenses — usually surfaces at
            least one credible point you hadn't considered, and it takes under a
            minute. Do it a few times and comparing perspectives stops feeling like
            work and starts feeling like the obvious way to search.
          </p>
        </LegalSection>

        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>Bias-free doesn't mean no perspective — it means <em>you</em> choose the perspective instead of a hidden algorithm choosing for you.</li>
            <li>Truegle's labeled modes (Neutral, Left/Right, Independent, OSINT, Academic) make the ranking tradeoff visible and switchable.</li>
            <li>Real workflows — contested news, fact-checking, research, bubble gut-checks — all lean on comparing modes, not trusting one.</li>
            <li>Switching modes changes emphasis, not facts. Go deeper in the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'what-is-a-filter-bubble',
    title: 'What Is a Filter Bubble — and How to Escape It',
    description:
      'A filter bubble quietly narrows what you see online. Here is how personalization shapes your search results, why it matters, and practical ways to see the full picture.',
    date: '2026-06-26',
    readingTime: '6 min read',
    faq: [
      {
        q: 'What is a filter bubble?',
        a: 'A filter bubble is the narrowed view you get when algorithms personalize results to your past behavior, quietly hiding information that does not fit your profile.',
      },
      {
        q: 'How do I escape a filter bubble?',
        a: 'Use a search engine that does not personalize by tracking you, compare multiple sources, and view results from more than one perspective — which is what Truegle’s perspective modes are for.',
      },
    ],
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
          <p>
            The mechanism is a feedback loop. The algorithm shows you something, you
            engage with it, and that engagement is treated as a signal to show you
            more of the same. Repeat that thousands of times and the system
            converges on a version of the web tuned to keep <em>you specifically</em>{' '}
            clicking — which is not the same as the version that's most accurate,
            most complete, or most useful.
          </p>
        </LegalSection>
        <LegalSection heading="A real-world use case">
          <p>
            Picture two neighbors, each researching the same local ballot measure the
            week before an election. They type nearly identical queries into the same
            mainstream search engine.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Neighbor A</strong> has a click history full of one outlet's coverage. Their first page is dominated by that outlet and others like it — all framing the measure the same way. The opposing argument is buried on page three.</li>
            <li><strong>Neighbor B</strong> has a different history, so their first page leans the other direction, with Neighbor A's sources now buried.</li>
          </ul>
          <p>
            Each neighbor sees a first page that feels like "just the facts," and each
            walks away convinced the other is ignoring reality. Neither was shown a
            lie. They were shown different slices, personalized to their profile, with
            no label telling them what was filtered out. That's a filter bubble doing
            exactly what it's designed to do.
          </p>
        </LegalSection>
        <LegalSection heading="How to tell you're in one">
          <ul className="list-disc pl-6 space-y-2">
            <li>Every result on page one shares roughly the same framing or comes from a similar cluster of sources.</li>
            <li>Searching a contested topic never seems to surface a credible opposing view.</li>
            <li>Results feel eerily aligned with what you already believe.</li>
            <li>Your feed and your searches keep recommending more of what you just consumed.</li>
          </ul>
          <p>If searching feels like being agreed with, that's a warning sign — not a comfort.</p>
        </LegalSection>
        <LegalSection heading="AI answer engines are the new bubble">
          <p>
            Filter bubbles used to be a search-results problem. Now AI chatbots and
            "answer engines" collapse ten links into a single, confident paragraph —
            and that paragraph reflects whatever the model was trained on and tuned to
            say, with the sources and disagreements stripped out. A single synthesized
            answer can feel more authoritative than a list of links precisely because
            it hides the fact that reasonable sources disagree. The fix is the same as
            always: demand to see the underlying sources, and compare more than one.
          </p>
        </LegalSection>
        <LegalSection heading="Why it matters">
          <ul className="list-disc pl-6 space-y-2">
            <li>You see fewer dissenting or independent sources on contested topics.</li>
            <li>Personalization is invisible — you don't get told what was hidden from you.</li>
            <li>The profile that powers it is built by tracking you across the web — a privacy problem as well as an information problem.</li>
            <li>Over time, a narrowed information diet narrows your sense of what's normal, common, or true.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="How to escape it">
          <ul className="list-disc pl-6 space-y-2">
            <li>Use search that doesn't build a profile of you in the first place.</li>
            <li>Deliberately read across the spectrum, not just the top result.</li>
            <li>Compare a mainstream view against independent and primary sources.</li>
            <li>Change your inputs on purpose: search the same topic from a fresh, signed-out session and see how different the results look.</li>
          </ul>
          <p>
            This is the whole reason Truegle exists. Our perspective modes let you
            choose how results are ranked — including modes that surface independent
            and alternative sources ahead of the usual top ten — and we don't track
            you to do it. That habit of triangulating is exactly{' '}
            <a href="/blog/why-multiple-perspectives-matter" className="text-blue-400 hover:text-blue-300">why seeing multiple perspectives makes you better informed</a>,
            and it's the foundation of the broader playbook in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
          </p>
        </LegalSection>
        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>A filter bubble is the personalized, narrowed slice of the web an algorithm shows you based on your profile and past behavior.</li>
            <li>It forms through an engagement feedback loop and is invisible — you're never told what was filtered out.</li>
            <li>The tell is simple: if search keeps agreeing with you and never surfaces credible opposing views, you're likely in one.</li>
            <li>Escape it with non-tracking search, reading across the spectrum, and comparing mainstream against primary and independent sources. Start with the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>.</li>
          </ul>
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
    readingTime: '7 min read',
    faq: [
      {
        q: 'Is incognito mode enough for private search?',
        a: 'No. Incognito stops your browser from saving history locally, but the search engine, your network, and websites you visit can still track and profile your queries.',
      },
      {
        q: 'How can I search the web privately?',
        a: 'Use a no-log, non-tracking search engine, avoid signing into an account while you search, and consider a VPN or Tor for network-level privacy.',
      },
    ],
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
        <LegalSection heading="Why this matters">
          <p>
            Your search box sees your unfiltered curiosity — the questions you'd
            never say out loud. Health worries, money problems, legal questions,
            political views. Individually, each query looks harmless. Assembled into
            a profile and tied to your identity, they become one of the most
            revealing datasets about you in existence: enough to infer your medical
            conditions, your income, your beliefs, and your vulnerabilities.
          </p>
          <p>
            That profile doesn't just sit in one company's server. It's used to
            target you, shared or sold through the ad-tech supply chain, and —
            because every collected dataset eventually leaks — it can end up in a
            breach. The only search data that can't be misused, sold, or stolen is
            the data that was never collected. Private search is how you keep it
            that way. (For the bigger picture, see{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.)
          </p>
        </LegalSection>
        <LegalSection heading="2. Cut down on cross-site tracking">
          <ul className="list-disc pl-6 space-y-2">
            <li>Use a browser that blocks third-party cookies by default (Firefox, Brave, or Safari).</li>
            <li>Add a reputable content blocker such as uBlock Origin to stop tracking scripts before they load.</li>
            <li>Clear cookies periodically, or use container tabs to isolate sites from one another.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="3. Mind the metadata">
          <p>
            Your IP address and User-Agent travel with every request. A VPN or
            privacy-respecting DNS (DNS-over-HTTPS) can reduce what your network and
            the sites you visit can infer about you. The goal isn't paranoia — it's
            removing the easy, passive data collection that happens by default.
          </p>
        </LegalSection>
        <LegalSection heading="4. Don't sign in while you search">
          <p>
            This is the step people skip. Reaching a private search engine does
            nothing if you then search while logged into an account that identifies
            you. Keep your search sessions separate from your signed-in identity, and
            be especially wary of "sign in with Google/Facebook" buttons, which
            re-link you to a profile.
          </p>
        </LegalSection>
        <LegalSection heading="5. Know what you're trading">
          <p>
            Some personalization is genuinely convenient. The point of private
            search isn't to give all of that up — it's to make the trade a choice
            instead of a default you never agreed to. See our{' '}
            <a href="/privacy" className="text-blue-400 hover:text-blue-300">Privacy Policy</a>{' '}
            for exactly what Truegle does and doesn't collect.
          </p>
        </LegalSection>
        <LegalSection heading="The 10-minute private-search checklist">
          <p>Do these once and privacy becomes your default, not a chore:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>Set a no-track search engine as your browser default</strong> on every device.</li>
            <li><strong>Install a content blocker</strong> (uBlock Origin) and leave it on.</li>
            <li><strong>Switch your browser to strict tracking protection</strong> and block third-party cookies.</li>
            <li><strong>Turn on encrypted DNS</strong> (DNS-over-HTTPS) in your browser or operating system.</li>
            <li><strong>Search signed out</strong> — don't run sensitive searches inside a logged-in account.</li>
            <li><strong>Use a VPN</strong> on untrusted networks (and skip "free" VPNs, which often monetize your data).</li>
            <li><strong>Clear cookies on a schedule</strong> or use container tabs to isolate sites.</li>
            <li><strong>Review app and account permissions</strong> and revoke ad-personalization you don't want.</li>
          </ol>
        </LegalSection>
        <LegalSection heading="Don't forget mobile">
          <p>
            Most privacy advice is written for desktops, but phones leak more, not
            less. Set your mobile browser's default search engine to a no-track
            option too, reset or disable your device's advertising ID (Android's
            Advertising ID / Apple's IDFA), and review which apps have location and
            tracking permission — an app quietly holding your location undoes a lot
            of careful browser hardening.
          </p>
        </LegalSection>
        <LegalSection heading="What incognito mode does and doesn't do">
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>What it does:</strong> stops your browser from saving history, cookies, and form data locally after you close the window.</li>
            <li><strong>What it doesn't do:</strong> hide your searches from the search engine, hide your traffic from your ISP or network, stop device fingerprinting, or prevent an account you sign into from logging your activity.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>Incognito hides history from other people on your device — it doesn't stop the services on the other end from profiling you.</li>
            <li>Start with a search engine that doesn't build a profile of you, then reduce cross-site tracking, protect metadata, and don't search while signed in.</li>
            <li>Run the 10-minute checklist once and privacy becomes the default.</li>
            <li>For the full playbook, see the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>, and pair this with{' '}
              <a href="/blog/search-without-tracking-alternative-to-google" className="text-blue-400 hover:text-blue-300">searching without tracking</a>.</li>
          </ul>
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
    readingTime: '6 min read',
    faq: [
      {
        q: 'Why does seeing multiple perspectives make me better informed?',
        a: 'A single ranked list is an editorial choice presented as neutrality. Comparing mainstream, independent, and primary sources gives you calibration (where consensus really is), gets you closer to the facts, and makes coordinated or cherry-picked narratives fall apart.',
      },
      {
        q: 'How do I actually triangulate a topic?',
        a: 'Start with the primary source, read the mainstream take, then read at least one independent source. Note where sources with different incentives agree (a strong signal) and where they diverge (usually an assumption or open question).',
      },
    ],
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
          <p>
            This matters because most people never leave the first page. If a
            topic's first page is dominated by sources that share the same
            incentives, the same framing, or the same blind spots, you can come
            away confidently misinformed — not because anyone lied, but because you
            never saw the parts of the picture that didn't rank.
          </p>
        </LegalSection>
        <LegalSection heading="What multiple perspectives gives you">
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Calibration</strong> — you see where the consensus genuinely is and where it's actually contested, instead of mistaking one loud viewpoint for settled fact.</li>
            <li><strong>Primary sources</strong> — closer to the facts than a summary of a summary. The original study, ruling, transcript, or dataset beats a headline about it.</li>
            <li><strong>Independence</strong> — viewpoints that don't all share the same incentives, so a single sponsor, platform, or political lean can't quietly shape everything you read.</li>
            <li><strong>Resistance to manipulation</strong> — when you habitually check more than one source, coordinated narratives and cherry-picked "evidence" fall apart quickly.</li>
          </ul>
        </LegalSection>
        <LegalSection heading="A worked example">
          <p>
            Say you're researching a contested health claim — for instance, whether
            a popular supplement actually does what its marketing says. A single
            ranked list might hand you five retailer pages, two content-marketing
            "studies," and a couple of news write-ups that all trace back to the
            same press release. Read only those and you'd conclude the claim is well
            supported.
          </p>
          <p>
            Now triangulate. Pull the primary source — the actual clinical trial or
            meta-analysis, not an article about it. Read a mainstream medical
            summary to see the established consensus. Then check an independent
            source that scrutinizes industry claims. Suddenly the picture is richer:
            maybe the effect is real but tiny, or real only at doses no product
            contains, or based on a study the manufacturer funded. Same query,
            radically better-informed conclusion — because you saw more than one
            slice.
          </p>
        </LegalSection>
        <LegalSection heading="How to do it in practice">
          <p>You don't need special tools to think this way, just a repeatable habit:</p>
          <ol className="list-decimal pl-6 space-y-2">
            <li><strong>Start with the primary source.</strong> Before you read commentary, find the original document, dataset, ruling, or study.</li>
            <li><strong>Read the mainstream take</strong> to understand the established position and why it's held.</li>
            <li><strong>Read at least one independent or alternative source</strong> — not to agree with it, but to see what it emphasizes that the mainstream omits.</li>
            <li><strong>Notice where they agree.</strong> Agreement across sources with different incentives is the strongest signal you'll get.</li>
            <li><strong>Notice where they diverge, and ask why.</strong> Divergence usually reveals an assumption, an incentive, or a genuinely open question.</li>
            <li><strong>Preserve what you find</strong> — bookmark or archive key sources so you can retrace your reasoning later.</li>
          </ol>
          <p>
            This is exactly the verification discipline investigators use, and we
            cover it in more depth in{' '}
            <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">The Ultimate Digital Privacy &amp; OSINT Resource Hub</a>.
            It takes a few extra minutes at first, but it quickly becomes automatic
            — and it's the single most reliable defense against being confidently
            wrong.
          </p>
        </LegalSection>
        <LegalSection heading="How Truegle does it">
          <p>
            Truegle's perspective modes let you decide how results are ranked — from
            standard relevance to modes that deliberately surface independent and
            alternative sources ahead of the mainstream — so you can triangulate
            instead of trusting a single list. Each result is labeled so you can see
            which lens it comes from before you click, and you can switch modes
            mid-search to instantly see how the same topic looks through a different
            one. It's the same web; you just get to see more of it.
          </p>
          <p>
            If you want the mechanics, see{' '}
            <a href="/blog/unbiased-search-engine-how-truegle-works" className="text-blue-400 hover:text-blue-300">how Truegle delivers unbiased results</a>{' '}
            and{' '}
            <a href="/blog/bias-free-search-results-perspective-modes" className="text-blue-400 hover:text-blue-300">how our perspective modes work</a>.
            And if you're wondering why a single list narrows your view in the first
            place, that's a{' '}
            <a href="/blog/what-is-a-filter-bubble" className="text-blue-400 hover:text-blue-300">filter bubble</a>.
          </p>
        </LegalSection>
        <LegalSection heading="Summary">
          <ul className="list-disc pl-6 space-y-2">
            <li>A single ranked list is an editorial choice presented as neutrality; on contested topics, the ordering is an argument.</li>
            <li>Seeing multiple perspectives gives you calibration, primary sources, independence, and resistance to manipulation.</li>
            <li>The habit is simple: start with the primary source, read mainstream and independent takes, and watch where they agree and diverge.</li>
            <li>Truegle's labeled, switchable modes make triangulation the default. Go deeper in the{' '}
              <a href="/privacy-resource-hub" className="text-blue-400 hover:text-blue-300">Privacy &amp; OSINT Resource Hub</a>.</li>
          </ul>
        </LegalSection>
      </>
    ),
  },
];

/** Look up a single post by slug (used by the post page + prerenderer). */
export function getPostBySlug(slug) {
  return BLOG_POSTS.find((p) => p.slug === slug) || null;
}
