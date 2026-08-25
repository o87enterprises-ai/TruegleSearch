/**
 * Detect an embeddable video URL (YouTube/Vimeo) and return its iframe embed
 * src. Used so "Open in app" / inline video citations play in-place instead
 * of loading the watch page (which YouTube blocks via X-Frame-Options).
 */
export function getVideoEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1);
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    // Exact host or a real subdomain only. A bare endsWith('youtube.com')
    // also matches attacker-controlled hosts like `evilyoutube.com`, which
    // would then be iframed as a trusted embed — the one thing a shared
    // Truegle player link must never do.
    if (host === 'youtube.com' || host.endsWith('.youtube.com')
      || host === 'youtube-nocookie.com' || host.endsWith('.youtube-nocookie.com')) {
      // A playlist id, if there is one. YouTube ids are conservative about
      // their alphabet, and this value is interpolated into an embed URL, so
      // anything outside it is dropped rather than passed through.
      const listId = (() => {
        const l = u.searchParams.get('list');
        return l && /^[A-Za-z0-9_-]{2,64}$/.test(l) ? l : null;
      })();
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        if (!id) return null;
        // Keep the playlist when the link carries one: /watch?v=X&list=Y means
        // "this video, in that playlist", and dropping the list turned a queue
        // someone shared into a single track.
        return listId
          ? `https://www.youtube.com/embed/${id}?list=${listId}`
          : `https://www.youtube.com/embed/${id}`;
      }
      // A BARE PLAYLIST — /playlist?list=… — which is what YouTube's own share
      // sheet hands you for an album or a mix, and what this function used to
      // return null for. That null was the whole bug behind "I pasted a
      // playlist and got web results about HTTPS": nothing recognised the link
      // as playable, so it fell through to an ordinary text search. videoseries
      // is YouTube's official entry point for playing a list with no
      // particular video chosen.
      if (u.pathname === '/playlist') {
        return listId ? `https://www.youtube.com/embed/videoseries?list=${listId}` : null;
      }
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith('/embed/')) return url;
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
    }
    // Video hosts beyond YouTube/Vimeo that publish a keyless embed. A search
    // for anything musical comes back full of these, and every one we don't
    // recognize is a result the player has to throw away — which is how a page
    // with 59 results ends up saying "nothing here can play".
    // Same exact-or-true-subdomain rule as above; these all end up in an
    // iframe, so a lookalike host must never match.
    if (host === 'dailymotion.com' || host.endsWith('.dailymotion.com')) {
      const id = /\/video\/([a-z0-9]+)/i.exec(u.pathname)?.[1];
      return id ? `https://www.dailymotion.com/embed/video/${id}` : null;
    }
    if (host === 'dai.ly') {
      const id = u.pathname.slice(1);
      return id ? `https://www.dailymotion.com/embed/video/${id}` : null;
    }
    if (host === 'rumble.com' || host.endsWith('.rumble.com')) {
      // Rumble's own embed ids live at /embed/<id>/; a watch URL carries the
      // id as its first path segment (v1a2b3c-title.html).
      if (u.pathname.startsWith('/embed/')) return url;
      const id = /^\/(v[a-z0-9]+)/i.exec(u.pathname)?.[1];
      return id ? `https://rumble.com/embed/${id}/` : null;
    }
    if (host === 'odysee.com' || host.endsWith('.odysee.com')) {
      const path = u.pathname.replace(/^\//, '');
      return path.includes('/') ? `https://odysee.com/$/embed/${path}` : null;
    }
    return null;
  } catch {
    return null;
  }
}

