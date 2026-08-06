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
// !reddit / !r <words>    → Reddit posts only
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
  '!reddit': 'reddit',
  '!r': 'reddit',
  '!web': 'any',        // escape hatch: search everything, not just video hosts
};

// Every platform the player can actually host, as a pickable chip.
//
// A provider is the same instruction as a bang (!yt, !reddit) — this is just
// the version you can tap. Both land in the same `platform` field.
//
// `channelLabel` and `prefix` exist because "the channel" is a DIFFERENT
// address on every platform, and using the wrong shape returns nothing:
// YouTube wants @handle, Reddit wants r/subreddit, SoundCloud wants a bare
// user slug. Naming each one correctly is the difference between the Channel
// chip working and looking broken.
export const PROVIDERS = [
  // "Anywhere", not "All" — the What row has its own All, and two chips
  // reading the same word in adjacent rows is the kind of thing that makes a
  // control feel arbitrary. It also just answers "where?" better.
  { id: 'all', label: 'Anywhere', site: '', category: 'videos', channelLabel: 'Channel', prefix: '@' },
  { id: 'youtube', label: 'YouTube', site: 'site:youtube.com', category: 'videos', channelLabel: 'Channel', prefix: '@' },
  // site: takes a DOMAIN. `site:reddit.com/r` is a path prefix, which only
  // Google honours — every other engine SearXNG fans out to treats it as
  // malformed and returns nothing, which is why Reddit searches came back
  // empty on the live index while passing against a mock.
  // 'social' is the backend's OWN Reddit path: SearXNG's social-media category
  // plus a Google query it builds itself. It does not depend on our site:
  // filter surviving, and — the reason this matters — it still answers when
  // SearXNG is cold, which 'web' and 'videos' may not.
  { id: 'reddit', label: 'Reddit', site: 'site:reddit.com', category: 'social', channelLabel: 'Subreddit', prefix: 'r/' },
  { id: 'vimeo', label: 'Vimeo', site: 'site:vimeo.com', category: 'videos', channelLabel: 'Creator', prefix: '' },
  // NOT "Artist" — the What row already has an Artist chip, and two chips with
  // the same word on screen is worse than a slightly duller label.
  { id: 'soundcloud', label: 'SoundCloud', site: 'site:soundcloud.com', category: 'web', channelLabel: 'Profile', prefix: '' },
  { id: 'tiktok', label: 'TikTok', site: 'site:tiktok.com', category: 'videos', channelLabel: 'Creator', prefix: '@' },
  { id: 'dailymotion', label: 'Dailymotion', site: 'site:dailymotion.com', category: 'videos', channelLabel: 'Channel', prefix: '' },
  { id: 'rumble', label: 'Rumble', site: 'site:rumble.com', category: 'videos', channelLabel: 'Channel', prefix: 'c/' },
  { id: 'odysee', label: 'Odysee', site: 'site:odysee.com', category: 'videos', channelLabel: 'Channel', prefix: '@' },
];
const PROVIDER_BY_ID = Object.fromEntries(PROVIDERS.map((p) => [p.id, p]));
export const providerMeta = (id) => PROVIDER_BY_ID[id] || PROVIDER_BY_ID.all;

const SITE = Object.fromEntries(
  PROVIDERS.filter((p) => p.site).map((p) => [p.id, p.site]),
);

const unquote = (v) => String(v || '').replace(/^"|"$/g, '').trim();

// "Darkwaters 9 channel" is how people say it; the channel is actually
// @DarkWaters9. Spoken names carry spaces the handle doesn't, so a channel is
// matched on its squashed form and searched for BOTH ways.
const squash = (v) => String(v || '').toLowerCase().replace(/[\s._-]/g, '');

