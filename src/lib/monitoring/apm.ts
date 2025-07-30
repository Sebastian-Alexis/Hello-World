//comprehensive application performance monitoring (apm) system
//provides real-time metrics collection, performance tracking, and operational insights

interface APMMetric {
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  tags: Record<string, string>;
  timestamp: number;
  unit?: string;
}

interface APMTransaction {
  id: string;
  name: string;
  type: 'web' | 'background' | 'database' | 'cache' | 'external';
  startTime: number;
  duration?: number;
  status: 'pending' | 'success' | 'error';
  spans: APMSpan[];
  metadata: Record<string, any>;
  userId?: string;
  sessionId?: string;
}

interface APMSpan {
  id: string;
  parentId?: string;
  operationName: string;
  startTime: number;
  duration?: number;
  tags: Record<string, string>;
  logs: Array<{ timestamp: number; fields: Record<string, any> }>;
  status: 'pending' | 'success' | 'error';
}

interface APMAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  metric: string;
  threshold: number;
  currentValue: number;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

interface APMConfig {
  enabled: boolean;
  sampleRate: number;
  maxTransactionDuration: number;
  maxSpansPerTransaction: number;
  metricsBufferSize: number;
  flushInterval: number;
  endpoints: {
    metrics: string;
    transactions: string;
    alerts: string;
  };
  thresholds: {
    responseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  };
}

