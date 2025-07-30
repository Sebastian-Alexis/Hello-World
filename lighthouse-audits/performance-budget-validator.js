//custom lighthouse audit for performance budget validation
const Audit = require('lighthouse').Audit;

class PerformanceBudgetValidatorAudit extends Audit {
  static get meta() {
    return {
      id: 'performance-budget-validator',
      title: 'Performance Budget Validation',
      failureTitle: 'Performance budget violations detected',
      description: 'Validates against custom performance budgets including bundle sizes, request counts, and timing thresholds.',
      supportedModes: ['navigation'],
      requiredArtifacts: ['NetworkRecords', 'traces', 'devtoolsLogs']
    };
  }

  static audit(artifacts, context) {
    const networkRecords = artifacts.NetworkRecords[Audit.DEFAULT_PASS] || [];
    const trace = artifacts.traces[Audit.DEFAULT_PASS];
    
    //performance budgets (aligned with your existing configuration)
    const budgets = {
      //resource sizes (in bytes)
      totalSize: 1600000,      //1.6MB total
      jsSize: 512000,          //512KB JavaScript
      cssSize: 102400,         //100KB CSS  
      imageSize: 1048576,      //1MB images
      fontSize: 204800,        //200KB fonts
      
      //request counts
      totalRequests: 50,       //max 50 requests
      jsRequests: 10,          //max 10 JS files
      cssRequests: 5,          //max 5 CSS files
      imageRequests: 25,       //max 25 images
      
      //timing budgets (in milliseconds)
      ttfb: 600,              //600ms TTFB
      domContentLoaded: 2000,  //2s DOM ready
      loadComplete: 4000,      //4s load complete
      firstPaint: 1000,        //1s first paint
      
      //performance scores (0-1 scale)
      performanceScore: 0.95,  //95+ performance
      lighthouseScore: 90      //90+ overall Lighthouse
    };

    const issues = [];
    let score = 100;

    //analyze resource sizes
    const resourceSizes = {
      total: 0,
      js: 0,
      css: 0,
      image: 0,
      font: 0
    };

    const requestCounts = {
      total: networkRecords.length,
      js: 0,
      css: 0,
      image: 0,
      font: 0
    };

    networkRecords.forEach(record => {
      const size = record.transferSize || 0;
      resourceSizes.total += size;

      if (record.mimeType?.includes('javascript') || record.url?.endsWith('.js')) {
        resourceSizes.js += size;
        requestCounts.js++;
      } else if (record.mimeType?.includes('css') || record.url?.endsWith('.css')) {
        resourceSizes.css += size;
        requestCounts.css++;
      } else if (record.mimeType?.startsWith('image/')) {
        resourceSizes.image += size;
        requestCounts.image++;
      } else if (record.mimeType?.includes('font') || /\.(woff2?|ttf|eot|otf)$/i.test(record.url)) {
        resourceSizes.font += size;
        requestCounts.font++;
      }
    });

    //validate resource size budgets
    if (resourceSizes.total > budgets.totalSize) {
      issues.push({
        budget: 'Total Bundle Size',
        actual: `${Math.round(resourceSizes.total / 1024)}KB`,
        limit: `${Math.round(budgets.totalSize / 1024)}KB`,
        severity: 'High',
        violation: Math.round((resourceSizes.total - budgets.totalSize) / 1024)
      });
      score -= 15;
    }

    if (resourceSizes.js > budgets.jsSize) {
      issues.push({
        budget: 'JavaScript Bundle Size',
        actual: `${Math.round(resourceSizes.js / 1024)}KB`,
        limit: `${Math.round(budgets.jsSize / 1024)}KB`,
        severity: 'High',
        violation: Math.round((resourceSizes.js - budgets.jsSize) / 1024)
      });
      score -= 10;
    }

    if (resourceSizes.css > budgets.cssSize) {
      issues.push({
        budget: 'CSS Bundle Size',
        actual: `${Math.round(resourceSizes.css / 1024)}KB`,
        limit: `${Math.round(budgets.cssSize / 1024)}KB`,
        severity: 'Medium',
        violation: Math.round((resourceSizes.css - budgets.cssSize) / 1024)
      });
      score -= 5;
    }

    if (resourceSizes.image > budgets.imageSize) {
      issues.push({
        budget: 'Image Bundle Size',
        actual: `${Math.round(resourceSizes.image / 1024)}KB`,
        limit: `${Math.round(budgets.imageSize / 1024)}KB`,
        severity: 'Medium',
        violation: Math.round((resourceSizes.image - budgets.imageSize) / 1024)
      });
      score -= 8;
    }

    //validate request count budgets
    if (requestCounts.total > budgets.totalRequests) {
      issues.push({
        budget: 'Total Requests',
        actual: `${requestCounts.total} requests`,
        limit: `${budgets.totalRequests} requests`,
        severity: 'Medium',
        violation: requestCounts.total - budgets.totalRequests
      });
      score -= 10;
    }

    if (requestCounts.js > budgets.jsRequests) {
      issues.push({
        budget: 'JavaScript Requests',
        actual: `${requestCounts.js} requests`,
        limit: `${budgets.jsRequests} requests`,
        severity: 'Medium',
        violation: requestCounts.js - budgets.jsRequests
      });
      score -= 5;
    }

    //analyze timing metrics from trace
    const traceEvents = trace.traceEvents;
    const navigationStart = traceEvents.find(e => e.name === 'navigationStart')?.ts || 0;
    
    const domContentLoaded = traceEvents.find(e => e.name === 'domContentLoadedEventEnd')?.ts;
    const loadComplete = traceEvents.find(e => e.name === 'loadEventEnd')?.ts;
    const firstPaint = traceEvents.find(e => e.name === 'firstPaint')?.ts;

    if (domContentLoaded && navigationStart) {
      const domTime = (domContentLoaded - navigationStart) / 1000; //convert to ms
      if (domTime > budgets.domContentLoaded) {
        issues.push({
          budget: 'DOM Content Loaded',
          actual: `${Math.round(domTime)}ms`,
          limit: `${budgets.domContentLoaded}ms`,
          severity: 'High',
          violation: Math.round(domTime - budgets.domContentLoaded)
        });
        score -= 12;
      }
    }

    if (loadComplete && navigationStart) {
      const loadTime = (loadComplete - navigationStart) / 1000;
      if (loadTime > budgets.loadComplete) {
        issues.push({
          budget: 'Load Complete',
          actual: `${Math.round(loadTime)}ms`,
          limit: `${budgets.loadComplete}ms`,
          severity: 'Medium',
          violation: Math.round(loadTime - budgets.loadComplete)
        });
        score -= 8;
      }
    }

    if (firstPaint && navigationStart) {
      const paintTime = (firstPaint - navigationStart) / 1000;
      if (paintTime > budgets.firstPaint) {
        issues.push({
          budget: 'First Paint',
          actual: `${Math.round(paintTime)}ms`,
          limit: `${budgets.firstPaint}ms`,
          severity: 'High',
          violation: Math.round(paintTime - budgets.firstPaint)
        });
        score -= 10;
      }
    }

    //check for performance regression indicators
    const slowResources = networkRecords.filter(record => 
      record.endTime - record.startTime > 2000 //resources taking >2s
    );

    if (slowResources.length > 0) {
      issues.push({
        budget: 'Slow Resources',
        actual: `${slowResources.length} slow resources`,
        limit: '0 slow resources',
        severity: 'Medium',
        violation: slowResources.length
      });
      score -= slowResources.length * 3;
    }

    const passed = score >= 80 && issues.length === 0;

    return {
      score: Math.max(0, score) / 100,
      numericValue: issues.length,
      numericUnit: 'count',
      displayValue: passed ? 
        'All performance budgets met' :
        `${issues.length} budget violations detected`,
      details: {
        type: 'table',
        headings: [
          {key: 'budget', itemType: 'text', text: 'Performance Budget'},
          {key: 'actual', itemType: 'text', text: 'Actual'},
          {key: 'limit', itemType: 'text', text: 'Budget Limit'},
          {key: 'severity', itemType: 'text', text: 'Severity'},
          {key: 'violation', itemType: 'text', text: 'Over Budget'}
        ],
        items: issues
      }
    };
  }
}

module.exports = PerformanceBudgetValidatorAudit;