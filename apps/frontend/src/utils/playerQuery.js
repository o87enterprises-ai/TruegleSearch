// What people type into the player, understood the way they mean it.
//
// The player is used like YouTube's search box, so it has to accept the things
// people type there: a channel with an @handle, "videos BY someone", a bare
// title. Web search returns none of that usefully on its own — asking a
// general index for "ebk jaaybo" gets articles, lyric sites and reposts, which
// is why the results looked random and sparse.
//
// Two jobs here:
//   1. Pull the intent out of the text (a channel, a platform preference).
//   2. Turn it into a query the search backend actually answers well, which
//      means site-scoping to YouTube rather than hoping it ranks first.
//
// Bangs are the familiar shorthand (DuckDuckGo's, and everyone copies it), and
// the dork forms are what people who use search operators already type.

// !yt / !youtube          → YouTube only
// !ch <name> / @<name>    → that channel
// channel:<name>          → same, operator form
// from:<name> / by:<name> → same, phrased the way people talk
const CHANNEL_OPERATORS = /(?:^|\s)(?:channel|from|by|author):("[^"]+"|\S+)/i;
const HANDLE = /(?:^|\s)@([A-Za-z0-9._-]{2,})/;
const PLATFORM_BANGS = {
  '!yt': 'youtube',
  '!youtube': 'youtube',
  '!tube': 'youtube',
  '!vimeo': 'vimeo',
  '!sc': 'soundcloud',
  '!soundcloud': 'soundcloud',
  '!tiktok': 'tiktok',
  '!web': 'any',        // escape hatch: search everything, not just video hosts
};

const SITE = {
  youtube: 'site:youtube.com',
  vimeo: 'site:vimeo.com',
  soundcloud: 'site:soundcloud.com',
  tiktok: 'site:tiktok.com',
};

const unquote = (v) => String(v || '').replace(/^"|"$/g, '').trim();

// "Darkwaters 9 channel" is how people say it; the channel is actually
// @DarkWaters9. Spoken names carry spaces the handle doesn't, so a channel is
// matched on its squashed form and searched for BOTH ways.
const squash = (v) => String(v || '').toLowerCase().replace(/[\s._-]/g, '');

// A trailing (or leading) "channel" / "yt channel" is the user naming what
// they want, not part of the name: "dark waters 9 channel" means the channel.
const TRAILING_CHANNEL = /^(.*?)\s+(?:yt\s+|youtube\s+)?channel\s*$/i;
const LEADING_CHANNEL = /^channel\s+(?:for\s+)?(.+)$/i;

// What the user is looking for. YouTube's own chips are the model: people
// scan by one axis at a time, and "song" and "channel" want very different
// queries even for identical text.
export const SEARCH_SCOPES = [
  { id: 'all', label: 'All' },
  { id: 'channel', label: 'Channel' },
  { id: 'song', label: 'Song' },
  { id: 'artist', label: 'Artist' },
  { id: 'title', label: 'Title' },
  { id: 'topic', label: 'Topic' },
];
const SCOPE_IDS = new Set(SEARCH_SCOPES.map((s) => s.id));

/**
 * @returns {{text, channel, platform, backendQuery, explicit}}
 *   text        — what's left after the operators are removed
 *   channel     — a channel/author name, if one was asked for
 *   platform    — 'youtube' | 'vimeo' | 'soundcloud' | 'tiktok' | 'any' | null
 *   backendQuery— what to actually send to search
 *   explicit    — the user asked for a platform/channel, so don't second-guess
 */
