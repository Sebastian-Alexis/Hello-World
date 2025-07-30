//advanced lighthouse configuration for comprehensive performance testing
const fs = require('fs');
const path = require('path');

//performance thresholds aligned with your existing vitals-monitor.ts
const PERFORMANCE_THRESHOLDS = {
  //core web vitals (Google's "Good" thresholds)
  LCP: 2500,  //largest contentful paint
  FCP: 1800,  //first contentful paint
  CLS: 0.1,   //cumulative layout shift
  TBT: 200,   //total blocking time (approximates FID)
  SI: 3400,   //speed index
  TTI: 5000,  //time to interactive
  
  //custom performance budgets
  TTFB: 600,   //time to first byte
  BLOCKING: 500, //render blocking resources
  UNUSED_CSS: 20000, //20KB unused CSS
  UNUSED_JS: 50000,  //50KB unused JS
  TOTAL_SIZE: 1600000, //1.6MB total size
  BOOTUP_TIME: 3500,   //3.5s JavaScript bootup
  MAIN_THREAD: 4000,   //4s main thread work
  
  //lighthouse scores (0-1 scale)
  PERFORMANCE_SCORE: 0.95,
  ACCESSIBILITY_SCORE: 0.95,
  BEST_PRACTICES_SCORE: 0.90,
  SEO_SCORE: 0.90
};

//custom lighthouse configuration
const lighthouseConfig = {
  extends: 'lighthouse:default',
  settings: {
    maxWaitForFcp: 30000,
    maxWaitForLoad: 45000,
    throttlingMethod: 'simulate',
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0
    },
    screenEmulation: {
      mobile: false,
      width: 1350,
      height: 940,
      deviceScaleFactor: 1,
      disabled: false
    },
    formFactor: 'desktop',
    locale: 'en-US',
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
    skipAudits: [
      //skip PWA audits for faster CI runs
      'service-worker',
      'offline-start-url',
      'installable-manifest',
      'apple-touch-icon',
      'splash-screen',
      'themed-omnibox',
      'content-width',
      //skip some accessibility audits if needed
      'color-contrast',
      'focus-traps'
    ]
  },
  //custom audit configurations
  audits: [
    //custom audit for Core Web Vitals integration
    {
      path: './lighthouse-audits/core-web-vitals-integration.js'
    },
    //custom audit for image optimization
    {
      path: './lighthouse-audits/image-optimization-advanced.js'
    },
    //custom audit for performance budget validation
    {
      path: './lighthouse-audits/performance-budget-validator.js'
    }
  ],
  categories: {
    performance: {
      title: 'Performance',
      description: 'Optimized for Core Web Vitals and performance budgets',
      auditRefs: [
        {id: 'first-contentful-paint', weight: 10, group: 'metrics'},
        {id: 'largest-contentful-paint', weight: 25, group: 'metrics'},
        {id: 'cumulative-layout-shift', weight: 25, group: 'metrics'},
        {id: 'total-blocking-time', weight: 30, group: 'metrics'},
        {id: 'speed-index', weight: 10, group: 'metrics'},
        {id: 'core-web-vitals-integration', weight: 0, group: 'metrics'},
        {id: 'image-optimization-advanced', weight: 0, group: 'load-opportunities'},
        {id: 'performance-budget-validator', weight: 0, group: 'diagnostics'}
      ]
    }
  }
};

//helper function to create performance reports
function createPerformanceReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    url: results.requestedUrl,
    finalUrl: results.finalUrl,
    scores: {
      performance: results.categories.performance.score,
      accessibility: results.categories.accessibility.score,
      bestPractices: results.categories['best-practices'].score,
      seo: results.categories.seo.score
    },
    coreWebVitals: {
      LCP: results.audits['largest-contentful-paint'].numericValue,
      FCP: results.audits['first-contentful-paint'].numericValue,
      CLS: results.audits['cumulative-layout-shift'].numericValue,
      TBT: results.audits['total-blocking-time'].numericValue,
      SI: results.audits['speed-index'].numericValue,
      TTI: results.audits['interactive'].numericValue
    },
    performanceMetrics: {
      TTFB: results.audits['server-response-time'].numericValue,
      totalByteWeight: results.audits['total-byte-weight'].numericValue,
      renderBlocking: results.audits['render-blocking-resources'].numericValue,
      unusedCSS: results.audits['unused-css-rules'].numericValue,
      unusedJS: results.audits['unused-javascript'].numericValue,
      bootupTime: results.audits['bootup-time'].numericValue,
      mainThreadWork: results.audits['mainthread-work-breakdown'].numericValue
    },
    opportunities: results.audits,
    environment: {
      networkUserAgent: results.environment.networkUserAgent,
      hostUserAgent: results.environment.hostUserAgent,
      benchmarkIndex: results.environment.benchmarkIndex
    }
  };

  return report;
}

