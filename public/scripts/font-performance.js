//font performance monitoring for client-side tracking
//integrates with existing performance monitoring system

(function() {
  'use strict';

  //font performance configuration
  const FONT_CONFIG = {
    monospaceStack: ['Courier New', 'Lucida Console', 'Monaco', 'Consolas', 'monospace'],
    performanceBudgets: {
      loadTime: 200, //ms
      clsImpact: 0.05, //cls units
      fallbackRate: 0.2 //20% fallback usage
    },
    platforms: {
      windows: ['Consolas', 'Lucida Console'],
      macos: ['Monaco', 'Lucida Console'],
      linux: ['Liberation Mono', 'DejaVu Sans Mono'],
      mobile: ['monospace']
    }
  };

  //font performance tracker
  class FontPerformanceMonitor {
    constructor() {
      this.metrics = {
        loadTimes: [],
        clsEvents: [],
        fallbackUsage: {},
        platformInfo: this.detectPlatform()
      };
      
      this.initialized = false;
      this.observers = [];
      
      this.init();
    }

    detectPlatform() {
      const ua = navigator.userAgent.toLowerCase();
      const platform = {
        name: 'unknown',
        expectedFonts: ['monospace']
      };

      if (ua.includes('windows')) {
        platform.name = 'windows';
        platform.expectedFonts = FONT_CONFIG.platforms.windows;
      } else if (ua.includes('macintosh') || ua.includes('mac os')) {
        platform.name = 'macos';
        platform.expectedFonts = FONT_CONFIG.platforms.macos;
      } else if (ua.includes('linux') && !ua.includes('android')) {
        platform.name = 'linux';
        platform.expectedFonts = FONT_CONFIG.platforms.linux;
      } else if (/android|iphone|ipad|ipod/.test(ua)) {
        platform.name = 'mobile';
        platform.expectedFonts = FONT_CONFIG.platforms.mobile;
      }

      return platform;
    }

    init() {
      if (this.initialized) return;

      //wait for dom ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startMonitoring());
      } else {
        this.startMonitoring();
      }

      this.initialized = true;
    }

    startMonitoring() {
      //monitor font loading events
      this.monitorFontLoading();
      
      //monitor cls events
      this.monitorCLS();
      
      //check font availability
      this.checkFontAvailability();
      
      //setup periodic reporting
      this.setupReporting();
      
      //integrate with existing performance tracker
      this.integrateWithVitals();
    }

    monitorFontLoading() {
      if (!document.fonts) return;

      const startTime = performance.now();
      
      document.fonts.addEventListener('loadingstart', (event) => {
        console.log('font loading started');
      });

      document.fonts.addEventListener('loadingdone', (event) => {
        const loadTime = performance.now() - startTime;
        this.metrics.loadTimes.push(loadTime);
        
        console.log(`font loading completed in ${loadTime.toFixed(2)}ms`);
        
        //emit performance event
        this.emitFontEvent('font-loaded', { loadTime });
      });

      document.fonts.addEventListener('loadingerror', (event) => {
        console.warn('font loading failed');
        this.emitFontEvent('font-error', { error: true });
      });
    }

    monitorCLS() {
      if (!window.PerformanceObserver) return;

      try {
        const clsObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.hadRecentInput) return;

            //heuristic for font-related cls
            if (entry.startTime < 3000) { //within 3s of page load
              this.metrics.clsEvents.push({
                value: entry.value,
                timestamp: entry.startTime,
                sources: entry.sources || []
              });

              //emit cls event
              this.emitFontEvent('font-cls', { 
                clsValue: entry.value,
                timestamp: entry.startTime
              });
            }
          });
        });

        clsObserver.observe({ type: 'layout-shift', buffered: true });
        this.observers.push(clsObserver);
      } catch (error) {
        console.warn('cls monitoring failed:', error);
      }
    }

    async checkFontAvailability() {
      const results = {};
      
      for (const fontName of FONT_CONFIG.monospaceStack) {
        try {
          const isAvailable = await this.isFontAvailable(fontName);
          results[fontName] = isAvailable;
          
          if (!isAvailable) {
            this.metrics.fallbackUsage[fontName] = true;
          }
        } catch (error) {
          console.warn(`font check failed for ${fontName}:`, error);
          results[fontName] = false;
        }
      }

      //calculate fallback rate
      const fallbackCount = Object.values(results).filter(available => !available).length;
      const fallbackRate = fallbackCount / FONT_CONFIG.monospaceStack.length;

      this.metrics.fallbackRate = fallbackRate;
      
      //emit availability data
      this.emitFontEvent('font-availability', {
        fonts: results,
        fallbackRate,
        platform: this.metrics.platformInfo.name
      });

      return results;
    }

    async isFontAvailable(fontName) {
      //skip generic monospace
      if (fontName === 'monospace') return true;

      if (document.fonts && document.fonts.check) {
        return document.fonts.check(`12px "${fontName}"`);
      }

      //fallback canvas method
      return this.canvasDetection(fontName);
    }

    canvasDetection(fontName) {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return false;

      //measure baseline
      context.font = '12px monospace';
      const baselineWidth = context.measureText('abcdefghijklmnopqrstuvwxyz').width;

      //measure with target font
      context.font = `12px "${fontName}", monospace`;
      const testWidth = context.measureText('abcdefghijklmnopqrstuvwxyz').width;

      //fonts are different if width differs significantly
      return Math.abs(testWidth - baselineWidth) > 1;
    }

    setupReporting() {
      //report metrics every 30 seconds
      setInterval(() => {
        this.reportMetrics();
      }, 30000);

      //report on page unload
      window.addEventListener('beforeunload', () => {
        this.reportMetrics(true);
      });
    }

    integrateWithVitals() {
      //listen for existing vitals updates
      window.addEventListener('web-vital', (event) => {
        const vital = event.detail;
        
        //enhance vitals with font data if relevant
        if (['LCP', 'CLS', 'FCP'].includes(vital.name)) {
          this.correlateFontImpact(vital);
        }
      });

      //add font data to performance events
      window.addEventListener('performance-update', (event) => {
        event.detail.fontMetrics = this.getMetricsSummary();
      });
    }

    correlateFontImpact(vital) {
      const fontData = {
        fallbackRate: this.metrics.fallbackRate || 0,
        avgLoadTime: this.getAverageLoadTime(),
        clsEvents: this.metrics.clsEvents.length,
        platform: this.metrics.platformInfo.name
      };

      //emit correlated data
      this.emitFontEvent('font-vital-correlation', {
        vital: vital.name,
        value: vital.value,
        rating: vital.rating,
        fontData
      });
    }

    getAverageLoadTime() {
      const loadTimes = this.metrics.loadTimes;
      return loadTimes.length > 0 ? 
        loadTimes.reduce((sum, time) => sum + time, 0) / loadTimes.length : 0;
    }

    getTotalCLS() {
      return this.metrics.clsEvents.reduce((sum, event) => sum + event.value, 0);
    }

    getMetricsSummary() {
      return {
        avgLoadTime: this.getAverageLoadTime(),
        totalCLS: this.getTotalCLS(),
        fallbackRate: this.metrics.fallbackRate || 0,
        platform: this.metrics.platformInfo.name,
        budgetStatus: this.checkBudgets()
      };
    }

    checkBudgets() {
      const budgets = FONT_CONFIG.performanceBudgets;
      const status = {};

      status.loadTime = this.getAverageLoadTime() <= budgets.loadTime;
      status.clsImpact = this.getTotalCLS() <= budgets.clsImpact;
      status.fallbackRate = (this.metrics.fallbackRate || 0) <= budgets.fallbackRate;

      return status;
    }

    emitFontEvent(eventName, data) {
      const event = new CustomEvent(eventName, {
        detail: {
          ...data,
          timestamp: Date.now(),
          sessionId: this.getSessionId()
        }
      });
      
      window.dispatchEvent(event);

      //also log in development
      if (window.location.hostname === 'localhost') {
        console.log(`font event: ${eventName}`, data);
      }
    }

    getSessionId() {
      if (!this.sessionId) {
        this.sessionId = `font-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }
      return this.sessionId;
    }

    reportMetrics(isUnload = false) {
      const metricsData = {
        ...this.getMetricsSummary(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
        isUnload
      };

      //send to performance endpoint
      const endpoint = '/api/analytics/font-performance';
      
      if (isUnload && navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, JSON.stringify(metricsData));
      } else {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metricsData),
          keepalive: true
        }).catch(error => {
          console.warn('font metrics reporting failed:', error);
        });
      }
    }

    //public api
    getRecommendations() {
      const recommendations = [];
      const summary = this.getMetricsSummary();

      if (summary.avgLoadTime > FONT_CONFIG.performanceBudgets.loadTime) {
        recommendations.push(`font loading is slow (${summary.avgLoadTime.toFixed(2)}ms) - consider preloading`);
      }

      if (summary.totalCLS > FONT_CONFIG.performanceBudgets.clsImpact) {
        recommendations.push(`high font cls (${summary.totalCLS.toFixed(3)}) - implement font fallback sizing`);
      }

      if (summary.fallbackRate > FONT_CONFIG.performanceBudgets.fallbackRate) {
        recommendations.push(`high fallback usage (${(summary.fallbackRate * 100).toFixed(1)}%) - optimize font stack`);
      }

      const expectedFonts = this.metrics.platformInfo.expectedFonts;
      recommendations.push(`platform: ${this.metrics.platformInfo.name} - expected fonts: ${expectedFonts.join(', ')}`);

      return recommendations;
    }

    getAnalysis() {
      return {
        metrics: this.getMetricsSummary(),
        recommendations: this.getRecommendations(),
        budgets: FONT_CONFIG.performanceBudgets,
        platform: this.metrics.platformInfo
      };
    }

    destroy() {
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];
    }
  }

  //create global instance
  window.fontPerformance = new FontPerformanceMonitor();

  //expose utilities
  window.fontDebug = {
    getRecommendations: () => window.fontPerformance.getRecommendations(),
    getAnalysis: () => window.fontPerformance.getAnalysis(),
    checkFonts: () => window.fontPerformance.checkFontAvailability(),
    getBudgetStatus: () => window.fontPerformance.checkBudgets()
  };

  //auto-start monitoring
  console.log('font performance monitoring initialized');
})();