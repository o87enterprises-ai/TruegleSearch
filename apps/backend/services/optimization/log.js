/** Minimal, dependency-free logger for the engine (runs in CI + locally). */
const tag = '[citation-engine]';
module.exports = {
  info: (...a) => console.log(tag, ...a),
  warn: (...a) => console.warn(tag, '⚠', ...a),
  error: (...a) => console.error(tag, '✖', ...a),
  ok: (...a) => console.log(tag, '✓', ...a),
};
