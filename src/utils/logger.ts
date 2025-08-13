import { DEV_CONSTANTS } from "@/config/constants";

// ============================================================================
// LOGGING CONFIGURATION WITH FLIPPER INTEGRATION
// ============================================================================

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  category?: string | undefined;
  userId?: string | undefined;
  sessionId?: string | undefined;
}

export interface LoggerConfig {
  enableConsole: boolean;
  enableFlipper: boolean;
  enableRemote: boolean;
  minLevel: LogLevel;
  maxEntries: number;
  categories: string[];
}

class Logger {
  private config: LoggerConfig;
  private logEntries: LogEntry[] = [];
  private flipperConnection: any = null;
  private sessionId: string;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enableConsole: true,
      enableFlipper: DEV_CONSTANTS.enableFlipper || false,
      enableRemote: DEV_CONSTANTS.enableDebugMode,
      minLevel: DEV_CONSTANTS.logLevel as LogLevel,
      maxEntries: 1000,
      categories: ["app", "auth", "workout", "ai", "api", "navigation", "storage"],
      ...config,
    };

    this.sessionId = this.generateSessionId();
    this.initializeFlipper();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeFlipper(): void {
    if (!this.config.enableFlipper) return;

    try {
      // Initialize Flipper connection for logging
      if (__DEV__ && (global as any).__FLIPPER__) {
        this.flipperConnection = (global as any).__FLIPPER__.createConnection("TrainSmart Logger");

        this.flipperConnection.receive("getLogs", (_data: any, responder: any) => {
          responder.success({
            logs: this.logEntries.slice(-100), // Send last 100 entries
            sessionId: this.sessionId,
          });
        });

        this.flipperConnection.receive("clearLogs", (_data: any, responder: any) => {
          this.clearLogs();
          responder.success({ cleared: true });
        });

        this.flipperConnection.receive("setLogLevel", (data: any, responder: any) => {
          if (data.level && ["debug", "info", "warn", "error"].includes(data.level)) {
            this.config.minLevel = data.level;
            responder.success({ level: data.level });
          } else {
            responder.error({ message: "Invalid log level" });
          }
        });
      }
    } catch (error) {
      console.warn("Failed to initialize Flipper logger:", error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
    };

    return levels[level] >= levels[this.config.minLevel];
  }

  private createLogEntry(level: LogLevel, message: string, data?: any, category?: string, userId?: string): LogEntry {
    return {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      category: category || undefined,
      userId: userId || undefined,
      sessionId: this.sessionId,
    };
  }

  private addLogEntry(entry: LogEntry): void {
    this.logEntries.push(entry);

    // Maintain max entries limit
    if (this.logEntries.length > this.config.maxEntries) {
      this.logEntries = this.logEntries.slice(-this.config.maxEntries);
    }

    // Send to Flipper
    if (this.config.enableFlipper && this.flipperConnection) {
      try {
        this.flipperConnection.send("newLog", entry);
      } catch (error) {
        console.warn("Failed to send log to Flipper:", error);
      }
    }

    // Send to remote logging service (in production)
    if (this.config.enableRemote && !__DEV__) {
      this.sendToRemoteLogger(entry);
    }
  }

  private async sendToRemoteLogger(entry: LogEntry): Promise<void> {
    try {
      // Only send warn and error logs to remote service to reduce noise
      if (entry.level === "warn" || entry.level === "error") {
        // Implementation would depend on your remote logging service
        // Example: Sentry, LogRocket, or custom endpoint
        console.log("Would send to remote logger:", entry);
      }
    } catch (error) {
      console.warn("Failed to send log to remote service:", error);
    }
  }

  private formatConsoleMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const category = entry.category ? `[${entry.category.toUpperCase()}]` : "";
    const userId = entry.userId ? `[User: ${entry.userId}]` : "";

    return `${timestamp} ${category} ${userId} ${entry.message}`;
  }

  // Public logging methods
  debug(message: string, data?: any, category?: string, userId?: string): void {
    if (!this.shouldLog("debug")) return;

    const entry = this.createLogEntry("debug", message, data, category, userId);
    this.addLogEntry(entry);

    if (this.config.enableConsole) {
      console.log(this.formatConsoleMessage(entry), data || "");
    }
  }

  info(message: string, data?: any, category?: string, userId?: string): void {
    if (!this.shouldLog("info")) return;

    const entry = this.createLogEntry("info", message, data, category, userId);
    this.addLogEntry(entry);

    if (this.config.enableConsole) {
      console.info(this.formatConsoleMessage(entry), data || "");
    }
  }

  warn(message: string, data?: any, category?: string, userId?: string): void {
    if (!this.shouldLog("warn")) return;

    const entry = this.createLogEntry("warn", message, data, category, userId);
    this.addLogEntry(entry);

    if (this.config.enableConsole) {
      console.warn(this.formatConsoleMessage(entry), data || "");
    }
  }

  error(message: string, error?: Error | any, category?: string, userId?: string): void {
    if (!this.shouldLog("error")) return;

    // Sanitize stack to avoid Metro attempting to symbolicate internal Hermes frames
    const sanitizeStack = (stack?: string) => {
      if (!stack) return stack;
      try {
        return stack
          .split("\n")
          .filter((line) => !line.includes("InternalBytecode.js") && !line.includes("InternalBytecode"))
          .join("\n");
      } catch {
        return stack;
      }
    };

    const errorData =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: sanitizeStack(error.stack),
          }
        : error;

    const entry = this.createLogEntry("error", message, errorData, category, userId);
    this.addLogEntry(entry);

    if (this.config.enableConsole) {
      // Print message without sending problematic stack lines to Metro
      console.error(this.formatConsoleMessage(entry), errorData || "");
    }
  }

  // Specialized logging methods for different app areas
  auth(level: LogLevel, message: string, data?: any, userId?: string): void {
    this[level](message, data, "auth", userId);
  }

  workout(level: LogLevel, message: string, data?: any, userId?: string): void {
    this[level](message, data, "workout", userId);
  }

  ai(level: LogLevel, message: string, data?: any, userId?: string): void {
    this[level](message, data, "ai", userId);
  }

  api(level: LogLevel, message: string, data?: any, userId?: string): void {
    this[level](message, data, "api", userId);
  }

  navigation(level: LogLevel, message: string, data?: any, userId?: string): void {
    this[level](message, data, "navigation", userId);
  }

  storage(level: LogLevel, message: string, data?: any, userId?: string): void {
    this[level](message, data, "storage", userId);
  }

  // Performance logging
  performance(operation: string, duration: number, data?: any, userId?: string): void {
    this.info(
      `Performance: ${operation} completed in ${duration}ms`,
      { operation, duration, ...data },
      "performance",
      userId
    );
  }

  // Network request logging
  networkRequest(method: string, url: string, status?: number, duration?: number, data?: any, userId?: string): void {
    const level: LogLevel = status && status >= 400 ? "error" : "info";
    const message = `${method} ${url} ${status ? `- ${status}` : ""}${duration ? ` (${duration}ms)` : ""}`;

    this[level](message, { method, url, status, duration, ...data }, "api", userId);
  }

  // User action logging
  userAction(action: string, screen?: string, data?: any, userId?: string): void {
    this.info(`User action: ${action}${screen ? ` on ${screen}` : ""}`, { action, screen, ...data }, "user", userId);
  }

  // Workout session logging
  workoutEvent(event: string, sessionId: string, data?: any, userId?: string): void {
    this.info(`Workout event: ${event}`, { event, workoutSessionId: sessionId, ...data }, "workout", userId);
  }

  // AI coaching logging
  aiInteraction(type: "query" | "response" | "error", data?: any, userId?: string): void {
    const level: LogLevel = type === "error" ? "error" : "info";
    this[level](`AI ${type}`, { type, ...data }, "ai", userId);
  }

  // Utility methods
  getLogs(category?: string, level?: LogLevel): LogEntry[] {
    let filteredLogs = this.logEntries;

    if (category) {
      filteredLogs = filteredLogs.filter((entry) => entry.category === category);
    }

    if (level) {
      filteredLogs = filteredLogs.filter((entry) => entry.level === level);
    }

    return filteredLogs;
  }

  clearLogs(): void {
    this.logEntries = [];
    this.info("Logs cleared", undefined, "app");
  }

  exportLogs(): string {
    return JSON.stringify(
      {
        sessionId: this.sessionId,
        exportedAt: new Date().toISOString(),
        logs: this.logEntries,
      },
      null,
      2
    );
  }

  // Configuration methods
  setLogLevel(level: LogLevel): void {
    this.config.minLevel = level;
    this.info(`Log level set to ${level}`, undefined, "app");
  }

  setUserId(userId: string): void {
    this.info(`User ID set to ${userId}`, undefined, "auth", userId);
  }

  // Public getter for sessionId
  get currentSessionId(): string {
    return this.sessionId;
  }

  // Crash reporting integration
  reportCrash(error: Error, context?: any, userId?: string): void {
    this.error("Application crash", error, "crash", userId);

    // Send to crash reporting service (Sentry, Crashlytics, etc.)
    if (!__DEV__) {
      try {
        // Example: Sentry.captureException(error, { extra: context });
        console.log("Would report crash to external service:", { error, context });
      } catch (reportingError) {
        console.error("Failed to report crash:", reportingError);
      }
    }
  }
}

