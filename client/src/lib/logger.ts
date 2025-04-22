// Logger utility for better debugging, especially in production

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

// Current log level (can be changed at runtime)
let currentLogLevel = LogLevel.INFO;

// Buffer for recent logs that can be accessed programmatically
const logBuffer: {level: LogLevel, message: string, data?: any, timestamp: Date}[] = [];
const MAX_BUFFER_SIZE = 100;

export const setLogLevel = (level: LogLevel) => {
  currentLogLevel = level;
  console.log(`Log level set to ${LogLevel[level]}`);
};

export const debug = (message: string, data?: any) => {
  if (currentLogLevel <= LogLevel.DEBUG) {
    console.debug(`[DEBUG] ${message}`, data || '');
    addToBuffer(LogLevel.DEBUG, message, data);
  }
};

export const info = (message: string, data?: any) => {
  if (currentLogLevel <= LogLevel.INFO) {
    console.info(`[INFO] ${message}`, data || '');
    addToBuffer(LogLevel.INFO, message, data);
  }
};

export const warn = (message: string, data?: any) => {
  if (currentLogLevel <= LogLevel.WARN) {
    console.warn(`[WARN] ${message}`, data || '');
    addToBuffer(LogLevel.WARN, message, data);
  }
};

export const error = (message: string, data?: any) => {
  if (currentLogLevel <= LogLevel.ERROR) {
    console.error(`[ERROR] ${message}`, data || '');
    addToBuffer(LogLevel.ERROR, message, data);
  }
};

const addToBuffer = (level: LogLevel, message: string, data?: any) => {
  logBuffer.unshift({
    level,
    message,
    data,
    timestamp: new Date()
  });
  
  // Trim buffer if it gets too large
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.pop();
  }
};

// Get recent logs for diagnostic purposes
export const getRecentLogs = (maxCount = 50, level = LogLevel.DEBUG) => {
  return logBuffer
    .filter(log => log.level >= level)
    .slice(0, maxCount)
    .map(log => ({
      level: LogLevel[log.level],
      message: log.message,
      data: log.data,
      timestamp: log.timestamp.toISOString()
    }));
};

// Format and export logs for sending to support
export const exportLogs = () => {
  const logExport = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    logs: getRecentLogs(100)
  };
  return JSON.stringify(logExport, null, 2);
};

// Helper function to easily view logs in console
export const showLogs = (maxCount = 20, level = LogLevel.INFO) => {
  const logs = getRecentLogs(maxCount, level);
  console.table(logs);
  return logs;
};

// Add window-level log access for debugging in production
if (typeof window !== 'undefined') {
  (window as any).__nodusLogs = {
    getLogs: getRecentLogs,
    showLogs,
    exportLogs,
    setLogLevel
  };
}

// Default to DEBUG in development, INFO in production
if (import.meta.env.DEV) {
  setLogLevel(LogLevel.DEBUG);
} else {
  setLogLevel(LogLevel.INFO);
}

export default {
  debug,
  info,
  warn,
  error,
  getRecentLogs,
  exportLogs,
  showLogs,
  setLogLevel
};