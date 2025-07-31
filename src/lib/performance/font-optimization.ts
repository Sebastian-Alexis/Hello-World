//font performance optimization for monospace fonts
//tracks loading, cls prevention, and cross-platform consistency

interface FontMetrics {
  name: string;
  loadTime: number;
  isAvailable: boolean;
  fallbackUsed: boolean;
  clsImpact: number;
  renderTime: number;
}

interface FontPerformanceData {
  primaryFont: FontMetrics;
  fallbackChain: FontMetrics[];
  totalLoadTime: number;
  clsEvents: number;
  platform: string;
  userAgent: string;
  timestamp: number;
}

class FontOptimizer {
  private fontMetrics: FontMetrics[] = [];
  private clsObserver?: PerformanceObserver;
  private fontFaceObserver?: FontFaceObserver;
  private platformInfo: any = {};
  
  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeFontTracking();
      this.detectPlatform();
      this.setupCLSMonitoring();
    }
  }

  private initializeFontTracking(): void {
    //track font loading performance
    if ('fonts' in document) {
      document.fonts.addEventListener('loadingstart', this.handleFontLoadStart.bind(this));
      document.fonts.addEventListener('loadingdone', this.handleFontLoadDone.bind(this));
      document.fonts.addEventListener('loadingerror', this.handleFontLoadError.bind(this));
    }

    //precheck font availability
    this.checkFontAvailability();
  }

  private detectPlatform(): void {
    const ua = navigator.userAgent.toLowerCase();
    
    this.platformInfo = {
      isWindows: ua.includes('windows'),
      isMacOS: ua.includes('macintosh') || ua.includes('mac os'),
      isLinux: ua.includes('linux') && !ua.includes('android'),
      isMobile: /android|iphone|ipad|ipod/.test(ua),
      primaryFont: this.getPrimaryMonospaceFont()
    };
  }

  private getPrimaryMonospaceFont(): string {
    const { isWindows, isMacOS, isLinux } = this.platformInfo;
    
    if (isWindows) return 'Consolas';
    if (isMacOS) return 'Monaco';
    if (isLinux) return 'Liberation Mono';
    return 'monospace';
  }

  private async checkFontAvailability(): Promise<void> {
    const monospaceFonts = ['Courier New', 'Lucida Console', 'Monaco', 'Consolas'];
    const startTime = performance.now();

    for (const fontName of monospaceFonts) {
      try {
        const isAvailable = await this.isFontAvailable(fontName);
        const loadTime = performance.now() - startTime;

        this.fontMetrics.push({
          name: fontName,
          loadTime,
          isAvailable,
          fallbackUsed: !isAvailable,
          clsImpact: 0,
          renderTime: loadTime
        });

        //break on first available font
        if (isAvailable) break;
      } catch (error) {
        console.warn(`font check failed for ${fontName}:`, error);
      }
    }

    //report font availability
    this.reportFontMetrics();
  }

  private async isFontAvailable(fontName: string): Promise<boolean> {
    if (!('fonts' in document)) return false;

    try {
      //use font loading api to check availability
      const font = new FontFace('test', `local("${fontName}")`);
      await font.load();
      return font.status === 'loaded';
    } catch {
      //fallback detection method
      return this.fallbackFontDetection(fontName);
    }
  }

  private fallbackFontDetection(fontName: string): boolean {
    //create canvas to measure font rendering
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return false;

    //measure baseline monospace font
    context.font = '12px monospace';
    const baselineWidth = context.measureText('test').width;

    //measure with target font
    context.font = `12px "${fontName}", monospace`;
    const testWidth = context.measureText('test').width;

    //if widths differ significantly, font is available
    return Math.abs(testWidth - baselineWidth) > 0.1;
  }

  private setupCLSMonitoring(): void {
    if (!('PerformanceObserver' in window)) return;

    try {
      this.clsObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.hadRecentInput) return; //ignore user-caused shifts

          //check if layout shift was font-related
          if (this.isFontRelatedCLS(entry)) {
            this.recordFontCLS(entry.value);
          }
        });
      });

      this.clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (error) {
      console.warn('cls monitoring setup failed:', error);
    }
  }

  private isFontRelatedCLS(entry: any): boolean {
    //heuristic: font-related cls typically happens within 2s of page load
    const timeSincePageLoad = entry.startTime;
    return timeSincePageLoad < 2000;
  }

  private recordFontCLS(clsValue: number): void {
    //update font metrics with cls impact
    this.fontMetrics.forEach(metric => {
      metric.clsImpact += clsValue;
    });

    //emit custom event for monitoring
    const event = new CustomEvent('font-cls-detected', {
      detail: { clsValue, timestamp: Date.now() }
    });
    window.dispatchEvent(event);
  }

  private handleFontLoadStart(event: any): void {
    console.log('font loading started:', event);
  }

  private handleFontLoadDone(event: any): void {
    console.log('font loading completed:', event);
    this.reportFontMetrics();
  }

  private handleFontLoadError(event: any): void {
    console.warn('font loading failed:', event);
  }

  private reportFontMetrics(): void {
    const performanceData: FontPerformanceData = {
      primaryFont: this.fontMetrics[0] || {
        name: 'fallback',
        loadTime: 0,
        isAvailable: true,
        fallbackUsed: true,
        clsImpact: 0,
        renderTime: 0
      },
      fallbackChain: this.fontMetrics,
      totalLoadTime: this.fontMetrics.reduce((sum, m) => sum + m.loadTime, 0),
      clsEvents: this.fontMetrics.reduce((sum, m) => sum + (m.clsImpact > 0 ? 1 : 0), 0),
      platform: this.platformInfo.primaryFont,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };

    //emit to performance tracker
    const event = new CustomEvent('font-performance-update', {
      detail: performanceData
    });
    window.dispatchEvent(event);

    //console logging for debugging
    if (import.meta.env?.DEV) {
      console.group('font performance metrics');
      console.log('platform:', this.platformInfo);
      console.log('available fonts:', this.fontMetrics.filter(m => m.isAvailable));
      console.log('fallback usage:', this.fontMetrics.filter(m => m.fallbackUsed));
      console.log('total cls impact:', this.fontMetrics.reduce((sum, m) => sum + m.clsImpact, 0));
      console.groupEnd();
    }
  }

  //public api for external usage
  public getFontMetrics(): FontMetrics[] {
    return [...this.fontMetrics];
  }

  public getPlatformInfo(): any {
    return { ...this.platformInfo };
  }

  public getOptimalFontStack(): string[] {
    const availableFonts = this.fontMetrics
      .filter(m => m.isAvailable)
      .sort((a, b) => a.loadTime - b.loadTime)
      .map(m => m.name);

    return availableFonts.length > 0 ? 
      availableFonts : 
      ['Courier New', 'monospace'];
  }

  public measureFontSwapCLS(): Promise<number> {
    return new Promise((resolve) => {
      let clsValue = 0;
      const startTime = performance.now();

      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry: any) => {
          if (entry.startTime - startTime < 1000) { //within 1s
            clsValue += entry.value;
          }
        });
      });

      observer.observe({ type: 'layout-shift' });

      setTimeout(() => {
        observer.disconnect();
        resolve(clsValue);
      }, 1000);
    });
  }

  public preloadOptimalFonts(): void {
    const optimalFonts = this.getOptimalFontStack().slice(0, 2);
    
    optimalFonts.forEach(fontName => {
      //create preload link for system fonts that might not be cached
      if (!this.isSystemFont(fontName)) {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'font';
        link.href = `data:font/truetype;charset=utf-8;base64,`; //placeholder
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    });
  }

  private isSystemFont(fontName: string): boolean {
    const systemFonts = ['Consolas', 'Monaco', 'Courier New', 'Lucida Console'];
    return systemFonts.includes(fontName);
  }

  public destroy(): void {
    if (this.clsObserver) {
      this.clsObserver.disconnect();
    }
  }
}