export function parsePlayerQuery(raw, scope = 'all') {
  let text = String(raw || '').trim();
  let platform = null;
  let channel = null;
  const activeScope = SCOPE_IDS.has(scope) ? scope : 'all';

  // Bangs, anywhere in the string — people put them at either end.
  for (const [bang, value] of Object.entries(PLATFORM_BANGS)) {
    const re = new RegExp(`(?:^|\\s)${bang.replace('!', '\\!')}(?=\\s|$)`, 'i');
    if (re.test(text)) {
      platform = value;
      text = text.replace(re, ' ').trim();
    }
  }

  // !ch <name> — takes the next word, or a quoted phrase.
  const ch = /(?:^|\s)!ch\s+("[^"]+"|\S+)/i.exec(text);
  if (ch) {
    channel = unquote(ch[1]);
    text = text.replace(ch[0], ' ').trim();
  }

  const op = CHANNEL_OPERATORS.exec(text);
  if (op) {
    channel = channel || unquote(op[1]);
    text = text.replace(op[0], ' ').trim();
  }

  const handle = HANDLE.exec(text);
  if (handle) {
    channel = channel || handle[1];
    text = text.replace(handle[0], ' ').trim();
  }

  // "… channel" / "channel …" — said out loud rather than typed as an operator.
  if (!channel) {
    const trailing = TRAILING_CHANNEL.exec(text);
    const leading = !trailing && LEADING_CHANNEL.exec(text);
    if (trailing && trailing[1].trim()) { channel = trailing[1].trim(); text = ''; }
    else if (leading && leading[1].trim()) { channel = leading[1].trim(); text = ''; }
  }
  // The Channel chip says the whole box is a channel name.
  if (activeScope === 'channel' && !channel && text) { channel = text; text = ''; }

  // A channel without a platform means YouTube: that is where channels are.
  if (channel && !platform) platform = 'youtube';

  const explicit = !!(channel || platform || activeScope !== 'all');
  const site = platform && platform !== 'any' ? SITE[platform] : '';

  // The channel is asked for in both spellings — the spoken one and the
  // handle — because an index has seen the page under whichever the creator
  // uses. "Darkwaters 9" alone never matched @DarkWaters9.
  const channelTerms = channel
    ? (squash(channel) === channel.toLowerCase()
      ? `"${channel}"`
      : `("${channel}" OR "${squash(channel)}" OR "@${squash(channel)}")`)
    : '';

  // Scope shapes the words around the query the way YouTube's chips do.
  const shaped = {
    all: text,
    channel: '',
    song: text ? `${text} (song OR audio OR "official audio" OR "official video")` : '',
    artist: text ? `"${text}" (artist OR official OR music)` : '',
    title: text ? `"${text}"` : '',
    topic: text,
  }[activeScope];

  const backendQuery = [site, channelTerms, shaped]
    .filter(Boolean).join(' ').trim();

  return {
    text, channel, platform, scope: activeScope,
    backendQuery: backendQuery || text, explicit,
  };
}

// Rank playable results the way someone searching for something to watch
// expects: YouTube first (it is what they meant), then the other hosts we can
// actually play, and inside each group the ones that match the channel they
// asked for. Without this the list was whatever order the index returned,
// which is what "random and sparse" looked like.
const HOST_RANK = { youtube: 0, vimeo: 1, soundcloud: 2, tiktok: 3 };

export function rankPlayable(rows, { channel, platform } = {}) {
  const wanted = channel ? channel.toLowerCase().replace(/[\s._-]/g, '') : null;
  const matchesChannel = (r) => {
    if (!wanted) return false;
    const hay = `${r.title || ''} ${r.channel || ''} ${r.pageUrl || ''}`
      .toLowerCase().replace(/[\s._-]/g, '');
    return hay.includes(wanted);
  };
  return [...rows].sort((a, b) => {
    // An explicitly requested platform outranks everything else.
    if (platform && platform !== 'any') {
      const ap = a.kind === platform ? 0 : 1;
      const bp = b.kind === platform ? 0 : 1;
      if (ap !== bp) return ap - bp;
    }
    const ac = matchesChannel(a) ? 0 : 1;
    const bc = matchesChannel(b) ? 0 : 1;
    if (ac !== bc) return ac - bc;
    const ah = HOST_RANK[a.kind] ?? 9;
    const bh = HOST_RANK[b.kind] ?? 9;
    return ah - bh;
  });
}

export default parsePlayerQuery;
