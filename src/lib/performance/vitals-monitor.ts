// =============================================================================
// CORE WEB VITALS MONITOR - Advanced performance monitoring and optimization
// Provides comprehensive tracking of Core Web Vitals with image-specific metrics
// =============================================================================

//core web vitals thresholds (Google's recommended values)
export const VITALS_THRESHOLDS = {
  LCP: { good: 2500, needsImprovement: 4000 }, // Largest Contentful Paint
  FID: { good: 100, needsImprovement: 300 },   // First Input Delay
  CLS: { good: 0.1, needsImprovement: 0.25 },  // Cumulative Layout Shift
  INP: { good: 200, needsImprovement: 500 },   // Interaction to Next Paint
  FCP: { good: 1800, needsImprovement: 3000 }, // First Contentful Paint
  TTFB: { good: 800, needsImprovement: 1800 }, // Time to First Byte
} as const;

//image-specific performance metrics
export const IMAGE_METRICS = {
  LOAD_TIME: { good: 1000, needsImprovement: 2500 },      // Image load time
  LCP_CONTRIBUTION: { good: 0.8, needsImprovement: 1.2 }, // LCP element ratio
  LAYOUT_SHIFT: { good: 0.05, needsImprovement: 0.15 },   // Image-caused CLS
  VIEWPORT_ENTRY: { good: 100, needsImprovement: 500 },   // Time to enter viewport
  DECODE_TIME: { good: 50, needsImprovement: 200 },       // Image decode time
} as const;

//performance metric interfaces
export interface VitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  entries: PerformanceEntry[];
  id: string;
  navigationType: string;
  timestamp: number;
}

export interface ImagePerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  metadata: {
    src: string;
    width?: number;
    height?: number;
    format?: string;
    isLCP?: boolean;
    loadingStrategy?: string;
    intersectionRatio?: number;
    [key: string]: any;
  };
  timestamp: number;
}

export interface PerformanceSnapshot {
  url: string;
  timestamp: number;
  vitals: Record<string, VitalsMetric>;
  imageMetrics: ImagePerformanceMetric[];
  networkInfo: NetworkInformation;
  deviceInfo: DeviceInformation;
  cumulativeScores: {
    overallRating: 'good' | 'needs-improvement' | 'poor';
    lcpScore: number;
    fidScore: number;
    clsScore: number;
    imageOptimizationScore: number;
  };
}

export interface NetworkInformation {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
}

export interface DeviceInformation {
  deviceMemory: number;
  hardwareConcurrency: number;
  maxTouchPoints: number;
  userAgent: string;
  viewport: { width: number; height: number };
  pixelRatio: number;
}

//advanced performance monitoring class
export class VitalsMonitor {
  private metrics: Map<string, VitalsMetric> = new Map();
  private imageMetrics: ImagePerformanceMetric[] = [];
  private observers: Set<PerformanceObserver> = new Set();
  private callbacks: Set<(metric: VitalsMetric | ImagePerformanceMetric) => void> = new Set();
  private isInitialized = false;
  private reportingEndpoint?: string;
  private reportingBatch: any[] = [];
  private reportingTimer?: number;

  constructor(options: {
    reportingEndpoint?: string;
    batchSize?: number;
    batchTimeout?: number;
    enableImageTracking?: boolean;
    enableNetworkTracking?: boolean;
  } = {}) {
    this.reportingEndpoint = options.reportingEndpoint;
    
    if (typeof window !== 'undefined') {
      this.initialize(options);
    }
  }

  //initialize performance monitoring
  private initialize(options: any): void {
    if (this.isInitialized) return;
    
    try {
      //setup core web vitals monitoring
      this.setupLCPMonitoring();
      this.setupFIDMonitoring();
      this.setupCLSMonitoring();
      this.setupINPMonitoring();
      this.setupFCPMonitoring();
      this.setupTTFBMonitoring();
      
      //setup image-specific monitoring
      if (options.enableImageTracking !== false) {
        this.setupImagePerformanceMonitoring();
      }
      
      //setup network monitoring
      if (options.enableNetworkTracking !== false) {
        this.setupNetworkMonitoring();
      }
      
      //setup automatic reporting
      if (this.reportingEndpoint) {
        this.setupBatchReporting(options.batchSize || 10, options.batchTimeout || 5000);
      }
      
      //track page visibility changes
      this.setupVisibilityTracking();
      
      this.isInitialized = true;
      
      if (options.verbose) {
        console.log('📊 Core Web Vitals monitoring initialized');
      }
      
    } catch (error) {
      console.error('Failed to initialize vitals monitoring:', error);
    }
  }

