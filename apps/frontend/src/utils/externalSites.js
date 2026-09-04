// Sites Truegle warns you about before sending you to them.
//
// ── WHY A WARNING AND NOT JUST A LINK ───────────────────────────────────────
//
// Everything else in the feed can be read WITHOUT leaving: a playable post
// opens in the in-app player, and the player is sandboxed, cookie-free on our
// side, and closes back into the scroll you were in. Meta's posts cannot —
// their embeds do not render for us (see the note in videoEmbed.js), so the
// only way to read one is to actually go to Facebook or Instagram.
//
// That is a genuinely different thing from tapping any other card, and it is
// worth one sentence before it happens rather than a surprise: you land on a
// Meta property, logged in as whoever that browser is logged in as, with
// their cookies and their tracking, and Truegle's no-tracking guarantee stops
// at that boundary because it has to. The warning is not friction for its own
// sake — it is the one moment where what happens next stops being ours.
//
// ── WHY A LIST AND NOT EVERY OUTBOUND LINK ──────────────────────────────────
//
// Warning on every external link would train people to dismiss it without
// reading, which is worse than not warning at all. This is only for the
// platforms whose content we cannot show in-app AND whose business is
// tracking — so the warning stays rare enough to still mean something.

const GATED = [
  { match: (h) => h === 'facebook.com' || h.endsWith('.facebook.com') || h === 'fb.watch' || h === 'fb.com', label: 'Facebook' },
  { match: (h) => h === 'instagram.com' || h.endsWith('.instagram.com'), label: 'Instagram' },
];

/**
 * The site's display name if following this URL should warn first, else null.
 * Null for anything unparseable — a URL we cannot read is a URL we cannot
 * make a claim about, and inventing a warning for it would be noise.
 */
export function gatedSite(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
    return GATED.find((g) => g.match(host))?.label || null;
  } catch {
    return null;
  }
}

export default gatedSite;
