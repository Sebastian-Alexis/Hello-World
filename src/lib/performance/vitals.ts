// =============================================================================
// ENHANCED PERFORMANCE TRACKER - Plan 7 Implementation
// Advanced Core Web Vitals tracking with real user metrics, regression detection,
// and comprehensive performance monitoring capabilities
// =============================================================================

import { onCLS, onFCP, onLCP, onTTFB, onINP, type Metric } from 'web-vitals';
import { fontOptimizer, fontUtils } from './font-optimization.js';

//core web vitals thresholds (in milliseconds/units)
const VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint (ms)
  FID: { good: 100, poor: 300 },        // First Input Delay (ms)
  CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift (unitless)
  TTFB: { good: 800, poor: 1800 },      // Time to First Byte (ms)
  FCP: { good: 1800, poor: 3000 },      // First Contentful Paint (ms)
  INP: { good: 200, poor: 500 },        // Interaction to Next Paint (ms)
};

//performance budgets for regression detection
const PERFORMANCE_BUDGETS = {
  LCP: 2500,     // ms
  FID: 100,      // ms
  CLS: 0.1,      // unitless
  TTFB: 800,     // ms
  FCP: 1800,     // ms
  INP: 200,      // ms
  MEMORY_USAGE: 70,  // percentage
  RESOURCE_SIZE: 2048,  // KB
  JS_BUNDLE_SIZE: 100,  // KB
  FONT_LOAD_TIME: 200,   // ms - budget for font loading
  FONT_CLS_RISK: 0,      // should be 0 (low risk only)
  FONT_FALLBACK_RATE: 10, // percentage - acceptable fallback usage
};

interface EnhancedVitalsData extends Omit<Metric, 'entries'> {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: string;
  timestamp: number;
  url: string;
  userAgent: string;
  connectionType?: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  sessionId: string;
  userId?: string;
  pageLoadTime?: number;
  domContentLoadedTime?: number;
  entries?: any[];
}

interface ResourceMetric {
  name: string;
  type: string;
  size: number;
  duration: number;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  initiatorType: string;
  timestamp: number;
  isCritical: boolean;
}

interface MemoryMetric {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
  timestamp: number;
}

interface UserInteractionMetric {
  interactionType: string;
  target: string;
  startTime: number;
  processingTime: number;
  presentationTime: number;
  duration: number;
  timestamp: number;
}

interface PerformanceAlert {
  metric: string;
  value: number;
  threshold: number;
  severity: 'warning' | 'critical';
  url: string;
  timestamp: number;
  sessionId: string;
  userId?: string;
}

interface PerformanceData {
  vitals: EnhancedVitalsData[];
  resources: ResourceMetric[];
  navigation: PerformanceNavigationTiming | null;
  memory: MemoryMetric[];
  userInteractions: UserInteractionMetric[];
  connection?: any;
  timestamp: number;
  sessionId: string;
  userId?: string;
  pageUrl: string;
  referrer: string;
  deviceInfo: {
    userAgent: string;
    viewport: { width: number; height: number };
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connectionType?: string;
  };
  performanceScore: number;
  regressions: PerformanceAlert[];
}

class PerformanceTracker {
  private vitalsData: EnhancedVitalsData[] = [];
  private resourceMetrics: ResourceMetric[] = [];
  private memoryMetrics: MemoryMetric[] = [];
  private userInteractions: UserInteractionMetric[] = [];
  private alerts: PerformanceAlert[] = [];
  private sessionId: string;
  private userId?: string;
  private reportingEndpoint: string;
  private dashboardEndpoint: string;
  private isReporting: boolean = false;
  private isOnline: boolean = true;
  private retryQueue: any[] = [];
  private performanceObserver?: PerformanceObserver;
  private memoryMonitorInterval?: NodeJS.Timeout;
  private baselineMetrics: Record<string, number> = {};
  private isInitialized: boolean = false;
  private fontOptimizer?: typeof fontOptimizer;