class APMSystem {
  private config: APMConfig;
  private metrics: Map<string, APMMetric[]> = new Map();
  private activeTransactions: Map<string, APMTransaction> = new Map();
  private completedTransactions: APMTransaction[] = [];
  private alerts: APMAlert[] = [];
  private flushTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<APMConfig> = {}) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      maxTransactionDuration: 30000,
      maxSpansPerTransaction: 100,
      metricsBufferSize: 1000,
      flushInterval: 30000,
      endpoints: {
        metrics: '/api/monitoring/metrics',
        transactions: '/api/monitoring/transactions',
        alerts: '/api/monitoring/alerts',
      },
      thresholds: {
        responseTime: 2000,
        errorRate: 0.05,
        memoryUsage: 80,
        cpuUsage: 80,
      },
      ...config,
    };

    if (typeof window !== 'undefined' && this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    //start metrics collection
    this.startMetricsCollection();
    
    //start periodic flushing
    this.flushTimer = setInterval(() => {
      this.flushData();
    }, this.config.flushInterval);

    //handle page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.shutdown();
      });
    }

    this.isInitialized = true;
    console.log('APM System initialized');
  }

  //metrics collection
  recordMetric(
    name: string,
    value: number,
    type: APMMetric['type'] = 'gauge',
    tags: Record<string, string> = {},
    unit?: string
  ): void {
    if (!this.config.enabled) return;

    const metric: APMMetric = {
      name,
      value,
      type,
      tags: {
        ...tags,
        environment: import.meta.env.MODE,
        version: import.meta.env.APP_VERSION || '1.0.0',
      },
      timestamp: Date.now(),
      unit,
    };

    const metricKey = `${name}_${JSON.stringify(tags)}`;
    const existingMetrics = this.metrics.get(metricKey) || [];
    
    //handle different metric types
    switch (type) {
      case 'counter':
        //accumulate counter values
        const lastCounter = existingMetrics[existingMetrics.length - 1];
        metric.value = (lastCounter?.value || 0) + value;
        break;
      case 'gauge':
        //replace gauge values
        break;
      case 'histogram':
      case 'summary':
        //append for aggregation
        break;
    }

    existingMetrics.push(metric);
    
    //limit buffer size
    if (existingMetrics.length > this.config.metricsBufferSize) {
      existingMetrics.shift();
    }
    
    this.metrics.set(metricKey, existingMetrics);

    //check thresholds and trigger alerts
    this.checkThresholds(metric);
  }

  //transaction tracking
  startTransaction(
    name: string,
    type: APMTransaction['type'] = 'web',
    metadata: Record<string, any> = {}
  ): string {
    if (!this.config.enabled) return '';

    const transactionId = this.generateId('txn');
    const transaction: APMTransaction = {
      id: transactionId,
      name,
      type,
      startTime: performance.now(),
      status: 'pending',
      spans: [],
      metadata: {
        ...metadata,
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      },
    };

    this.activeTransactions.set(transactionId, transaction);

    //auto-finish transaction after max duration
    setTimeout(() => {
      if (this.activeTransactions.has(transactionId)) {
        this.finishTransaction(transactionId, 'error', 'Transaction timeout');
      }
    }, this.config.maxTransactionDuration);

    return transactionId;
  }

  finishTransaction(
    transactionId: string,
    status: 'success' | 'error' = 'success',
    errorMessage?: string
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    transaction.duration = performance.now() - transaction.startTime;
    transaction.status = status;

    if (errorMessage) {
      transaction.metadata.error = errorMessage;
    }

    //finish any pending spans
    transaction.spans.forEach(span => {
      if (span.status === 'pending') {
        span.duration = transaction.duration;
        span.status = status;
      }
    });

    this.activeTransactions.delete(transactionId);
    this.completedTransactions.push(transaction);

    //record transaction metrics
    this.recordMetric('transaction.duration', transaction.duration, 'histogram', {
      name: transaction.name,
      type: transaction.type,
      status: transaction.status,
    }, 'ms');

    this.recordMetric('transaction.count', 1, 'counter', {
      name: transaction.name,
      type: transaction.type,
      status: transaction.status,
    });

    //limit completed transactions buffer
    if (this.completedTransactions.length > 1000) {
      this.completedTransactions.shift();
    }
  }

  //span tracking (for distributed tracing)
  startSpan(
    transactionId: string,
    operationName: string,
    parentSpanId?: string,
    tags: Record<string, string> = {}
  ): string {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return '';

    if (transaction.spans.length >= this.config.maxSpansPerTransaction) {
      console.warn('Max spans per transaction exceeded');
      return '';
    }

    const spanId = this.generateId('span');
    const span: APMSpan = {
      id: spanId,
      parentId: parentSpanId,
      operationName,
      startTime: performance.now(),
      status: 'pending',
      tags: {
        ...tags,
        transactionId,
      },
      logs: [],
    };

    transaction.spans.push(span);
    return spanId;
  }

  finishSpan(
    transactionId: string,
    spanId: string,
    status: 'success' | 'error' = 'success',
    tags: Record<string, string> = {}
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    const span = transaction.spans.find(s => s.id === spanId);
    if (!span) return;

    span.duration = performance.now() - span.startTime;
    span.status = status;
    span.tags = { ...span.tags, ...tags };

    //record span metrics
    this.recordMetric('span.duration', span.duration, 'histogram', {
      operation: span.operationName,
      status: span.status,
    }, 'ms');
  }

  //span logging
  logSpan(
    transactionId: string,
    spanId: string,
    fields: Record<string, any>
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    const span = transaction.spans.find(s => s.id === spanId);
    if (!span) return;

    span.logs.push({
      timestamp: Date.now(),
      fields,
    });
  }

  //automatic metrics collection
  private startMetricsCollection(): void {
    //collect performance metrics
    this.collectPerformanceMetrics();
    
    //collect memory metrics
    this.collectMemoryMetrics();
    
    //collect navigation metrics
    this.collectNavigationMetrics();
    
    //collect error metrics
    this.setupErrorTracking();

    //start periodic collection
    setInterval(() => {
      this.collectPerformanceMetrics();
      this.collectMemoryMetrics();
    }, 5000);
  }

  private collectPerformanceMetrics(): void {
    if (typeof performance === 'undefined') return;

    //collect navigation timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      this.recordMetric('page.loadTime', navigation.loadEventEnd - navigation.fetchStart, 'gauge', {}, 'ms');
      this.recordMetric('page.domContentLoaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'gauge', {}, 'ms');
      this.recordMetric('page.ttfb', navigation.responseStart - navigation.fetchStart, 'gauge', {}, 'ms');
    }

    //collect resource timing
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    resources.forEach(resource => {
      this.recordMetric('resource.duration', resource.duration, 'histogram', {
        type: this.getResourceType(resource.name),
      }, 'ms');
      
      this.recordMetric('resource.size', resource.transferSize || 0, 'histogram', {
        type: this.getResourceType(resource.name),
      }, 'bytes');
    });

    //clear processed entries
    performance.clearResourceTimings();
  }

  private collectMemoryMetrics(): void {
    if (typeof performance === 'undefined' || !(performance as any).memory) return;

    const memory = (performance as any).memory;
    this.recordMetric('memory.used', memory.usedJSHeapSize, 'gauge', {}, 'bytes');
    this.recordMetric('memory.total', memory.totalJSHeapSize, 'gauge', {}, 'bytes');
    this.recordMetric('memory.limit', memory.jsHeapSizeLimit, 'gauge', {}, 'bytes');
    this.recordMetric('memory.usage', (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100, 'gauge', {}, 'percent');
  }

  private collectNavigationMetrics(): void {
    if (typeof navigator === 'undefined') return;

    //connection info
    const connection = (navigator as any).connection;
    if (connection) {
      this.recordMetric('connection.downlink', connection.downlink || 0, 'gauge', {
        type: connection.effectiveType || 'unknown',
      }, 'mbps');
      
      this.recordMetric('connection.rtt', connection.rtt || 0, 'gauge', {
        type: connection.effectiveType || 'unknown',
      }, 'ms');
    }

    //device info
    this.recordMetric('device.memory', (navigator as any).deviceMemory || 0, 'gauge', {}, 'gb');
    this.recordMetric('device.cores', navigator.hardwareConcurrency || 0, 'gauge', {});
  }

  private setupErrorTracking(): void {
    if (typeof window === 'undefined') return;

    //javascript errors
    window.addEventListener('error', (event) => {
      this.recordMetric('error.count', 1, 'counter', {
        type: 'javascript',
        source: event.filename || 'unknown',
      });

      this.createAlert('error', 'JavaScript Error', event.message, 'error.count', 0, 1);
    });

    //unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.recordMetric('error.count', 1, 'counter', {
        type: 'promise',
      });

      this.createAlert('error', 'Unhandled Promise Rejection', 
        event.reason?.toString() || 'Unknown rejection', 'error.count', 0, 1);
    });
  }

  //threshold monitoring and alerting
  private checkThresholds(metric: APMMetric): void {
    const { thresholds } = this.config;
    
    switch (metric.name) {
      case 'page.loadTime':
        if (metric.value > thresholds.responseTime) {
          this.createAlert('warning', 'Slow Page Load', 
            `Page load time (${metric.value}ms) exceeds threshold (${thresholds.responseTime}ms)`,
            metric.name, thresholds.responseTime, metric.value);
        }
        break;
        
      case 'memory.usage':
        if (metric.value > thresholds.memoryUsage) {
          this.createAlert('warning', 'High Memory Usage',
            `Memory usage (${metric.value}%) exceeds threshold (${thresholds.memoryUsage}%)`,
            metric.name, thresholds.memoryUsage, metric.value);
        }
        break;
        
      case 'error.count':
        const errorRate = this.calculateErrorRate();
        if (errorRate > thresholds.errorRate) {
          this.createAlert('error', 'High Error Rate',
            `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold (${(thresholds.errorRate * 100).toFixed(2)}%)`,
            'error.rate', thresholds.errorRate, errorRate);
        }
        break;
    }
  }

  private calculateErrorRate(): number {
    const errorMetrics = this.metrics.get('error.count_{"type":"javascript"}') || [];
    const transactionMetrics = this.metrics.get('transaction.count') || [];
    
    const recentErrors = errorMetrics.filter(m => Date.now() - m.timestamp < 300000); // 5 minutes
    const recentTransactions = transactionMetrics.filter(m => Date.now() - m.timestamp < 300000);
    
    const errorCount = recentErrors.reduce((sum, m) => sum + m.value, 0);
    const transactionCount = recentTransactions.reduce((sum, m) => sum + m.value, 0);
    
    return transactionCount > 0 ? errorCount / transactionCount : 0;
  }

  private createAlert(
    level: APMAlert['level'],
    title: string,
    message: string,
    metric: string,
    threshold: number,
    currentValue: number
  ): void {
    const alert: APMAlert = {
      id: this.generateId('alert'),
      level,
      title,
      message,
      metric,
      threshold,
      currentValue,
      timestamp: Date.now(),
      resolved: false,
    };

    this.alerts.push(alert);

    //emit alert event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('apm-alert', { detail: alert }));
    }

    //limit alerts buffer
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }
  }

  //data export and flushing
  private async flushData(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      //flush metrics
      if (this.metrics.size > 0) {
        const metricsData = Array.from(this.metrics.entries()).map(([key, metrics]) => ({
          key,
          metrics: metrics.slice(), //clone array
        }));

        await this.sendToEndpoint(this.config.endpoints.metrics, { metrics: metricsData });
        this.metrics.clear();
      }

      //flush completed transactions
      if (this.completedTransactions.length > 0) {
        await this.sendToEndpoint(this.config.endpoints.transactions, {
          transactions: this.completedTransactions.slice(),
        });
        this.completedTransactions.length = 0;
      }

      //flush alerts
      const unresolvedAlerts = this.alerts.filter(a => !a.resolved);
      if (unresolvedAlerts.length > 0) {
        await this.sendToEndpoint(this.config.endpoints.alerts, { alerts: unresolvedAlerts });
      }
    } catch (error) {
      console.error('Failed to flush APM data:', error);
    }
  }

  private async sendToEndpoint(endpoint: string, data: any): Promise<void> {
    if (typeof fetch === 'undefined') return;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`APM endpoint error: ${response.status} ${response.statusText}`);
    }
  }

  //utility methods
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) return 'image';
    if (['js', 'mjs'].includes(extension)) return 'script';
    if (['css'].includes(extension)) return 'stylesheet';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension)) return 'font';
    if (['mp4', 'webm', 'ogg'].includes(extension)) return 'video';
    
    return 'other';
  }

  //public api
  public getMetrics(): Map<string, APMMetric[]> {
    return new Map(this.metrics);
  }

  public getActiveTransactions(): APMTransaction[] {
    return Array.from(this.activeTransactions.values());
  }

  public getCompletedTransactions(): APMTransaction[] {
    return [...this.completedTransactions];
  }

  public getAlerts(): APMAlert[] {
    return [...this.alerts];
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      return true;
    }
    return false;
  }

  public setSampleRate(rate: number): void {
    this.config.sampleRate = Math.max(0, Math.min(1, rate));
  }

  public setThreshold(metric: string, value: number): void {
    (this.config.thresholds as any)[metric] = value;
  }

  public getDashboardData(): {
    metrics: Record<string, any>;
    transactions: Record<string, any>;
    errors: Record<string, any>;
    performance: Record<string, any>;
  } {
    const now = Date.now();
    const timeWindow = 300000; // 5 minutes

    //aggregate metrics
    const recentMetrics = new Map<string, number>();
    for (const [key, metrics] of this.metrics.entries()) {
      const recent = metrics.filter(m => now - m.timestamp < timeWindow);
      if (recent.length > 0) {
        const latest = recent[recent.length - 1];
        recentMetrics.set(key, latest.value);
      }
    }

    //aggregate transactions
    const recentTransactions = this.completedTransactions.filter(t => 
      now - (t.startTime + (t.duration || 0)) < timeWindow
    );

    const transactionStats = {
      total: recentTransactions.length,
      success: recentTransactions.filter(t => t.status === 'success').length,
      error: recentTransactions.filter(t => t.status === 'error').length,
      avgDuration: recentTransactions.length > 0 ? 
        recentTransactions.reduce((sum, t) => sum + (t.duration || 0), 0) / recentTransactions.length : 0,
    };

    //aggregate errors
    const recentAlerts = this.alerts.filter(a => now - a.timestamp < timeWindow);
    const errorStats = {
      total: recentAlerts.length,
      critical: recentAlerts.filter(a => a.level === 'critical').length,
      error: recentAlerts.filter(a => a.level === 'error').length,
      warning: recentAlerts.filter(a => a.level === 'warning').length,
      unresolved: recentAlerts.filter(a => !a.resolved).length,
    };

    //performance summary
    const performanceStats = {
      memoryUsage: recentMetrics.get('memory.usage') || 0,
      pageLoadTime: recentMetrics.get('page.loadTime') || 0,
      errorRate: this.calculateErrorRate(),
      activeTransactions: this.activeTransactions.size,
    };

    return {
      metrics: Object.fromEntries(recentMetrics),
      transactions: transactionStats,
      errors: errorStats,
      performance: performanceStats,
    };
  }

  public shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    //final data flush
    this.flushData().catch(console.error);

    this.isInitialized = false;
  }
}