//helper function to validate performance against budgets
function validatePerformanceBudgets(report) {
  const violations = [];
  
  //check core web vitals
  if (report.coreWebVitals.LCP > PERFORMANCE_THRESHOLDS.LCP) {
    violations.push({
      metric: 'LCP',
      actual: report.coreWebVitals.LCP,
      threshold: PERFORMANCE_THRESHOLDS.LCP,
      severity: 'error'
    });
  }
  
  if (report.coreWebVitals.FCP > PERFORMANCE_THRESHOLDS.FCP) {
    violations.push({
      metric: 'FCP',
      actual: report.coreWebVitals.FCP,
      threshold: PERFORMANCE_THRESHOLDS.FCP,
      severity: 'error'
    });
  }
  
  if (report.coreWebVitals.CLS > PERFORMANCE_THRESHOLDS.CLS) {
    violations.push({
      metric: 'CLS',
      actual: report.coreWebVitals.CLS,
      threshold: PERFORMANCE_THRESHOLDS.CLS,
      severity: 'error'
    });
  }
  
  if (report.coreWebVitals.TBT > PERFORMANCE_THRESHOLDS.TBT) {
    violations.push({
      metric: 'TBT',
      actual: report.coreWebVitals.TBT,
      threshold: PERFORMANCE_THRESHOLDS.TBT,
      severity: 'error'
    });
  }
  
  //check performance scores
  if (report.scores.performance < PERFORMANCE_THRESHOLDS.PERFORMANCE_SCORE) {
    violations.push({
      metric: 'Performance Score',
      actual: report.scores.performance,
      threshold: PERFORMANCE_THRESHOLDS.PERFORMANCE_SCORE,
      severity: 'error'
    });
  }
  
  //check performance budgets
  if (report.performanceMetrics.totalByteWeight > PERFORMANCE_THRESHOLDS.TOTAL_SIZE) {
    violations.push({
      metric: 'Total Bundle Size',
      actual: report.performanceMetrics.totalByteWeight,
      threshold: PERFORMANCE_THRESHOLDS.TOTAL_SIZE,
      severity: 'warning'
    });
  }
  
  if (report.performanceMetrics.unusedCSS > PERFORMANCE_THRESHOLDS.UNUSED_CSS) {
    violations.push({
      metric: 'Unused CSS',
      actual: report.performanceMetrics.unusedCSS,
      threshold: PERFORMANCE_THRESHOLDS.UNUSED_CSS,
      severity: 'warning'
    });
  }
  
  if (report.performanceMetrics.unusedJS > PERFORMANCE_THRESHOLDS.UNUSED_JS) {
    violations.push({
      metric: 'Unused JavaScript',
      actual: report.performanceMetrics.unusedJS,
      threshold: PERFORMANCE_THRESHOLDS.UNUSED_JS,
      severity: 'warning'
    });
  }
  
  return violations;
}

//integration with existing performance monitoring
function integrateWithVitalsMonitor(report) {
  const integrationPayload = {
    source: 'lighthouse-ci',
    timestamp: report.timestamp,
    url: report.url,
    metrics: [
      {
        name: 'LCP',
        value: report.coreWebVitals.LCP,
        rating: report.coreWebVitals.LCP <= 2500 ? 'good' : 
                report.coreWebVitals.LCP <= 4000 ? 'needs-improvement' : 'poor',
        source: 'lighthouse'
      },
      {
        name: 'FCP',
        value: report.coreWebVitals.FCP,
        rating: report.coreWebVitals.FCP <= 1800 ? 'good' : 
                report.coreWebVitals.FCP <= 3000 ? 'needs-improvement' : 'poor',
        source: 'lighthouse'
      },
      {
        name: 'CLS',
        value: report.coreWebVitals.CLS,
        rating: report.coreWebVitals.CLS <= 0.1 ? 'good' : 
                report.coreWebVitals.CLS <= 0.25 ? 'needs-improvement' : 'poor',
        source: 'lighthouse'
      },
      {
        name: 'TBT',
        value: report.coreWebVitals.TBT,
        rating: report.coreWebVitals.TBT <= 200 ? 'good' : 
                report.coreWebVitals.TBT <= 600 ? 'needs-improvement' : 'poor',
        source: 'lighthouse'
      }
    ],
    scores: report.scores,
    violations: validatePerformanceBudgets(report)
  };
  
  return integrationPayload;
}

//export configurations and utilities
module.exports = {
  lighthouseConfig,
  PERFORMANCE_THRESHOLDS,
  createPerformanceReport,
  validatePerformanceBudgets,
  integrateWithVitalsMonitor
};