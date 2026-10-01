import { forwardRef } from 'react';
import { Music } from 'lucide-react';
import TruegleWatermark from '../ui/TruegleWatermark';
import PlayerStarters from './PlayerStarters';
import PlayerBrowse from './PlayerBrowse';
import { PLAYER_SANDBOX } from './playerSandbox';

export { PLAYER_SANDBOX };

// The media surface itself — the only place an embed is mounted, so playback
// state lives in exactly one node no matter which presentation is on screen.
//
// `fill` = take all the height that's going (full screen), instead of sizing
// from the clip's aspect ratio. The controls bar below stays on screen either
// way — that's the whole reason full screen is ours and not the embed's.
// YouTube only pushes state over postMessage when the embed is built with
// enablejsapi=1 (and an origin, which scopes who it will talk to). These are
// added HERE rather than in the shared source builder so what we store, share
// and hand to /w stays a plain embed URL.
function withPlaybackChannel(kind, src) {
  const sep = src.includes('?') ? '&' : '?';
  if (kind === 'youtube') {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${src}${sep}autoplay=1&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ''}`;
  }
  return `${src}${sep}autoplay=1`;
}

const PlayerScreen = forwardRef(function PlayerScreen({
  source, mediaRef, frameRef, onEnded, onError, maxHeight, fill = false, compact = false,
  // Lock the picture to 9:16 in every state and letterbox anything wider —
  // the feed player is portrait-native. See the note above `ratio`.
  portrait = false,
  // What the current search turned up. With nothing playing, the viewport
  // becomes a swipeable deck of those results instead of a black rectangle.
  browse = null, browseLoading = false,
  browseMore = false, onBrowseMore = null, browseLoadingMore = false,
}, ref) {
  // Idle. An empty black rectangle reads as a player that has never worked.
  // If a search has run, the results themselves fill it — full-size, one flick
  // apart, previewable by holding. Otherwise it's four Truegle creators and
  // their latest uploads: real things to press, and the roster in front of
  // people.
  if (!source) {
    const browsing = browseLoading || (browse && browse.length > 0);
    return (
      <div ref={ref} className={`w-full ${browsing ? '' : 'overflow-y-auto'} ${fill ? 'flex flex-col flex-1 min-h-0' : ''}`}>
        {browsing
          ? <PlayerBrowse rows={browse} loading={browseLoading} compact={compact} fill={fill}
              more={browseMore} onMore={onBrowseMore} loadingMore={browseLoadingMore} />
          : <PlayerStarters compact={compact} />}
      </div>
    );
  }

  const { kind, src, title } = source;
  // EVERY KIND THAT IS AN IFRAME HAS TO BE LISTED HERE. This list is the only
  // thing standing between an embed and the <audio> fallback at the bottom of
  // this component, and that fallback fails SILENTLY-ish: it hands an HTML
  // embed page to an <audio> element, which renders a dead transport and
  // plays nothing.
  //
  // That is exactly what happened to twitter/truthsocial — and to
  // instagram/facebook before they were dropped (see videoEmbed.js). Four
  // kinds were added to getPlayable() without being added here, so every one
  // of them classified as playable, showed a play badge, mounted... an audio
  // element pointed at a web page. Reported as "the inline iframe centered
  // player is not properly firing", and it was not the iframe: there was no
  // iframe. ADD THE KIND HERE IN THE SAME COMMIT AS THE getPlayable() RULE.
  const isVideoIframe = ['youtube', 'vimeo', 'tiktok', 'dailymotion', 'rumble', 'odysee', 'reddit',
    'twitter', 'truthsocial'].includes(kind);
  // Post embeds are CARDS, not video players — a tweet or a Truth is text,
  // sized to its own content, with no controls to reach. Same reasoning as
  // the TikTok note below: err tall and lose a band of background rather
  // than err short and clip the post.
  const isPostCard = kind === 'twitter' || kind === 'truthsocial';
  const isSoundcloud = kind === 'soundcloud';
  // Shorts / Reels / TikToks are shot 9:16. Boxing them into a 16:9 frame
  // wastes most of the player and shrinks the clip to a stamp.
  const vertical = !!source.vertical || kind === 'tiktok';

  // TIKTOK IS NOT 9:16, AND THAT IS WHY IT DID NOT FIT.
  //
  // The clip is, but the /embed/v2 iframe is not a video player — it is a card.
  // Below the picture it renders the author row, the caption, the music line and
  // the action rail, and that chrome is part of the document we are handed: it
  // cannot be turned off and it does not scroll. Sized to 9:16 the iframe was
  // roughly a quarter shorter than its own contents, so the bottom of the card
  // was cut off — which is what "not fitting properly in the viewport" was.
  //
  // Measured off the real embed: ~404 wide by ~945 tall, so 9:21 rather than
  // 9:16. An approximation on purpose — the caption is text and re-wraps, so the
  // true height moves with the words. Erring slightly tall costs a thin band of
  // background; erring short costs the controls.
  // ── PORTRAIT NATIVE, LIKE TIKTOK ────────────────────────────────────────
  //
  // The feed player is 9:16 in EVERY state — docked, popped out, full screen.
  // Not "9:16 when the clip is vertical": 9:16 full stop. A widescreen video
  // is letterboxed into it, black band above and below, exactly the way a
  // landscape clip looks on TikTok. The owner's rule, and it is what makes
  // the feed player recognisably not the Tube player rather than the same
  // frame at a different size.
  //
  // Letterboxing is free for an iframe — YouTube and the rest fit their own
  // picture to the box we give them — and for a native <video> it is
  // object-contain, already set below.
  const ratio = portrait ? '9 / 16'
    : kind === 'tiktok' ? '9 / 21'
      : isPostCard ? '3 / 4'
        : (vertical ? '9 / 16' : '16 / 9');

  // A 9:16 clip is ~1.78× its width tall — at phone width that is taller than
  // the whole viewport, which pushed the transport row off the bottom of the
  // screen and put the controls out of reach exactly when a reel was playing.
  // The box is capped against the VIEWPORT (svh, so the mobile browser's own
  // chrome counts) and letterboxes: the clip narrows and centres rather than
  // growing past what you can see. The floating window gets a tighter cap
  // still — it sits ON TOP of the page, so a tall one covers the very search
  // bar you popped it out to keep using.
  // --truegle-player-cap is set by whatever is hosting the player when it
  // knows the real room available (the docked slot does); the svh figure is
  // the fallback when nobody has measured.
  //
  // NOTE the popped window ALSO honours the measured cap. It used to
  // short-circuit to a flat 42svh, which is a share of the VIEWPORT — but the
  // floating frame is sized against whatever is left after keeping clear of
  // the page's search bar, which in a landscape phone is much less than that.
  // The picture then overflowed a frame it was supposed to fit inside and
  // pushed the transport row out of the bottom of it.
  // PORTRAIT DOES NOT READ --truegle-player-cap, and that is not an oversight.
  // That variable is the FRAME's measured leftover height, published by
  // MiniPlayer from `frameHeight - chromeHeight`. With a landscape picture
  // that is stable. With a portrait one it is a feedback loop: a 9:16 picture
  // makes the frame taller, which makes the measured chrome bigger, which
  // shrinks the cap, which shrinks the picture… settling on the 100px floor.
  // Measured in a browser, not reasoned about: the corner picture came out
  // 56×100, correct ratio and useless size. A viewport figure has no such
  // loop — it does not depend on the thing it is sizing.
  const cap = portrait
    ? (compact ? 'min(52svh, 60vh)' : 'min(62svh, 72vh)')
    : compact
      ? 'min(42svh, var(--truegle-player-cap, 100svh))'
    // TikTok gets more height than a bare reel because a fifth of its box is
    // the card's own chrome rather than picture — at 58svh the CLIP came out
    // noticeably smaller than a YouTube Short beside it, for the same box.
    : `min(${kind === 'tiktok' ? '68svh' : (vertical ? '58svh' : '62svh')}, var(--truegle-player-cap, 100svh))`;
  // FULL SCREEN IS THE ONE PLACE THE BOX IS NORMALLY UNCONSTRAINED — the
  // picture fills the screen and the flex chain does the sizing. A portrait
  // player cannot do that: it has to hold 9:16 against a landscape screen,
  // so it keeps a real box there too, sized by HEIGHT (the scarce dimension
  // in full screen) with the width falling out of the ratio.
  //
  // THIS BOX MUST STAY INSIDE THIS COMPONENT. It was briefly a wrapper div
  // in TrueglePlayer instead, and that broke full screen completely: this
  // component's root is `flex-1 min-h-0`, i.e. it expects to BE the flex
  // item of the fullscreen column. With a plain block div in between, the
  // flex sizing stopped applying, its height resolved to `auto`, and the
  // `h-full` box below resolved against auto to ZERO — a 0px-tall iframe.
  // Playing audio over a black screen, which is exactly what that was.
  const boxStyle = fill
    ? (portrait ? {
      aspectRatio: ratio, height: '100%', width: 'auto', maxWidth: '100%', margin: '0 auto',
    } : undefined)
    : {
      aspectRatio: ratio,
      maxHeight: cap,
      // width:auto lets max-height win and the box shrink sideways rather than
      // overflow — that's what produces the side bars on a reel.
      width: 'auto',
      maxWidth: '100%',
      margin: '0 auto',
    };

  return (
    <div
      ref={ref}
      data-player-screen
      data-portrait={portrait ? 'yes' : undefined}
      // Portrait in full screen has to CENTRE its column against a landscape
      // screen, so the root becomes the flex container that does it. Outside
      // full screen the box centres itself with `margin: 0 auto` as before.
      className={`relative w-full bg-black ${fill ? `flex-1 min-h-0${portrait ? ' flex justify-center' : ''}` : ''}`}
    >
      {isSoundcloud ? (
        <iframe
          key={src}
          src={src}
          className="w-full block"
          style={{ height: 166 }}
          title={title || 'SoundCloud player'}
          sandbox={PLAYER_SANDBOX}
          allow="autoplay"
        />
      ) : isVideoIframe ? (
        <div className={fill && !portrait ? 'relative w-full h-full' : 'relative'} style={boxStyle}>
          <iframe
            ref={frameRef}
            key={source.playToken ? `${src}#${source.playToken}` : src}
            src={withPlaybackChannel(kind, src)}
            // When the frame finished loading — useEmbedPlayback's silence
            // clock starts here, not at mount, so a slow network is not
            // mistaken for a dead clip.
            onLoad={(e) => { e.currentTarget.dataset.loaded = '1'; }}
            className="absolute inset-0 w-full h-full"
            title={title || 'Video player'}
            sandbox={PLAYER_SANDBOX}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : kind === 'video' ? (
        // object-contain IS the letterbox for a native file: the black bands
        // above and below a widescreen clip in a portrait box come from here.
        <video ref={mediaRef} key={source.playToken ? `${src}#${source.playToken}` : src} src={src} controls autoPlay playsInline onEnded={onEnded} onError={onError}
          style={fill ? undefined : { ...(portrait ? { aspectRatio: ratio, width: '100%', objectFit: 'contain', background: '#000' } : {}), maxHeight: maxHeight ? `min(${maxHeight}px, ${cap})` : cap }}
          className={fill ? 'w-full h-full bg-black object-contain' : 'w-full bg-black'} />
      ) : (
        <div className="flex items-center gap-2 px-3 py-3">
          <Music size={16} className="text-white/40 shrink-0" />
          <audio ref={mediaRef} key={source.playToken ? `${src}#${source.playToken}` : src} src={src} controls autoPlay onEnded={onEnded} onError={onError} className="w-full" />
        </div>
      )}

      {/* Our mark over our viewer — never burned into the creator's video,
          which we neither hold nor have the right to re-encode. */}
      <TruegleWatermark />
    </div>
  );
});

export default PlayerScreen;
