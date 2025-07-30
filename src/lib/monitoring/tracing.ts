//distributed tracing system for performance analysis and request flow monitoring
//provides comprehensive request tracing across services and operations

export enum SpanKind {
  INTERNAL = 'internal',
  SERVER = 'server',
  CLIENT = 'client',
  PRODUCER = 'producer',
  CONSUMER = 'consumer',
}

export enum SpanStatus {
  UNSET = 'unset',
  OK = 'ok',
  ERROR = 'error',
}

interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  traceState?: string;
  baggage?: Record<string, string>;
}

interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
  traceState?: string;
  baggage?: Record<string, string>;
}

interface Span {
  context: SpanContext;
  operationName: string;
  kind: SpanKind;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: SpanStatus;
  statusMessage?: string;
  tags: Record<string, any>;
  logs: LogEntry[];
  references: SpanReference[];
  process: ProcessInfo;
  warnings: string[];
}

interface LogEntry {
  timestamp: number;
  fields: Record<string, any>;
  level?: 'debug' | 'info' | 'warn' | 'error';
}

interface SpanReference {
  type: 'child_of' | 'follows_from';
  spanContext: SpanContext;
}

interface ProcessInfo {
  serviceName: string;
  tags: Record<string, any>;
}

interface Trace {
  traceId: string;
  spans: Span[];
  duration: number;
  startTime: number;
  endTime: number;
  services: string[];
  operationCount: number;
  errorCount: number;
  warnings: string[];
  rootSpan?: Span;
}

interface TracingConfig {
  enabled: boolean;
  serviceName: string;
  sampleRate: number;
  maxSpansPerTrace: number;
  maxTraceRetentionTime: number; // milliseconds
  endpoint: string;
  batchSize: number;
  flushInterval: number;
  enableAutoInstrumentation: boolean;
}

class TracingSystem {
  private config: TracingConfig;
  private activeSpans = new Map<string, Span>();
  private completedTraces = new Map<string, Trace>();
  private currentContext: TraceContext | null = null;
  private flushTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(config: Partial<TracingConfig> = {}) {
    this.config = {
      enabled: true,
      serviceName: 'portfolio-app',
      sampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
      maxSpansPerTrace: 100,
      maxTraceRetentionTime: 300000, // 5 minutes
      endpoint: '/api/monitoring/traces',
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      enableAutoInstrumentation: true,
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initialize(): void {
    if (this.isInitialized) return;

    //start batch flushing
    this.flushTimer = setInterval(() => {
      this.flushTraces().catch(console.error);
    }, this.config.flushInterval);

    //setup auto-instrumentation
    if (this.config.enableAutoInstrumentation) {
      this.setupAutoInstrumentation();
    }

    //cleanup old traces
    setInterval(() => {
      this.cleanupOldTraces();
    }, 60000); // every minute

    this.isInitialized = true;
    console.log('Tracing System initialized');
  }

  private setupAutoInstrumentation(): void {
    if (typeof window === 'undefined') return;

    //instrument fetch
    const originalFetch = window.fetch;
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      const method = init?.method || 'GET';
      
      const span = this.startSpan(`HTTP ${method}`, SpanKind.CLIENT);
      span.setTag('http.method', method);
      span.setTag('http.url', url);
      span.setTag('component', 'fetch');

      try {
        const response = await originalFetch(input, init);
        
        span.setTag('http.status_code', response.status);
        span.setTag('http.status_text', response.statusText);
        
        if (response.ok) {
          span.setStatus(SpanStatus.OK);
        } else {
          span.setStatus(SpanStatus.ERROR, `HTTP ${response.status}`);
        }
        
        span.finish();
        return response;
      } catch (error) {
        span.setStatus(SpanStatus.ERROR, error instanceof Error ? error.message : 'Unknown error');
        span.setTag('error', true);
        span.log('error', { message: error instanceof Error ? error.message : 'Unknown error' });
        span.finish();
        throw error;
      }
    };

    //instrument navigation
    const instrumentNavigation = (type: string) => {
      const span = this.startSpan(`Navigation ${type}`, SpanKind.INTERNAL);
      span.setTag('navigation.type', type);
      span.setTag('navigation.url', window.location.href);
      
      //finish navigation span after a short delay
      setTimeout(() => {
        span.setStatus(SpanStatus.OK);
        span.finish();
      }, 100);
    };

    //listen for navigation events
    window.addEventListener('popstate', () => instrumentNavigation('popstate'));
    
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      instrumentNavigation('pushState');
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      instrumentNavigation('replaceState');
    };

    //instrument dom events
    const instrumentedEvents = ['click', 'submit', 'change'];
    instrumentedEvents.forEach(eventType => {
      document.addEventListener(eventType, (event) => {
        if (Math.random() > this.config.sampleRate) return;

        const span = this.startSpan(`DOM ${eventType}`, SpanKind.INTERNAL);
        span.setTag('event.type', eventType);
        span.setTag('event.target', this.getElementSelector(event.target as Element));
        span.setTag('component', 'dom');

        //finish the span quickly for dom events
        setTimeout(() => {
          span.setStatus(SpanStatus.OK);
          span.finish();
        }, 10);
      }, { passive: true });
    });
  }

