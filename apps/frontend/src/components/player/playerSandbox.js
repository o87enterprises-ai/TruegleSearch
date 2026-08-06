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

export default PLAYER_SANDBOX;
