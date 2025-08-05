//comprehensive monitoring system initialization and exports
//provides unified access to all monitoring components

//import all monitoring systems
import { apm } from './apm';
import { logger, createLogger } from './logging';
import { healthMonitor } from './health';
import { alerting } from './alerting';
import { uptimeMonitor } from './uptime';
import { tracing } from './tracing';
import { backupSystem } from './backup';

//monitoring configuration
interface MonitoringConfig {
  enabled: boolean;
  environment: string;
  serviceName: string;
  version: string;
  apm: {
    enabled: boolean;
    sampleRate: number;
    enableAutoInstrumentation: boolean;
  };
  logging: {
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    persistLocal: boolean;
    maxEntries: number;
  };
  health: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
  alerting: {
    enabled: boolean;
    evaluationInterval: number;
    enableEscalation: boolean;
  };
  uptime: {
    enabled: boolean;
    defaultInterval: number;
    incidentThreshold: number;
  };
  tracing: {
    enabled: boolean;
    sampleRate: number;
    enableAutoInstrumentation: boolean;
  };
  backup: {
    enabled: boolean;
    defaultRetention: number;
    maxConcurrentJobs: number;
  };
}

//default configuration
const DEFAULT_CONFIG: MonitoringConfig = {
  enabled: true,
  environment: import.meta.env.MODE || 'development',
  serviceName: 'portfolio-app',
  version: import.meta.env.APP_VERSION || '1.0.0',
  apm: {
    enabled: true,
    sampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    enableAutoInstrumentation: true,
  },
  logging: {
    level: import.meta.env.MODE === 'production' ? 'info' : 'debug',
    persistLocal: true,
    maxEntries: 10000,
  },
  health: {
    enabled: true,
    interval: 30000, // 30 seconds
    timeout: 5000,   // 5 seconds
  },
  alerting: {
    enabled: true,
    evaluationInterval: 60000, // 1 minute
    enableEscalation: true,
  },
  uptime: {
    enabled: true,
    defaultInterval: 60000, // 1 minute
    incidentThreshold: 3,
  },
  tracing: {
    enabled: true,
    sampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    enableAutoInstrumentation: true,
  },
  backup: {
    enabled: true,
    defaultRetention: 30, // 30 days
    maxConcurrentJobs: 2,
  },
};

