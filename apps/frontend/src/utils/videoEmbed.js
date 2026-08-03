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
    return null;
  } catch {
    return null;
  }
}

// Direct-media file extensions the persistent mini-player can play natively.
const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|wav|flac)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

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
  const embed = getVideoEmbed(url);
  if (embed) {
    if (embed.includes('player.vimeo.com')) return { kind: 'vimeo', src: embed };
    // Swap youtube.com/embed → youtube-nocookie.com/embed for the mini-player.
    return { kind: 'youtube', src: embed.replace('www.youtube.com', 'www.youtube-nocookie.com') };
  }
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
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
