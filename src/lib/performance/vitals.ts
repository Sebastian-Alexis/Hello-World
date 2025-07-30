// =============================================================================
// CORE WEB VITALS MONITORING - Performance tracking and optimization
// Tracks CLS, LCP, FID, TTFB and other performance metrics
// =============================================================================

//core web vitals thresholds (in milliseconds)
const VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },      // Largest Contentful Paint
  FID: { good: 100, poor: 300 },        // First Input Delay  
  CLS: { good: 0.1, poor: 0.25 },       // Cumulative Layout Shift
  TTFB: { good: 800, poor: 1800 },      // Time to First Byte
  FCP: { good: 1800, poor: 3000 },      // First Contentful Paint
  INP: { good: 200, poor: 500 },        // Interaction to Next Paint
};

interface VitalsData {
  name: string;
  value: number;
  id: string;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  navigationType: string;
  timestamp: number;
  url: string;
  userAgent: string;
}

interface PerformanceData {
  vitals: VitalsData[];
  resources: PerformanceResourceTiming[];
  navigation: PerformanceNavigationTiming | null;
  memory?: any;
  connection?: any;
  timestamp: number;
  sessionId: string;
}

class VitalsMonitor {
  private vitalsData: VitalsData[] = [];
  private sessionId: string;
  private reportingEndpoint: string;
  private isReporting: boolean = false;

  constructor(options: {
    reportingEndpoint?: string;
    enableAutoReporting?: boolean;
    sampleRate?: number;
  } = {}) {
    this.sessionId = this.generateSessionId();
    this.reportingEndpoint = options.reportingEndpoint || '/api/vitals';
    this.isReporting = options.enableAutoReporting ?? true;

    //only initialize in browser environment
    if (typeof window !== 'undefined') {
      this.initializeVitalsTracking();
      this.trackPageVisibility();
      this.trackResourceLoading();
    }
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeVitalsTracking(): void {
    //track Core Web Vitals using web-vitals library pattern
    this.trackLCP();
    this.trackFID();
    this.trackCLS();
    this.trackTTFB();
    this.trackFCP();
    this.trackINP();
  }

  private trackLCP(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          
          if (lastEntry) {
            this.recordVital('LCP', lastEntry.startTime, lastEntry.id);
          }
        });
        
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
      } catch (error) {
        console.warn('LCP tracking failed:', error);
      }
    }
  }

  private trackFID(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.recordVital('FID', entry.processingStart - entry.startTime, entry.name);
          });
        });
        
        observer.observe({ type: 'first-input', buffered: true });
      } catch (error) {
        console.warn('FID tracking failed:', error);
      }
    }
  }

  private trackCLS(): void {
    if ('PerformanceObserver' in window) {
      try {
        let clsValue = 0;
        let clsEntries: any[] = [];
        let sessionValue = 0;
        let sessionEntries: any[] = [];

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              const firstSessionEntry = sessionEntries[0];
              const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

              //check if entry belongs to current session
              if (sessionValue && 
                  entry.startTime - lastSessionEntry.startTime < 1000 &&
                  entry.startTime - firstSessionEntry.startTime < 5000) {
                sessionValue += entry.value;
                sessionEntries.push(entry);
              } else {
                sessionValue = entry.value;
                sessionEntries = [entry];
              }

              if (sessionValue > clsValue) {
                clsValue = sessionValue;
                clsEntries = [...sessionEntries];
                
                this.recordVital('CLS', clsValue, clsEntries.map(e => e.name).join(','));
              }
            }
          }
        });
        
        observer.observe({ type: 'layout-shift', buffered: true });
      } catch (error) {
        console.warn('CLS tracking failed:', error);
      }
    }
  }

  private trackTTFB(): void {
    if ('performance' in window && 'getEntriesByType' in performance) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.responseStart > 0) {
              this.recordVital('TTFB', entry.responseStart - entry.fetchStart, entry.name);
            }
          });
        });
        
        observer.observe({ type: 'navigation', buffered: true });
      } catch (error) {
        //fallback to navigation timing
        this.trackTTFBFallback();
      }
    }
  }

  private trackTTFBFallback(): void {
    window.addEventListener('load', () => {
      const navTiming = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navTiming && navTiming.responseStart > 0) {
        const ttfb = navTiming.responseStart - navTiming.fetchStart;
        this.recordVital('TTFB', ttfb, 'navigation');
      }
    });
  }

  private trackFCP(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.name === 'first-contentful-paint') {
              this.recordVital('FCP', entry.startTime, entry.name);
            }
          });
        });
        
        observer.observe({ type: 'paint', buffered: true });
      } catch (error) {
        console.warn('FCP tracking failed:', error);
      }
    }
  }

  private trackINP(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (entry.duration) {
              this.recordVital('INP', entry.duration, entry.name);
            }
          });
        });
        
        observer.observe({ type: 'event', buffered: true });
      } catch (error) {
        console.warn('INP tracking failed:', error);
      }
    }
  }

  private recordVital(name: string, value: number, id: string): void {
    const threshold = VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS];
    let rating: 'good' | 'needs-improvement' | 'poor' = 'good';
    
    if (threshold) {
      if (value > threshold.poor) {
        rating = 'poor';
      } else if (value > threshold.good) {
        rating = 'needs-improvement';
      }
    }

    const vitalData: VitalsData = {
      name,
      value,
      id,
      delta: value, // For simplicity, using value as delta
      rating,
      navigationType: this.getNavigationType(),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    this.vitalsData.push(vitalData);

    //report immediately for poor ratings
    if (rating === 'poor' && this.isReporting) {
      this.reportVital(vitalData);
    }

    //emit custom event for external tracking
    this.emitVitalEvent(vitalData);
  }

  private getNavigationType(): string {
    if ('navigation' in performance) {
      const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return navEntry?.type || 'unknown';
    }
    return 'unknown';
  }

  private emitVitalEvent(data: VitalsData): void {
    const event = new CustomEvent('web-vital', { detail: data });
    window.dispatchEvent(event);
  }

  private trackPageVisibility(): void {
    let isHidden = document.hidden;
    
    const handleVisibilityChange = () => {
      if (isHidden && !document.hidden) {
        //page became visible, track return time
        this.recordCustomMetric('page-return', Date.now());
      }
      isHidden = document.hidden;
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    //track when user leaves page
    window.addEventListener('beforeunload', () => {
      if (this.isReporting) {
        this.sendBeacon();
      }
    });
  }

  private trackResourceLoading(): void {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries() as PerformanceResourceTiming[];
          
          //track slow loading resources
          entries.forEach(entry => {
            const loadTime = entry.responseEnd - entry.startTime;
            
            //flag resources taking longer than 2 seconds
            if (loadTime > 2000) {
              this.recordCustomMetric('slow-resource', loadTime, {
                name: entry.name,
                type: entry.initiatorType,
                size: entry.transferSize,
              });
            }
          });
        });
        
        observer.observe({ type: 'resource', buffered: true });
      } catch (error) {
        console.warn('Resource tracking failed:', error);
      }
    }
  }

  private recordCustomMetric(name: string, value: number, metadata?: any): void {
    const customData = {
      name,
      value,
      metadata,
      timestamp: Date.now(),
      url: window.location.href,
      sessionId: this.sessionId,
    };

    //emit custom event
    const event = new CustomEvent('custom-metric', { detail: customData });
    window.dispatchEvent(event);
  }

  private async reportVital(data: VitalsData): Promise<void> {
    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vital: data, sessionId: this.sessionId }),
        keepalive: true,
      });
    } catch (error) {
      console.warn('Failed to report vital:', error);
      
      //queue for service worker sync
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.controller?.postMessage({
          type: 'CACHE_ANALYTICS',
          payload: { vital: data, sessionId: this.sessionId }
        });
      }
    }
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

  private getResourceTimings(): PerformanceResourceTiming[] {
    return performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  }

  private getNavigationTiming(): PerformanceNavigationTiming | null {
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return entries[0] || null;
  }

  private getMemoryInfo(): any {
    return (performance as any).memory || null;
  }

  private getConnectionInfo(): any {
    return (navigator as any).connection || null;
  }

  //public API methods
  public getVitalsData(): VitalsData[] {
    return [...this.vitalsData];
  }

  public getPerformanceSummary(): {
    vitals: Record<string, { value: number; rating: string }>;
    overallScore: number;
  } {
    const summary: Record<string, { value: number; rating: string }> = {};
    let totalScore = 0;
    let metricCount = 0;

    this.vitalsData.forEach(vital => {
      if (!summary[vital.name]) {
        summary[vital.name] = { value: vital.value, rating: vital.rating };
        
        //calculate score (good=100, needs-improvement=50, poor=0)
        const score = vital.rating === 'good' ? 100 : 
                     vital.rating === 'needs-improvement' ? 50 : 0;
        totalScore += score;
        metricCount++;
      }
    });

    return {
      vitals: summary,
      overallScore: metricCount > 0 ? Math.round(totalScore / metricCount) : 0,
    };
  }

  public enableReporting(endpoint?: string): void {
    this.isReporting = true;
    if (endpoint) {
      this.reportingEndpoint = endpoint;
    }
  }

  public disableReporting(): void {
    this.isReporting = false;
  }

  public clearData(): void {
    this.vitalsData = [];
  }
}

