import { PERSPECTIVES, perspectiveBiases } from '../config/perspectives';

/**
 * The REREAD — re-read the results already on the page through a lens.
 *
 * WHY THIS EXISTS AS A SEPARATE STEP FROM SEARCHING AGAIN. The old Perspectives
 * page had exactly one behaviour: pick a lens, fire a whole new search, wait.
 * Most of the time that was wasteful — the answer the user wanted was already
 * in the twenty results in front of them, just buried under a dozen wire-copy
 * versions of the same story. Re-ordering what is already there costs one pass
 * over an array, returns instantly, and sends nothing anywhere.
 *
 * So the fold does the cheap thing first and the expensive thing only when the
 * cheap thing came up short. Reread first; rerun on request.
 *
 * WHAT IT CAN AND CANNOT DO — worth being straight about, because the whole
 * design depends on the difference:
 *   - REREAD sees ONLY the current result set. If nobody in that set writes
 *     from the angle you picked, no amount of re-reading will invent one. That
 *     is the honest signal for "now run it again".
 *   - RERUN goes back to the backend with the same perspective ids, which
 *     applies its own strict filter across a fresh fetch and can surface
 *     sources this page never had.
 *
 * Every result already carries `bias` from SearchService.categorizeByBias, so
 * this is a filter over a label the backend computed — not a second, weaker
 * guess at the same thing on the client.
 */

/**
 * @param {Array} results   the result set currently on screen
 * @param {string[]} ids    selected perspective ids
 * @returns {{active, biases, matched, rest, count, total}}
 */
export function readThroughLens(results = [], ids = []) {
  const real = ids.filter((id) => id && id !== 'neutral');
  // 'neutral' alone is not a lens — it is the absence of one. Treating it as a
  // filter would silently hide every labelled result the moment the page
  // loads, since neutral is also the default selection.
  if (!real.length) {
    return { active: false, biases: [], matched: results, rest: [], count: results.length, total: results.length };
  }
  const biases = perspectiveBiases(real);
  const matched = [];
  const rest = [];
  for (const r of results) {
    (biases.includes(r?.bias) ? matched : rest).push(r);
  }
  return { active: true, biases, matched, rest, count: matched.length, total: results.length };
}

/**
 * "How many ways can I re-ask this?" — the count behind the fold's button, and
 * the per-chip counts inside it.
 *
 * A perspective is a WAY only if the current results actually contain it. A
 * chip reading "Conservative 0" is doing real work: it tells the user up front
 * that this particular angle needs a rerun rather than letting them pick it,
 * see an empty list, and conclude the feature is broken.
 *
 * @returns {{counts: Record<string, number>, ways: number}}
 */
export function waysToReask(results = []) {
  const counts = {};
  const byBias = {};
  for (const r of results) {
    const b = r?.bias || 'neutral';
    byBias[b] = (byBias[b] || 0) + 1;
  }
  let ways = 0;
  for (const p of PERSPECTIVES) {
    if (p.id === 'neutral') continue;
    const n = perspectiveBiases([p.id]).reduce((sum, b) => sum + (byBias[b] || 0), 0);
    counts[p.id] = n;
    if (n > 0) ways += 1;
  }
  return { counts, ways };
}
