import React from 'react';
import { Link } from 'react-router-dom';

/*
 * /developers — the public documentation for Truegle's search API.
 *
 * WHY THIS PAGE EXISTS, beyond being nice to have. Reddit's Devvit platform
 * will only allow-list an outbound domain for one of a few reasons, and the
 * one that applies to us is "APIs that provide data or specific services …
 * that have a publicly documented and publicly accessible API". Without a page
 * like this, `api.truegle.info` is a personal server, and Devvit's policy says
 * personal servers "will not be approved". With it, the request is for a
 * documented public API, which is a category they do approve.
 *
 * So this is a real commitment, not paperwork: what is written here is what
 * the endpoint has to keep doing.
 *
 * PRERENDERED. Registered in scripts/prerender-entry.jsx, so it must stay pure
 * text and links — no window, no canvas, no effects that touch the browser.
 * A reviewer following the link needs to see the content in the HTML itself,
 * not after a JavaScript bundle boots.
 */

// The documented hostname. This is the one requested in the Reddit app's
// fetch allow-list (apps/reddit/devvit.json), and the two must agree — a
// domain we document but do not serve is worse than no page at all.
const API_HOST = 'https://api.truegle.info';

const REQUEST = `curl -X POST ${API_HOST}/api/search \\
  -H 'Content-Type: application/json' \\
  -d '{"query": "how do tides work", "mode": "blue-pill"}'`;

const RESPONSE = `{
  "success": true,
  "query": "how do tides work",
  "resultCount": 18,
  "results": [
    {
      "title": "Tides and Water Levels",
      "url": "https://oceanservice.noaa.gov/education/tutorial_tides/",
      "snippet": "Tides are very long-period waves that move through the ocean…",
      "source": "searxng",
      "date": "2024-06-11T00:00:00.000Z"
    }
  ],
  "instantAnswer": null,
  "timestamp": "2026-08-20T09:12:44.118Z"
}`;

const FIELDS = [
  ['query', 'string, required', 'What to search for. 1–300 characters.'],
  ['mode', 'string, optional', 'Which lens to search through. Defaults to blue-pill (mainstream). See Modes below.'],
  ['filters', 'object, optional', 'Narrowing options — time range, language, safe search. Unknown keys are ignored rather than rejected.'],
];

const RESULT_FIELDS = [
  ['title', 'string', 'The page title as the source published it.'],
  ['url', 'string', 'The result’s address. Always absolute, always http(s).'],
  ['snippet', 'string', 'A short extract. May be empty when the source gave none.'],
  ['source', 'string', 'Which index the result came from.'],
  ['date', 'string | null', 'ISO 8601 publication date, or null when the source did not state one. It is never guessed.'],
];

const MODES = [
  ['blue-pill', 'Mainstream. What the consensus web says. The default.'],
  ['red-pill', 'Rabbit Hole. Reaches past the first page of consensus.'],
  ['ocean', 'Privacy / OSINT. Weighted toward primary and public-record sources.'],
  ['green', 'Summarize. Same results, condensed.'],
];

const Row = ({ cells, head = false }) => (
  <tr className={head ? '' : 'border-t border-white/10'}>
    {cells.map((c, i) => (
      <td
        key={i}
        className={`py-2.5 pr-4 align-top ${
          head
            ? 'text-white/40 text-xs uppercase tracking-wider font-medium'
            : i === 0
              ? 'font-mono text-sm text-emerald-300 whitespace-nowrap'
              : i === 1
                ? 'text-sm text-white/45 whitespace-nowrap'
                : 'text-sm text-white/70'
        }`}
      >
        {c}
      </td>
    ))}
  </tr>
);

const Table = ({ head, rows }) => (
  <div className="overflow-x-auto -mx-4 px-4">
    <table className="w-full min-w-[520px] border-collapse">
      <thead><Row cells={head} head /></thead>
      <tbody>{rows.map((r, i) => <Row key={i} cells={r} />)}</tbody>
    </table>
  </div>
);

const Code = ({ children }) => (
  <pre className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[13px] leading-relaxed text-white/80">
    <code>{children}</code>
  </pre>
);

const H = ({ id, children }) => (
  <h2 id={id} className="text-2xl font-semibold mt-14 mb-4 scroll-mt-8">{children}</h2>
);