  constructor(options: {
    reportingEndpoint?: string;
    dashboardEndpoint?: string;
    enableAutoReporting?: boolean;
    sampleRate?: number;
    userId?: string;
    enableRegressionDetection?: boolean;
    enableMemoryMonitoring?: boolean;
    enableUserInteractionTracking?: boolean;
  } = {}) {
    this.sessionId = this.generateSessionId();
    this.userId = options.userId;
    this.reportingEndpoint = options.reportingEndpoint || '/api/analytics/performance';
    this.dashboardEndpoint = options.dashboardEndpoint || '/api/analytics/dashboard';
    this.isReporting = options.enableAutoReporting ?? true;

    //only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.initializeEnhancedTracking(options);
      this.setupNetworkDetection();
      this.setupRetryMechanism();
      this.loadBaselineMetrics();
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private async initializeEnhancedTracking(options: any): Promise<void> {
    if (this.isInitialized) return;
    
    try {
      //initialize Core Web Vitals with web-vitals library
      this.initializeWebVitalsTracking();
      
      //initialize additional tracking systems
      this.trackPageVisibility();
      this.trackResourceLoading();
      
      if (options.enableMemoryMonitoring !== false) {
        this.startMemoryMonitoring();
      }
      
      if (options.enableUserInteractionTracking !== false) {
        this.trackUserInteractions();
      }
      
      //initialize font optimization tracking
      this.initializeFontOptimization();
      
      //setup periodic reporting
      setInterval(() => this.sendMetricsIfReady(), 30000);
      
      //setup page unload handler
      window.addEventListener('beforeunload', () => this.handlePageUnload());
      
      this.isInitialized = true;
      console.log('Enhanced Performance Tracker initialized');
    } catch (error) {
      console.error('Failed to initialize performance tracking:', error);
    }
  }

  private initializeWebVitalsTracking(): void {
    //use official web-vitals library for accurate measurements
    onCLS(this.handleWebVital.bind(this), { reportAllChanges: true });
    onFCP(this.handleWebVital.bind(this));
    onLCP(this.handleWebVital.bind(this), { reportAllChanges: true });
    onTTFB(this.handleWebVital.bind(this));
    onINP(this.handleWebVital.bind(this), { reportAllChanges: true });
  }

  private handleWebVital(metric: Metric): void {
    const enhancedMetric: EnhancedVitalsData = {
      ...metric,
      rating: this.getRating(metric.name, metric.value),
      navigationType: this.getNavigationType(),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: this.getConnectionType(),
      deviceMemory: (navigator as any).deviceMemory,
      hardwareConcurrency: navigator.hardwareConcurrency,
      sessionId: this.sessionId,
      userId: this.userId,
      pageLoadTime: this.getPageLoadTime(),
      domContentLoadedTime: this.getDOMContentLoadedTime(),
      entries: metric.entries as any[]
    };

    this.vitalsData.push(enhancedMetric);
    
    //check for regressions and alerts
    this.checkForRegressions(enhancedMetric);
    
    //emit custom event for external listeners
    this.emitVitalEvent(enhancedMetric);
    
    //report critical metrics immediately
    if (enhancedMetric.rating === 'poor' || this.isCriticalMetric(metric.name)) {
      this.sendMetricsIfReady();
    }
  }

  private initializeFontOptimization(): void {
    try {
      //use the singleton font optimizer instance
      this.fontOptimizer = fontOptimizer;

      //listen for font optimization events
      window.addEventListener('fontOptimizationComplete', (event: any) => {
        const { loadTime, usedFont } = event.detail;
        
        //track font loading performance
        this.trackCustomMetric('font-optimization-load-time', loadTime);
        
        //track if fallback was used
        if (usedFont !== 'Courier New') {
          this.trackCustomMetric('font-fallback-active', 1, 'needs-improvement');
        }
        
        //get cls risk assessment
        if (this.fontOptimizer) {
          const assessment = this.fontOptimizer.getCLSRiskAssessment();
          if (assessment.overallRisk !== 'low') {
            this.trackCustomMetric('font-cls-risk', assessment.overallRisk === 'high' ? 2 : 1, 'poor');
          }
        }
      });
      
    } catch (error) {
      console.warn('font optimization initialization failed:', error);
    }
  }

  private setupNetworkDetection(): void {
    this.isOnline = navigator.onLine;
    
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processRetryQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  private setupRetryMechanism(): void {
    //process retry queue every 30 seconds when online
    setInterval(() => {
      if (this.isOnline && this.retryQueue.length > 0) {
        this.processRetryQueue();
      }
    }, 30000);
  }

  private async processRetryQueue(): Promise<void> {
    const queue = [...this.retryQueue];
    this.retryQueue = [];
    
    for (const item of queue) {
      try {
        await this.sendToEndpoint(item.endpoint, item.data);
      } catch (error) {
        //re-queue if still failing
        if (this.retryQueue.length < 50) { // max queue size
          this.retryQueue.push(item);
        }
      }
    }
  }

  private async loadBaselineMetrics(): Promise<void> {
    try {
      const response = await fetch('/api/analytics/baseline');
      if (response.ok) {
        this.baselineMetrics = await response.json();
      }
    } catch (error) {
      //use default baselines if API fails
      this.baselineMetrics = { ...PERFORMANCE_BUDGETS };
    }
  }

  private checkForRegressions(metric: EnhancedVitalsData): void {
    const baseline = this.baselineMetrics[metric.name] || PERFORMANCE_BUDGETS[metric.name as keyof typeof PERFORMANCE_BUDGETS];
    
    if (baseline && metric.value > baseline * 1.2) { // 20% regression threshold
      const alert: PerformanceAlert = {
        metric: metric.name,
        value: metric.value,
        threshold: baseline,
        severity: metric.value > baseline * 1.5 ? 'critical' : 'warning',
        url: metric.url,
        timestamp: metric.timestamp,
        sessionId: this.sessionId,
        userId: this.userId
      };
      
      this.alerts.push(alert);
      this.sendAlert(alert);
    }
  }

  private async sendAlert(alert: PerformanceAlert): Promise<void> {
    try {
      await this.sendToEndpoint('/api/analytics/alerts', { alert });
      console.warn('Performance regression detected:', alert);
    } catch (error) {
      console.error('Failed to send performance alert:', error);
    }
  }

  private startMemoryMonitoring(): void {
    if (!(performance as any).memory) return;
    
    const trackMemory = () => {
      const memory = (performance as any).memory;
      const memoryMetric: MemoryMetric = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        timestamp: Date.now()
      };
      
      this.memoryMetrics.push(memoryMetric);
      
      //alert on high memory usage
      if (memoryMetric.usagePercentage > 80) {
        const alert: PerformanceAlert = {
          metric: 'MEMORY_USAGE',
          value: memoryMetric.usagePercentage,
          threshold: 80,
          severity: memoryMetric.usagePercentage > 90 ? 'critical' : 'warning',
          url: window.location.href,
          timestamp: Date.now(),
          sessionId: this.sessionId,
          userId: this.userId
        };
        
        this.alerts.push(alert);
        this.sendAlert(alert);
      }
      
      //keep only last 50 memory readings
      if (this.memoryMetrics.length > 50) {
        this.memoryMetrics = this.memoryMetrics.slice(-50);
      }
    };
    
    //track memory every 5 seconds
    this.memoryMonitorInterval = setInterval(trackMemory, 5000);
    trackMemory(); // initial reading
  }

  private trackUserInteractions(): void {
    const interactionTypes = ['click', 'keydown', 'touchstart'];
    
    interactionTypes.forEach(type => {
      document.addEventListener(type, (event) => {
        const startTime = performance.now();
        
        //use requestIdleCallback to measure processing time
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            const processingTime = performance.now() - startTime;
            
            const interaction: UserInteractionMetric = {
              interactionType: type,
              target: this.getElementSelector(event.target as Element),
              startTime,
              processingTime,
              presentationTime: performance.now(),
              duration: processingTime,
              timestamp: Date.now()
            };
            
            this.userInteractions.push(interaction);
            
            //alert on slow interactions
            if (processingTime > 100) {
              const alert: PerformanceAlert = {
                metric: 'SLOW_INTERACTION',
                value: processingTime,
                threshold: 100,
                severity: processingTime > 300 ? 'critical' : 'warning',
                url: `${window.location.href}#${interaction.target}`,
                timestamp: Date.now(),
                sessionId: this.sessionId,
                userId: this.userId
              };
              
              this.alerts.push(alert);
            }
            
            //keep only last 100 interactions
            if (this.userInteractions.length > 100) {
              this.userInteractions = this.userInteractions.slice(-100);
            }
          });
        }
      }, { passive: true });
    });
  }

  private getElementSelector(element: Element): string {
    if (!element) return 'unknown';
    
    if (element.id) return `#${element.id}`;
    if (element.className) return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  private isCriticalMetric(metricName: string): boolean {
    return ['LCP', 'FID', 'CLS'].includes(metricName);
  }

  private getPageLoadTime(): number {
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navTiming ? navTiming.loadEventEnd - navTiming.fetchStart : 0;
  }

  private getDOMContentLoadedTime(): number {
    const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return navTiming ? navTiming.domContentLoadedEventEnd - navTiming.fetchStart : 0;
  }

  private trackResourceLoading(): void {
    if (!('PerformanceObserver' in window)) return;
    
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceResourceTiming[];
        
        entries.forEach(entry => {
          const resourceMetric: ResourceMetric = {
            name: entry.name,
            type: this.getResourceType(entry.name),
            size: entry.transferSize || 0,
            duration: entry.responseEnd - entry.startTime,
            transferSize: entry.transferSize || 0,
            encodedBodySize: entry.encodedBodySize || 0,
            decodedBodySize: entry.decodedBodySize || 0,
            initiatorType: entry.initiatorType,
            timestamp: Date.now(),
            isCritical: this.isCriticalResource(entry.name)
          };
          
          this.resourceMetrics.push(resourceMetric);
          
          //alert on slow resources
          if (resourceMetric.duration > 3000 || resourceMetric.size > 2048 * 1024) {
            const alert: PerformanceAlert = {
              metric: resourceMetric.duration > 3000 ? 'SLOW_RESOURCE' : 'LARGE_RESOURCE',
              value: resourceMetric.duration > 3000 ? resourceMetric.duration : resourceMetric.size,
              threshold: resourceMetric.duration > 3000 ? 3000 : 2048 * 1024,
              severity: 'warning',
              url: resourceMetric.name,
              timestamp: Date.now(),
              sessionId: this.sessionId,
              userId: this.userId
            };
            
            this.alerts.push(alert);
          }
        });
        
        //keep only last 200 resource metrics
        if (this.resourceMetrics.length > 200) {
          this.resourceMetrics = this.resourceMetrics.slice(-200);
        }
      });
      
      this.performanceObserver.observe({ type: 'resource', buffered: true });
    } catch (error) {
      console.warn('Resource tracking failed:', error);
    }
  }

  private getResourceType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension)) return 'image';
    if (['js', 'mjs'].includes(extension)) return 'script';
    if (['css'].includes(extension)) return 'stylesheet';
    if (['woff', 'woff2', 'ttf', 'otf'].includes(extension)) return 'font';
    if (['mp4', 'webm', 'ogg'].includes(extension)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(extension)) return 'audio';
    
    return 'other';
  }

  private isCriticalResource(url: string): boolean {
    //consider resources critical if they're CSS, fonts, or above-the-fold images
    const type = this.getResourceType(url);
    return ['stylesheet', 'font'].includes(type) || url.includes('critical');
  }

  private calculatePerformanceScore(): number {
    if (this.vitalsData.length === 0) return 100;
    
    const weights = {
      LCP: 25,
      FID: 25,
      CLS: 25,
      TTFB: 10,
      FCP: 10,
      INP: 5
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    this.vitalsData.forEach(vital => {
      const weight = weights[vital.name as keyof typeof weights] || 0;
      if (weight > 0) {
        const score = vital.rating === 'good' ? 100 : 
                     vital.rating === 'needs-improvement' ? 50 : 0;
        totalScore += score * weight;
        totalWeight += weight;
      }
    });
    
    return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 100;
  }

  private async sendMetricsIfReady(): Promise<void> {
    if (!this.isReporting || 
        (this.vitalsData.length === 0 && this.resourceMetrics.length === 0 && 
         this.memoryMetrics.length === 0 && this.userInteractions.length === 0)) {
      return;
    }
    
    const performanceData: PerformanceData = {
      vitals: [...this.vitalsData],
      resources: [...this.resourceMetrics],
      navigation: this.getNavigationTiming(),
      memory: [...this.memoryMetrics],
      userInteractions: [...this.userInteractions],
      connection: this.getConnectionInfo(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
      userId: this.userId,
      pageUrl: window.location.href,
      referrer: document.referrer,
      deviceInfo: {
        userAgent: navigator.userAgent,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        deviceMemory: (navigator as any).deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
        connectionType: this.getConnectionType()
      },
      performanceScore: this.calculatePerformanceScore(),
      regressions: [...this.alerts]
    };
    
    try {
      await this.sendToEndpoint(this.reportingEndpoint, performanceData);
      
      //clear sent data
      this.vitalsData = [];
      this.resourceMetrics = [];
      this.memoryMetrics = [];
      this.userInteractions = [];
      this.alerts = [];
    } catch (error) {
      console.warn('Failed to send performance metrics:', error);
      
      //queue for retry if offline
      if (!this.isOnline && this.retryQueue.length < 50) {
        this.retryQueue.push({
          endpoint: this.reportingEndpoint,
          data: performanceData
        });
      }
    }
  }

  private async sendToEndpoint(endpoint: string, data: any): Promise<void> {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private handlePageUnload(): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    //send final metrics using sendBeacon
    this.sendBeacon();
  }

  private getNavigationType(): string {
    if ('navigation' in performance) {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navEntry?.type || 'unknown';
    }
    return 'unknown';
  }

  private emitVitalEvent(data: EnhancedVitalsData): void {
    const event = new CustomEvent('web-vital', { detail: data });
    window.dispatchEvent(event);
    
    //also emit performance event for dashboard integration
    const performanceEvent = new CustomEvent('performance-update', {
      detail: {
        metric: data,
        score: this.calculatePerformanceScore(),
        alerts: this.alerts.length
      }
    });
    window.dispatchEvent(performanceEvent);
  }

  private trackPageVisibility(): void {
    let isHidden = document.hidden;
    let visibilityStartTime = Date.now();
    
    const handleVisibilityChange = () => {
      const now = Date.now();
      
      if (isHidden && !document.hidden) {
        //page became visible, track return time
        this.recordCustomMetric('page-return', now);
        visibilityStartTime = now;
      } else if (!isHidden && document.hidden) {
        //page became hidden, track visibility duration
        const visibilityDuration = now - visibilityStartTime;
        this.recordCustomMetric('page-visibility-duration', visibilityDuration);
      }
      
      isHidden = document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  private recordCustomMetric(name: string, value: number, metadata?: any): void {
    const customData = {
      name: `CUSTOM_${name.toUpperCase()}`,
      value,
      metadata,
      timestamp: Date.now(),
      url: window.location.href,
      sessionId: this.sessionId,
      userId: this.userId
    };

    //emit custom event
    const event = new CustomEvent('custom-metric', { detail: customData });
    window.dispatchEvent(event);
  }


  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const threshold = VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS];
    if (!threshold) return 'good';
    
    if (value > threshold.poor) return 'poor';
    if (value > threshold.good) return 'needs-improvement';
    return 'good';
  }


  private sendBeacon(): void {
    if (this.vitalsData.length === 0) return;

    const payload: PerformanceData = {
      vitals: this.vitalsData,
      resources: this.getResourceTimings(),
      navigation: this.getNavigationTiming(),
      memory: this.getMemoryInfo(),
      connection: this.getConnectionInfo(),
      timestamp: Date.now(),
      sessionId: this.sessionId,
    };

    //use sendBeacon for reliable delivery
    if ('sendBeacon' in navigator) {
      navigator.sendBeacon(this.reportingEndpoint, JSON.stringify(payload));
    } else {
      //fallback for older browsers
      fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {}); // Ignore errors on page unload
    }
  }


  //public API methods for external usage
  public setUserId(userId: string): void {
    this.userId = userId;
  }

  public trackCustomMetric(name: string, value: number, rating?: 'good' | 'needs-improvement' | 'poor'): void {
    this.recordCustomMetric(name, value, { rating });
  }

  public trackUserInteraction(action: string, duration: number, target?: string): void {
    const interaction: UserInteractionMetric = {
      interactionType: action,
      target: target || 'unknown',
      startTime: performance.now() - duration,
      processingTime: duration,
      presentationTime: performance.now(),
      duration,
      timestamp: Date.now()
    };
    
    this.userInteractions.push(interaction);
  }

  public async measureAsyncOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      this.recordCustomMetric(`async-operation-${name}`, duration);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordCustomMetric(`async-operation-${name}-error`, duration);
      throw error;
    }
  }

  public forceMetricsSend(): Promise<void> {
    return this.sendMetricsIfReady();
  }

  public getVitalsData(): EnhancedVitalsData[] {
    return [...this.vitalsData];
  }

  public getResourceMetrics(): ResourceMetric[] {
    return [...this.resourceMetrics];
  }

  public getMemoryMetrics(): MemoryMetric[] {
    return [...this.memoryMetrics];
  }

  public getUserInteractions(): UserInteractionMetric[] {
    return [...this.userInteractions];
  }

  public getAlerts(): PerformanceAlert[] {
    return [...this.alerts];
  }

  public getPerformanceSummary(): {
    vitals: Record<string, { value: number; rating: string; timestamp: number }>;
    overallScore: number;
    resourceCount: number;
    memoryUsage: number;
    alertCount: number;
    sessionDuration: number;
  } {
    const summary: Record<string, { value: number; rating: string; timestamp: number }> = {};
    
    //get latest value for each vital
    this.vitalsData.forEach(vital => {
      if (!summary[vital.name] || vital.timestamp > summary[vital.name].timestamp) {
        summary[vital.name] = { 
          value: vital.value, 
          rating: vital.rating,
          timestamp: vital.timestamp
        };
      }
    });

    const latestMemory = this.memoryMetrics[this.memoryMetrics.length - 1];
    const sessionDuration = Date.now() - parseInt(this.sessionId.split('-')[1]);

    return {
      vitals: summary,
      overallScore: this.calculatePerformanceScore(),
      resourceCount: this.resourceMetrics.length,
      memoryUsage: latestMemory?.usagePercentage || 0,
      alertCount: this.alerts.length,
      sessionDuration
    };
  }

  public enableReporting(endpoint?: string, dashboardEndpoint?: string): void {
    this.isReporting = true;
    if (endpoint) {
      this.reportingEndpoint = endpoint;
    }
    if (dashboardEndpoint) {
      this.dashboardEndpoint = dashboardEndpoint;
    }
  }

  public disableReporting(): void {
    this.isReporting = false;
  }

  public clearAllData(): void {
    this.vitalsData = [];
    this.resourceMetrics = [];
    this.memoryMetrics = [];
    this.userInteractions = [];
    this.alerts = [];
  }

  public setBaselineMetrics(baselines: Record<string, number>): void {
    this.baselineMetrics = { ...this.baselineMetrics, ...baselines };
  }

  public getSessionId(): string {
    return this.sessionId;
  }

  public destroy(): void {
    this.isReporting = false;
    
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    
    this.clearAllData();
  }
}