// "Dark Waters 9" → "@darkwaters9". The one form the index answers.
//
// Provider-aware, because the prefix IS the address: r/askreddit is not
// @askreddit and searching for the wrong one returns nothing. Live-tested on
// YouTube — "Darkwaters 9" returns a film and a DND series, @darkwaters9
// returns the channel.
export const toHandle = (v, provider = 'youtube') => {
  // A LINK IS NOT A HANDLE. The Channel chip rewrites the box on every
  // keystroke, so pasting a URL while it was on produced
  // "r/https://wwwredditcom/r/aww/comments/..." — no longer a URL, so it went
  // to the search backend as a garbage query and came back with nothing. That
  // is what "not even direct links work" was. Pass links through untouched.
  const asText = String(v || '');
  if (/^\s*https?:\/\//i.test(asText)) return asText.trim();
  const { prefix } = providerMeta(provider === 'all' ? 'youtube' : provider);
  const bare = squash(String(v || '').replace(/^@+/, '').replace(/^r\//i, '').replace(/^c\//i, ''));
  return bare ? `${prefix}${bare}` : '';
};

/** What to call "the channel" on this provider — the Channel chip's label. */
export const channelLabel = (provider) => providerMeta(provider).channelLabel;

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
 *   platform    — a PROVIDERS id, 'any', or null
 *   backendQuery— what to actually send to search
 *   explicit    — the user asked for a platform/channel, so don't second-guess
 */
export function parsePlayerQuery(raw, scope = 'all', provider = 'all') {
  let text = String(raw || '').trim();
  // The provider chip is a default that a bang typed in the box can override —
  // typing "!yt" while Reddit is selected means you changed your mind.
  let platform = provider && provider !== 'all' && PROVIDER_BY_ID[provider] ? provider : null;
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

  const explicit = !!(channel || platform || activeScope !== 'all' || (provider && provider !== 'all'));
  let site = platform && platform !== 'any' ? SITE[platform] || '' : '';

  // The HANDLE is the query. Tested against the live index: "Darkwaters 9"
  // returns a film and a DND series, an OR group of spellings returns nothing
  // useful (the provider doesn't honour the grouping), and @darkwaters9
  // returns the channel. So a channel is always normalised to its handle —
  // spaces out, leading @ on — and asked for exactly that way.
  let channelTerms = channel ? toHandle(channel, platform || 'youtube') : '';

  // A subreddit stays a TERM alongside the domain scope, for the same reason:
  // `site:reddit.com/r/aww` is a path filter most engines don't support.
  // `site:reddit.com "r/aww"` works everywhere and is nearly as sharp, since
  // the subreddit name appears in the URL and the page of every post in it.
  if (platform === 'reddit' && channelTerms) channelTerms = `"${channelTerms}"`;

  // Scope shapes the words around the query the way YouTube's chips do.
  const shaped = {
    all: text,
    channel: '',
    song: text ? `${text} (song OR audio OR "official audio" OR "official video")` : '',
    artist: text ? `"${text}" (artist OR official OR music)` : '',
    title: text ? `"${text}"` : '',
    topic: text,
  }[activeScope];

  const siteQuery = [site, channelTerms, shaped].filter(Boolean).join(' ').trim();

  // The category-scoped ask does NOT carry our site: filter. The backend's
  // social path appends its own ("… site:reddit.com OR site:twitter.com …"),
  // and stacking two site: clauses in one Google query returns nothing. What
  // keeps non-Reddit noise out is getPlayable(), which refuses every host in
  // that list except Reddit.
  const category = providerMeta(platform && platform !== 'any' ? platform : 'all').category || 'videos';
  const scopedQuery = category === 'social'
    ? [channelTerms, shaped].filter(Boolean).join(' ').trim()
    : siteQuery;

  return {
    text, channel, platform, scope: activeScope, category,
    backendQuery: scopedQuery || siteQuery || text,
    siteQuery: siteQuery || text,
    explicit,
  };
}

// Rank playable results the way someone searching for something to watch
// expects: YouTube first (it is what they meant), then the other hosts we can
// actually play, and inside each group the ones that match the channel they
// asked for. Without this the list was whatever order the index returned,
// which is what "random and sparse" looked like.
// Reddit sits last: its embed is a post card rather than a player, so it is
// what you get when you asked for it, not what you get by default.
const HOST_RANK = { youtube: 0, vimeo: 1, soundcloud: 2, tiktok: 3, reddit: 8 };

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
