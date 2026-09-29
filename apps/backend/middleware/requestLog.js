/**
 * The HTTP request log, with nothing about a person in it.
 *
 * Production used morgan's `combined` format, which writes the client IP
 * address, the full URL — query string included, so `?q=` search text on the
 * GET routes — the referrer and the user agent for every request, to a log that
 * outlives the request. That undid the privacy middleware sitting next to it.
 *
 * This logs what operating a service needs — method, PATH (no query string),
 * status, size and time — and nothing else.
 */
const morgan = require('morgan');

morgan.token('safe-path', (req) => String(req.originalUrl || req.url || '').split('?')[0].slice(0, 200));

const FORMAT = ':method :safe-path :status :res[content-length] :response-time ms';

/** @param {{ write: (line: string) => void }} stream */
function requestLogger(stream) {
  return morgan(FORMAT, { stream });
}

module.exports = { requestLogger, FORMAT };
