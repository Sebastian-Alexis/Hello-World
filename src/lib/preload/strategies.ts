// =============================================================================
// INTELLIGENT PRELOADING STRATEGIES - Advanced image and resource preloading
// Provides user behavior prediction and adaptive preloading for optimal performance
// =============================================================================

//preloading configuration
export const PRELOAD_CONFIG = {
  //preloading priorities
  PRIORITIES: {
    critical: 'high', //above-the-fold, LCP candidates
    important: 'medium', //visible on scroll, user interaction targets
    deferred: 'low', //below-the-fold, lazy-loaded content
  },
  
  //preload strategies
  STRATEGIES: {
    immediate: 0, //preload immediately
    viewport: 100, //preload when approaching viewport
    interaction: 200, //preload on user interaction
    idle: 500, //preload during idle time
    network: 1000, //preload based on network conditions
  },
  
  //resource type priorities
  RESOURCE_TYPES: {
    lcp_image: 'critical',
    hero_image: 'critical',
    above_fold: 'important',
    gallery_next: 'important',
    below_fold: 'deferred',
    background: 'deferred',
  },
  
  //network condition thresholds
  NETWORK_THRESHOLDS: {
    fast: { effectiveType: '4g', downlink: 10 },
    medium: { effectiveType: '3g', downlink: 1.5 },
    slow: { effectiveType: '2g', downlink: 0.5 },
  },
  
  //user behavior patterns
  BEHAVIOR_PATTERNS: {
    scroll_velocity_threshold: 200, //px/s
    hover_duration_threshold: 200, //ms
    click_prediction_window: 1000, //ms
    viewport_margin: '100px', //intersection observer margin
  },
} as const;

//preload request interface
export interface PreloadRequest {
  url: string;
  type: 'image' | 'video' | 'font' | 'script' | 'style';
  priority: 'critical' | 'important' | 'deferred';
  strategy: keyof typeof PRELOAD_CONFIG.STRATEGIES;
  metadata: {
    width?: number;
    height?: number;
    format?: string;
    source?: string;
    timestamp: number;
    [key: string]: any;
  };
}

//user behavior data
export interface UserBehavior {
  scrollVelocity: number;
  scrollDirection: 'up' | 'down' | 'none';
  mousePosition: { x: number; y: number };
  hoverTargets: Set<Element>;
  clickTargets: Element[];
  viewportHistory: Array<{ element: Element; timestamp: number; duration: number }>;
  interactionPredictions: Array<{ element: Element; probability: number; timestamp: number }>;
}

//network conditions
export interface NetworkConditions {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
  saveData: boolean;
  category: 'fast' | 'medium' | 'slow';
}

//intelligent preloading manager
export class IntelligentPreloadManager {
  private preloadQueue: Map<string, PreloadRequest> = new Map();
  private preloadedResources: Set<string> = new Set();
  private userBehavior: UserBehavior;
  private networkConditions: NetworkConditions;
  private observers: Set<any> = new Set();
  private isEnabled = true;
  private debugMode = false;

  constructor(options: {
    debugMode?: boolean;
    maxConcurrentPreloads?: number;
    respectSaveData?: boolean;
  } = {}) {
    this.debugMode = options.debugMode || false;
    
    //initialize user behavior tracking
    this.userBehavior = {
      scrollVelocity: 0,
      scrollDirection: 'none',
      mousePosition: { x: 0, y: 0 },
      hoverTargets: new Set(),
      clickTargets: [],
      viewportHistory: [],
      interactionPredictions: [],
    };

    //initialize network conditions
    this.networkConditions = {
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false,
      category: 'fast',
    };

    if (typeof window !== 'undefined') {
      this.initialize();
    }
  }

  //initialize preloading system
  private initialize(): void {
    this.setupNetworkMonitoring();
    this.setupUserBehaviorTracking();
    this.setupIntersectionObserver();
    this.setupIdleTimePreloading();
    this.setupMemoryPressureHandling();
    
    if (this.debugMode) {
      this.setupDebugInterface();
    }
  }