//create global apm instance
export const apm = new APMSystem({
  enabled: true,
  sampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  thresholds: {
    responseTime: 2000,
    errorRate: 0.05,
    memoryUsage: 80,
    cpuUsage: 80,
  },
});

//convenience functions
export const recordMetric = (name: string, value: number, type?: APMMetric['type'], tags?: Record<string, string>) => 
  apm.recordMetric(name, value, type, tags);

export const startTransaction = (name: string, type?: APMTransaction['type'], metadata?: Record<string, any>) => 
  apm.startTransaction(name, type, metadata);

export const finishTransaction = (id: string, status?: 'success' | 'error', error?: string) => 
  apm.finishTransaction(id, status, error);

export const startSpan = (transactionId: string, operation: string, parentId?: string, tags?: Record<string, string>) => 
  apm.startSpan(transactionId, operation, parentId, tags);

export const finishSpan = (transactionId: string, spanId: string, status?: 'success' | 'error', tags?: Record<string, string>) => 
  apm.finishSpan(transactionId, spanId, status, tags);

//auto-instrument common operations
if (typeof window !== 'undefined') {
  //instrument fetch
  const originalFetch = window.fetch;
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || 'GET';
    
    const transactionId = startTransaction(`HTTP ${method}`, 'external', { url, method });
    const spanId = startSpan(transactionId, `fetch ${method} ${url}`);

    try {
      const response = await originalFetch(input, init);
      
      finishSpan(transactionId, spanId, response.ok ? 'success' : 'error', {
        status: response.status.toString(),
        statusText: response.statusText,
      });
      
      finishTransaction(transactionId, response.ok ? 'success' : 'error');
      
      return response;
    } catch (error) {
      finishSpan(transactionId, spanId, 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      finishTransaction(transactionId, 'error', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  };

  //instrument navigation
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function(...args) {
    const transactionId = startTransaction('Navigation', 'web', { type: 'pushState', url: args[2] });
    originalPushState.apply(history, args);
    setTimeout(() => finishTransaction(transactionId), 100);
  };

  history.replaceState = function(...args) {
    const transactionId = startTransaction('Navigation', 'web', { type: 'replaceState', url: args[2] });
    originalReplaceState.apply(history, args);
    setTimeout(() => finishTransaction(transactionId), 100);
  };
}

export default apm;