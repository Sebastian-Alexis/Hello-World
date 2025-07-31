//font performance validation for monospace transition
//validates that performance budgets are maintained after font changes

interface PerformanceBudgets {
  LCP: number;
  FID: number;
  CLS: number;
  TTFB: number;
  FCP: number;
  INP: number;
  FONT_LOAD_TIME: number;
  FONT_CLS_IMPACT: number;
}

interface FontValidationResult {
  passed: boolean;
  violations: string[];
  metrics: {
    fontLoadTime: number;
    fontCLSImpact: number;
    totalCLS: number;
    lcp: number;
    fcp: number;
  };
  recommendations: string[];
  score: number;
}

const STRICT_BUDGETS: PerformanceBudgets = {
  LCP: 2500,        // ms - your requirement
  FID: 100,         // ms - your requirement  
  CLS: 0.1,         // unitless - your requirement
  TTFB: 800,        // ms - your requirement
  FCP: 1800,        // ms - your requirement
  INP: 200,         // ms - your requirement
  FONT_LOAD_TIME: 200,  // ms - additional font budget
  FONT_CLS_IMPACT: 0.05 // unitless - font-specific CLS budget
};

class FontPerformanceValidator {
  private budgets: PerformanceBudgets;
  private validationResults: FontValidationResult[] = [];
  
  constructor(customBudgets?: Partial<PerformanceBudgets>) {
    this.budgets = { ...STRICT_BUDGETS, ...customBudgets };
  }

  async validateFontPerformance(): Promise<FontValidationResult> {
    const startTime = performance.now();
    const violations: string[] = [];
    const recommendations: string[] = [];
    
    try {
      //measure font loading time
      const fontLoadTime = await this.measureFontLoadTime();
      
      //measure font-specific CLS
      const fontCLSImpact = await this.measureFontCLS();
      
      //get current core web vitals
      const webVitals = await this.getCurrentWebVitals();
      
      //validate against budgets
      if (webVitals.lcp > this.budgets.LCP) {
        violations.push(`LCP ${webVitals.lcp}ms exceeds budget of ${this.budgets.LCP}ms`);
        recommendations.push('optimize LCP by preloading critical fonts and reducing font swap time');
      }
      
      if (webVitals.fcp > this.budgets.FCP) {
        violations.push(`FCP ${webVitals.fcp}ms exceeds budget of ${this.budgets.FCP}ms`);
        recommendations.push('improve FCP by implementing font-display: swap and fallback fonts');
      }
      
      if (webVitals.cls > this.budgets.CLS) {
        violations.push(`CLS ${webVitals.cls} exceeds budget of ${this.budgets.CLS}`);
        recommendations.push('reduce CLS by using size-adjust and ascent-override for font fallbacks');
      }
      
      if (fontLoadTime > this.budgets.FONT_LOAD_TIME) {
        violations.push(`font load time ${fontLoadTime}ms exceeds budget of ${this.budgets.FONT_LOAD_TIME}ms`);
        recommendations.push('preload critical fonts and optimize font stack order');
      }
      
      if (fontCLSImpact > this.budgets.FONT_CLS_IMPACT) {
        violations.push(`font CLS impact ${fontCLSImpact} exceeds budget of ${this.budgets.FONT_CLS_IMPACT}`);
        recommendations.push('implement font metric overrides to match fallback dimensions');
      }
      
      //calculate performance score
      const score = this.calculatePerformanceScore(webVitals, fontLoadTime, fontCLSImpact);
      
      const result: FontValidationResult = {
        passed: violations.length === 0,
        violations,
        metrics: {
          fontLoadTime,
          fontCLSImpact,
          totalCLS: webVitals.cls,
          lcp: webVitals.lcp,
          fcp: webVitals.fcp
        },
        recommendations,
        score
      };
      
      this.validationResults.push(result);
      
      //emit validation event
      this.emitValidationEvent(result);
      
      return result;
      
    } catch (error) {
      console.error('font performance validation failed:', error);
      return {
        passed: false,
        violations: ['validation failed due to error'],
        metrics: { fontLoadTime: 0, fontCLSImpact: 0, totalCLS: 0, lcp: 0, fcp: 0 },
        recommendations: ['retry validation after page load completes'],
        score: 0
      };
    }
  }
  