  //setup network condition monitoring
  private setupNetworkMonitoring(): void {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateNetworkConditions = () => {
        this.networkConditions = {
          effectiveType: connection.effectiveType || '4g',
          downlink: connection.downlink || 10,
          rtt: connection.rtt || 50,
          saveData: connection.saveData || false,
          category: this.categorizeNetwork(connection),
        };
        
        //adjust preloading strategy based on network conditions
        this.adjustPreloadingStrategy();
      };

      connection.addEventListener('change', updateNetworkConditions);
      updateNetworkConditions(); //initial setup
    }
  }

  //categorize network conditions
  private categorizeNetwork(connection: any): 'fast' | 'medium' | 'slow' {
    const { effectiveType, downlink } = connection;
    
    if (effectiveType === '4g' && downlink >= PRELOAD_CONFIG.NETWORK_THRESHOLDS.fast.downlink) {
      return 'fast';
    } else if (effectiveType === '3g' || downlink >= PRELOAD_CONFIG.NETWORK_THRESHOLDS.medium.downlink) {
      return 'medium';
    }
    
    return 'slow';
  }

  //setup user behavior tracking
  private setupUserBehaviorTracking(): void {
    let lastScrollTime = Date.now();
    let lastScrollY = window.pageYOffset;
    
    //track scroll behavior
    const scrollHandler = this.throttle(() => {
      const currentTime = Date.now();
      const currentScrollY = window.pageYOffset;
      const deltaTime = currentTime - lastScrollTime;
      const deltaY = Math.abs(currentScrollY - lastScrollY);
      
      this.userBehavior.scrollVelocity = deltaTime > 0 ? deltaY / deltaTime : 0;
      this.userBehavior.scrollDirection = currentScrollY > lastScrollY ? 'down' : 
        currentScrollY < lastScrollY ? 'up' : 'none';
      
      lastScrollTime = currentTime;
      lastScrollY = currentScrollY;
      
      //predict scroll-based preloading
      this.predictScrollBasedPreloading();
    }, 100);

    window.addEventListener('scroll', scrollHandler, { passive: true });

    //track mouse behavior
    const mouseMoveHandler = this.throttle((e: MouseEvent) => {
      this.userBehavior.mousePosition = { x: e.clientX, y: e.clientY };
      this.predictMouseBasedPreloading(e);
    }, 50);

    document.addEventListener('mousemove', mouseMoveHandler, { passive: true });

    //track hover behavior
    document.addEventListener('mouseenter', (e) => {
      if (e.target instanceof Element) {
        this.userBehavior.hoverTargets.add(e.target);
        setTimeout(() => {
          if (this.userBehavior.hoverTargets.has(e.target)) {
            this.predictHoverBasedPreloading(e.target);
          }
        }, PRELOAD_CONFIG.BEHAVIOR_PATTERNS.hover_duration_threshold);
      }
    }, { capture: true });

    document.addEventListener('mouseleave', (e) => {
      if (e.target instanceof Element) {
        this.userBehavior.hoverTargets.delete(e.target);
      }
    }, { capture: true });

    //track click behavior
    document.addEventListener('click', (e) => {
      if (e.target instanceof Element) {
        this.userBehavior.clickTargets.push(e.target);
        this.learnFromUserInteraction(e.target);
      }
    }, { capture: true });
  }

  //setup intersection observer for viewport-based preloading
  private setupIntersectionObserver(): void {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const element = entry.target;
        
        if (entry.isIntersecting) {
          //element entered viewport
          const viewportEntry = {
            element,
            timestamp: Date.now(),
            duration: 0,
          };
          
          this.userBehavior.viewportHistory.push(viewportEntry);
          
          //trigger viewport-based preloading
          this.handleViewportEntry(element);
        } else {
          //element left viewport - update duration
          const historyEntry = this.userBehavior.viewportHistory
            .findLast(entry => entry.element === element);
          
          if (historyEntry) {
            historyEntry.duration = Date.now() - historyEntry.timestamp;
          }
        }
      });
    }, {
      rootMargin: PRELOAD_CONFIG.BEHAVIOR_PATTERNS.viewport_margin,
      threshold: [0, 0.25, 0.5, 0.75, 1],
    });

    //observe all images and interactive elements
    document.querySelectorAll('img, video, [data-preload]').forEach(element => {
      observer.observe(element);
    });

    //observe dynamically added elements
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            const preloadableElements = element.querySelectorAll('img, video, [data-preload]');
            preloadableElements.forEach(el => observer.observe(el));
          }
        });
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.observers.add(observer);
    this.observers.add(mutationObserver);
  }

  //setup idle time preloading
  private setupIdleTimePreloading(): void {
    if ('requestIdleCallback' in window) {
      const scheduleIdlePreloading = () => {
        (window as any).requestIdleCallback((deadline: any) => {
          this.processIdlePreloading(deadline);
          
          //schedule next idle period
          setTimeout(scheduleIdlePreloading, 1000);
        });
      };

      scheduleIdlePreloading();
    } else {
      //fallback for browsers without requestIdleCallback
      setInterval(() => {
        this.processIdlePreloading({ timeRemaining: () => 16 }); //simulate 16ms budget
      }, 2000);
    }
  }

  //setup memory pressure handling
  private setupMemoryPressureHandling(): void {
    if ('memory' in performance) {
      const checkMemoryPressure = () => {
        const memInfo = (performance as any).memory;
        const memoryRatio = memInfo.usedJSHeapSize / memInfo.jsHeapSizeLimit;
        
        if (memoryRatio > 0.8) {
          //high memory pressure - reduce preloading
          this.isEnabled = false;
          this.clearPreloadQueue();
        } else if (memoryRatio < 0.6) {
          //normal memory conditions - resume preloading
          this.isEnabled = true;
        }
      };

      setInterval(checkMemoryPressure, 5000);
    }
  }

  //predict scroll-based preloading
  private predictScrollBasedPreloading(): void {
    if (this.userBehavior.scrollVelocity > PRELOAD_CONFIG.BEHAVIOR_PATTERNS.scroll_velocity_threshold) {
      //fast scrolling - preload more aggressively in scroll direction
      const direction = this.userBehavior.scrollDirection;
      this.scheduleDirectionalPreloading(direction, 'viewport');
    }
  }

  //predict mouse-based preloading
  private predictMouseBasedPreloading(event: MouseEvent): void {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (!element) return;

    //find preloadable resources near mouse cursor
    const nearbyElements = this.findNearbyPreloadableElements(element, 200);
    nearbyElements.forEach(el => {
      this.scheduleElementPreloading(el, 'interaction');
    });
  }

  //predict hover-based preloading
  private predictHoverBasedPreloading(element: Element): void {
    //preload related resources when user hovers over interactive elements
    if (element.matches('a, button, [role="button"]')) {
      const preloadTargets = this.findRelatedPreloadTargets(element);
      preloadTargets.forEach(target => {
        this.scheduleResourcePreloading(target.url, target.type, 'interaction', target.metadata);
      });
    }

    //preload next/previous images in galleries
    if (element.closest('.optimized-gallery')) {
      this.scheduleGalleryPreloading(element);
    }
  }

  //learn from user interaction patterns
  private learnFromUserInteraction(element: Element): void {
    //analyze user behavior patterns to improve predictions
    const interactionType = this.classifyInteraction(element);
    const context = this.getInteractionContext(element);
    
    //update interaction predictions
    this.updateInteractionPredictions(interactionType, context);
  }

  //handle viewport entry events
  private handleViewportEntry(element: Element): void {
    //schedule preloading for nearby elements
    const strategy = this.determinePreloadStrategy(element);
    this.scheduleElementPreloading(element, strategy);
    
    //preload next elements in sequence (e.g., gallery items)
    const nextElements = this.findSequentialElements(element);
    nextElements.forEach(el => {
      this.scheduleElementPreloading(el, 'viewport');
    });
  }

  //schedule directional preloading based on scroll
  private scheduleDirectionalPreloading(direction: 'up' | 'down', strategy: keyof typeof PRELOAD_CONFIG.STRATEGIES): void {
    const viewport = {
      top: window.pageYOffset,
      bottom: window.pageYOffset + window.innerHeight,
    };

    const buffer = direction === 'down' ? window.innerHeight * 2 : window.innerHeight;
    const targetArea = direction === 'down' ? 
      { top: viewport.bottom, bottom: viewport.bottom + buffer } :
      { top: viewport.top - buffer, bottom: viewport.top };

    //find elements in target area
    const elements = document.elementsFromPoint(
      window.innerWidth / 2,
      direction === 'down' ? targetArea.bottom - 100 : targetArea.top + 100
    );

    elements.forEach(element => {
      if (this.isPreloadableElement(element)) {
        this.scheduleElementPreloading(element, strategy);
      }
    });
  }

  //schedule element preloading
  private scheduleElementPreloading(element: Element, strategy: keyof typeof PRELOAD_CONFIG.STRATEGIES): void {
    const preloadTargets = this.extractPreloadTargets(element);
    
    preloadTargets.forEach(target => {
      this.scheduleResourcePreloading(target.url, target.type, target.priority, {
        ...target.metadata,
        element: element,
        strategy,
      });
    });
  }

  //schedule resource preloading
  scheduleResourcePreloading(
    url: string,
    type: PreloadRequest['type'],
    priority: PreloadRequest['priority'],
    metadata: any = {}
  ): void {
    if (!this.isEnabled || this.preloadedResources.has(url)) {
      return;
    }

    //check network conditions
    if (!this.shouldPreloadBasedOnNetwork(priority)) {
      return;
    }

    const request: PreloadRequest = {
      url,
      type,
      priority,
      strategy: metadata.strategy || 'idle',
      metadata: {
        ...metadata,
        timestamp: Date.now(),
      },
    };

    this.preloadQueue.set(url, request);
    
    //execute preload based on strategy
    const delay = PRELOAD_CONFIG.STRATEGIES[request.strategy];
    setTimeout(() => {
      this.executePreload(request);
    }, delay);

    if (this.debugMode) {
      console.log(`🔄 Scheduled preload: ${url} (${priority}, ${request.strategy})`);
    }
  }

  //execute actual preload
  private async executePreload(request: PreloadRequest): Promise<void> {
    if (!this.isEnabled || this.preloadedResources.has(request.url)) {
      return;
    }

    try {
      const startTime = performance.now();
      
      //create preload link element
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = request.url;
      link.as = request.type === 'image' ? 'image' : request.type;
      
      //set priority hint
      if ('fetchPriority' in link) {
        (link as any).fetchPriority = request.priority === 'critical' ? 'high' : 
          request.priority === 'important' ? 'medium' : 'low';
      }

      //set type for images
      if (request.type === 'image' && request.metadata.format) {
        link.type = `image/${request.metadata.format}`;
      }

      //add to document
      document.head.appendChild(link);

      //track successful preload
      link.onload = () => {
        const loadTime = performance.now() - startTime;
        this.preloadedResources.add(request.url);
        this.preloadQueue.delete(request.url);
        
        this.trackPreloadPerformance('preload-success', loadTime, request);
        
        if (this.debugMode) {
          console.log(`✅ Preloaded: ${request.url} (${loadTime.toFixed(2)}ms)`);
        }
      };

      link.onerror = () => {
        const loadTime = performance.now() - startTime;
        this.preloadQueue.delete(request.url);
        
        this.trackPreloadPerformance('preload-error', loadTime, request);
        
        if (this.debugMode) {
          console.warn(`❌ Preload failed: ${request.url}`);
        }
      };

    } catch (error) {
      console.error('Preload execution failed:', error);
      this.preloadQueue.delete(request.url);
    }
  }

  //process idle time preloading
  private processIdlePreloading(deadline: any): void {
    const sortedQueue = Array.from(this.preloadQueue.values())
      .filter(request => request.strategy === 'idle')
      .sort((a, b) => {
        //prioritize by importance and age
        const priorityWeight = { critical: 3, important: 2, deferred: 1 };
        const aPriority = priorityWeight[a.priority];
        const bPriority = priorityWeight[b.priority];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        return a.metadata.timestamp - b.metadata.timestamp;
      });

    //process queue during idle time
    while (deadline.timeRemaining() > 5 && sortedQueue.length > 0) {
      const request = sortedQueue.shift()!;
      this.executePreload(request);
    }
  }

  //utility methods
  private shouldPreloadBasedOnNetwork(priority: PreloadRequest['priority']): boolean {
    const { category, saveData } = this.networkConditions;
    
    //respect save-data preference
    if (saveData && priority !== 'critical') {
      return false;
    }

    //adjust based on network speed
    switch (category) {
      case 'fast':
        return true; //preload everything
      case 'medium':
        return priority !== 'deferred'; //skip deferred resources
      case 'slow':
        return priority === 'critical'; //only critical resources
      default:
        return priority === 'critical';
    }
  }

  private isPreloadableElement(element: Element): boolean {
    return element.matches('img, video, [data-preload], a[href*=".jpg"], a[href*=".png"], a[href*=".webp"]');
  }

  private extractPreloadTargets(element: Element): Array<{
    url: string;
    type: PreloadRequest['type'];
    priority: PreloadRequest['priority'];
    metadata: any;
  }> {
    const targets: any[] = [];

    if (element.matches('img')) {
      const img = element as HTMLImageElement;
      const url = img.dataset.src || img.src;
      if (url) {
        targets.push({
          url,
          type: 'image' as const,
          priority: this.determineImagePriority(img),
          metadata: {
            width: img.width || img.naturalWidth,
            height: img.height || img.naturalHeight,
            format: this.detectImageFormat(url),
            source: 'img-element',
          },
        });
      }
    }

    return targets;
  }

  private determineImagePriority(img: HTMLImageElement): PreloadRequest['priority'] {
    //check if image is LCP candidate
    if (img.dataset.priority === 'high' || img.loading === 'eager') {
      return 'critical';
    }

    //check viewport position
    const rect = img.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    if (rect.top < viewportHeight) {
      return 'important'; //above the fold
    }

    return 'deferred';
  }

  private detectImageFormat(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const formatMap: Record<string, string> = {
      'webp': 'webp',
      'avif': 'avif',
      'jpg': 'jpeg',
      'jpeg': 'jpeg',
      'png': 'png',
      'gif': 'gif',
    };
    return formatMap[extension || ''] || 'jpeg';
  }

  private adjustPreloadingStrategy(): void {
    //adjust preloading behavior based on network conditions
    const { category } = this.networkConditions;
    
    switch (category) {
      case 'slow':
        //more conservative preloading
        this.clearNonCriticalPreloads();
        break;
      case 'medium':
        //moderate preloading
        this.clearDeferredPreloads();
        break;
      case 'fast':
        //aggressive preloading
        break;
    }
  }

  private clearNonCriticalPreloads(): void {
    for (const [url, request] of this.preloadQueue) {
      if (request.priority !== 'critical') {
        this.preloadQueue.delete(url);
      }
    }
  }

  private clearDeferredPreloads(): void {
    for (const [url, request] of this.preloadQueue) {
      if (request.priority === 'deferred') {
        this.preloadQueue.delete(url);
      }
    }
  }

  private clearPreloadQueue(): void {
    this.preloadQueue.clear();
  }

  private trackPreloadPerformance(name: string, value: number, request: PreloadRequest): void {
    if (typeof window.vitalsMonitor !== 'undefined') {
      window.vitalsMonitor.recordCustomMetric(name, value, {
        url: request.url,
        type: request.type,
        priority: request.priority,
        strategy: request.strategy,
        networkCategory: this.networkConditions.category,
      });
    }
  }

  private throttle(func: Function, limit: number): Function {
    let inThrottle: boolean;
    return function(this: any, ...args: any[]) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  private setupDebugInterface(): void {
    //expose debug methods to window
    (window as any).preloadDebug = {
      getQueue: () => Array.from(this.preloadQueue.values()),
      getPreloaded: () => Array.from(this.preloadedResources),
      getBehavior: () => this.userBehavior,
      getNetwork: () => this.networkConditions,
      clearQueue: () => this.clearPreloadQueue(),
      toggle: () => { this.isEnabled = !this.isEnabled; },
    };
  }

  //public API methods
  preloadImage(url: string, priority: PreloadRequest['priority'] = 'important'): void {
    this.scheduleResourcePreloading(url, 'image', priority);
  }

  preloadVideo(url: string, priority: PreloadRequest['priority'] = 'important'): void {
    this.scheduleResourcePreloading(url, 'video', priority);
  }

  preloadFont(url: string, priority: PreloadRequest['priority'] = 'critical'): void {
    this.scheduleResourcePreloading(url, 'font', priority);
  }

  getPreloadStats(): {
    queueSize: number;
    preloadedCount: number;
    networkCategory: string;
    isEnabled: boolean;
  } {
    return {
      queueSize: this.preloadQueue.size,
      preloadedCount: this.preloadedResources.size,
      networkCategory: this.networkConditions.category,
      isEnabled: this.isEnabled,
    };
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
    this.clearPreloadQueue();
    this.preloadedResources.clear();
  }

  //placeholder methods for features not fully implemented
  private findNearbyPreloadableElements(element: Element, radius: number): Element[] {
    return [];
  }

  private findRelatedPreloadTargets(element: Element): any[] {
    return [];
  }

  private scheduleGalleryPreloading(element: Element): void {
    //implementation would analyze gallery structure and preload adjacent images
  }

  private classifyInteraction(element: Element): string {
    return 'click';
  }

  private getInteractionContext(element: Element): any {
    return {};
  }

  private updateInteractionPredictions(type: string, context: any): void {
    //implementation would use ML/statistical methods to improve predictions
  }

  private determinePreloadStrategy(element: Element): keyof typeof PRELOAD_CONFIG.STRATEGIES {
    return 'viewport';
  }

  private findSequentialElements(element: Element): Element[] {
    return [];
  }
}