  //setup Largest Contentful Paint monitoring
  private setupLCPMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      
      if (lastEntry) {
        const metric: VitalsMetric = {
          name: 'LCP',
          value: lastEntry.startTime,
          rating: this.getRating(lastEntry.startTime, VITALS_THRESHOLDS.LCP),
          delta: lastEntry.startTime,
          entries: [lastEntry],
          id: this.generateId(),
          navigationType: this.getNavigationType(),
          timestamp: Date.now(),
        };
        
        this.recordMetric(metric);
        
        //check if LCP element is an image
        if (lastEntry.element && lastEntry.element.tagName === 'IMG') {
          this.recordImageMetric('lcp-image-contribution', lastEntry.startTime, {
            src: lastEntry.element.src || lastEntry.element.dataset.src,
            width: lastEntry.element.naturalWidth,
            height: lastEntry.element.naturalHeight,
            isLCP: true,
          });
        }
      }
    });

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      this.observers.add(observer);
    } catch (error) {
      console.warn('LCP monitoring not supported:', error);
    }
  }

  //setup First Input Delay monitoring
  private setupFIDMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        const fidEntry = entry as any;
        
        const metric: VitalsMetric = {
          name: 'FID',
          value: fidEntry.processingStart - fidEntry.startTime,
          rating: this.getRating(fidEntry.processingStart - fidEntry.startTime, VITALS_THRESHOLDS.FID),
          delta: fidEntry.processingStart - fidEntry.startTime,
          entries: [fidEntry],
          id: this.generateId(),
          navigationType: this.getNavigationType(),
          timestamp: Date.now(),
        };
        
        this.recordMetric(metric);
      }
    });

    try {
      observer.observe({ type: 'first-input', buffered: true });
      this.observers.add(observer);
    } catch (error) {
      console.warn('FID monitoring not supported:', error);
    }
  }

  //setup Cumulative Layout Shift monitoring
  private setupCLSMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;
    let clsEntries: any[] = [];

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        const layoutShiftEntry = entry as any;
        
        //only count layout shifts without recent user input
        if (!layoutShiftEntry.hadRecentInput) {
          clsValue += layoutShiftEntry.value;
          clsEntries.push(layoutShiftEntry);
          
          //check if layout shift involves images
          if (layoutShiftEntry.sources) {
            for (const source of layoutShiftEntry.sources) {
              if (source.node && source.node.tagName === 'IMG') {
                this.recordImageMetric('layout-shift-contribution', layoutShiftEntry.value, {
                  src: source.node.src || source.node.dataset.src,
                  shiftValue: layoutShiftEntry.value,
                  previousRect: source.previousRect,
                  currentRect: source.currentRect,
                });
              }
            }
          }
        }
      }
      
      const metric: VitalsMetric = {
        name: 'CLS',
        value: clsValue,
        rating: this.getRating(clsValue, VITALS_THRESHOLDS.CLS),
        delta: clsValue,
        entries: clsEntries,
        id: this.generateId(),
        navigationType: this.getNavigationType(),
        timestamp: Date.now(),
      };
      
      this.recordMetric(metric);
    });

    try {
      observer.observe({ type: 'layout-shift', buffered: true });
      this.observers.add(observer);
    } catch (error) {
      console.warn('CLS monitoring not supported:', error);
    }
  }

  //setup Interaction to Next Paint monitoring
  private setupINPMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    let longestInteraction = 0;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        const eventEntry = entry as any;
        
        if (eventEntry.duration > longestInteraction) {
          longestInteraction = eventEntry.duration;
          
          const metric: VitalsMetric = {
            name: 'INP',
            value: eventEntry.duration,
            rating: this.getRating(eventEntry.duration, VITALS_THRESHOLDS.INP),
            delta: eventEntry.duration,
            entries: [eventEntry],
            id: this.generateId(),
            navigationType: this.getNavigationType(),
            timestamp: Date.now(),
          };
          
          this.recordMetric(metric);
        }
      }
    });

    try {
      observer.observe({ type: 'event', buffered: true });
      this.observers.add(observer);
    } catch (error) {
      console.warn('INP monitoring not supported:', error);
    }
  }

  //setup First Contentful Paint monitoring
  private setupFCPMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        if (entry.name === 'first-contentful-paint') {
          const metric: VitalsMetric = {
            name: 'FCP',
            value: entry.startTime,
            rating: this.getRating(entry.startTime, VITALS_THRESHOLDS.FCP),
            delta: entry.startTime,
            entries: [entry],
            id: this.generateId(),
            navigationType: this.getNavigationType(),
            timestamp: Date.now(),
          };
          
          this.recordMetric(metric);
        }
      }
    });

    try {
      observer.observe({ type: 'paint', buffered: true });
      this.observers.add(observer);
    } catch (error) {
      console.warn('FCP monitoring not supported:', error);
    }
  }

  //setup Time to First Byte monitoring
  private setupTTFBMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        const navEntry = entry as PerformanceNavigationTiming;
        
        if (navEntry.responseStart > 0) {
          const ttfb = navEntry.responseStart - navEntry.requestStart;
          
          const metric: VitalsMetric = {
            name: 'TTFB',
            value: ttfb,
            rating: this.getRating(ttfb, VITALS_THRESHOLDS.TTFB),
            delta: ttfb,
            entries: [navEntry],
            id: this.generateId(),
            navigationType: this.getNavigationType(),
            timestamp: Date.now(),
          };
          
          this.recordMetric(metric);
        }
      }
    });

    try {
      observer.observe({ type: 'navigation', buffered: true });
      this.observers.add(observer);
    } catch (error) {
      console.warn('TTFB monitoring not supported:', error);
    }
  }

  //setup comprehensive image performance monitoring
  private setupImagePerformanceMonitoring(): void {
    //monitor image loading performance
    this.observeImageLoading();
    
    //monitor image decode performance
    this.observeImageDecoding();
    
    //monitor image intersection performance
    this.observeImageIntersection();
    
    //monitor image-related layout shifts
    this.observeImageLayoutShifts();
  }

  //observe image loading performance
  private observeImageLoading(): void {
    const images = document.querySelectorAll('img[data-optimized="true"]');
    
    images.forEach(img => {
      const startTime = performance.now();
      
      const onLoad = () => {
        const loadTime = performance.now() - startTime;
        
        this.recordImageMetric('image-load-time', loadTime, {
          src: img.dataset.originalSrc || (img as HTMLImageElement).src,
          width: (img as HTMLImageElement).naturalWidth,
          height: (img as HTMLImageElement).naturalHeight,
          format: this.detectImageFormat((img as HTMLImageElement).src),
          loadingStrategy: (img as HTMLImageElement).loading,
        });
      };
      
      const onError = () => {
        const loadTime = performance.now() - startTime;
        
        this.recordImageMetric('image-load-error', loadTime, {
          src: img.dataset.originalSrc || (img as HTMLImageElement).src,
          error: 'load-failed',
        });
      };
      
      if ((img as HTMLImageElement).complete) {
        onLoad();
      } else {
        img.addEventListener('load', onLoad, { once: true });
        img.addEventListener('error', onError, { once: true });
      }
    });
  }

  //observe image decoding performance
  private observeImageDecoding(): void {
    if (!('PerformanceObserver' in window)) return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      
      for (const entry of entries) {
        if (entry.name.includes('image') && entry.entryType === 'measure') {
          this.recordImageMetric('image-decode-time', entry.duration, {
            src: entry.name,
          });
        }
      }
    });

    try {
      observer.observe({ type: 'measure', buffered: true });
      this.observers.add(observer);
    } catch (error) {
      console.warn('Image decode monitoring not supported:', error);
    }
  }

  //observe image intersection performance
  private observeImageIntersection(): void {
    if (!('IntersectionObserver' in window)) return;

    const intersectionTimes = new Map<Element, number>();

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const img = entry.target;
        
        if (entry.isIntersecting) {
          //record when image enters viewport
          const entryTime = Date.now();
          intersectionTimes.set(img, entryTime);
          
          this.recordImageMetric('image-viewport-entry', entryTime, {
            src: img.dataset?.originalSrc || (img as HTMLImageElement).src,
            intersectionRatio: entry.intersectionRatio,
            loadingStrategy: (img as HTMLImageElement).loading,
          });
        } else if (intersectionTimes.has(img)) {
          //record viewport exit
          const entryTime = intersectionTimes.get(img)!;
          const viewTime = Date.now() - entryTime;
          
          this.recordImageMetric('image-viewport-time', viewTime, {
            src: img.dataset?.originalSrc || (img as HTMLImageElement).src,
            viewDuration: viewTime,
          });
          
          intersectionTimes.delete(img);
        }
      });
    }, {
      threshold: [0, 0.25, 0.5, 0.75, 1],
      rootMargin: '50px',
    });

    //observe all images
    document.querySelectorAll('img').forEach(img => {
      observer.observe(img);
    });

    //observe dynamically added images
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const images = (node as Element).querySelectorAll('img');
            images.forEach(img => observer.observe(img));
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  //observe image-related layout shifts
  private observeImageLayoutShifts(): void {
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach(entry => {
        const img = entry.target as HTMLImageElement;
        
        //detect if resize was caused by image loading
        if (img.tagName === 'IMG' && !img.complete) {
          this.recordImageMetric('image-layout-shift-potential', Date.now(), {
            src: img.src || img.dataset.src,
            contentRect: entry.contentRect,
            hasExplicitDimensions: !!(img.width && img.height),
          });
        }
      });
    });

    //observe all images
    document.querySelectorAll('img').forEach(img => {
      resizeObserver.observe(img);
    });
  }

  //setup network condition monitoring
  private setupNetworkMonitoring(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const trackNetworkChange = () => {
        this.recordCustomMetric('network-change', Date.now(), {
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
        });
      };
      
      connection.addEventListener('change', trackNetworkChange);
      trackNetworkChange(); //initial measurement
    }
  }

  //setup page visibility tracking
  private setupVisibilityTracking(): void {
    let visibilityStartTime = Date.now();
    
    const handleVisibilityChange = () => {
      if (document.hidden) {
        //page became hidden - report accumulated metrics
        this.flushReports();
      } else {
        //page became visible
        visibilityStartTime = Date.now();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    //report metrics before page unload
    window.addEventListener('beforeunload', () => {
      this.flushReports();
    });
  }

  //setup batch reporting
  private setupBatchReporting(batchSize: number, batchTimeout: number): void {
    const flushBatch = () => {
      if (this.reportingBatch.length > 0) {
        this.sendBatch([...this.reportingBatch]);
        this.reportingBatch = [];
      }
    };
    
    //flush on batch size
    const checkBatchSize = () => {
      if (this.reportingBatch.length >= batchSize) {
        flushBatch();
      }
    };
    
    //flush on timeout
    this.reportingTimer = window.setInterval(flushBatch, batchTimeout);
    
    //add to callbacks
    this.callbacks.add(checkBatchSize);
  }

  //record core web vitals metric
  private recordMetric(metric: VitalsMetric): void {
    this.metrics.set(metric.name, metric);
    
    //notify callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(metric);
      } catch (error) {
        console.error('Vitals callback error:', error);
      }
    });
    
    //add to reporting batch
    if (this.reportingEndpoint) {
      this.reportingBatch.push({
        type: 'vital',
        ...metric,
      });
    }
    
    if (typeof window !== 'undefined' && window.console?.debug) {
      console.debug(`📊 ${metric.name}: ${metric.value.toFixed(2)}ms (${metric.rating})`, metric);
    }
  }

  //record image-specific performance metric
  recordImageMetric(name: string, value: number, metadata: any = {}): void {
    const metric: ImagePerformanceMetric = {
      name,
      value,
      rating: this.getImageMetricRating(name, value),
      metadata,
      timestamp: Date.now(),
    };
    
    this.imageMetrics.push(metric);
    
    //notify callbacks
    this.callbacks.forEach(callback => {
      try {
        callback(metric);
      } catch (error) {
        console.error('Image metrics callback error:', error);
      }
    });
    
    //add to reporting batch
    if (this.reportingEndpoint) {
      this.reportingBatch.push({
        type: 'image',
        ...metric,
      });
    }
  }

  //record custom metric
  recordCustomMetric(name: string, value: number, metadata: any = {}): void {
    this.recordImageMetric(name, value, metadata);
  }

  //get current performance snapshot
  getPerformanceSnapshot(): PerformanceSnapshot {
    return {
      url: window.location.href,
      timestamp: Date.now(),
      vitals: Object.fromEntries(this.metrics),
      imageMetrics: [...this.imageMetrics],
      networkInfo: this.getNetworkInfo(),
      deviceInfo: this.getDeviceInfo(),
      cumulativeScores: this.calculateCumulativeScores(),
    };
  }

  //calculate cumulative performance scores
  private calculateCumulativeScores(): PerformanceSnapshot['cumulativeScores'] {
    const vitals = Array.from(this.metrics.values());
    const goodCount = vitals.filter(v => v.rating === 'good').length;
    const totalCount = vitals.length;
    
    const overallRating: 'good' | 'needs-improvement' | 'poor' = 
      goodCount / totalCount >= 0.75 ? 'good' :
      goodCount / totalCount >= 0.5 ? 'needs-improvement' : 'poor';
    
    //calculate individual scores
    const lcpMetric = this.metrics.get('LCP');
    const fidMetric = this.metrics.get('FID');
    const clsMetric = this.metrics.get('CLS');
    
    const lcpScore = lcpMetric ? this.calculateScore(lcpMetric.value, VITALS_THRESHOLDS.LCP) : 0;
    const fidScore = fidMetric ? this.calculateScore(fidMetric.value, VITALS_THRESHOLDS.FID) : 0;
    const clsScore = clsMetric ? this.calculateScore(clsMetric.value, VITALS_THRESHOLDS.CLS) : 0;
    
    //calculate image optimization score
    const imageLoadTimes = this.imageMetrics.filter(m => m.name === 'image-load-time');
    const avgImageLoadTime = imageLoadTimes.length > 0 ?
      imageLoadTimes.reduce((sum, m) => sum + m.value, 0) / imageLoadTimes.length : 1000;
    const imageOptimizationScore = this.calculateScore(avgImageLoadTime, IMAGE_METRICS.LOAD_TIME);
    
    return {
      overallRating,
      lcpScore,
      fidScore,
      clsScore,
      imageOptimizationScore,
    };
  }

  //utility methods
  private getRating(value: number, thresholds: { good: number; needsImprovement: number }): 'good' | 'needs-improvement' | 'poor' {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  private getImageMetricRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = IMAGE_METRICS[name as keyof typeof IMAGE_METRICS];
    if (!thresholds) return 'good';
    
    return this.getRating(value, thresholds);
  }

  private calculateScore(value: number, thresholds: { good: number; needsImprovement: number }): number {
    if (value <= thresholds.good) return 100;
    if (value <= thresholds.needsImprovement) {
      const range = thresholds.needsImprovement - thresholds.good;
      const position = value - thresholds.good;
      return Math.max(0, 100 - (position / range) * 50);
    }
    return Math.max(0, 50 - ((value - thresholds.needsImprovement) / thresholds.needsImprovement) * 50);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private getNavigationType(): string {
    if ('navigation' in performance && 'type' in (performance as any).navigation) {
      return (performance as any).navigation.type;
    }
    return 'unknown';
  }

  private detectImageFormat(src: string): string {
    const extension = src.split('.').pop()?.toLowerCase();
    const formatMap: Record<string, string> = {
      'webp': 'WebP',
      'avif': 'AVIF',
      'jpg': 'JPEG',
      'jpeg': 'JPEG',
      'png': 'PNG',
      'gif': 'GIF',
    };
    return formatMap[extension || ''] || 'Unknown';
  }

  private getNetworkInfo(): NetworkInformation {
    const connection = (navigator as any).connection;
    
    return {
      effectiveType: connection?.effectiveType || '4g',
      downlink: connection?.downlink || 10,
      rtt: connection?.rtt || 50,
      saveData: connection?.saveData || false,
    };
  }

  private getDeviceInfo(): DeviceInformation {
    return {
      deviceMemory: (navigator as any).deviceMemory || 4,
      hardwareConcurrency: navigator.hardwareConcurrency || 4,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      pixelRatio: window.devicePixelRatio || 1,
    };
  }

  private async sendBatch(batch: any[]): Promise<void> {
    if (!this.reportingEndpoint || batch.length === 0) return;
    
    try {
      await fetch(this.reportingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          batch,
          url: window.location.href,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
        }),
        keepalive: true,
      });
    } catch (error) {
      console.error('Failed to send performance batch:', error);
    }
  }

  private flushReports(): void {
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }
    
    if (this.reportingBatch.length > 0) {
      this.sendBatch([...this.reportingBatch]);
      this.reportingBatch = [];
    }
  }

  //public API methods
  onMetric(callback: (metric: VitalsMetric | ImagePerformanceMetric) => void): void {
    this.callbacks.add(callback);
  }

  offMetric(callback: (metric: VitalsMetric | ImagePerformanceMetric) => void): void {
    this.callbacks.delete(callback);
  }

  getMetrics(): { vitals: VitalsMetric[]; images: ImagePerformanceMetric[] } {
    return {
      vitals: Array.from(this.metrics.values()),
      images: [...this.imageMetrics],
    };
  }

  clearMetrics(): void {
    this.metrics.clear();
    this.imageMetrics = [];
  }

  dispose(): void {
    //cleanup observers
    this.observers.forEach(observer => {
      try {
        observer.disconnect();
      } catch (error) {
        console.warn('Error disconnecting observer:', error);
      }
    });
    
    this.observers.clear();
    this.callbacks.clear();
    
    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
    }
    
    //flush any remaining reports
    this.flushReports();
  }
}

