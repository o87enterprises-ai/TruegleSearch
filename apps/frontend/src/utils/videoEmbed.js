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
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
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
    // SoundCloud → official widget player (full tracks, artist-friendly, no
    // OAuth). src is the fully-built widget URL so the player renders it as-is.
    if (host === 'soundcloud.com' || host.endsWith('.soundcloud.com')) {
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