// ── Identity ────────────────────────────────────────────────────────────────
// The SAME video reaches us as half a dozen different strings: a watch URL, a
// youtu.be short link, an /embed/ URL with a ?si= tracking suffix, a nocookie
// host, a thumbnail-recovered id. Comparing `src` treats every one of those as
// a different video — which is why de-duplication silently failed, why the
// queue could hold the same clip twice, and above all why auto-advance
// "played the next duplicate listing of the same video": it searched the
// title, got the same video back under a different URL, saw a src it had
// never seen, and played it again.
//
// mediaKey() is the one identity everything compares on: platform + the
// platform's own id. It mirrors MediaService.classifyMedia's `canonical` on
// the backend — keep the two in step.
const KEY_RULES = [
  [/youtube(?:-nocookie)?\.com\/embed\/([\w-]{6,20})/i, 'youtube'],
  [/youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|live\/)([\w-]{6,20})/i, 'youtube'],
  [/youtu\.be\/([\w-]{6,20})/i, 'youtube'],
  [/\/vi(?:_webp)?\/([\w-]{6,20})\//i, 'youtube'],          // i.ytimg thumbnail
  [/(?:player\.)?vimeo\.com\/(?:video\/)?(\d+)/i, 'vimeo'],
  [/tiktok\.com\/(?:embed\/v2\/|[^?]*\/video\/)(\d+)/i, 'tiktok'],
  [/dailymotion\.com\/(?:embed\/)?video\/([a-z0-9]+)/i, 'dailymotion'],
  [/dai\.ly\/([a-z0-9]+)/i, 'dailymotion'],
  [/rumble\.com\/embed\/(v[a-z0-9]+)/i, 'rumble'],
  [/rumble\.com\/(v[a-z0-9]+)/i, 'rumble'],
  // A Reddit post is identified by its post id, which is the same in the
  // permalink and in the redditmedia embed we build from it.
  [/redd(?:it|itmedia)\.com\/r\/[A-Za-z0-9_]+\/comments\/([a-z0-9]{4,10})/i, 'reddit'],
];