//singleton instance
export const vitalsMonitor = new VitalsMonitor({
  enableAutoReporting: true,
  sampleRate: 1.0, // Report all metrics in development
});

//helper functions for performance optimization
export const performanceUtils = {
  /**
   * Measure and log performance of async operations
   */
  async measureAsync<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    
    try {
      const result = await operation();
      const duration = performance.now() - start;
      
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
      
      //record custom metric
      vitalsMonitor['recordCustomMetric']('operation-timing', duration, { operation: name });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.warn(`Performance: ${name} failed after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
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
   * Get performance recommendations
   */
  getRecommendations(): string[] {
    const summary = vitalsMonitor.getPerformanceSummary();
    const recommendations: string[] = [];
    
    Object.entries(summary.vitals).forEach(([metric, data]) => {
      if (data.rating === 'poor') {
        switch (metric) {
          case 'LCP':
            recommendations.push('Optimize images and critical resources for faster loading');
            recommendations.push('Consider using a CDN for better content delivery');
            break;
          case 'FID':
            recommendations.push('Reduce JavaScript execution time');
            recommendations.push('Break up long-running tasks');
            break;
          case 'CLS':
            recommendations.push('Set explicit dimensions for images and ads');
            recommendations.push('Avoid inserting content above existing content');
            break;
          case 'TTFB':
            recommendations.push('Optimize server response time');
            recommendations.push('Use caching to improve response speed');
            break;
        }
      }
    });
    
    if (summary.overallScore < 70) {
      recommendations.push('Consider implementing service worker for caching');
      recommendations.push('Optimize bundle size and use code splitting');
    }
    
    return recommendations;
  },
};

//initialize vitals monitoring automatically
if (typeof window !== 'undefined') {
  //wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('Core Web Vitals monitoring initialized');
    });
  } else {
    console.log('Core Web Vitals monitoring initialized');
  }
}