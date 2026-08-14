import source from '../content/survival-encyclopedia.md?raw';

// The Survivor's Encyclopedia, parsed once at module load.
//
// This module is the ONLY thing that knows the file's shape, and it is lazy —
// nothing here is in the main bundle. Somebody who mistypes a URL, reads "404"
// and leaves downloads none of it.
//
// The point of the whole feature: a search engine that is worth something when
// the search engine cannot be reached. That is why `toDocument()` exists and
// why it inlines everything — a file on the reader's disk survives cache
// eviction, "clear browsing data", a flat battery on the router, and this site
// going away entirely. A service-worker cache survives none of those.

const LETTER = /^### (.+)$/;
const ENTRY = /^#### (.+)$/;

// The file opens with an HTML comment documenting its own structure. Strip it
// before parsing so the convention note never leaks into the intro or into the
// copy the reader saves.
const strip = (md) => md.replace(/<!--[\s\S]*?-->\n*/g, '');

function parse(md) {
  const letters = [];
  const entries = [];
  const intro = [];
  let letter = null;
  let entry = null;
  let title = '';
  let outro = [];

  for (const raw of strip(md).split('\n')) {
    if (raw.startsWith('# ')) { title = raw.slice(2).trim(); continue; }
    const l = raw.match(LETTER);
    if (l) {
      letter = { letter: l[1].trim(), entries: [] };
      letters.push(letter);
      entry = null;
      continue;
    }
    const e = raw.match(ENTRY);
    if (e) {
      // A heading can carry its article on the same line, after an en dash:
      //
      //   #### Pemmican – Ultimate survival food: dried lean meat...
      //   #### Acorn Flour – See *Foraging & Wild Foods*
      //
      // Both are split here. Without the split the first became a
      // three-hundred-character TITLE with an empty body, which read in the
      // index as a wall of prose where a name should be — and the second is a
      // cross-reference rather than an article, marked so the index can be
      // honest about how many things actually tell you how to do something.
      const label = e[1].trim();
      const split = /^(.+?)\s+[\u2013\u2014-]\s+(.+)$/.exec(label);
      const name = (split ? split[1] : label).trim();
      const rest = split ? split[2].trim() : '';
      const see = /^See\s+(.+)$/.exec(rest);
      entry = {
        id: slug(name),
        title: name,
        seeAlso: see ? see[1].trim() : null,
        letter: letter?.letter || '?',
        lines: rest ? [rest] : [],
      };
      (letter?.entries || []).push(entry);
      entries.push(entry);
      continue;
    }
    if (entry) entry.lines.push(raw);
    else if (letters.length) outro.push(raw);
    else intro.push(raw);
  }

  for (const en of entries) en.body = trim(en.lines).join('\n');
  return {
    title: title || "The Survivor's Encyclopedia",
    intro: trim(intro).join('\n'),
    outro: trim(outro).join('\n'),
    letters: letters.filter((x) => x.entries.length),
    entries,
  };
}

const trim = (lines) => {
  const out = [...lines];
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out.filter((l) => l.trim() !== '---');
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const BOOK = parse(source);
export const RAW = strip(source).trim();

/**
 * Search titles and bodies. Title hits rank first, because somebody looking up
 * "water filter" while their water is bad wants the article, not the six other
 * entries that mention filtering water in passing.
 */
export function search(q) {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2) return [];
  const hits = [];
  for (const e of BOOK.entries) {
    const t = e.title.toLowerCase().indexOf(needle);
    const b = e.body.toLowerCase().indexOf(needle);
    if (t < 0 && b < 0) continue;
    hits.push({ entry: e, rank: t >= 0 ? t : 1000 + b, where: t >= 0 ? 'title' : 'body' });
  }
  return hits.sort((a, b) => a.rank - b.rank).slice(0, 40).map((h) => h.entry);
}

// ── the offline copy ───────────────────────────────────────────────────────

const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/** Inline markdown → HTML. Bold, italic, and nothing else, because nothing
 *  else appears in the source and a general parser is a general liability. */
export function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/** Block markdown → HTML, for one entry body. */
export function blocks(md) {
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const ol = /^\d+\.\s+(.*)$/.exec(line);
    const ul = /^-\s+(.*)$/.exec(line);
    if (ol) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
    } else if (ul) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

/**
 * The whole book as ONE self-contained HTML file: no scripts, no fonts, no
 * images, no links off the page. Open it from a memory stick on a laptop that
 * has never seen a network and it works, which is the only definition of
 * "offline" that means anything on the day you need it.
 */
export function toDocument() {
  const nav = BOOK.letters
    .map((l) => `<a href="#L${l.letter}">${esc(l.letter)}</a>`)
    .join('');
  const body = BOOK.letters.map((l) => `
<section><h2 id="L${esc(l.letter)}">${esc(l.letter)}</h2>
${l.entries.map((e) => `<article><h3 id="${e.id}">${esc(e.title)}</h3>\n${blocks(e.body)}</article>`).join('\n')}
</section>`).join('\n');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(BOOK.title)}</title>
<style>
  :root { color-scheme: light dark; --bg:#fff; --fg:#111; --dim:#555; --rule:#d4d4d4; --accent:#0b6b52; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0d0f12; --fg:#e8e6e3; --dim:#9aa0a6; --rule:#2a2f36; --accent:#5ee2b0; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.6 Georgia,'Times New Roman',serif; }
  .wrap { max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 6rem; }
  h1 { font-size:1.9rem; line-height:1.2; margin:0 0 .25rem; }
  .sub { color:var(--dim); font-style:italic; margin:0 0 1.5rem; }
  nav { position:sticky; top:0; background:var(--bg); border-bottom:1px solid var(--rule);
        padding:.6rem 0; margin-bottom:1.5rem; display:flex; flex-wrap:wrap; gap:.15rem; }
  nav a { display:inline-block; min-width:1.6rem; text-align:center; padding:.2rem .1rem;
          color:var(--accent); text-decoration:none; font-family:ui-monospace,monospace; font-weight:700; }
  h2 { font-family:ui-monospace,monospace; font-size:1.5rem; color:var(--accent);
       border-bottom:2px solid var(--rule); padding-bottom:.2rem; margin:2.5rem 0 1rem; }
  h3 { font-size:1.1rem; margin:1.6rem 0 .4rem; }
  article { margin-bottom:1.2rem; }
  p { margin:.5rem 0; }
  ol,ul { margin:.5rem 0; padding-left:1.5rem; }
  li { margin:.3rem 0; }
  footer { margin-top:3rem; padding-top:1rem; border-top:1px solid var(--rule);
           color:var(--dim); font-style:italic; }
  @media print { nav { display:none; } body { font-size:11pt; } article { break-inside:avoid; } }
</style></head>
<body><div class="wrap">
<h1>${esc(BOOK.title)}</h1>
<p class="sub">A comprehensive guide to post-apocalyptic, off-grid and pioneer survival. Saved from Truegle. This file needs no network — keep a copy somewhere that does not depend on one.</p>
<nav>${nav}</nav>
${body}
<footer>${blocks(BOOK.outro)}</footer>
</div></body></html>`;
}

/** Hand the reader a file. Blob + object URL, revoked after the click so a
 *  long session cannot leak a copy of the book per save. */
export function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