// Create singleton logger instance
export const logger = new Logger();

// Export convenience functions
export const log = {
  debug: (message: string, data?: any, category?: string, userId?: string) =>
    logger.debug(message, data, category, userId),

  info: (message: string, data?: any, category?: string, userId?: string) =>
    logger.info(message, data, category, userId),

  warn: (message: string, data?: any, category?: string, userId?: string) =>
    logger.warn(message, data, category, userId),

  error: (message: string, error?: Error | any, category?: string, userId?: string) =>
    logger.error(message, error, category, userId),

  // Specialized loggers
  auth: logger.auth.bind(logger),
  workout: logger.workout.bind(logger),
  ai: logger.ai.bind(logger),
  api: logger.api.bind(logger),
  navigation: logger.navigation.bind(logger),
  storage: logger.storage.bind(logger),

  // Utility loggers
  performance: logger.performance.bind(logger),
  networkRequest: logger.networkRequest.bind(logger),
  userAction: logger.userAction.bind(logger),
  workoutEvent: logger.workoutEvent.bind(logger),
  aiInteraction: logger.aiInteraction.bind(logger),
  reportCrash: logger.reportCrash.bind(logger),
};

// Development helpers
if (__DEV__) {
  // Make logger available globally for debugging
  (global as any).logger = logger;
  (global as any).log = log;

  // Log app startup
  logger.info(
    "TrainSmart app started",
    {
      environment: DEV_CONSTANTS.enableDebugMode ? "development" : "production",
      flipperEnabled: DEV_CONSTANTS.enableFlipper,
      sessionId: logger.currentSessionId,
    },
    "app"
  );
}

export default logger;