//export singleton instance
export const fontOptimizer = new FontOptimizer();

//export utilities
export const fontUtils = {
  //measure font rendering performance
  measureFontRender(text: string, fontFamily: string): number {
    const start = performance.now();
    
    const element = document.createElement('div');
    element.style.fontFamily = fontFamily;
    element.style.position = 'absolute';
    element.style.visibility = 'hidden';
    element.textContent = text;
    
    document.body.appendChild(element);
    const renderTime = performance.now() - start;
    document.body.removeChild(element);
    
    return renderTime;
  },

  //optimize font display for cls prevention
  optimizeFontDisplay(): void {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'OptimizedMonospace';
        src: local('Consolas'), local('Monaco'), local('Lucida Console'), local('Courier New');
        font-display: swap;
        size-adjust: 100%;
        ascent-override: 90%;
        descent-override: 22%;
        line-gap-override: 0%;
      }
    `;
    document.head.appendChild(style);
  },

  //get font performance recommendations
  getRecommendations(): string[] {
    const metrics = fontOptimizer.getFontMetrics();
    const recommendations: string[] = [];

    const totalCLS = metrics.reduce((sum, m) => sum + m.clsImpact, 0);
    if (totalCLS > 0.05) {
      recommendations.push('high cls detected - implement font fallback sizing');
    }

    const avgLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0) / metrics.length;
    if (avgLoadTime > 200) {
      recommendations.push('slow font loading - consider font preloading');
    }

    const fallbackUsage = metrics.filter(m => m.fallbackUsed).length / metrics.length;
    if (fallbackUsage > 0.3) {
      recommendations.push('high fallback usage - optimize font stack for platform');
    }

    return recommendations;
  }
};

//browser integration
if (typeof window !== 'undefined') {
  //add to global for debugging
  if (import.meta.env?.DEV) {
    (window as any).fontOptimizer = fontOptimizer;
    (window as any).fontUtils = fontUtils;
  }

  //optimize font display on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      fontUtils.optimizeFontDisplay();
    });
  } else {
    fontUtils.optimizeFontDisplay();
  }
}