//create enhanced performance tracker instance
export const performanceTracker = new PerformanceTracker({
  enableAutoReporting: true,
  enableRegressionDetection: true,
  enableMemoryMonitoring: true,
  enableUserInteractionTracking: true
});

//backward compatibility
export const vitalsMonitor = performanceTracker;

//enhanced performance utilities
export const performanceUtils = {
  /**
   * Measure and log performance of async operations with enhanced tracking
   */
  async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    return performanceTracker.measureAsyncOperation(name, operation);
  },

  /**
   * Track custom business metrics
   */
  trackBusinessMetric(name: string, value: number, metadata?: any): void {
    performanceTracker.trackCustomMetric(`business-${name}`, value);
    
    if (metadata) {
      console.log(`Business Metric: ${name} = ${value}`, metadata);
    }
  },

  /**
   * Measure DOM manipulation performance
   */
  measureDOMOperation(name: string, operation: () => void): number {
    const start = performance.now();
    operation();
    const duration = performance.now() - start;
    
    performanceTracker.trackCustomMetric(`dom-${name}`, duration);
    
    if (duration > 16) { // Over one frame at 60fps
      console.warn(`Slow DOM operation: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  },

  /**
   * Debounce function for performance
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate?: boolean
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;
    
    return function executedFunction(...args: Parameters<T>) {
      const later = () => {
        timeout = null;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func(...args);
    };
  },

  /**
   * Throttle function for performance
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return function executedFunction(...args: Parameters<T>) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  /**
   * Defer execution until browser is idle
   */
  requestIdleCallback(callback: () => void, timeout = 5000): void {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(callback, { timeout });
    } else {
      //fallback for browsers without requestIdleCallback
      setTimeout(callback, 1);
    }
  },

  /**
   * Preload critical resources
   */
  preloadResource(url: string, type: 'script' | 'style' | 'image' | 'font'): void {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = url;
    
    switch (type) {
      case 'script':
        link.as = 'script';
        break;
      case 'style':
        link.as = 'style';
        break;
      case 'image':
        link.as = 'image';
        break;
      case 'font':
        link.as = 'font';
        link.crossOrigin = 'anonymous';
        break;
    }
    
    document.head.appendChild(link);
  },

  /**
   * Get detailed performance recommendations based on current metrics
   */
  getRecommendations(): {
    critical: string[];
    important: string[];
    minor: string[];
    score: number;
  } {
    const summary = performanceTracker.getPerformanceSummary();
    const alerts = performanceTracker.getAlerts();
    const recommendations = {
      critical: [] as string[],
      important: [] as string[],
      minor: [] as string[],
      score: summary.overallScore
    };
    
    //analyze core web vitals
    Object.entries(summary.vitals).forEach(([metric, data]) => {
      const category = data.rating === 'poor' ? 'critical' : 
                      data.rating === 'needs-improvement' ? 'important' : 'minor';
      
      switch (metric) {
        case 'LCP':
          if (data.rating !== 'good') {
            recommendations[category].push(
              data.value > 4000 ? 
              'Critical: LCP is very slow. Optimize critical resources and consider CDN' :
              'Improve LCP by optimizing images and preloading critical resources'
            );
          }
          break;
        case 'FID':
          if (data.rating !== 'good') {
            recommendations[category].push(
              'Reduce JavaScript execution time and break up long tasks'
            );
          }
          break;
        case 'CLS':
          if (data.rating !== 'good') {
            recommendations[category].push(
              'Fix layout shifts by setting dimensions for images and avoiding DOM insertion'
            );
          }
          break;
        case 'TTFB':
          if (data.rating !== 'good') {
            recommendations[category].push(
              'Optimize server response time and implement caching'
            );
          }
          break;
        case 'INP':
          if (data.rating !== 'good') {
            recommendations[category].push(
              'Improve interaction responsiveness by optimizing event handlers'
            );
          }
          break;
      }
    });
    
    //analyze memory usage
    if (summary.memoryUsage > 80) {
      recommendations.critical.push('High memory usage detected - investigate memory leaks');
    } else if (summary.memoryUsage > 60) {
      recommendations.important.push('Monitor memory usage - consider optimization');
    }
    
    //analyze alerts
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    if (criticalAlerts > 0) {
      recommendations.critical.push(`${criticalAlerts} critical performance issues detected`);
    }
    
    //overall score recommendations
    if (summary.overallScore < 50) {
      recommendations.critical.push('Overall performance is poor - immediate optimization needed');
      recommendations.critical.push('Consider performance audit and major optimizations');
    } else if (summary.overallScore < 80) {
      recommendations.important.push('Performance could be improved with targeted optimizations');
    }
    
    return recommendations;
  },

  /**
   * Create performance budget checker
   */
  createBudgetChecker(budgets: Record<string, number>) {
    return {
      check(): { passed: boolean; violations: string[] } {
        const summary = performanceTracker.getPerformanceSummary();
        const violations: string[] = [];
        
        Object.entries(budgets).forEach(([metric, budget]) => {
          const vital = summary.vitals[metric];
          if (vital && vital.value > budget) {
            violations.push(`${metric}: ${vital.value} > ${budget} (budget)`);
          }
        });
        
        return {
          passed: violations.length === 0,
          violations
        };
      }
    };
  },

  /**
   * Setup performance monitoring for specific components
   */
  monitorComponent(componentName: string) {
    const startTime = performance.now();
    
    return {
      markRender(): void {
        const renderTime = performance.now() - startTime;
        performanceTracker.trackCustomMetric(`component-render-${componentName}`, renderTime);
      },
      
      markMount(): void {
        const mountTime = performance.now() - startTime;
        performanceTracker.trackCustomMetric(`component-mount-${componentName}`, mountTime);
      },
      
      markUnmount(): void {
        const totalTime = performance.now() - startTime;
        performanceTracker.trackCustomMetric(`component-lifecycle-${componentName}`, totalTime);
      }
    };
  }
};

//export font validation utilities
export { fontValidator, fontValidationUtils };

//export types for external usage
export type {
  EnhancedVitalsData,
  ResourceMetric,
  MemoryMetric,
  UserInteractionMetric,
  PerformanceAlert,
  PerformanceData
};

//export main class
export { PerformanceTracker };

//integrate font performance validation
import { fontValidator, fontValidationUtils } from './font-performance-validator';

//global performance monitoring setup
if (typeof window !== 'undefined') {
  //listen for font validation events
  window.addEventListener('font-validation-complete', (event: any) => {
    const validationResult = event.detail.result;
    
    //track font performance as custom metrics
    performanceTracker.trackCustomMetric('font-load-time', validationResult.metrics.fontLoadTime);
    performanceTracker.trackCustomMetric('font-cls-impact', validationResult.metrics.fontCLSImpact);
    
    //create alert if validation failed
    if (!validationResult.passed) {
      const alert = {
        metric: 'FONT_PERFORMANCE',
        value: validationResult.score,
        threshold: 85, //minimum acceptable score
        severity: validationResult.score < 50 ? 'critical' : 'warning',
        url: window.location.href,
        timestamp: Date.now(),
        sessionId: performanceTracker.getSessionId(),
        details: validationResult.violations
      };
      
      console.warn('font performance validation failed:', alert);
    }
  });
  
  //start continuous font validation
  fontValidator.startContinuousValidation(60000); //every minute
  //monitor long tasks
  if ('PerformanceObserver' in window) {
    const longTaskObserver = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.duration > 50) {
          performanceTracker.trackCustomMetric('long-task', entry.duration);
          console.warn(`Long task detected: ${entry.duration.toFixed(2)}ms`);
        }
      });
    });
    
    try {
      longTaskObserver.observe({ type: 'longtask', buffered: true });
    } catch (error) {
      //longtask observer not supported
    }
  }
  
  //monitor unhandled errors that might impact performance
  window.addEventListener('error', (event) => {
    performanceTracker.trackCustomMetric('js-error', 1, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno
    });
  });
  
  //monitor unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    performanceTracker.trackCustomMetric('promise-rejection', 1, {
      reason: event.reason?.toString?.()
    });
  });
  
  //initialize enhanced performance tracking automatically
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Enhanced Performance Tracker initialized');
    });
  } else {
    console.log('Enhanced Performance Tracker initialized');
  }
  
  //add performance debugging in development
  if (import.meta.env?.DEV) {
    (window as any).performanceTracker = performanceTracker;
    (window as any).performanceUtils = performanceUtils;
  }
}