const Developers = () => (
  <div className="min-h-screen bg-black text-white">
    <div className="max-w-3xl mx-auto px-4 py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.2em] text-white/35 mb-3">Truegle API</p>
        <h1 className="text-4xl font-bold mb-4">Search the web from your own code</h1>
        <p className="text-white/60 leading-relaxed">
          One public endpoint. No key, no account, no sign-up form. Send a query,
          get web results back as JSON. It is the same API the Truegle website
          runs on, which is the only honest way to publish one — if it breaks for
          you it breaks for us.
        </p>
      </header>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <p className="text-sm text-white/60 leading-relaxed">
          <span className="text-white/85 font-medium">Base URL</span>
          <br />
          <code className="font-mono text-emerald-300">{API_HOST}</code>
        </p>
      </div>

      <H id="quickstart">Quickstart</H>
      <p className="text-white/60 mb-4 leading-relaxed">
        There is no step before this one. Paste it into a terminal.
      </p>
      <Code>{REQUEST}</Code>

      <H id="request">The request</H>
      <p className="text-white/60 mb-4 leading-relaxed">
        <code className="font-mono text-emerald-300">POST /api/search</code>, with a
        JSON body. <code className="font-mono text-emerald-300">Content-Type: application/json</code> is
        required; nothing else is.
      </p>
      <Table head={['Field', 'Type', 'Meaning']} rows={FIELDS} />

      <H id="response">The response</H>
      <Code>{RESPONSE}</Code>
      <p className="text-white/60 mt-4 mb-4 leading-relaxed">
        Every entry in <code className="font-mono text-emerald-300">results</code> has
        the same five fields.
      </p>
      <Table head={['Field', 'Type', 'Meaning']} rows={RESULT_FIELDS} />
      <p className="text-white/50 text-sm mt-4 leading-relaxed">
        A search that finds nothing returns <code className="font-mono">success: true</code> with
        an empty <code className="font-mono">results</code> array — an empty web is not an
        error. Genuine failures use the HTTP status: <code className="font-mono">400</code> for
        a missing or malformed query, <code className="font-mono">429</code> when you are
        going too fast, <code className="font-mono">5xx</code> when it is our fault.
      </p>

      <H id="modes">Modes</H>
      <p className="text-white/60 mb-4 leading-relaxed">
        Truegle searches the same web through different lenses. The mode changes
        which sources are weighted, not which are permitted — nothing is hidden
        from you in any mode.
      </p>
      <Table head={['Mode', 'What it does']} rows={MODES} />

      <H id="limits">Rate limits and fair use</H>
      <ul className="space-y-3 text-white/60 leading-relaxed list-disc pl-5">
        <li>
          Requests are rate limited per IP. Stay conversational and you will never
          see it; hammer it in a loop and you will get a{' '}
          <code className="font-mono">429</code>. Back off and retry rather than
          retrying immediately.
        </li>
        <li>
          <span className="text-white/85">Cache what you fetch.</span> Truegle runs
          on its own hardware and other people&apos;s indexes. Repeating an
          identical query every few seconds costs real money and helps nobody.
        </li>
        <li>
          <span className="text-white/85">Browser calls are restricted.</span> The
          endpoint is meant to be called from a server. Cross-origin browser
          requests from arbitrary sites are not permitted, so a public web page
          cannot use it as its own backend.
        </li>
        <li>
          There is no paid tier and no key to buy. If you need volume beyond fair
          use, write to us before you take it.
        </li>
      </ul>

      <H id="privacy">What we do with your requests</H>
      <p className="text-white/60 leading-relaxed mb-3">
        The same thing we do with searches on the website, which is close to
        nothing. We do not build a profile, we do not set a cookie, and there is
        no account to attach anything to. Queries are logged in aggregate to
        produce a trending list, without anything identifying attached.
      </p>
      <p className="text-white/60 leading-relaxed">
        If you are passing your users&apos; searches through this API, you are
        the one holding their trust. Do not send us anything about them beyond
        the words they typed — we do not want it and we have nowhere to put it.
      </p>

      <H id="terms">Terms</H>
      <p className="text-white/60 leading-relaxed">
        Use of this API is covered by the{' '}
        <Link to="/terms" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">Terms of Service</Link>{' '}
        and the{' '}
        <Link to="/privacy" className="text-blue-400 hover:text-blue-300 underline underline-offset-2">Privacy Policy</Link>.
        Attribute results to Truegle where you display them. Bulk collection for
        model training is a separate licence — see{' '}
        <a
          href="/ai-licensing"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          AI licensing
        </a>.
      </p>

      <H id="contact">Getting in touch</H>
      <p className="text-white/60 leading-relaxed">
        Questions, bug reports, or a use case that needs more than fair use:{' '}
        <a
          href="mailto:truegleai@proton.me?subject=Truegle%20API"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          truegleai@proton.me
        </a>. A real person reads it.
      </p>

      <footer className="mt-16 pt-8 border-t border-white/10 text-sm text-white/40">
        <Link to="/" className="hover:text-white/70">← Back to Truegle</Link>
      </footer>
    </div>
  </div>
);

export default Developers;
