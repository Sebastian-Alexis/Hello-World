//font performance testing script
//run this in browser console to test font performance impact

(function() {
  'use strict';
  
  //performance testing utilities
  window.fontPerformanceTest = {
    //test font loading time
    async testFontLoadTime() {
      console.log('testing font load time...');
      
      const startTime = performance.now();
      
      //create test element with monospace font
      const testElement = document.createElement('div');
      testElement.style.fontFamily = 'var(--font-primary)';
      testElement.style.position = 'absolute';
      testElement.style.visibility = 'hidden';
      testElement.style.fontSize = '16px';
      testElement.innerHTML = 'The quick brown fox jumps over the lazy dog 1234567890';
      
      document.body.appendChild(testElement);
      
      //wait for fonts to load
      if ('fonts' in document) {
        await document.fonts.ready;
      }
      
      const loadTime = performance.now() - startTime;
      document.body.removeChild(testElement);
      
      console.log(`font load time: ${loadTime.toFixed(2)}ms`);
      return loadTime;
    },
    
    //test CLS impact of font swap
    async testFontCLS() {
      console.log('testing font CLS impact...');
      
      return new Promise((resolve) => {
        let clsValue = 0;
        const startTime = performance.now();
        
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (!entry.hadRecentInput && entry.startTime - startTime < 3000) {
              clsValue += entry.value;
            }
          });
        });
        
        observer.observe({ type: 'layout-shift', buffered: true });
        
        //create font swap to trigger CLS
        const testText = document.createElement('div');
        testText.innerHTML = 'Testing font swap CLS impact with different text sizes and weights';
        testText.style.fontSize = '24px';
        testText.style.fontWeight = 'bold';
        testText.style.fontFamily = 'Times, serif'; //different font first
        document.body.appendChild(testText);
        
        setTimeout(() => {
          //swap to monospace
          testText.style.fontFamily = 'var(--font-primary)';
        }, 100);
        
        setTimeout(() => {
          observer.disconnect();
          document.body.removeChild(testText);
          console.log(`font CLS impact: ${clsValue.toFixed(4)}`);
          resolve(clsValue);
        }, 3000);
      });
    },
    
    //test cross-platform font availability
    testFontAvailability() {
      console.log('testing font availability...');
      
      const fonts = ['Courier New', 'Consolas', 'Lucida Console', 'Monaco', 'Liberation Mono'];
      const results = {};
      
      fonts.forEach(font => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (context) {
          //baseline measurement
          context.font = '12px monospace';
          const baseWidth = context.measureText('test').width;
          
          //font test
          context.font = `12px "${font}", monospace`;
          const testWidth = context.measureText('test').width;
          
          results[font] = Math.abs(testWidth - baseWidth) > 0.1;
        }
      });
      
      console.log('font availability:', results);
      return results;
    },
    
    //run comprehensive font performance test
    async runFullTest() {
      console.group('comprehensive font performance test');
      
      try {
        //test current performance
        const currentMetrics = await this.getCurrentVitals();
        console.log('current metrics:', currentMetrics);
        
        //test font loading
        const fontLoadTime = await this.testFontLoadTime();
        
        //test font availability
        const availability = this.testFontAvailability();
        
        //test CLS impact
        const clsImpact = await this.testFontCLS();
        
        //calculate score
        const score = this.calculateScore(currentMetrics, fontLoadTime, clsImpact);
        
        const results = {
          metrics: currentMetrics,
          fontLoadTime,
          availability,
          clsImpact,
          score,
          passed: score >= 85,
          budgetViolations: this.checkBudgets(currentMetrics, fontLoadTime, clsImpact)
        };
        
        console.log('test results:', results);
        
        //provide recommendations
        const recommendations = this.getRecommendations(results);
        if (recommendations.length > 0) {
          console.warn('recommendations:', recommendations);
        }
        
        return results;
        
      } catch (error) {
        console.error('test failed:', error);
        return { error: error.message };
      } finally {
        console.groupEnd();
      }
    },
    
    //get current web vitals
    async getCurrentVitals() {
      const vitals = {};
      
      //check if performance tracker is available
      if (window.performanceTracker) {
        const summary = window.performanceTracker.getPerformanceSummary();
        Object.entries(summary.vitals).forEach(([key, value]) => {
          vitals[key] = value.value;
        });
      }
      
      //add paint metrics
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcp) vitals.FCP = fcp.startTime;
      
      //add navigation metrics
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        vitals.TTFB = navigation.responseStart - navigation.requestStart;
      }
      
      return vitals;
    },
    
    //calculate performance score
    calculateScore(metrics, fontLoadTime, clsImpact) {
      let score = 100;
      
      //deduct for slow metrics
      if (metrics.LCP > 2500) score -= 20;
      if (metrics.FCP > 1800) score -= 15;
      if (metrics.CLS > 0.1) score -= 25;
      if (fontLoadTime > 200) score -= 15;
      if (clsImpact > 0.05) score -= 15;
      
      return Math.max(0, score);
    },
    
    //check budget violations
    checkBudgets(metrics, fontLoadTime, clsImpact) {
      const budgets = {
        LCP: 2500,
        FID: 100,
        CLS: 0.1,
        TTFB: 800,
        FCP: 1800,
        INP: 200,
        FONT_LOAD_TIME: 200,
        FONT_CLS_IMPACT: 0.05
      };
      
      const violations = [];
      
      Object.entries(budgets).forEach(([metric, budget]) => {
        let value;
        
        switch (metric) {
          case 'FONT_LOAD_TIME':
            value = fontLoadTime;
            break;
          case 'FONT_CLS_IMPACT':
            value = clsImpact;
            break;
          default:
            value = metrics[metric];
        }
        
        if (value && value > budget) {
          violations.push(`${metric}: ${value} > ${budget}`);
        }
      });
      
      return violations;
    },
    
    //get optimization recommendations
    getRecommendations(results) {
      const recommendations = [];
      
      if (results.fontLoadTime > 200) {
        recommendations.push('preload critical fonts to reduce load time');
      }
      
      if (results.clsImpact > 0.05) {
        recommendations.push('implement font metric overrides to prevent CLS');
        recommendations.push('use font-display: swap with size-adjust');
      }
      
      if (results.metrics.LCP > 2500) {
        recommendations.push('optimize LCP by reducing font swap time');
      }
      
      //check font availability
      const availableFonts = Object.values(results.availability).filter(Boolean).length;
      if (availableFonts < 2) {
        recommendations.push('add more fallback fonts for better cross-platform support');
      }
      
      if (results.score < 85) {
        recommendations.push('overall performance needs improvement - review all metrics');
      }
      
      return recommendations;
    },
    
    //monitor performance continuously
    startMonitoring(intervalMs = 30000) {
      console.log(`starting font performance monitoring (${intervalMs}ms interval)`);
      
      return setInterval(async () => {
        const results = await this.runFullTest();
        
        if (results.score < 85) {
          console.warn('performance degradation detected:', results);
        }
        
        //emit custom event
        window.dispatchEvent(new CustomEvent('font-performance-check', {
          detail: results
        }));
        
      }, intervalMs);
    }
  };
  
  //auto-run basic test on load
  if (document.readyState === 'complete') {
    setTimeout(() => {
      console.log('running automatic font performance check...');
      window.fontPerformanceTest.runFullTest();
    }, 1000);
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => {
        console.log('running automatic font performance check...');
        window.fontPerformanceTest.runFullTest();
      }, 1000);
    });
  }
  
  //add easy console commands
  console.log('font performance test utilities loaded:');
  console.log('- fontPerformanceTest.runFullTest() - run comprehensive test');
  console.log('- fontPerformanceTest.testFontLoadTime() - test font loading');
  console.log('- fontPerformanceTest.testFontCLS() - test CLS impact');
  console.log('- fontPerformanceTest.testFontAvailability() - check font availability');
  console.log('- fontPerformanceTest.startMonitoring() - continuous monitoring');
  
})();