class MonitoringSystem {
  private config: MonitoringConfig;
  private isInitialized = false;
  private systemLogger = createLogger('monitoring-system');

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.systemLogger.warn('Monitoring system already initialized');
      return;
    }

    try {
      this.systemLogger.info('Initializing monitoring system', {
        environment: this.config.environment,
        serviceName: this.config.serviceName,
        version: this.config.version,
      });

      //initialize all monitoring components
      await this.initializeComponents();

      //setup system-wide monitoring
      this.setupSystemMonitoring();

      //setup error handlers
      this.setupErrorHandlers();

      //setup shutdown handlers
      this.setupShutdownHandlers();

      this.isInitialized = true;
      this.systemLogger.info('Monitoring system initialized successfully');

      //log system information
      this.logSystemInfo();
    } catch (error) {
      this.systemLogger.error('Failed to initialize monitoring system', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async initializeComponents(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    //initialize components based on configuration
    if (this.config.apm.enabled) {
      initPromises.push(this.initializeAPM());
    }

    if (this.config.health.enabled) {
      initPromises.push(this.initializeHealth());
    }

    if (this.config.alerting.enabled) {
      initPromises.push(this.initializeAlerting());
    }

    if (this.config.uptime.enabled) {
      initPromises.push(this.initializeUptime());
    }

    if (this.config.tracing.enabled) {
      initPromises.push(this.initializeTracing());
    }

    if (this.config.backup.enabled) {
      initPromises.push(this.initializeBackup());
    }

    //wait for all components to initialize
    await Promise.all(initPromises);
  }

  private async initializeAPM(): Promise<void> {
    this.systemLogger.debug('Initializing APM system');
    
    //apm is already initialized through import
    //configure sample rate
    apm.setSampleRate(this.config.apm.sampleRate);
    
    this.systemLogger.info('APM system initialized', {
      sampleRate: this.config.apm.sampleRate,
      autoInstrumentation: this.config.apm.enableAutoInstrumentation,
    });
  }

  private async initializeHealth(): Promise<void> {
    this.systemLogger.debug('Initializing health monitoring');
    
    //health monitor is already initialized through import
    //configuration is handled in the constructor
    
    this.systemLogger.info('Health monitoring initialized', {
      interval: this.config.health.interval,
      timeout: this.config.health.timeout,
    });
  }

  private async initializeAlerting(): Promise<void> {
    this.systemLogger.debug('Initializing alerting system');
    
    //alerting system is already initialized through import
    //additional configuration can be added here
    
    this.systemLogger.info('Alerting system initialized', {
      evaluationInterval: this.config.alerting.evaluationInterval,
      escalation: this.config.alerting.enableEscalation,
    });
  }

  private async initializeUptime(): Promise<void> {
    this.systemLogger.debug('Initializing uptime monitoring');
    
    //uptime monitor is already initialized through import
    //configuration is handled in the constructor
    
    this.systemLogger.info('Uptime monitoring initialized', {
      interval: this.config.uptime.defaultInterval,
      threshold: this.config.uptime.incidentThreshold,
    });
  }

  private async initializeTracing(): Promise<void> {
    this.systemLogger.debug('Initializing distributed tracing');
    
    //tracing system is already initialized through import
    //configure sample rate
    tracing.setSampleRate(this.config.tracing.sampleRate);
    
    this.systemLogger.info('Distributed tracing initialized', {
      sampleRate: this.config.tracing.sampleRate,
      autoInstrumentation: this.config.tracing.enableAutoInstrumentation,
    });
  }

  private async initializeBackup(): Promise<void> {
    this.systemLogger.debug('Initializing backup system');
    
    //backup system is already initialized through import
    //configuration is handled in the constructor
    
    this.systemLogger.info('Backup system initialized', {
      retention: this.config.backup.defaultRetention,
      maxJobs: this.config.backup.maxConcurrentJobs,
    });
  }

  private setupSystemMonitoring(): void {
    //monitor the monitoring system itself
    if (typeof window !== 'undefined') {
      //browser environment
      window.addEventListener('error', (event) => {
        this.systemLogger.error('Unhandled error in monitoring system', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          stack: event.error?.stack,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.systemLogger.error('Unhandled promise rejection in monitoring system', {
          reason: event.reason?.toString(),
          stack: event.reason?.stack,
        });
      });
    }

    //monitor system resources periodically
    setInterval(() => {
      this.collectSystemMetrics();
    }, 60000); // every minute
  }

  private collectSystemMetrics(): void {
    try {
      //collect memory usage
      if (typeof performance !== 'undefined' && (performance as any).memory) {
        const memory = (performance as any).memory;
        const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
        
        apm.recordMetric('system.memory.usage', usagePercent, 'gauge', {
          service: 'monitoring-system',
        });
        
        if (usagePercent > 80) {
          this.systemLogger.warn('High memory usage in monitoring system', {
            usagePercent,
            usedJSHeapSize: memory.usedJSHeapSize,
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
          });
        }
      }

      //collect component health
      const componentHealth = {
        apm: this.config.apm.enabled,
        logging: this.config.logging.level !== undefined,
        health: this.config.health.enabled,
        alerting: this.config.alerting.enabled,
        uptime: this.config.uptime.enabled,
        tracing: this.config.tracing.enabled,
        backup: this.config.backup.enabled,
      };

      apm.recordMetric('system.components.healthy', 
        Object.values(componentHealth).filter(Boolean).length, 
        'gauge', { service: 'monitoring-system' }
      );
    } catch (error) {
      this.systemLogger.error('Failed to collect system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private setupErrorHandlers(): void {
    //setup global error handlers for the monitoring system
    const originalConsoleError = console.error;
    console.error = (...args) => {
      //call original console.error
      originalConsoleError.apply(console, args);
      
      //log to monitoring system
      this.systemLogger.error('Console error captured', {
        args: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)),
      });
    };
  }

  private setupShutdownHandlers(): void {
    const shutdown = () => {
      this.systemLogger.info('Shutting down monitoring system');
      this.shutdown();
    };

    if (typeof process !== 'undefined') {
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', shutdown);
    }
  }

  private logSystemInfo(): void {
    const systemInfo = {
      environment: this.config.environment,
      serviceName: this.config.serviceName,
      version: this.config.version,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      timestamp: new Date().toISOString(),
      components: {
        apm: this.config.apm.enabled,
        logging: true, // always enabled
        health: this.config.health.enabled,
        alerting: this.config.alerting.enabled,
        uptime: this.config.uptime.enabled,
        tracing: this.config.tracing.enabled,
        backup: this.config.backup.enabled,
      },
    };

    this.systemLogger.info('Monitoring system operational', systemInfo);
  }

  public getSystemStatus(): {
    initialized: boolean;
    config: MonitoringConfig;
    components: Record<string, boolean>;
    uptime: number;
  } {
    return {
      initialized: this.isInitialized,
      config: this.config,
      components: {
        apm: this.config.apm.enabled,
        logging: true,
        health: this.config.health.enabled,
        alerting: this.config.alerting.enabled,
        uptime: this.config.uptime.enabled,
        tracing: this.config.tracing.enabled,
        backup: this.config.backup.enabled,
      },
      uptime: typeof performance !== 'undefined' ? performance.now() : Date.now(),
    };
  }

  public updateConfig(updates: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...updates };
    this.systemLogger.info('Monitoring configuration updated', updates);
  }

  public shutdown(): void {
    if (!this.isInitialized) return;

    try {
      this.systemLogger.info('Shutting down monitoring components');

      //shutdown all components
      if (this.config.apm.enabled) {
        apm.shutdown();
      }

      if (this.config.health.enabled) {
        healthMonitor.shutdown();
      }

      if (this.config.alerting.enabled) {
        alerting.shutdown();
      }

      if (this.config.uptime.enabled) {
        uptimeMonitor.shutdown();
      }

      if (this.config.tracing.enabled) {
        tracing.shutdown();
      }

      if (this.config.backup.enabled) {
        backupSystem.shutdown();
      }

      //shutdown logger last
      logger.shutdown();

      this.isInitialized = false;
    } catch (error) {
      console.error('Error during monitoring system shutdown:', error);
    }
  }
}

//create global monitoring system instance
export const monitoring = new MonitoringSystem();

//initialize monitoring system when module is loaded
//only in browser environment, not in workers
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  monitoring.initialize().catch(console.error);
}

//export all monitoring components
export {
  apm,
  logger,
  createLogger,
  healthMonitor,
  alerting,
  uptimeMonitor,
  tracing,
  backupSystem,
};

//export types
export type { MonitoringConfig };

//export convenience functions
export {
  //apm functions
  recordMetric,
  startTransaction,
  finishTransaction,
  startSpan,
  finishSpan,
} from './apm';

export {
  //logging functions
  log,
  trace,
  debug,
  info,
  warn,
  error,
  fatal,
} from './logging';

export {
  //health functions
  runHealthCheck,
  runAllHealthChecks,
  getSystemHealth,
  getHealthSummary,
  registerHealthCheck,
} from './health';

export {
  //alerting functions
  createAlert,
  acknowledgeAlert,
  resolveAlert,
} from './alerting';

export {
  //uptime functions
  addUptimeCheck,
  getStatusPage,
} from './uptime';

export {
  //tracing functions
  startTrace,
  traceOperation,
  traceSync,
  getCurrentContext,
  setCurrentContext,
} from './tracing';

export {
  //backup functions
  createBackupJob,
  executeBackup,
  createRecoveryPlan,
  executeRecovery,
} from './backup';

//default export
export default monitoring;