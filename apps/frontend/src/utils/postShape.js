import { isVerticalSource, mediaKey } from './videoEmbed';

// THE SHAPE A FEED POST WEARS (owner, 2026-11-07).
//
// A reel is a 9:16 clip, a YouTube video is 16:9, and the feed used to draw
// both as the same short text row with a 56px thumbnail. The card now takes the
// original's shape, so the feed reads like the platforms it came from:
//
//   'tall'  9:16  Shorts, TikToks, Instagram and Facebook Reels
//   'wide'  16:9  a video we can play (YouTube, Vimeo, Rumble, …)
//   'row'         everything else — text, links, images, audio, repos. The
//                 compact row it has always been; there is no native video
//                 shape to adopt, so nothing is invented.
//
// The posts carry no real width or height, so this reads what the LINK says
// (the same test the player uses to box a Short upright), never the picture.
const WIDE_KINDS = new Set(['youtube', 'vimeo', 'dailymotion', 'rumble', 'odysee', 'video']);

// The picture a shaped card is drawn on: the post's own thumbnail, else — for
// YouTube only, where it is derivable from the id — the video's poster.
export function posterFor(post, source) {
  if (post?.thumbnail) return post.thumbnail;
  try {
    const key = source ? mediaKey(source) : '';
    if (key && key.startsWith('youtube:')) return `https://i.ytimg.com/vi/${key.slice(8)}/hqdefault.jpg`;
  } catch { /* no id to derive from */ }
  return null;
}

export function postShape(post, source) {
  if (!post) return 'row';
  if (post.vertical || source?.vertical) return 'tall';
  if (isVerticalSource(post.permalink) || isVerticalSource(post.url)) return 'tall';
  if (source && WIDE_KINDS.has(source.kind)) return 'wide';
  return 'row';
}
