//Core Web Vitals monitoring and performance tracking
(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  //core web vitals thresholds
  const THRESHOLDS = {
    LCP: { good: 2500, poor: 4000 },
    FID: { good: 100, poor: 300 },
    CLS: { good: 0.1, poor: 0.25 },
    TTFB: { good: 800, poor: 1800 },
    FCP: { good: 1800, poor: 3000 }
  };
  
  //track metrics
  const metrics = {};
  const observers = [];
  
  //send metric to analytics
  function sendMetric(name, value, rating, delta) {
    const metric = {
      name,
      value: Math.round(value),
      rating,
      delta: Math.round(delta || 0),
      timestamp: Date.now(),
      url: window.location.href,
      connection: getConnectionInfo()
    };
    
    //track in analytics if available
    if (window.analytics) {
      window.analytics.track('core_web_vital', metric);
    }
    
    //also log to console in development
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      console.log(`[CWV] ${name}:`, metric);
    }
    
    //store metric for potential reporting
    metrics[name] = metric;
    
    //dispatch custom event
    window.dispatchEvent(new CustomEvent('webvital', { detail: metric }));
  }
  
  //get connection information
  function getConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      effectiveType: connection?.effectiveType || 'unknown',
      rtt: connection?.rtt || null,
      downlink: connection?.downlink || null
    };
  }
  
  //get rating based on thresholds
  function getRating(name, value) {
    const threshold = THRESHOLDS[name];
    if (!threshold) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }
  
  //largest contentful paint
  function observeLCP() {
    if (!('PerformanceObserver' in window)) return;
    
    let lcp = 0;
    
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      
      if (lastEntry) {
        lcp = lastEntry.startTime;
        sendMetric('LCP', lcp, getRating('LCP', lcp));
      }
    });
    
    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      observers.push(observer);
    } catch (e) {
      console.warn('LCP observation failed:', e);
    }
  }
  
  //first input delay
  function observeFID() {
    if (!('PerformanceObserver' in window)) return;
    
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      
      entries.forEach((entry) => {
        if (entry.name === 'first-input') {
          const fid = entry.processingStart - entry.startTime;
          sendMetric('FID', fid, getRating('FID', fid));
        }
      });
    });
    
    try {
      observer.observe({ type: 'first-input', buffered: true });
      observers.push(observer);
    } catch (e) {
      console.warn('FID observation failed:', e);
    }
  }
  
  //cumulative layout shift
  function observeCLS() {
    if (!('PerformanceObserver' in window)) return;
    
    let cls = 0;
    let sessionValue = 0;
    let sessionEntries = [];
    
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      
      entries.forEach((entry) => {
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];
          
          //if the entry occurred less than 1 second after the previous entry and
          //less than 5 seconds after the first entry in the session, include it
          if (sessionValue && 
              entry.startTime - lastSessionEntry.startTime < 1000 &&
              entry.startTime - firstSessionEntry.startTime < 5000) {
            sessionValue += entry.value;
            sessionEntries.push(entry);
          } else {
            sessionValue = entry.value;
            sessionEntries = [entry];
          }
          
          //if the current session value is larger than the current CLS value,
          //update CLS and the entries contributing to it
          if (sessionValue > cls) {
            cls = sessionValue;
            sendMetric('CLS', cls, getRating('CLS', cls));
          }
        }
      });
    });
    
    try {
      observer.observe({ type: 'layout-shift', buffered: true });
      observers.push(observer);
    } catch (e) {
      console.warn('CLS observation failed:', e);
    }
  }
  
  //first contentful paint
  function observeFCP() {
    if (!('PerformanceObserver' in window)) return;
    
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      
      entries.forEach((entry) => {
        if (entry.name === 'first-contentful-paint') {
          const fcp = entry.startTime;
          sendMetric('FCP', fcp, getRating('FCP', fcp));
        }
      });
    });
    
    try {
      observer.observe({ type: 'paint', buffered: true });
      observers.push(observer);
    } catch (e) {
      console.warn('FCP observation failed:', e);
    }
  }
  
  //time to first byte
  function observeTTFB() {
    if (!('performance' in window)) return;
    
    //wait for navigation timing to be available
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          const ttfb = navigation.responseStart - navigation.requestStart;
          sendMetric('TTFB', ttfb, getRating('TTFB', ttfb));
        }
      }, 0);
    });
  }
  
  //resource timing
  function observeResourceTiming() {
    if (!('PerformanceObserver' in window)) return;
    
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      
      entries.forEach((entry) => {
        //track slow resources
        const duration = entry.responseEnd - entry.startTime;
        
        if (duration > 1000) { //resources taking more than 1 second
          if (window.analytics) {
            window.analytics.track('slow_resource', {
              name: entry.name,
              type: entry.initiatorType,
              duration: Math.round(duration),
              size: entry.transferSize || null,
              rating: duration > 3000 ? 'poor' : 'needs-improvement'
            });
          }
        }
      });
    });
    
    try {
      observer.observe({ type: 'resource', buffered: true });
      observers.push(observer);
    } catch (e) {
      console.warn('Resource timing observation failed:', e);
    }
  }
  
  //long tasks
  function observeLongTasks() {
    if (!('PerformanceObserver' in window)) return;
    
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      
      entries.forEach((entry) => {
        if (window.analytics) {
          window.analytics.track('long_task', {
            duration: Math.round(entry.duration),
            startTime: Math.round(entry.startTime),
            rating: entry.duration > 100 ? 'poor' : 'needs-improvement'
          });
        }
      });
    });
    
    try {
      observer.observe({ type: 'longtask', buffered: true });
      observers.push(observer);
    } catch (e) {
      console.warn('Long task observation failed:', e);
    }
  }
  
  //page visibility changes for accurate metrics
  function handleVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      //send final metrics when page becomes hidden
      observers.forEach(observer => {
        try {
          observer.disconnect();
        } catch (e) {
          //ignore errors during cleanup
        }
      });
      
      //send summary if available
      if (Object.keys(metrics).length > 0) {
        const summary = {
          lcp: metrics.LCP?.value || null,
          fid: metrics.FID?.value || null,
          cls: metrics.CLS?.value || null,
          fcp: metrics.FCP?.value || null,
          ttfb: metrics.TTFB?.value || null,
          overall_rating: calculateOverallRating()
        };
        
        if (window.analytics) {
          window.analytics.track('cwv_summary', summary);
        }
      }
    }
  }
  
  //calculate overall performance rating
  function calculateOverallRating() {
    const ratings = Object.values(metrics).map(m => m.rating);
    const counts = ratings.reduce((acc, rating) => {
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});
    
    if (counts.poor > 0) return 'poor';
    if (counts['needs-improvement'] > 0) return 'needs-improvement';
    return 'good';
  }
  
  //memory usage tracking
  function trackMemoryUsage() {
    if (!('performance' in window) || !performance.memory) return;
    
    const memory = performance.memory;
    const memoryInfo = {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
      limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024) // MB
    };
    
    if (window.analytics) {
      window.analytics.track('memory_usage', memoryInfo);
    }
  }
  
  //initialize all observers
  function init() {
    try {
      observeLCP();
      observeFID();
      observeCLS();
      observeFCP();
      observeTTFB();
      observeResourceTiming();
      observeLongTasks();
      
      //track memory usage periodically
      trackMemoryUsage();
      setInterval(trackMemoryUsage, 30000); //every 30 seconds
      
      //handle page visibility changes
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      //handle page unload
      window.addEventListener('beforeunload', handleVisibilityChange);
      
    } catch (error) {
      console.warn('Core Web Vitals initialization failed:', error);
    }
  }
  
  //expose public API
  window.webVitals = {
    getMetrics: () => ({ ...metrics }),
    getOverallRating: calculateOverallRating
  };
  
  //initialize immediately
  init();
  
})();