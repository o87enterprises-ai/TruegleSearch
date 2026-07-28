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
    readingTime: '4 min read',
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

        <LegalSection heading="Neon Green — CPM Ads">
          <p>
            A <strong>neon apple-green border</strong> marks a paid CPM (cost-per-thousand
            impressions) ad — display banners from our ad network partner Adsterra. These
            ads are served to all users regardless of query content.
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
