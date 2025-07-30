//comprehensive structured logging system with search capabilities
//provides centralized logging, filtering, and analysis for observability

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5,
}

interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  message: string;
  context: Record<string, any>;
  source: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  spanId?: string;
  tags: string[];
  metadata: Record<string, any>;
}

interface LogQuery {
  level?: LogLevel;
  levelRange?: [LogLevel, LogLevel];
  source?: string;
  userId?: string;
  sessionId?: string;
  traceId?: string;
  message?: string;
  messagePattern?: RegExp;
  tags?: string[];
  timeRange?: [number, number];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'level';
  sortOrder?: 'asc' | 'desc';
}

interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  maxEntries: number;
  flushInterval: number;
  persistLocal: boolean;
  endpoints: {
    logs: string;
    search: string;
  };
  formatters: {
    console: (entry: LogEntry) => string;
    json: (entry: LogEntry) => string;
  };
}

class StructuredLogger {
  private config: LogConfig;
  private entries: LogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<LogConfig> = {}) {
    this.config = {
      enabled: true,
      level: import.meta.env.MODE === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
      maxEntries: 10000,
      flushInterval: 60000, // 1 minute
      persistLocal: true,
      endpoints: {
        logs: '/api/monitoring/logs',
        search: '/api/monitoring/logs/search',
      },
      formatters: {
        console: this.defaultConsoleFormatter.bind(this),
        json: this.defaultJsonFormatter.bind(this),
      },
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    //load persisted logs
    this.loadPersistedLogs();

    //start periodic flushing
    this.flushTimer = setInterval(() => {
      this.flushLogs();
    }, this.config.flushInterval);

    //handle page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flushLogs();
      });
    }

    this.isInitialized = true;
    this.info('Structured Logger initialized', 'logger');
  }

  private generateId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEntry(
    level: LogLevel,
    message: string,
    source: string,
    context: Record<string, any> = {},
    tags: string[] = []
  ): LogEntry {
    return {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      message,
      context,
      source,
      userId: context.userId,
      sessionId: context.sessionId,
      traceId: context.traceId,
      spanId: context.spanId,
      tags,
      metadata: {
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        environment: import.meta.env.MODE,
        version: import.meta.env.APP_VERSION || '1.0.0',
      },
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return this.config.enabled && level >= this.config.level;
  }

  private addEntry(entry: LogEntry): void {
    this.entries.push(entry);

    //output to console in development
    if (import.meta.env.DEV) {
      this.outputToConsole(entry);
    }

    //persist to local storage
    if (this.config.persistLocal && typeof localStorage !== 'undefined') {
      this.persistEntry(entry);
    }

    //limit entries buffer
    if (this.entries.length > this.config.maxEntries) {
      this.entries.shift();
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const formatted = this.config.formatters.console(entry);
    
    switch (entry.level) {
      case LogLevel.TRACE:
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(formatted);
        break;
    }
  }

  private persistEntry(entry: LogEntry): void {
    try {
      const key = `logs_${new Date().toISOString().split('T')[0]}`;
      const existing = localStorage.getItem(key);
      const logs = existing ? JSON.parse(existing) : [];
      
      logs.push(entry);
      
      //limit daily logs
      if (logs.length > 1000) {
        logs.shift();
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (error) {
      console.warn('Failed to persist log entry:', error);
    }
  }

  private loadPersistedLogs(): void {
    if (typeof localStorage === 'undefined') return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const key = `logs_${today}`;
      const stored = localStorage.getItem(key);
      
      if (stored) {
        const logs = JSON.parse(stored) as LogEntry[];
        this.entries.push(...logs.slice(-100)); // load last 100 entries
      }
    } catch (error) {
      console.warn('Failed to load persisted logs:', error);
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.entries.length === 0) return;

    try {
      const logsToFlush = this.entries.slice();
      
      await fetch(this.config.endpoints.logs, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToFlush }),
      });

      //clear flushed logs
      this.entries.length = 0;
    } catch (error) {
      console.warn('Failed to flush logs:', error);
    }
  }

  private defaultConsoleFormatter(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    const contextStr = Object.keys(entry.context).length > 0 ? 
      ` | ${JSON.stringify(entry.context)}` : '';
    const tagsStr = entry.tags.length > 0 ? ` | tags: [${entry.tags.join(', ')}]` : '';
    
    return `[${timestamp}] ${levelName} [${entry.source}] ${entry.message}${contextStr}${tagsStr}`;
  }

  private defaultJsonFormatter(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  //public logging methods
  public trace(message: string, source: string = 'app', context: Record<string, any> = {}, tags: string[] = []): string {
    if (!this.shouldLog(LogLevel.TRACE)) return '';
    
    const entry = this.createEntry(LogLevel.TRACE, message, source, context, tags);
    this.addEntry(entry);
    return entry.id;
  }

  public debug(message: string, source: string = 'app', context: Record<string, any> = {}, tags: string[] = []): string {
    if (!this.shouldLog(LogLevel.DEBUG)) return '';
    
    const entry = this.createEntry(LogLevel.DEBUG, message, source, context, tags);
    this.addEntry(entry);
    return entry.id;
  }

  public info(message: string, source: string = 'app', context: Record<string, any> = {}, tags: string[] = []): string {
    if (!this.shouldLog(LogLevel.INFO)) return '';
    
    const entry = this.createEntry(LogLevel.INFO, message, source, context, tags);
    this.addEntry(entry);
    return entry.id;
  }

  public warn(message: string, source: string = 'app', context: Record<string, any> = {}, tags: string[] = []): string {
    if (!this.shouldLog(LogLevel.WARN)) return '';
    
    const entry = this.createEntry(LogLevel.WARN, message, source, context, tags);
    this.addEntry(entry);
    return entry.id;
  }

  public error(message: string, source: string = 'app', context: Record<string, any> = {}, tags: string[] = []): string {
    if (!this.shouldLog(LogLevel.ERROR)) return '';
    
    const entry = this.createEntry(LogLevel.ERROR, message, source, context, tags);
    this.addEntry(entry);
    return entry.id;
  }

  public fatal(message: string, source: string = 'app', context: Record<string, any> = {}, tags: string[] = []): string {
    if (!this.shouldLog(LogLevel.FATAL)) return '';
    
    const entry = this.createEntry(LogLevel.FATAL, message, source, context, tags);
    this.addEntry(entry);
    return entry.id;
  }

  //structured logging with objects
  public log(level: LogLevel, message: string, source: string = 'app', context: Record<string, any> = {}, tags: string[] = []): string {
    if (!this.shouldLog(level)) return '';
    
    const entry = this.createEntry(level, message, source, context, tags);
    this.addEntry(entry);
    return entry.id;
  }

  //search and filtering
  public search(query: LogQuery): LogEntry[] {
    let results = [...this.entries];

    //filter by level
    if (query.level !== undefined) {
      results = results.filter(entry => entry.level === query.level);
    }

    if (query.levelRange) {
      const [min, max] = query.levelRange;
      results = results.filter(entry => entry.level >= min && entry.level <= max);
    }

    //filter by source
    if (query.source) {
      results = results.filter(entry => entry.source.includes(query.source!));
    }

    //filter by user/session
    if (query.userId) {
      results = results.filter(entry => entry.userId === query.userId);
    }

    if (query.sessionId) {
      results = results.filter(entry => entry.sessionId === query.sessionId);
    }

    if (query.traceId) {
      results = results.filter(entry => entry.traceId === query.traceId);
    }

    //filter by message
    if (query.message) {
      results = results.filter(entry => entry.message.includes(query.message!));
    }

    if (query.messagePattern) {
      results = results.filter(entry => query.messagePattern!.test(entry.message));
    }

    //filter by tags
    if (query.tags && query.tags.length > 0) {
      results = results.filter(entry => 
        query.tags!.some(tag => entry.tags.includes(tag))
      );
    }

    //filter by time range
    if (query.timeRange) {
      const [start, end] = query.timeRange;
      results = results.filter(entry => entry.timestamp >= start && entry.timestamp <= end);
    }

    //sort results
    const sortBy = query.sortBy || 'timestamp';
    const sortOrder = query.sortOrder || 'desc';
    
    results.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'timestamp') {
        aValue = a.timestamp;
        bValue = b.timestamp;
      } else if (sortBy === 'level') {
        aValue = a.level;
        bValue = b.level;
      } else {
        return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    //apply offset and limit
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    
    return results.slice(offset, offset + limit);
  }

  //analytics and insights
  public getAnalytics(timeWindow: number = 3600000): {
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsBySource: Record<string, number>;
    errorRate: number;
    topSources: Array<{ source: string; count: number }>;
    recentErrors: LogEntry[];
    timeDistribution: Array<{ hour: number; count: number }>;
  } {
    const cutoff = Date.now() - timeWindow;
    const recentLogs = this.entries.filter(entry => entry.timestamp > cutoff);

    //aggregate by level
    const logsByLevel: Record<string, number> = {};
    recentLogs.forEach(entry => {
      const levelName = LogLevel[entry.level];
      logsByLevel[levelName] = (logsByLevel[levelName] || 0) + 1;
    });

    //aggregate by source
    const logsBySource: Record<string, number> = {};
    recentLogs.forEach(entry => {
      logsBySource[entry.source] = (logsBySource[entry.source] || 0) + 1;
    });

    //calculate error rate
    const errors = recentLogs.filter(entry => entry.level >= LogLevel.ERROR).length;
    const errorRate = recentLogs.length > 0 ? errors / recentLogs.length : 0;

    //top sources
    const topSources = Object.entries(logsBySource)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([source, count]) => ({ source, count }));

    //recent errors
    const recentErrors = recentLogs
      .filter(entry => entry.level >= LogLevel.ERROR)
      .slice(-10);

    //time distribution
    const timeDistribution: Array<{ hour: number; count: number }> = [];
    const hourCounts: Record<number, number> = {};
    
    recentLogs.forEach(entry => {
      const hour = new Date(entry.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    for (let hour = 0; hour < 24; hour++) {
      timeDistribution.push({ hour, count: hourCounts[hour] || 0 });
    }

    return {
      totalLogs: recentLogs.length,
      logsByLevel,
      logsBySource,
      errorRate,
      topSources,
      recentErrors,
      timeDistribution,
    };
  }

  public exportLogs(format: 'json' | 'csv' = 'json', query?: LogQuery): string {
    const logs = query ? this.search(query) : this.entries;

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else {
      //csv format
      const headers = ['timestamp', 'level', 'source', 'message', 'userId', 'sessionId', 'tags'];
      const csvLines = [headers.join(',')];
      
      logs.forEach(entry => {
        const row = [
          new Date(entry.timestamp).toISOString(),
          LogLevel[entry.level],
          entry.source,
          `"${entry.message.replace(/"/g, '""')}"`,
          entry.userId || '',
          entry.sessionId || '',
          `"${entry.tags.join(', ')}"`,
        ];
        csvLines.push(row.join(','));
      });
      
      return csvLines.join('\n');
    }
  }

  //configuration
  public setLevel(level: LogLevel): void {
    this.config.level = level;
    this.info(`Log level changed to ${LogLevel[level]}`, 'logger');
  }

  public setSource(source: string): Logger {
    return new Logger(this, source);
  }

  public addFormatter(name: string, formatter: (entry: LogEntry) => string): void {
    (this.config.formatters as any)[name] = formatter;
  }

  //cleanup
  public clear(): void {
    this.entries.length = 0;
    
    if (typeof localStorage !== 'undefined') {
      const keys = Object.keys(localStorage).filter(key => key.startsWith('logs_'));
      keys.forEach(key => localStorage.removeItem(key));
    }
    
    this.info('Log history cleared', 'logger');
  }

  public shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushLogs().catch(console.error);
    this.isInitialized = false;
  }

  //getters
  public getEntries(): LogEntry[] {
    return [...this.entries];
  }

  public getConfig(): LogConfig {
    return { ...this.config };
  }
}

//logger wrapper for specific sources
class Logger {
  constructor(
    private parent: StructuredLogger,
    private source: string
  ) {}

  trace(message: string, context?: Record<string, any>, tags?: string[]): string {
    return this.parent.trace(message, this.source, context, tags);
  }

  debug(message: string, context?: Record<string, any>, tags?: string[]): string {
    return this.parent.debug(message, this.source, context, tags);
  }

  info(message: string, context?: Record<string, any>, tags?: string[]): string {
    return this.parent.info(message, this.source, context, tags);
  }

  warn(message: string, context?: Record<string, any>, tags?: string[]): string {
    return this.parent.warn(message, this.source, context, tags);
  }

  error(message: string, context?: Record<string, any>, tags?: string[]): string {
    return this.parent.error(message, this.source, context, tags);
  }

  fatal(message: string, context?: Record<string, any>, tags?: string[]): string {
    return this.parent.fatal(message, this.source, context, tags);
  }

  log(level: LogLevel, message: string, context?: Record<string, any>, tags?: string[]): string {
    return this.parent.log(level, message, this.source, context, tags);
  }

  child(source: string): Logger {
    return new Logger(this.parent, `${this.source}.${source}`);
  }
}

//global logger instance
export const logger = new StructuredLogger({
  level: import.meta.env.MODE === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  persistLocal: true,
});

//convenience functions
export const log = logger.log.bind(logger);
export const trace = logger.trace.bind(logger);
export const debug = logger.debug.bind(logger);
export const info = logger.info.bind(logger);
export const warn = logger.warn.bind(logger);
export const error = logger.error.bind(logger);
export const fatal = logger.fatal.bind(logger);

//create source-specific loggers
export const createLogger = (source: string): Logger => logger.setSource(source);

//auto-instrument browser errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    error('JavaScript Error', 'browser', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error?.stack,
    }, ['error', 'javascript']);
  });

  window.addEventListener('unhandledrejection', (event) => {
    error('Unhandled Promise Rejection', 'browser', {
      reason: event.reason?.toString(),
      stack: event.reason?.stack,
    }, ['error', 'promise']);
  });
}

export { StructuredLogger, Logger, LogLevel };
export type { LogEntry, LogQuery, LogConfig };