/**
 * What Truegle Maps is doing for THIS query, as a line of fact for the prompt.
 *
 * REPORTED: asked "taxi cottage grove oregon", the assistant wrote "If you're
 * on a TrueGLE search page, the map pane should already be showing Cottage
 * Grove" — a hedge about our own product, and on that occasion also false:
 * nothing had opened. The model has no view of the page, so left to itself it
 * either invents a state or apologises for having no location, and both are
 * bad answers.
 *
 * The client sends this straight off parseLocalQuery — the same function the
 * search page uses to decide whether the map opens — so a claim made here
 * cannot contradict what the reader is looking at.
 *
 * Deliberately narrow. It asserts only what the client actually knows: whether
 * the map is on screen or one tap away, and what it was asked to find. It
 * never claims a result count and never claims a position, because the server
 * has neither.
 */

const MAP_STATES = new Set(['open', 'available', 'none']);

// `state` is checked against a known set rather than interpolated, and the
// free-text fields are stripped of newlines and clamped, so a hand-rolled
// request body cannot write its own instructions into the system prompt.
const clean = (v) => String(v || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 80);

/**
 * @param {{state?: string, subject?: string, place?: string}|null} mapSurface
 * @returns {string|null} a prompt fragment, or null when there is nothing true to say
 */
function buildMapFact(mapSurface) {
  if (!mapSurface || typeof mapSurface !== 'object') return null;
  const state = String(mapSurface.state || '');
  if (!MAP_STATES.has(state) || state === 'none') return null;

  const subject = clean(mapSurface.subject);
  const place = clean(mapSurface.place);

  const what = subject
    ? `looking for ${subject}${place ? ` in ${place}` : ' around the user'}`
    : (place ? `centred on ${place}` : 'showing this location');

  const where = state === 'open'
    ? `TRUEGLE MAPS IS OPEN ON THIS PAGE RIGHT NOW, ${what}.`
    : `TRUEGLE MAPS COVERS THIS QUERY — there is a "View map" control on this page that opens it ${what}.`;

  return `CURRENT PAGE STATE (fact, not a guess — say this plainly and do not hedge about it):
${where} Point the user at it in one short sentence. Do not describe it as something that "should" be showing, and do not name any other maps or listings product. You still do not receive the user's position; the map asks the browser for it directly.`;
}

module.exports = { buildMapFact, MAP_STATES };
