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
    slug: 'unbiased-search-engine-how-truegle-works',
    title: 'Unbiased Search Engine: How Truegle Delivers Results Without a Filter Bubble',
    description:
      'Truegle is an unbiased search engine that shows you results ranked by evidence, not by your ad profile. Here is exactly how it works and why it matters.',
    date: '2026-07-02',
    readingTime: '4 min read',
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
          </p>
        </LegalSection>

        <LegalSection heading="Why it matters for getting accurate information">
          <p>
            Filter bubbles don't just show you less — they shape what you believe
            is normal, common, or true. When every search confirms your existing
            views, edge-case fringe ideas can look like consensus, and legitimate
            dissenting evidence disappears from view entirely.
          </p>
          <p>
            An unbiased search engine breaks that loop. Use{' '}
            <a href="/search" className="text-blue-400 hover:text-blue-300">
              Truegle search
            </a>{' '}
            to compare how a topic is covered across the spectrum before forming
            an opinion.
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
            Ads on Truegle are clearly marked with a color-coded badge and are
            kept physically separate from organic results. See our{' '}
            <a href="/blog/understanding-our-ad-color-system" className="text-blue-400 hover:text-blue-300">
              ad color guide
            </a>{' '}
            for details.
          </p>
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
    readingTime: '3 min read',
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
              <strong>Ads are network-served, not behaviorally targeted.</strong>{' '}
              Contextual ads (based on your search query, not your history) are
              clearly labeled. You can see exactly what type of ad you're looking
              at from the color of its border.
            </li>
            <li>
              <strong>Safe Search is always on by default.</strong> Explicit
              content requires explicit opt-in by an authenticated user — it is
              never served to casual visitors.
            </li>
          </ul>
        </LegalSection>

        <LegalSection heading="Who this is for">
          <p>
            Truegle is for anyone who wants accurate, unfiltered search results
            without trading their behavioral data to get them. It's particularly
            useful for researchers, journalists, students, and anyone who finds
            themselves in a filter bubble and wants a second opinion on any topic.
          </p>
          <p>
            Try it at{' '}
            <a href="/search" className="text-blue-400 hover:text-blue-300">
              truegle.info/search
            </a>
            . No account required.
          </p>
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
    readingTime: '4 min read',
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
            coverage that your judgment is actually informed. Start at{' '}
            <a href="/search" className="text-blue-400 hover:text-blue-300">
              truegle.info
            </a>
            .
          </p>
        </LegalSection>
      </>
    ),
  },
  {
    slug: 'understanding-our-ad-color-system',
    title: 'What the Ad Colors on Truegle Mean — and Why We Show Them',
    description:
      'Every ad on Truegle is color-coded so you can tell at a glance what kind of ad it is and whether it benefits you directly. Here is what each color means.',
    date: '2026-06-28',
    readingTime: '3 min read',
    body: (
      <>
        <p>
          Most search engines hide their ad infrastructure. You see a result, you may not
          even know it's paid placement, and you have no idea where the money flows. Truegle
          does the opposite: every ad slot on the platform carries a visible color-coded
          badge so you know exactly what you're looking at before you decide to engage.
        </p>

        <LegalSection heading="Yellow — Available Ad Spots">
          <p>
            A <strong>yellow-bordered slot</strong> is an unsold or house ad space — inventory
            we haven't filled with a paying advertiser yet. You'll see a "Claim This Spot"
            prompt. These slots exist so advertisers can see exactly where their placement
            would appear. If you're a business that wants to reach a privacy-conscious,
            independent-minded audience, yellow is your invitation.
          </p>
          <p>
            Yellow means: <em>no third-party advertiser is paying to influence what you see
            here right now.</em>
          </p>
        </LegalSection>

        <LegalSection heading="Neon Green — CPM and Affiliate Ads">
          <p>
            A <strong>neon apple-green border</strong> marks a paid CPM (cost-per-thousand
            impressions) or affiliate ad — things like display banners from our ad network
            partner Adsterra, or affiliate product links. These ads are served to all users
            regardless of query content.
          </p>
          <p>
            Green means: <em>a real advertiser paid to be here. Truegle earns revenue from
            this impression or any resulting purchase.</em> We never use this revenue to
            influence search rankings — it funds server costs and the Rewards Program.
          </p>
        </LegalSection>

        <LegalSection heading="Red and Blue Pulse — Adult Content Ads">
          <p>
            A <strong>pulsing red-and-blue glow</strong> identifies an adult-content ad. These
            are only ever shown to users who meet all three conditions simultaneously: signed
            in with a Google-verified account (our lightweight age signal), Safe Search set
            to Off, and searching for a query that contains adult-intent keywords.
          </p>
          <p>
            If you don't meet all three conditions, you will never see a red-blue pulsing ad —
            ever. The triple gate is enforced both client-side and server-side.
          </p>
          <p>
            The bright, alternating pulse is intentional: adult ads should be unmistakably
            visible as such so users can make an informed choice about engaging with them.
          </p>
        </LegalSection>

        <LegalSection heading="Pulsing Red with White Border — Watch &amp; Earn Ads">
          <p>
            A <strong>pulsing red slot with a white border</strong> is a Rewards Program ad.
            If you've opted in to the Truegle Rewards Program at{' '}
            <a href="/rewards" className="text-blue-400 hover:text-blue-300">/rewards</a>,
            watching this ad for its full duration earns you a small real-cash credit
            toward a PayPal payout.
          </p>
          <p>
            Watch time is measured server-side using an IntersectionObserver + visibility
            tracking — the client cannot spoof it. You earn only for genuine views. The red
            pulse is the signal: <em>this one pays you.</em>
          </p>
        </LegalSection>

        <LegalSection heading="Why We Do This">
          <p>
            Truegle's core promise is transparency. That extends to how we make money.
            Color-coding every ad type means you're never left guessing whether something
            is organic content or paid placement, who benefits from the transaction, or
            whether content is age-appropriate. We think every search engine should work
            this way.
          </p>
          <p>
            If you have questions about our ad policies or want to advertise on Truegle,
            visit{' '}
            <a href="/advertise" className="text-blue-400 hover:text-blue-300">/advertise</a>.
          </p>
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
