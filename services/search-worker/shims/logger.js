// Stand-in for the backend's winston logger. Logs provider failure names only, never request content.
module.exports = {
  warn: (...a) => console.warn(...a),
  info: (...a) => console.log(...a),
  error: (...a) => console.error(...a),
};
