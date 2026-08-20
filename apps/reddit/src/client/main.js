/*
 * The web view.
 *
 * IT TALKS ONLY TO ITS OWN /api/. That is not a style choice — Devvit blocks a
 * client-side fetch to any external domain, and requires the path to start with
 * /api/. Everything that leaves Reddit leaves from the server, one file over.
 *
 * Rendered by hand rather than with a framework: this is one form and one list,
 * and a post that loads instantly on a phone in a scrolling feed is worth more
 * here than component ergonomics.
 */

const form = document.getElementById('form');
const input = document.getElementById('q');
const button = document.getElementById('go');
const out = document.getElementById('out');

/** Only ever inserted as text, never as markup. */
const say = (text, bad = false) => {
  out.replaceChildren();
  const p = document.createElement('p');
  p.className = bad ? 'note bad' : 'note';
  p.textContent = text;
  out.append(p);
  return p;
};

/** example.com/a/b → example.com › a › b, the way a result line reads. */
function crumb(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    const path = u.pathname.split('/').filter(Boolean).slice(0, 2);
    return [host, ...path].join(' › ');
  } catch {
    return url;
  }
}

function when(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function render(results) {
  if (!results.length) {
    say('Nothing came back for that. Try different words.');
    return;
  }
  const frag = document.createDocumentFragment();
  for (const r of results) {
    const a = document.createElement('a');
    a.className = 'hit';
    a.href = r.url;
    // A result opens in a new tab and carries no referrer — the destination
    // learns nothing about where the click came from, including that it came
    // from a subreddit.
    a.target = '_blank';
    a.rel = 'noopener noreferrer';

    const host = document.createElement('span');
    host.className = 'hit-h';
    host.textContent = crumb(r.url);

    const title = document.createElement('span');
    title.className = 'hit-t';
    title.textContent = r.title || crumb(r.url);

    const snippet = document.createElement('span');
    snippet.className = 'hit-s';
    const date = when(r.date);
    if (date) {
      const d = document.createElement('span');
      d.className = 'hit-d';
      d.textContent = `${date} — `;
      snippet.append(d);
    }
    snippet.append(document.createTextNode(r.snippet || ''));

    a.append(host, title, snippet);
    frag.append(a);
  }
  out.replaceChildren(frag);
}

// One search at a time. Somebody hammering Enter on a slow network used to be
// able to have three in flight and see whichever landed last, which is not
// necessarily the one they last asked for.
let running = false;

async function search(query) {
  if (running) return;
  running = true;
  button.disabled = true;
  say('Searching').classList.add('spin');

  try {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || data.status !== 'ok') {
      say(data?.message || 'Search is not answering right now. Try again in a moment.', true);
      return;
    }
    render(Array.isArray(data.results) ? data.results : []);
  } catch {
    say('Could not reach search from here. Try again in a moment.', true);
  } finally {
    running = false;
    button.disabled = false;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = input.value.trim();
  if (query) search(query);
});
