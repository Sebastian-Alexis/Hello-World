// Analytics tracking system
(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // Configuration
  const ANALYTICS_CONFIG = {
    endpoint: '/api/analytics/track',
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000,
  };
  
  // Event queue for batching
  let eventQueue = [];
  let flushTimeout;
  
  // User identification
  let userId = localStorage.getItem('analytics_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('analytics_user_id', userId);
  }
  
  // Session identification
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  
  // Device information
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'desktop';
    
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      deviceType = /iPad/.test(ua) ? 'tablet' : 'mobile';
    }
    
    return {
      deviceType,
      userAgent: ua,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1
    };
  }
  
  // Connection information
  function getConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    return {
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || null,
      rtt: connection?.rtt || null,
      saveData: connection?.saveData || false
    };
  }
  
  // UTM parameter extraction
  function getUTMParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {};
    
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      const value = urlParams.get(param);
      if (value) utmParams[param] = value;
    });
    
    return utmParams;
  }
  
  // Event tracking function
  function trackEvent(eventType, properties = {}) {
    const event = {
      event_type: eventType,
      page_path: window.location.pathname,
      page_url: window.location.href,
      referrer: document.referrer,
      user_id: userId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      properties: {
        ...getDeviceInfo(),
        ...getConnectionInfo(),
        ...getUTMParameters(),
        ...properties
      }
    };
    
    // Add to queue
    eventQueue.push(event);
    
    // Flush if batch size reached
    if (eventQueue.length >= ANALYTICS_CONFIG.batchSize) {
      flushEvents();
    } else {
      // Schedule flush
      scheduleFlush();
    }
  }
  
  // Schedule event flushing
  function scheduleFlush() {
    if (flushTimeout) return;
    
    flushTimeout = setTimeout(() => {
      flushEvents();
    }, ANALYTICS_CONFIG.flushInterval);
  }
  
  // Flush events to server
  async function flushEvents(retryCount = 0) {
    if (eventQueue.length === 0) return;
    
    const events = [...eventQueue];
    eventQueue = [];
    
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    
    try {
      const response = await fetch(ANALYTICS_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
        keepalive: true
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.warn('Analytics flush failed:', error);
      
      // Retry logic
      if (retryCount < ANALYTICS_CONFIG.maxRetries) {
        setTimeout(() => {
          eventQueue.unshift(...events);
          flushEvents(retryCount + 1);
        }, ANALYTICS_CONFIG.retryDelay * Math.pow(2, retryCount));
      }
    }
  }
  
  // Page view tracking
  function trackPageView() {
    trackEvent('page_view', {
      title: document.title,
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
  }
  
  // Scroll tracking
  let maxScrollDepth = 0;
  let scrollTimeouts = {};
  
  function trackScroll() {
    const scrollPercent = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    
    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;
      
      // Track scroll depth milestones
      const milestones = [25, 50, 75, 90, 100];
      const milestone = milestones.find(m => scrollPercent >= m && maxScrollDepth < m);
      
      if (milestone && !scrollTimeouts[milestone]) {
        scrollTimeouts[milestone] = setTimeout(() => {
          trackEvent('scroll_depth', {
            depth_percent: milestone,
            max_depth: maxScrollDepth
          });
        }, 1000);
      }
    }
  }
  
  // Click tracking
  function trackClick(event) {
    const element = event.target.closest('a, button, [data-track]');
    if (!element) return;
    
    const properties = {
      element_type: element.tagName.toLowerCase(),
      element_text: element.textContent?.trim().substring(0, 100) || '',
      element_id: element.id || null,
      element_class: element.className || null
    };
    
    // Track external links
    if (element.tagName === 'A' && element.hostname !== window.location.hostname) {
      properties.external_url = element.href;
      trackEvent('external_link_click', properties);
    }
    // Track internal navigation
    else if (element.tagName === 'A' && element.hostname === window.location.hostname) {
      properties.internal_url = element.href;
      trackEvent('internal_link_click', properties);
    }
    // Track button clicks
    else if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      trackEvent('button_click', properties);
    }
    // Track custom tracked elements
    else if (element.hasAttribute('data-track')) {
      properties.track_id = element.getAttribute('data-track');
      trackEvent('custom_click', properties);
    }
  }
  
  // Form tracking
  function trackFormSubmit(event) {
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    
    trackEvent('form_submit', {
      form_id: form.id || null,
      form_name: form.name || null,
      form_action: form.action || null,
      form_method: form.method || 'get'
    });
  }
  
  // Search tracking
  function trackSearch(query, results = null) {
    trackEvent('search', {
      query: query.trim().substring(0, 100),
      results_count: results,
      search_location: window.location.pathname
    });
  }
  
  // Time on page tracking
  let timeOnPageStart = Date.now();
  let isPageVisible = !document.hidden;
  
  function trackTimeOnPage() {
    if (!isPageVisible) return;
    
    const timeSpent = Math.round((Date.now() - timeOnPageStart) / 1000);
    
    if (timeSpent >= 10) { // Only track if at least 10 seconds
      trackEvent('time_on_page', {
        seconds: timeSpent,
        minutes: Math.round(timeSpent / 60)
      });
    }
  }
  
  // Visibility change tracking
  function handleVisibilityChange() {
    if (document.hidden) {
      isPageVisible = false;
      trackTimeOnPage();
    } else {
      isPageVisible = true;
      timeOnPageStart = Date.now();
    }
  }
  
  // Performance tracking
  function trackPerformance() {
    if (!('performance' in window)) return;
    
    // Wait for page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        if (navigation) {
          trackEvent('page_performance', {
            dns_time: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
            connect_time: Math.round(navigation.connectEnd - navigation.connectStart),
            response_time: Math.round(navigation.responseEnd - navigation.responseStart),
            dom_load_time: Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart),
            load_time: Math.round(navigation.loadEventEnd - navigation.navigationStart),
            first_paint: paint.find(p => p.name === 'first-paint')?.startTime || null,
            first_contentful_paint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null
          });
        }
      }, 1000);
    });
  }
  
  // Error tracking
  function trackError(error, source = 'javascript') {
    trackEvent('error', {
      message: error.message || 'Unknown error',
      source: source,
      filename: error.filename || null,
      line_number: error.lineno || null,
      column_number: error.colno || null,
      stack: error.error?.stack?.substring(0, 1000) || null
    });
  }
  
  // Initialize analytics
  function init() {
    // Track initial page view
    trackPageView();
    
    // Set up event listeners
    document.addEventListener('click', trackClick);
    document.addEventListener('submit', trackFormSubmit);
    window.addEventListener('scroll', debounce(trackScroll, 250));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => {
      trackTimeOnPage();
      flushEvents();
    });
    
    // Error tracking
    window.addEventListener('error', trackError);
    window.addEventListener('unhandledrejection', (event) => {
      trackError({ message: event.reason }, 'promise');
    });
    
    // Performance tracking
    trackPerformance();
    
    // SPA navigation tracking
    let currentPath = window.location.pathname;
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        trackPageView();
        timeOnPageStart = Date.now();
        maxScrollDepth = 0;
        scrollTimeouts = {};
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Utility function for debouncing
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Expose public API
  window.analytics = {
    track: trackEvent,
    trackPageView,
    trackSearch,
    flush: flushEvents
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();