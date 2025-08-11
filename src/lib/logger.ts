// Centralized logging system for the Plank application
export type LogLevel = "OFF" | "ERROR" | "WARN" | "LOG" | "DEBUG" | "TRACE";

export type LogModule =
  | "geometry"
  | "plank"
  | "plankCutting"
  | "tessellation"
  | "polygonStore"
  | "plankStore";

// Log level hierarchy (higher number = more verbose)
const LOG_LEVELS: Record<LogLevel, number> = {
  OFF: 0,
  ERROR: 1,
  WARN: 2,
  LOG: 3,
  DEBUG: 4,
  TRACE: 5,
};

// Default configuration - all modules OFF by default
const moduleLogLevels: Record<LogModule, LogLevel> = {
  geometry: "OFF",
  plank: "OFF",
  plankCutting: "OFF",
  tessellation: "OFF",
  polygonStore: "OFF",
  plankStore: "OFF",
};

// Configure log level for a specific module
export const setLogLevel = (module: LogModule, level: LogLevel): void => {
  moduleLogLevels[module] = level;
};

// Get current log level for a module
export const getLogLevel = (module: LogModule): LogLevel => {
  return moduleLogLevels[module];
};

// Check if a log level should be output for a module
const shouldLog = (module: LogModule, level: LogLevel): boolean => {
  const moduleLevel = moduleLogLevels[module];
  return LOG_LEVELS[level] <= LOG_LEVELS[moduleLevel];
};

// Create logger for a specific module
export const createLogger = (module: LogModule) => ({
  error: (message: string, ...args: unknown[]) => {
    if (shouldLog(module, "ERROR")) {
      console.error(`[${module.toUpperCase()} ERROR] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]) => {
    if (shouldLog(module, "WARN")) {
      console.warn(`[${module.toUpperCase()} WARN] ${message}`, ...args);
    }
  },

  log: (message: string, ...args: unknown[]) => {
    if (shouldLog(module, "LOG")) {
      console.log(`[${module.toUpperCase()}] ${message}`, ...args);
    }
  },

  debug: (message: string, ...args: unknown[]) => {
    if (shouldLog(module, "DEBUG")) {
      console.log(`[${module.toUpperCase()} DEBUG] ${message}`, ...args);
    }
  },

  trace: (message: string, ...args: unknown[]) => {
    if (shouldLog(module, "TRACE")) {
      console.log(`[${module.toUpperCase()} TRACE] ${message}`, ...args);
    }
  },
});

// Quick configuration helpers
export const configureLogs = (config: Partial<Record<LogModule, LogLevel>>) => {
  Object.entries(config).forEach(([module, level]) => {
    setLogLevel(module as LogModule, level as LogLevel);
  });
};

// Development shortcuts
export const enableDebugLogs = () => {
  configureLogs({
    plankCutting: "LOG",
    tessellation: "TRACE",
    geometry: "LOG",
  });
};

export const disableAllLogs = () => {
  Object.keys(moduleLogLevels).forEach((module) => {
    setLogLevel(module as LogModule, "OFF");
  });
};

window.setLogLevel = setLogLevel;
window.enableDebugLogs = enableDebugLogs;
window.disableAllLogs = disableAllLogs;