  private async measureFontLoadTime(): Promise<number> {
    if (!('fonts' in document)) return 0;
    
    const startTime = performance.now();
    
    try {
      //wait for all fonts to load
      await document.fonts.ready;
      return performance.now() - startTime;
    } catch {
      //fallback measurement
      return this.fallbackFontLoadMeasurement();
    }
  }
  
  private fallbackFontLoadMeasurement(): number {
    //measure time for font rendering to stabilize
    const startTime = performance.now();
    const testElement = document.createElement('div');
    testElement.style.fontFamily = 'var(--font-primary)';
    testElement.style.position = 'absolute';
    testElement.style.visibility = 'hidden';
    testElement.textContent = 'font loading test';
    
    document.body.appendChild(testElement);
    const loadTime = performance.now() - startTime;
    document.body.removeChild(testElement);
    
    return loadTime;
  }
  
  private async measureFontCLS(): Promise<number> {
    return new Promise((resolve) => {
      let fontCLS = 0;
      const startTime = performance.now();
      
      if (!('PerformanceObserver' in window)) {
        resolve(0);
        return;
      }
      
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          //only count CLS from font swaps (typically within first 2 seconds)
          if (entry.startTime - startTime < 2000 && !entry.hadRecentInput) {
            fontCLS += entry.value;
          }
        });
      });
      
      observer.observe({ type: 'layout-shift', buffered: true });
      
      //measure for 3 seconds to capture font swap CLS
      setTimeout(() => {
        observer.disconnect();
        resolve(fontCLS);
      }, 3000);
    });
  }
  
  private async getCurrentWebVitals(): Promise<{
    lcp: number;
    fcp: number;
    cls: number;
    fid: number;
    ttfb: number;
    inp: number;
  }> {
    //get performance entries
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paintEntries = performance.getEntriesByType('paint');
    
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
    const ttfb = navigation?.responseStart - navigation?.requestStart || 0;
    
    //for LCP, CLS, FID, INP we need to use existing tracker or estimate
    const vitalsData = this.getExistingVitalsData();
    
    return {
      lcp: vitalsData.lcp || 0,
      fcp: fcp,
      cls: vitalsData.cls || 0,
      fid: vitalsData.fid || 0,
      ttfb: ttfb,
      inp: vitalsData.inp || 0
    };
  }
  
  private getExistingVitalsData(): any {
    //try to get data from existing performance tracker
    if (typeof window !== 'undefined' && (window as any).performanceTracker) {
      const summary = (window as any).performanceTracker.getPerformanceSummary();
      return {
        lcp: summary.vitals.LCP?.value || 0,
        cls: summary.vitals.CLS?.value || 0,
        fid: summary.vitals.FID?.value || 0,
        inp: summary.vitals.INP?.value || 0
      };
    }
    
    //fallback to estimates based on current performance
    return {
      lcp: this.estimateLCP(),
      cls: 0, //will be measured separately
      fid: 0, //hard to estimate
      inp: 0  //hard to estimate
    };
  }
  
  private estimateLCP(): number {
    //estimate LCP based on load timing
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (!navigation) return 0;
    
    //rough estimate: dom content loaded + font load time
    const domContentLoaded = navigation.domContentLoadedEventStart - navigation.fetchStart;
    const estimatedFontTime = 200; //conservative estimate
    
    return domContentLoaded + estimatedFontTime;
  }
  
  private calculatePerformanceScore(
    vitals: any, 
    fontLoadTime: number, 
    fontCLSImpact: number
  ): number {
    let score = 100;
    
    //deduct points for budget violations
    if (vitals.lcp > this.budgets.LCP) {
      score -= Math.min(30, (vitals.lcp - this.budgets.LCP) / 100);
    }
    
    if (vitals.fcp > this.budgets.FCP) {
      score -= Math.min(20, (vitals.fcp - this.budgets.FCP) / 100);
    }
    
    if (vitals.cls > this.budgets.CLS) {
      score -= Math.min(25, (vitals.cls - this.budgets.CLS) * 100);
    }
    
    if (fontLoadTime > this.budgets.FONT_LOAD_TIME) {
      score -= Math.min(15, (fontLoadTime - this.budgets.FONT_LOAD_TIME) / 10);
    }
    
    if (fontCLSImpact > this.budgets.FONT_CLS_IMPACT) {
      score -= Math.min(10, (fontCLSImpact - this.budgets.FONT_CLS_IMPACT) * 100);
    }
    
    return Math.max(0, Math.round(score));
  }
  
  private emitValidationEvent(result: FontValidationResult): void {
    const event = new CustomEvent('font-validation-complete', {
      detail: {
        result,
        timestamp: Date.now(),
        budgets: this.budgets
      }
    });
    window.dispatchEvent(event);
    
    //log results in development
    if (import.meta.env?.DEV) {
      console.group('font performance validation');
      console.log('passed:', result.passed);
      console.log('score:', result.score);
      console.log('metrics:', result.metrics);
      if (result.violations.length > 0) {
        console.warn('violations:', result.violations);
      }
      if (result.recommendations.length > 0) {
        console.info('recommendations:', result.recommendations);
      }
      console.groupEnd();
    }
  }
  
  //public API
  public async runValidation(): Promise<FontValidationResult> {
    return this.validateFontPerformance();
  }
  
  public getValidationHistory(): FontValidationResult[] {
    return [...this.validationResults];
  }
  
  public setBudgets(budgets: Partial<PerformanceBudgets>): void {
    this.budgets = { ...this.budgets, ...budgets };
  }
  
  public getBudgets(): PerformanceBudgets {
    return { ...this.budgets };
  }
  
  //continuous monitoring
  public startContinuousValidation(intervalMs: number = 30000): NodeJS.Timeout {
    return setInterval(async () => {
      const result = await this.validateFontPerformance();
      
      //emit alert if validation fails
      if (!result.passed) {
        const alertEvent = new CustomEvent('font-performance-alert', {
          detail: {
            violations: result.violations,
            recommendations: result.recommendations,
            timestamp: Date.now()
          }
        });
        window.dispatchEvent(alertEvent);
      }
    }, intervalMs);
  }
}

