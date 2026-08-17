import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// The one place an AI answer becomes HTML.
//
// WHY THIS EXISTS: react-markdown was being called from six places — the search
// summary, TruegleChat, the chat overlay, the inline summary chat, the shared
// thread, and the OSINT panel — five of them bare and one with a components
// map. So the same answer rendered differently depending on which surface you
// happened to be reading it on, and a fix applied to one never reached the
// other five.
//
// REPORTED, and the reason this got written: an answer containing a markdown
// table arrived on screen as one flat run of pipes —
//
//     | Method | Details | |--------|---------| | Search directly | Google …
//
// That is not a model failure. TABLES ARE NOT PART OF COMMONMARK. They are a
// GitHub-Flavored Markdown extension, and plain react-markdown ships no GFM
// support, so the table source was parsed as an ordinary paragraph — and a
// paragraph folds its single newlines into spaces, which is exactly the flat
// line the user saw. remark-gfm is the fix, and it also brings strikethrough,
// task lists and bare-URL autolinking (which is why TruegleChat's hand-rolled
// linkifyBareUrls could go).
//
// Links always open in a new tab with rel="noopener noreferrer": an answer can
// cite anywhere on the web, and nothing cited should be able to reach back
// into the tab it was opened from.
//
// Tables scroll inside their own box rather than pushing the page sideways —
// a five-column comparison must not force horizontal scroll on a phone.

// `node` is destructured off every override and dropped: react-markdown hands
// each custom component the mdast node it came from, and spreading that onto a
// DOM element emits a literal node="[object Object]" attribute and a React
// warning on every heading, cell and link.
const COMPONENTS = {
  a: ({ node: _node, href, children, ...rest }) => (
    <a {...rest} href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ),
  table: ({ node: _node, children, ...rest }) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-white/15">
      <table {...rest} className="w-full text-left text-[13px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ node: _node, children, ...rest }) => (
    <thead {...rest} className="bg-white/[0.07]">{children}</thead>
  ),
  th: ({ node: _node, children, ...rest }) => (
    <th {...rest} className="px-3 py-2 font-semibold text-white/85 border-b border-white/15 whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ node: _node, children, ...rest }) => (
    // /10, not /8: Tailwind 3's opacity modifier only takes values on the
    // opacity scale, so border-white/8 emits no colour rule at all and the row
    // divider falls back to the default border colour — a bright grey line
    // across a dark card.
    <td {...rest} className="px-3 py-2 align-top border-b border-white/10 text-white/75">{children}</td>
  ),
};

const PLUGINS = [remarkGfm];

/**
 * Render an AI answer. Drop-in replacement for a bare <ReactMarkdown>.
 *
 * @param {object} props
 * @param {string} props.children  markdown source
 * @param {object} [props.components]  per-surface overrides merged over the defaults
 */
export default function Markdown({ children, components }) {
  return (
    <ReactMarkdown
      remarkPlugins={PLUGINS}
      components={components ? { ...COMPONENTS, ...components } : COMPONENTS}
    >
      {children}
    </ReactMarkdown>
  );
}