//singleton instance
export const vitalsMonitor = new VitalsMonitor({
  enableImageTracking: true,
  enableNetworkTracking: true,
  verbose: process.env.NODE_ENV === 'development',
});

//expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).vitalsMonitor = vitalsMonitor;
}

//utility functions
export const VitalsUtils = {
  //get current performance scores
  getScores: () => vitalsMonitor.getPerformanceSnapshot().cumulativeScores,
  
  //get image optimization recommendations
  getImageOptimizationRecommendations: (): string[] => {
    const snapshot = vitalsMonitor.getPerformanceSnapshot();
    const recommendations: string[] = [];
    
    //analyze image metrics
    const slowImages = snapshot.imageMetrics.filter(m => 
      m.name === 'image-load-time' && m.rating === 'poor'
    );
    
    if (slowImages.length > 0) {
      recommendations.push(`Optimize ${slowImages.length} slow-loading images`);
    }
    
    const layoutShifts = snapshot.imageMetrics.filter(m => 
      m.name === 'layout-shift-contribution' && m.value > 0.1
    );
    
    if (layoutShifts.length > 0) {
      recommendations.push('Add explicit width/height attributes to prevent layout shifts');
    }
    
    const unoptimizedFormats = snapshot.imageMetrics.filter(m => 
      m.metadata.format === 'JPEG' || m.metadata.format === 'PNG'
    );
    
    if (unoptimizedFormats.length > 0) {
      recommendations.push('Convert images to modern formats (WebP, AVIF)');
    }
    
    return recommendations;
  },
  
  //start monitoring
  start: (options?: any) => vitalsMonitor,
  
  //stop monitoring
  stop: () => vitalsMonitor.dispose(),
};