//create validator instance with your strict budgets
export const fontValidator = new FontPerformanceValidator(STRICT_BUDGETS);

//utility functions
export const fontValidationUtils = {
  //quick validation check
  async quickCheck(): Promise<boolean> {
    const result = await fontValidator.runValidation();
    return result.passed;
  },
  
  //get performance recommendations
  async getRecommendations(): Promise<string[]> {
    const result = await fontValidator.runValidation();
    return result.recommendations;
  },
  
  //check specific metric
  async checkMetric(metric: keyof PerformanceBudgets): Promise<boolean> {
    const result = await fontValidator.runValidation();
    const budgets = fontValidator.getBudgets();
    
    switch (metric) {
      case 'LCP':
        return result.metrics.lcp <= budgets.LCP;
      case 'CLS':
        return result.metrics.totalCLS <= budgets.CLS;
      case 'FCP':
        return result.metrics.fcp <= budgets.FCP;
      case 'FONT_LOAD_TIME':
        return result.metrics.fontLoadTime <= budgets.FONT_LOAD_TIME;
      case 'FONT_CLS_IMPACT':
        return result.metrics.fontCLSImpact <= budgets.FONT_CLS_IMPACT;
      default:
        return true;
    }
  },
  
  //create performance report
  async generateReport(): Promise<{
    summary: string;
    details: FontValidationResult;
    actionItems: string[];
  }> {
    const result = await fontValidator.runValidation();
    
    const summary = result.passed 
      ? `✅ Font performance validation passed (score: ${result.score}/100)`
      : `❌ Font performance validation failed (score: ${result.score}/100)`;
    
    const actionItems = result.recommendations.concat(
      result.violations.map(v => `fix: ${v}`)
    );
    
    return {
      summary,
      details: result,
      actionItems
    };
  }
};

//browser integration
if (typeof window !== 'undefined') {
  //add to global for debugging
  if (import.meta.env?.DEV) {
    (window as any).fontValidator = fontValidator;
    (window as any).fontValidationUtils = fontValidationUtils;
  }
  
  //run initial validation after page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      //delay to allow fonts to load
      setTimeout(async () => {
        const result = await fontValidator.runValidation();
        console.log('initial font performance validation:', result.passed ? 'passed' : 'failed');
      }, 2000);
    });
  } else {
    setTimeout(async () => {
      const result = await fontValidator.runValidation();
      console.log('font performance validation:', result.passed ? 'passed' : 'failed');
    }, 1000);
  }
}

//export types
export type { PerformanceBudgets, FontValidationResult };
export { FontPerformanceValidator };