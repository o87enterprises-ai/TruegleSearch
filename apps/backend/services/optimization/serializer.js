/**
 * Serializer — turns a validated, structured post object into the exact JSX
 * source that blogPosts.jsx expects, plus the sitemap <url> block and the
 * llms.txt line. The MODEL never emits JSX; this deterministic serializer does,
 * so the build can't be broken by model output and the house style is uniform.
 */

const { CANONICAL_ORIGIN } = require('./config');

// --- escaping -------------------------------------------------------------

/** Escape text placed inside JSX element bodies (<p>TEXT</p>). */
function escapeJsxText(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\{/g, '&#123;')
    .replace(/\}/g, '&#125;');
}

/** Emit a safe single-quoted JS string literal (matches file house style). */
function singleQuote(s) {
  return `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ')}'`;
}

// --- body rendering -------------------------------------------------------

const IND = '        '; // 8 spaces — nesting inside `body: ( <> ... </> )`

function renderProse(content) {
  return content.map((p) => `${IND}  <p>${escapeJsxText(p)}</p>`).join('\n');
}

function renderList(content, ordered) {
  const tag = ordered ? 'ol' : 'ul';
  const cls = ordered ? 'list-decimal pl-6 space-y-2' : 'list-disc pl-6 space-y-2';
  const items = content.map((li) => `${IND}    <li>${escapeJsxText(li)}</li>`).join('\n');
  return `${IND}  <${tag} className="${cls}">\n${items}\n${IND}  </${tag}>`;
}

function renderLinks(section) {
  const items = section.links
    .map(
      (l) =>
        `${IND}    <li><a href="${l.href}" className="text-blue-400 hover:text-blue-300">${escapeJsxText(l.text)}</a></li>`
    )
    .join('\n');
  return (
    `${IND}  <p>${escapeJsxText(section.intro)}</p>\n` +
    `${IND}  <ul className="list-disc pl-6 space-y-2">\n${items}\n${IND}  </ul>`
  );
}

function renderSection(section) {
  let inner;
  if (section.kind === 'steps') inner = renderList(section.content, true);
  else if (section.kind === 'points') inner = renderList(section.content, false);
  else if (section.kind === 'links') inner = renderLinks(section);
  else inner = renderProse(section.content);
  return `${IND}<LegalSection heading=${jsxAttr(section.heading)}>\n${inner}\n${IND}</LegalSection>`;
}

/** heading is a prop — emit as a JS-string expression to dodge quote issues. */
function jsxAttr(s) {
  return `{${singleQuote(s)}}`;
}

function renderBody(post) {
  const lead = `${IND}<p><strong>Short answer:</strong> ${escapeJsxText(post.shortAnswer)}</p>`;
  const sections = post.sections.map(renderSection).join('\n');
  return `(\n      <>\n${lead}\n${sections}\n      </>\n    )`;
}

// --- entry / sitemap / llms ----------------------------------------------

function renderFaq(faq) {
  const entries = faq
    .map((f) => `      {\n        q: ${singleQuote(f.q)},\n        a: ${singleQuote(f.a)},\n      }`)
    .join(',\n');
  return `[\n${entries},\n    ]`;
}

/** Full blogPosts.jsx array element, indented to sit at array depth. */
function renderEntry(post) {
  return (
    `  {\n` +
    `    slug: ${singleQuote(post.slug)},\n` +
    `    title: ${singleQuote(post.title)},\n` +
    `    description:\n      ${singleQuote(post.description)},\n` +
    `    date: ${singleQuote(post.date)},\n` +
    `    readingTime: ${singleQuote(post.readingTime)},\n` +
    `    faq: ${renderFaq(post.faq)},\n` +
    `    body: ${renderBody(post)},\n` +
    `  },`
  );
}

function sitemapUrl(slug, date) {
  return (
    `  <url>\n` +
    `    <loc>${CANONICAL_ORIGIN}/blog/${slug}</loc>\n` +
    `    <lastmod>${date}</lastmod>\n` +
    `  </url>`
  );
}

function llmsLine(slug, title) {
  return `- ${CANONICAL_ORIGIN}/blog/${slug} — ${title}`;
}

module.exports = {
  escapeJsxText,
  singleQuote,
  renderSection,
  renderBody,
  renderEntry,
  sitemapUrl,
  llmsLine,
};