export function mediaKey(input) {
  if (!input) return '';
  const raws = typeof input === 'string' ? [input] : [input.src, input.pageUrl];
  for (const raw of raws) {
    if (typeof raw !== 'string' || !raw) continue;
    // SoundCloud's widget wraps the real track URL in a query parameter, so
    // the identity has to be dug out of it rather than read off the widget.
    const wrapped = /w\.soundcloud\.com\/player\/\?url=([^&]+)/i.exec(raw);
    const s = wrapped ? decodeURIComponent(wrapped[1]) : raw;
    for (const [re, platform] of KEY_RULES) {
      const m = re.exec(s);
      if (m) return `${platform}:${m[1]}`;
    }
    const sc = /soundcloud\.com\/([^/?#]+\/[^/?#]+)/i.exec(s);
    if (sc) return `soundcloud:${sc[1].toLowerCase()}`;
  }
  // Anything else (a direct file, an unrecognised host) is identified by host
  // and path — the query string is where cache-busters and tracking live.
  const s = (typeof input === 'string' ? input : input.src) || '';
  try {
    const u = new URL(s);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname}`.toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

// The inverse: a stored key back to a URL getPlayable() will accept. The
// platform signal pool is keyed, not URL'd, and older rows may have no page
// URL at all — this is what makes those rows playable again.
export function urlFromKey(key) {
  const i = String(key || '').indexOf(':');
  if (i < 1) return null;
  const platform = key.slice(0, i);
  const id = key.slice(i + 1);
  if (!id) return null;
  switch (platform) {
    case 'youtube': return `https://www.youtube.com/watch?v=${id}`;
    case 'vimeo': return `https://vimeo.com/${id}`;
    case 'tiktok': return `https://www.tiktok.com/@x/video/${id}`;
    case 'dailymotion': return `https://www.dailymotion.com/video/${id}`;
    case 'rumble': return `https://rumble.com/${id}`;
    // Reddit's embed needs the subreddit, which the key doesn't carry. The
    // bare comments path redirects to the real one, and that is enough for a
    // link — but not enough to rebuild the embed, so the pool row keeps its
    // own pageUrl for that.
    case 'reddit': return `https://www.reddit.com/comments/${id}`;
    case 'soundcloud': return `https://soundcloud.com/${id}`;
    default: return null;
  }
}

/** Do these two sources point at the same piece of media? */
export const sameMedia = (a, b) => {
  if (!a || !b) return false;
  const ka = mediaKey(a);
  return !!ka && ka === mediaKey(b);
};

// Direct-media file extensions the persistent mini-player can play natively.
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

// Sources that are portrait by nature — Shorts, TikToks, Reels.
function isVerticalSource(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if ((host === 'youtube.com' || host.endsWith('.youtube.com')) && u.pathname.startsWith('/shorts/')) return true;
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Classify a URL for the persistent pop-out mini-player.
 * Returns { kind, src } or null if the URL isn't something we can keep playing.
 *  - kind 'youtube' | 'vimeo' → an embeddable iframe src (youtube uses the
 *    privacy-preserving youtube-nocookie host to match Truegle's no-tracking
 *    stance).
 *  - kind 'audio' | 'video' → a direct media file for a native <audio>/<video>.
 */
export function getPlayable(url) {
  if (!url) return null;
  // Short-form is shot vertically; the player needs to know so it doesn't box
  // a 9:16 clip into a 16:9 frame. Read it off the ORIGINAL url — the embed
  // form of a Short is indistinguishable from a normal video.
  const vertical = isVerticalSource(url);
  const embed = getVideoEmbed(url);
  if (embed) {
    if (embed.includes('player.vimeo.com')) return { kind: 'vimeo', src: embed };
    // The other keyless hosts render through the same iframe path; they get
    // their own kind rather than being labelled 'youtube', so nothing
    // downstream reasons about them as if they were YouTube.
    if (embed.includes('dailymotion.com')) return { kind: 'dailymotion', src: embed };
    if (embed.includes('rumble.com')) return { kind: 'rumble', src: embed };
    if (embed.includes('odysee.com')) return { kind: 'odysee', src: embed };
    // Swap youtube.com/embed → youtube-nocookie.com/embed for the mini-player.
    return {
      kind: 'youtube',
      src: embed.replace('www.youtube.com', 'www.youtube-nocookie.com'),
      ...(vertical ? { vertical: true } : {}),
    };
  }
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    // TikTok's embed player is keyless and needs no OAuth — the only
    // short-form platform besides YouTube that lets us play in-app.
    // (Instagram/Facebook Reels gate oEmbed behind Meta app review.)
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      const id = /\/video\/(\d+)/.exec(u.pathname)?.[1];
      return id ? { kind: 'tiktok', src: `https://www.tiktok.com/embed/v2/${id}`, vertical: true } : null;
    }
    // Reddit → the official redditmedia embed, which is the ONLY way Reddit
    // content plays outside Reddit without a library.
    //
    // What we deliberately do NOT do: reach for the v.redd.it stream directly.
    // Reddit serves those as DASH/HLS with the audio on a SEPARATE track, so
    // playing one means shipping dash.js or hls.js and muxing two streams —
    // a dependency and a maintenance burden for one platform. The embed plays
    // the same video with sound, for free, in the iframe we already have.
    //
    // Only a full post permalink works: the embed is addressed by subreddit +
    // post id, and a bare v.redd.it or redd.it link carries neither. Those are
    // better reported as "can't play that" than silently mangled.
    if (host === 'reddit.com' || host.endsWith('.reddit.com')) {
      const m = /^\/r\/([A-Za-z0-9_]{2,30})\/comments\/([a-z0-9]{4,10})/i.exec(u.pathname);
      if (m) {
        return {
          kind: 'reddit',
          src: `https://www.redditmedia.com/r/${m[1]}/comments/${m[2]}/`
            + '?ref_source=embed&ref=share&embed=true&theme=dark&showmedia=true&depth=1',
        };
      }
      return null;
    }
    // SoundCloud → official widget player (full tracks, artist-friendly, no
    // OAuth). src is the fully-built widget URL so the player renders it as-is.
    if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
      // A PROFILE is playable too — the widget streams that artist's whole
      // catalogue from it, which is precisely what "play this EP" means when
      // the search turned up the artist rather than one track. What must be
      // refused is SoundCloud's own furniture, which has no audio behind it.
      const seg = u.pathname.split('/').filter(Boolean);
      const RESERVED = new Set(['discover', 'stream', 'you', 'search', 'upload', 'pages', 'terms', 'settings', 'notifications', 'messages', 'charts', 'tags', 'people']);
      if (!seg.length || RESERVED.has(seg[0].toLowerCase())) return null;
      const widget = `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}`
        + '&auto_play=true&hide_related=true&show_comments=false&show_user=true&visual=false';
      return { kind: 'soundcloud', src: widget };
    }
    const path = u.pathname;
    if (AUDIO_EXT.test(path) || AUDIO_EXT.test(url)) return { kind: 'audio', src: url };
    if (VIDEO_EXT.test(path) || VIDEO_EXT.test(url)) return { kind: 'video', src: url };
  } catch { /* not a parseable URL */ }
  return null;
}
