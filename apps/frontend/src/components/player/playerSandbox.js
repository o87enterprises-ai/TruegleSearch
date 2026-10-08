// The sandbox every embed in the player runs under. Lives in its own module so
// the screen and the browse deck share ONE definition — a second copy is a
// second thing to forget when the rules change, and the rules here are the
// difference between a shared Truegle link being safe to open and not.
//
// `allow-same-origin` grants the frame ITS OWN origin (youtube-nocookie /
// player.vimeo / w.soundcloud / tiktok), never ours — the embeds need it for
// storage and won't play without it. What is deliberately withheld is
// `allow-top-navigation*`: that's the permission that lets an embed yank the
// whole tab somewhere else. Same lesson as the 2026-08-01 ad hijack — CSP does
// not stop top-navigation, only the sandbox does.
export const PLAYER_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';

// ANY OTHER SITE'S PLAYER (kind 'embed' — found by the backend's
// EmbedDiscovery, owner 2026-10-08: "if there's a free embed code listed on a
// site I want Truegle to be able to play it, period"). A site we know nothing
// about gets less: no popups at all, which is how pop-under ads and "you won a
// prize" windows open. It can still play, go full screen and keep its storage.
export const OPEN_EMBED_SANDBOX = 'allow-scripts allow-same-origin allow-presentation';

export const sandboxFor = (kind) => (kind === 'embed' ? OPEN_EMBED_SANDBOX : PLAYER_SANDBOX);

export default PLAYER_SANDBOX;
