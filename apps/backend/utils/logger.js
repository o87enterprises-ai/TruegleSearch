const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

// ── Secret redaction ────────────────────────────────────────────────────────
// Several routes do `logger.error('...', error)` with a raw axios error. Its
// serialised form carries `config.headers` (Authorization: Token <deepgram key>,
// Bearer <paypal token>) and request URLs with ?key= params, which would land in
// any log file/drain. Strip those before ANY transport formats the entry.
const SENSITIVE_KEY = /^(authorization|proxy-authorization|cookie|set-cookie|x-admin-key|x-api-key|api[-_]?key|apikey|access[-_]?token|refresh[-_]?token|id[-_]?token|token|secret|client[-_]?secret|password|passwd|code_hash|jwt)$/i;
const DROP_KEY = /^(config|request|_request|agent)$/;   // axios/http internals: headers, sockets
function scrub(value, depth = 0, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  if (depth > 5) return '[Truncated]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1, seen));
  const out = {};
  const keys = value instanceof Error
    ? ['name', 'message', 'code', 'status', 'response', ...Object.keys(value)]
    : Object.keys(value);
  for (const k of new Set(keys)) {
    if (SENSITIVE_KEY.test(k)) { out[k] = '[REDACTED]'; continue; }
    if (DROP_KEY.test(k)) { out[k] = '[omitted]'; continue; }
    if (k === 'response' && value[k] && typeof value[k] === 'object' && 'status' in value[k]) {
      out[k] = { status: value[k].status };   // an upstream reply body can echo secrets
      continue;
    }
    out[k] = scrub(value[k], depth + 1, seen);
  }
  return out;
}
const redact = winston.format((info) => {
  for (const k of Object.keys(info)) {
    if (k === 'level' || k === 'message' || k === 'timestamp' || k === 'stack') continue;
    info[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : scrub(info[k]);
  }
  return info;
});

// Define format
const format = winston.format.combine(
  redact(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    if (stack) {
      log += `\n${stack}`;
    }
    return log;
  })
);

// Console format with colors
const consoleFormat = winston.format.combine(
  redact(),
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0 && process.env.NODE_ENV !== 'production') {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: consoleFormat,
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  }),
];

// Add file transports in production — but not on hosts that capture stdout
// (Render, Vercel). There the container runs as a non-root user and the app
// directory is not writable, so creating logs/ would crash the process at boot.
if (process.env.NODE_ENV === 'production' && !process.env.RENDER && !process.env.VERCEL) {
  transports.push(
    // Error log file
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  // Don't exit on handled exceptions
  exitOnError: false,
});

// Create stream for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  },
};

// Helper methods for structured logging
logger.logRequest = (req, extra = {}) => {
  logger.http('Incoming request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.userId,
    ...extra,
  });
};

logger.logResponse = (req, res, duration, extra = {}) => {
  const level = res.statusCode >= 400 ? 'warn' : 'http';
  logger[level]('Response sent', {
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    duration: `${duration}ms`,
    userId: req.user?.userId,
    ...extra,
  });
};

logger.logError = (error, req = null, extra = {}) => {
  const errorLog = {
    message: error.message,
    stack: error.stack,
    name: error.name,
    ...extra,
  };

  if (req) {
    errorLog.method = req.method;
    errorLog.path = req.path;
    errorLog.ip = req.ip;
    errorLog.userId = req.user?.userId;
  }

  logger.error('Error occurred', errorLog);
};

logger.logAuth = (action, userId, success, extra = {}) => {
  const level = success ? 'info' : 'warn';
  logger[level](`Auth: ${action}`, {
    userId,
    success,
    ...extra,
  });
};

// No query text and no user id: a log line that says who searched for what is
// exactly the record the privacy policy says does not exist.
logger.logSearch = (query, userId, resultCount, duration, extra = {}) => {
  logger.info('Search performed', {
    queryLength: String(query || '').length,
    resultCount,
    duration: `${duration}ms`,
    ...extra,
  });
};

module.exports = logger;
module.exports.scrub = scrub;
