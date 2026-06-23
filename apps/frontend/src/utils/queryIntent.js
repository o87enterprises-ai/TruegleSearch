const QUESTION_WORDS = [
  'who', 'what', 'when', 'where', 'why', 'how', 'which', 'whose',
  'is', 'are', 'was', 'were', 'do', 'does', 'did',
  'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
];

/**
 * Heuristic check for whether a search query is phrased as a question —
 * either ending in "?" or opening with a question word (who/what/how/is/etc).
 * Used to decide when to surface a quick-answer card vs. a sponsored slot.
 */
export function isQuestionQuery(query) {
  if (!query) return false;
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.endsWith('?')) return true;

  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z']/g, '');
  return QUESTION_WORDS.includes(firstWord);
}
