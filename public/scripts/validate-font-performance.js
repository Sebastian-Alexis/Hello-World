//font performance validation system
//automated testing and budget enforcement

(function() {
  'use strict';

  //validation configuration
  const VALIDATION_CONFIG = {
    budgets: {
      lcp: 2500, //ms
      fid: 100, //ms  
      cls: 0.1, //unitless
      ttfb: 800, //ms
      fcp: 1800, //ms
      inp: 200, //ms
      fontLoad: 200, //ms
      fontCLS: 0.05 //cls units from fonts
    },
    
    thresholds: {
      critical: 0.8, //80% of budget
      warning: 0.6 //60% of budget
    },

    platforms: {
      expected: {
        windows: ['Consolas', 'Lucida Console'],
        macos: ['Monaco', 'Lucida Console'], 
        linux: ['Liberation Mono', 'DejaVu Sans Mono'],
        mobile: ['monospace']
      },
      fallbackLimit: 0.2 //20% fallback usage acceptable
    }
  };

  //font performance validator
  class FontPerformanceValidator {
    constructor() {
      this.results = {
        passed: 0,
        failed: 0,
        warnings: 0,
        tests: []
      };
      
      this.initialized = false;
    }

    async run() {
      console.group('font performance validation');
      
      this.results = { passed: 0, failed: 0, warnings: 0, tests: [] };
      
      //wait for font performance monitor to be ready
      await this.waitForFontMonitor();
      
      //run validation tests
      await this.validateFontLoading();
      await this.validateCLSImpact();
      await this.validateCrossplatform();
      await this.validateOverallPerformance();
      
      //generate report
      const report = this.generateReport();
      
      console.log('validation results:', report);
      console.groupEnd();
      
      return report;
    }

    async waitForFontMonitor() {
      //wait up to 5 seconds for font monitor to initialize
      let attempts = 0;
      while (!window.fontPerformance && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
      
      if (!window.fontPerformance) {
        this.addTest('font-monitor-init', false, 'font performance monitor not available');
        return;
      }

      //wait for initial metrics
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    async validateFontLoading() {
      if (!window.fontPerformance) return;

      const analysis = window.fontPerformance.getAnalysis();
      const metrics = analysis.metrics;

      //test: font loading time
      const loadTimeTest = metrics.avgLoadTime <= VALIDATION_CONFIG.budgets.fontLoad;
      this.addTest(
        'font-load-time',
        loadTimeTest,
        `avg load time: ${metrics.avgLoadTime.toFixed(2)}ms (budget: ${VALIDATION_CONFIG.budgets.fontLoad}ms)`,
        metrics.avgLoadTime > VALIDATION_CONFIG.budgets.fontLoad * VALIDATION_CONFIG.thresholds.critical
      );

      //test: font availability by platform
      const platformInfo = analysis.platform;
      const expectedFonts = VALIDATION_CONFIG.platforms.expected[platformInfo.name] || ['monospace'];
      
      //check if at least one expected font is available
      const availabilityResults = await window.fontPerformance.checkFontAvailability();
      const hasExpectedFont = expectedFonts.some(font => availabilityResults[font] === true);
      
      this.addTest(
        'font-availability',
        hasExpectedFont,
        `platform: ${platformInfo.name}, expected: ${expectedFonts.join(', ')}, available: ${Object.entries(availabilityResults).filter(([name, avail]) => avail).map(([name]) => name).join(', ')}`
      );

      //test: fallback usage rate
      const fallbackTest = metrics.fallbackRate <= VALIDATION_CONFIG.platforms.fallbackLimit;
      this.addTest(
        'fallback-usage',
        fallbackTest,
        `fallback rate: ${(metrics.fallbackRate * 100).toFixed(1)}% (limit: ${VALIDATION_CONFIG.platforms.fallbackLimit * 100}%)`,
        metrics.fallbackRate > VALIDATION_CONFIG.platforms.fallbackLimit * 1.5
      );
    }

    async validateCLSImpact() {
      if (!window.fontPerformance) return;

      const analysis = window.fontPerformance.getAnalysis();
      const metrics = analysis.metrics;

      //test: font-related cls
      const clsTest = metrics.totalCLS <= VALIDATION_CONFIG.budgets.fontCLS;
      this.addTest(
        'font-cls-impact',
        clsTest,
        `font cls: ${metrics.totalCLS.toFixed(4)} (budget: ${VALIDATION_CONFIG.budgets.fontCLS})`,
        metrics.totalCLS > VALIDATION_CONFIG.budgets.fontCLS * 2
      );

      //test: check if font-display swap is working
      const hasSwapOptimization = this.checkFontDisplaySwap();
      this.addTest(
        'font-display-optimization',
        hasSwapOptimization,
        hasSwapOptimization ? 'font-display: swap detected' : 'font-display: swap not found in stylesheets'
      );
    }

    checkFontDisplaySwap() {
      //check for font-display: swap in stylesheets
      const stylesheets = Array.from(document.styleSheets);
      
      for (const stylesheet of stylesheets) {
        try {
          const rules = Array.from(stylesheet.cssRules || stylesheet.rules || []);
          
          for (const rule of rules) {
            if (rule.type === CSSRule.FONT_FACE_RULE) {
              const fontDisplay = rule.style.getPropertyValue('font-display');
              if (fontDisplay === 'swap') {
                return true;
              }
            }
          }
        } catch (error) {
          //ignore cross-origin stylesheets
          continue;
        }
      }
      
      return false;
    }

    async validateCrossplatform() {
      if (!window.fontPerformance) return;

      const analysis = window.fontPerformance.getAnalysis();
      const platformInfo = analysis.platform;

      //test: platform detection
      const platformTest = platformInfo.name !== 'unknown';
      this.addTest(
        'platform-detection',
        platformTest,
        `detected platform: ${platformInfo.name}`
      );

      //test: expected fonts for platform
      const expectedFonts = platformInfo.expectedFonts || [];
      const hasExpectedFonts = expectedFonts.length > 0;
      this.addTest(
        'platform-fonts',
        hasExpectedFonts,
        `expected fonts for ${platformInfo.name}: ${expectedFonts.join(', ')}`
      );

      //test: monospace consistency
      const monoTest = await this.testMonospaceConsistency();
      this.addTest(
        'monospace-consistency',
        monoTest.consistent,
        monoTest.message
      );
    }

    async testMonospaceConsistency() {
      //test if monospace fonts render consistently
      const testText = 'abcdefghijklmnopqrstuvwxyz0123456789';
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        return { consistent: false, message: 'canvas not available for testing' };
      }

      //measure different monospace fonts
      const fonts = ['Courier New', 'Monaco', 'Consolas', 'monospace'];
      const measurements = {};

      fonts.forEach(font => {
        context.font = `16px "${font}", monospace`;
        measurements[font] = context.measureText(testText).width;
      });

      //check if measurements are reasonably consistent (within 10%)
      const widths = Object.values(measurements);
      const minWidth = Math.min(...widths);
      const maxWidth = Math.max(...widths);
      const variation = (maxWidth - minWidth) / minWidth;

      const consistent = variation < 0.1; //10% variation allowed
      
      return {
        consistent,
        message: `width variation: ${(variation * 100).toFixed(1)}% (${Object.entries(measurements).map(([font, width]) => `${font}: ${width}px`).join(', ')})`
      };
    }

    async validateOverallPerformance() {
      //integrate with existing performance tracker if available
      if (window.performanceTracker) {
        const summary = window.performanceTracker.getPerformanceSummary();
        
        //test: overall performance score
        const scoreTest = summary.overallScore >= 80;
        this.addTest(
          'overall-performance',
          scoreTest,
          `performance score: ${summary.overallScore}/100`,
          summary.overallScore < 60
        );

        //test: core web vitals
        Object.entries(summary.vitals).forEach(([metric, data]) => {
          const budget = VALIDATION_CONFIG.budgets[metric.toLowerCase()];
          if (budget) {
            const passed = data.value <= budget;
            this.addTest(
              `core-vital-${metric.toLowerCase()}`,
              passed,
              `${metric}: ${data.value} (budget: ${budget}, rating: ${data.rating})`,
              data.rating === 'poor'
            );
          }
        });
      }

      //test: no javascript errors affecting fonts
      const errorTest = this.checkForFontErrors();
      this.addTest(
        'font-errors',
        errorTest.passed,
        errorTest.message
      );
    }

    checkForFontErrors() {
      //check console for font-related errors
      const errors = window.fontPerformanceErrors || [];
      
      if (errors.length === 0) {
        return { passed: true, message: 'no font-related errors detected' };
      }

      return { 
        passed: false, 
        message: `${errors.length} font errors: ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}` 
      };
    }

    addTest(name, passed, message, isCritical = false) {
      const test = {
        name,
        passed,
        message,
        isCritical,
        timestamp: Date.now()
      };

      this.results.tests.push(test);

      if (passed) {
        this.results.passed++;
        console.log(`✅ ${name}: ${message}`);
      } else if (isCritical) {
        this.results.failed++;
        console.error(`❌ ${name}: ${message}`);
      } else {
        this.results.warnings++;
        console.warn(`⚠️ ${name}: ${message}`);
      }
    }

    generateReport() {
      const total = this.results.passed + this.results.failed + this.results.warnings;
      const passRate = total > 0 ? (this.results.passed / total * 100).toFixed(1) : 0;
      
      const report = {
        summary: {
          total,
          passed: this.results.passed,
          failed: this.results.failed,
          warnings: this.results.warnings,
          passRate: `${passRate}%`,
          status: this.getOverallStatus()
        },
        tests: this.results.tests,
        recommendations: this.getRecommendations(),
        timestamp: Date.now()
      };

      //emit validation event
      const event = new CustomEvent('font-validation-complete', {
        detail: report
      });
      window.dispatchEvent(event);

      return report;
    }

    getOverallStatus() {
      if (this.results.failed > 0) return 'FAILED';
      if (this.results.warnings > 2) return 'WARNING';
      return 'PASSED';
    }

    getRecommendations() {
      const recommendations = [];
      const criticalTests = this.results.tests.filter(t => !t.passed && t.isCritical);
      const warningTests = this.results.tests.filter(t => !t.passed && !t.isCritical);

      if (criticalTests.length > 0) {
        recommendations.push('CRITICAL: Address failed tests immediately');
        criticalTests.forEach(test => {
          recommendations.push(`- Fix ${test.name}: ${test.message}`);
        });
      }

      if (warningTests.length > 0) {
        recommendations.push('WARNINGS: Consider optimizing');
        warningTests.forEach(test => {
          recommendations.push(`- Optimize ${test.name}: ${test.message}`);
        });
      }

      //add font-specific recommendations
      if (window.fontPerformance) {
        const fontRecs = window.fontPerformance.getRecommendations();
        recommendations.push(...fontRecs);
      }

      if (recommendations.length === 0) {
        recommendations.push('All font performance tests passed! ✨');
      }

      return recommendations;
    }

    //continuous monitoring
    startContinuousValidation(intervalMinutes = 5) {
      console.log(`starting continuous font validation (every ${intervalMinutes} minutes)`);
      
      setInterval(async () => {
        const report = await this.run();
        
        if (report.summary.status === 'FAILED') {
          console.error('font performance validation failed:', report);
          
          //emit critical alert
          const alert = new CustomEvent('font-performance-alert', {
            detail: {
              severity: 'critical',
              message: 'font performance validation failed',
              report
            }
          });
          window.dispatchEvent(alert);
        }
      }, intervalMinutes * 60 * 1000);
    }
  }

  //create global validator
  window.validateFontPerformance = new FontPerformanceValidator();

  //auto-run validation after page load
  if (document.readyState === 'complete') {
    setTimeout(() => window.validateFontPerformance.run(), 2000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => window.validateFontPerformance.run(), 2000);
    });
  }

  //add error tracking for fonts
  window.fontPerformanceErrors = [];
  
  window.addEventListener('error', (event) => {
    if (event.message && event.message.toLowerCase().includes('font')) {
      window.fontPerformanceErrors.push(event.message);
    }
  });

  console.log('font performance validation system loaded');
})();