//singleton instance
export const preloadManager = new IntelligentPreloadManager({
  debugMode: process.env.NODE_ENV === 'development',
});

//expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).preloadManager = preloadManager;
}

//utility functions
export const PreloadUtils = {
  //preload critical resources
  preloadCritical: (urls: string[]) => {
    urls.forEach(url => {
      const type = url.includes('.woff') || url.includes('.ttf') ? 'font' : 'image';
      preloadManager.scheduleResourcePreloading(url, type as any, 'critical');
    });
  },

  //preload images in gallery
  preloadGallery: (imageUrls: string[], currentIndex: number = 0, preloadCount: number = 3) => {
    for (let i = 1; i <= preloadCount; i++) {
      const nextIndex = currentIndex + i;
      if (nextIndex < imageUrls.length) {
        preloadManager.preloadImage(imageUrls[nextIndex], 'important');
      }
    }
  },

  //adaptive preloading based on user behavior
  adaptivePreload: (element: Element) => {
    if (preloadManager) {
      preloadManager['scheduleElementPreloading'](element, 'interaction');
    }
  },

  //get preload statistics
  getStats: () => preloadManager.getPreloadStats(),

  //enable/disable preloading
  toggle: (enabled: boolean) => {
    preloadManager['isEnabled'] = enabled;
  },
};