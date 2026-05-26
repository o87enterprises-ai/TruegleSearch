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

// Define format
const format = winston.format.combine(
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

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
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

logger.logSearch = (query, userId, resultCount, duration, extra = {}) => {
  logger.info('Search performed', {
    query: query.substring(0, 100), // Truncate long queries
    userId,
    resultCount,
    duration: `${duration}ms`,
    ...extra,
  });
};

module.exports = logger;