  private getElementSelector(element: Element): string {
    if (!element) return 'unknown';
    
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  //trace and span management
  public startTrace(operationName: string, parentContext?: TraceContext): TraceContext {
    const traceId = parentContext?.traceId || this.generateTraceId();
    const spanId = this.generateSpanId();
    
    const context: TraceContext = {
      traceId,
      spanId,
      traceFlags: 1, // sampled
      traceState: parentContext?.traceState,
      baggage: parentContext?.baggage,
    };

    this.currentContext = context;
    
    //start root span
    const rootSpan = this.createSpan(operationName, SpanKind.SERVER, context);
    this.activeSpans.set(spanId, rootSpan);

    return context;
  }

  public startSpan(
    operationName: string, 
    kind: SpanKind = SpanKind.INTERNAL, 
    parentContext?: TraceContext
  ): TracedSpan {
    //use current context if no parent provided
    const context = parentContext || this.currentContext;
    
    //create new context for this span
    const spanContext: SpanContext = {
      traceId: context?.traceId || this.generateTraceId(),
      spanId: this.generateSpanId(),
      parentSpanId: context?.spanId,
      traceFlags: 1,
      traceState: context?.traceState,
      baggage: context?.baggage,
    };

    const span = this.createSpan(operationName, kind, spanContext);
    this.activeSpans.set(spanContext.spanId, span);

    return new TracedSpan(span, this);
  }

  private createSpan(operationName: string, kind: SpanKind, context: SpanContext): Span {
    return {
      context,
      operationName,
      kind,
      startTime: performance.now(),
      status: SpanStatus.UNSET,
      tags: {},
      logs: [],
      references: context.parentSpanId ? [{
        type: 'child_of',
        spanContext: {
          traceId: context.traceId,
          spanId: context.parentSpanId,
          traceFlags: context.traceFlags,
        },
      }] : [],
      process: {
        serviceName: this.config.serviceName,
        tags: {
          environment: import.meta.env.MODE,
          version: import.meta.env.APP_VERSION || '1.0.0',
          hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        },
      },
      warnings: [],
    };
  }

  public finishSpan(spanId: string, status: SpanStatus = SpanStatus.OK, statusMessage?: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = performance.now();
    span.duration = span.endTime - span.startTime;
    span.status = status;
    span.statusMessage = statusMessage;

    //move to completed traces
    this.activeSpans.delete(spanId);
    this.addSpanToTrace(span);
  }

  private addSpanToTrace(span: Span): void {
    const traceId = span.context.traceId;
    let trace = this.completedTraces.get(traceId);

    if (!trace) {
      trace = {
        traceId,
        spans: [],
        duration: 0,
        startTime: span.startTime,
        endTime: span.endTime || span.startTime,
        services: [],
        operationCount: 0,
        errorCount: 0,
        warnings: [],
      };
      this.completedTraces.set(traceId, trace);
    }

    trace.spans.push(span);
    trace.operationCount++;

    if (span.status === SpanStatus.ERROR) {
      trace.errorCount++;
    }

    if (span.warnings.length > 0) {
      trace.warnings.push(...span.warnings);
    }

    //update trace timing
    trace.startTime = Math.min(trace.startTime, span.startTime);
    trace.endTime = Math.max(trace.endTime, span.endTime || span.startTime);
    trace.duration = trace.endTime - trace.startTime;

    //update services list
    if (!trace.services.includes(span.process.serviceName)) {
      trace.services.push(span.process.serviceName);
    }

    //identify root span
    if (!span.context.parentSpanId) {
      trace.rootSpan = span;
    }

    //limit spans per trace
    if (trace.spans.length > this.config.maxSpansPerTrace) {
      trace.spans.shift(); // remove oldest span
      trace.warnings.push('Trace exceeded maximum span limit');
    }
  }

  //context management
  public getCurrentContext(): TraceContext | null {
    return this.currentContext;
  }

  public setCurrentContext(context: TraceContext | null): void {
    this.currentContext = context;
  }

  public withContext<T>(context: TraceContext, fn: () => T): T {
    const previousContext = this.currentContext;
    this.currentContext = context;
    
    try {
      return fn();
    } finally {
      this.currentContext = previousContext;
    }
  }

  public async withContextAsync<T>(context: TraceContext, fn: () => Promise<T>): Promise<T> {
    const previousContext = this.currentContext;
    this.currentContext = context;
    
    try {
      return await fn();
    } finally {
      this.currentContext = previousContext;
    }
  }

  //trace operations
  public async traceOperation<T>(
    operationName: string,
    operation: (span: TracedSpan) => Promise<T>,
    kind: SpanKind = SpanKind.INTERNAL
  ): Promise<T> {
    const span = this.startSpan(operationName, kind);
    
    try {
      const result = await operation(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.setStatus(SpanStatus.ERROR, error instanceof Error ? error.message : 'Unknown error');
      span.setTag('error', true);
      span.log('error', { 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      span.finish();
    }
  }

  public traceSync<T>(
    operationName: string,
    operation: (span: TracedSpan) => T,
    kind: SpanKind = SpanKind.INTERNAL
  ): T {
    const span = this.startSpan(operationName, kind);
    
    try {
      const result = operation(span);
      span.setStatus(SpanStatus.OK);
      return result;
    } catch (error) {
      span.setStatus(SpanStatus.ERROR, error instanceof Error ? error.message : 'Unknown error');
      span.setTag('error', true);
      span.log('error', { 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    } finally {
      span.finish();
    }
  }

  //data export
  private async flushTraces(): Promise<void> {
    const traces = Array.from(this.completedTraces.values());
    if (traces.length === 0) return;

    //prepare batch
    const batch = traces.slice(0, this.config.batchSize);
    
    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traces: batch }),
      });

      //remove flushed traces
      batch.forEach(trace => this.completedTraces.delete(trace.traceId));
    } catch (error) {
      console.error('Failed to flush traces:', error);
    }
  }

  private cleanupOldTraces(): void {
    const cutoff = Date.now() - this.config.maxTraceRetentionTime;
    
    for (const [traceId, trace] of this.completedTraces.entries()) {
      if (trace.endTime < cutoff) {
        this.completedTraces.delete(traceId);
      }
    }

    //cleanup active spans that are too old
    for (const [spanId, span] of this.activeSpans.entries()) {
      if (span.startTime < cutoff) {
        span.warnings.push('Span exceeded maximum duration');
        this.finishSpan(spanId, SpanStatus.ERROR, 'Span timeout');
      }
    }
  }

  //utility methods
  private generateTraceId(): string {
    //generate 128-bit trace ID
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  private generateSpanId(): string {
    //generate 64-bit span ID
    return Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  //public api
  public getTrace(traceId: string): Trace | null {
    return this.completedTraces.get(traceId) || null;
  }

  public getAllTraces(): Trace[] {
    return Array.from(this.completedTraces.values());
  }

  public getActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  public getTraceAnalytics(): {
    totalTraces: number;
    avgDuration: number;
    errorRate: number;
    topOperations: Array<{ name: string; count: number; avgDuration: number }>;
    serviceMap: Array<{ from: string; to: string; count: number }>;
  } {
    const traces = Array.from(this.completedTraces.values());
    
    if (traces.length === 0) {
      return {
        totalTraces: 0,
        avgDuration: 0,
        errorRate: 0,
        topOperations: [],
        serviceMap: [],
      };
    }

    const totalDuration = traces.reduce((sum, trace) => sum + trace.duration, 0);
    const errorCount = traces.filter(trace => trace.errorCount > 0).length;
    
    //analyze operations
    const operationStats = new Map<string, { count: number; totalDuration: number }>();
    traces.forEach(trace => {
      trace.spans.forEach(span => {
        const key = span.operationName;
        const stats = operationStats.get(key) || { count: 0, totalDuration: 0 };
        stats.count++;
        stats.totalDuration += span.duration || 0;
        operationStats.set(key, stats);
      });
    });

    const topOperations = Array.from(operationStats.entries())
      .map(([name, stats]) => ({
        name,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    //build service map (simplified)
    const serviceConnections = new Map<string, number>();
    traces.forEach(trace => {
      for (let i = 0; i < trace.services.length; i++) {
        for (let j = i + 1; j < trace.services.length; j++) {
          const key = `${trace.services[i]}->${trace.services[j]}`;
          serviceConnections.set(key, (serviceConnections.get(key) || 0) + 1);
        }
      }
    });

    const serviceMap = Array.from(serviceConnections.entries())
      .map(([connection, count]) => {
        const [from, to] = connection.split('->');
        return { from, to, count };
      })
      .sort((a, b) => b.count - a.count);

    return {
      totalTraces: traces.length,
      avgDuration: totalDuration / traces.length,
      errorRate: errorCount / traces.length,
      topOperations,
      serviceMap,
    };
  }

  public setSampleRate(rate: number): void {
    this.config.sampleRate = Math.max(0, Math.min(1, rate));
  }

  public shutdown(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    //flush remaining traces
    this.flushTraces().catch(console.error);

    this.isInitialized = false;
    console.log('Tracing System shutdown');
  }
}

//traced span wrapper
class TracedSpan {
  constructor(
    private span: Span,
    private tracer: TracingSystem
  ) {}

  public setTag(key: string, value: any): TracedSpan {
    this.span.tags[key] = value;
    return this;
  }

  public setTags(tags: Record<string, any>): TracedSpan {
    Object.assign(this.span.tags, tags);
    return this;
  }

  public log(event: string, fields: Record<string, any> = {}, level?: LogEntry['level']): TracedSpan {
    this.span.logs.push({
      timestamp: performance.now(),
      fields: { event, ...fields },
      level,
    });
    return this;
  }

  public setStatus(status: SpanStatus, message?: string): TracedSpan {
    this.span.status = status;
    this.span.statusMessage = message;
    return this;
  }

  public addWarning(warning: string): TracedSpan {
    this.span.warnings.push(warning);
    return this;
  }

  public getContext(): SpanContext {
    return this.span.context;
  }

  public finish(status?: SpanStatus, statusMessage?: string): void {
    if (status !== undefined) {
      this.setStatus(status, statusMessage);
    }
    this.tracer.finishSpan(this.span.context.spanId, this.span.status, this.span.statusMessage);
  }

  //child span creation
  public startChild(operationName: string, kind: SpanKind = SpanKind.INTERNAL): TracedSpan {
    return this.tracer.startSpan(operationName, kind, {
      traceId: this.span.context.traceId,
      spanId: this.span.context.spanId,
      traceFlags: this.span.context.traceFlags,
      traceState: this.span.context.traceState,
      baggage: this.span.context.baggage,
    });
  }
}

//global tracing instance
export const tracing = new TracingSystem({
  serviceName: 'portfolio-app',
  sampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
  enableAutoInstrumentation: true,
});

//convenience functions
export const startTrace = (operationName: string, parentContext?: TraceContext) =>
  tracing.startTrace(operationName, parentContext);

export const startSpan = (operationName: string, kind?: SpanKind, parentContext?: TraceContext) =>
  tracing.startSpan(operationName, kind, parentContext);

export const traceOperation = <T>(operationName: string, operation: (span: TracedSpan) => Promise<T>, kind?: SpanKind) =>
  tracing.traceOperation(operationName, operation, kind);

export const traceSync = <T>(operationName: string, operation: (span: TracedSpan) => T, kind?: SpanKind) =>
  tracing.traceSync(operationName, operation, kind);

export const getCurrentContext = () => tracing.getCurrentContext();
export const setCurrentContext = (context: TraceContext | null) => tracing.setCurrentContext(context);

export { TracingSystem, TracedSpan };
export type { TraceContext, SpanContext, Span, Trace, LogEntry };