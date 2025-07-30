// =============================================================================
// PERFORMANCE VALIDATOR - Comprehensive testing and validation system
// Validates >60% file size reduction and Core Web Vitals improvements
// =============================================================================

import { vitalsMonitor, type VitalsMetric, type ImagePerformanceMetric } from '../performance/vitals-monitor';
import { imageProcessor } from '../image/processor';

//performance test configuration
export const TEST_CONFIG = {
  //target improvements
  TARGETS: {
    fileSizeReduction: 0.6, // 60% minimum reduction
    lcpImprovement: 0.3, // 30% LCP improvement
    clsThreshold: 0.1, // CLS should be under 0.1
    imageLoadTime: 2000, // Images should load within 2s
    formatAdoption: 0.8, // 80% modern format adoption
  },
  
  //test scenarios
  SCENARIOS: {
    desktop_fast: { viewport: { width: 1920, height: 1080 }, network: '4g', cpu: 'fast' },
    desktop_slow: { viewport: { width: 1920, height: 1080 }, network: '3g', cpu: 'slow' },
    mobile_fast: { viewport: { width: 375, height: 667 }, network: '4g', cpu: 'fast' },
    mobile_slow: { viewport: { width: 375, height: 667 }, network: '3g', cpu: 'slow' },
  },
  
  //test images for validation
  TEST_IMAGES: [
    { type: 'hero', width: 1920, height: 1080, originalFormat: 'jpeg' },
    { type: 'thumbnail', width: 400, height: 300, originalFormat: 'png' },
    { type: 'gallery', width: 800, height: 600, originalFormat: 'jpeg' },
    { type: 'avatar', width: 200, height: 200, originalFormat: 'png' },
  ],
  
  //performance thresholds
  THRESHOLDS: {
    excellent: { score: 90, color: '#10b981' },
    good: { score: 75, color: '#f59e0b' },
    needsImprovement: { score: 50, color: '#ef4444' },
    poor: { score: 0, color: '#dc2626' },
  },
} as const;

//test result interfaces
export interface PerformanceTestResult {
  scenario: string;
  passed: boolean;
  score: number;
  metrics: {
    lcp: number;
    fid: number;
    cls: number;
    fcp: number;
    ttfb: number;
  };
  imageMetrics: {
    averageLoadTime: number;
    totalSizeReduction: number;
    formatDistribution: Record<string, number>;
    errorRate: number;
  };
  recommendations: string[];
  timestamp: number;
}

export interface ImageOptimizationTestResult {
  imageSrc: string;
  originalSize: number;
  optimizedSize: number;
  sizeReduction: number;
  originalFormat: string;
  optimizedFormat: string;
  quality: number;
  loadTime: number;
  passed: boolean;
  issues: string[];
}

export interface ComprehensiveTestReport {
  overallScore: number;
  passed: boolean;
  testResults: PerformanceTestResult[];
  imageResults: ImageOptimizationTestResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    averageSizeReduction: number;
    averageLCPImprovement: number;
    criticalIssues: string[];
    recommendations: string[];
  };
  generatedAt: string;
}

//performance validation system
export class PerformanceValidator {
  private testResults: PerformanceTestResult[] = [];
  private imageResults: ImageOptimizationTestResult[] = [];
  private baseline: any = null;
  private isRunning = false;

  constructor() {
    this.initializeBaseline();
  }

  //initialize baseline measurements
  private async initializeBaseline(): Promise<void> {
    //capture initial page metrics as baseline
    await new Promise(resolve => setTimeout(resolve, 2000)); //wait for initial load
    
    const snapshot = vitalsMonitor.getPerformanceSnapshot();
    this.baseline = {
      lcp: snapshot.vitals.LCP?.value || 0,
      fid: snapshot.vitals.FID?.value || 0,
      cls: snapshot.vitals.CLS?.value || 0,
      fcp: snapshot.vitals.FCP?.value || 0,
      ttfb: snapshot.vitals.TTFB?.value || 0,
      imageMetrics: snapshot.imageMetrics,
      timestamp: Date.now(),
    };
  }

  //run comprehensive performance test suite
  async runComprehensiveTests(): Promise<ComprehensiveTestReport> {
    if (this.isRunning) {
      throw new Error('Performance tests are already running');
    }

    this.isRunning = true;
    console.log('🚀 Starting comprehensive performance validation...');

    try {
      //reset results
      this.testResults = [];
      this.imageResults = [];

      //run performance tests for each scenario
      for (const [scenarioName, scenario] of Object.entries(TEST_CONFIG.SCENARIOS)) {
        console.log(`📊 Testing scenario: ${scenarioName}`);
        const result = await this.runScenarioTest(scenarioName, scenario);
        this.testResults.push(result);
      }

      //run image optimization tests
      console.log('🖼️ Testing image optimizations...');
      const imageResults = await this.runImageOptimizationTests();
      this.imageResults.push(...imageResults);

      //validate file size reduction targets
      console.log('📏 Validating file size reductions...');
      await this.validateFileSizeReductions();

      //validate Core Web Vitals improvements
      console.log('⚡ Validating Core Web Vitals improvements...');
      await this.validateWebVitalsImprovements();

      //generate comprehensive report
      const report = this.generateComprehensiveReport();
      
      console.log(`✅ Performance validation completed with score: ${report.overallScore}/100`);
      return report;

    } catch (error) {
      console.error('❌ Performance validation failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  //run performance test for specific scenario
  private async runScenarioTest(scenarioName: string, scenario: any): Promise<PerformanceTestResult> {
    const startTime = Date.now();
    
    //simulate scenario conditions
    await this.simulateScenarioConditions(scenario);
    
    //wait for metrics to stabilize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    //capture performance metrics
    const snapshot = vitalsMonitor.getPerformanceSnapshot();
    const metrics = {
      lcp: snapshot.vitals.LCP?.value || 0,
      fid: snapshot.vitals.FID?.value || 0,
      cls: snapshot.vitals.CLS?.value || 0,
      fcp: snapshot.vitals.FCP?.value || 0,
      ttfb: snapshot.vitals.TTFB?.value || 0,
    };

    //calculate image metrics
    const imageLoadTimes = snapshot.imageMetrics
      .filter(m => m.name === 'image-load-time')
      .map(m => m.value);
    
    const averageLoadTime = imageLoadTimes.length > 0 ? 
      imageLoadTimes.reduce((sum, time) => sum + time, 0) / imageLoadTimes.length : 0;

    const formatDistribution = this.calculateFormatDistribution(snapshot.imageMetrics);
    const errorRate = this.calculateErrorRate(snapshot.imageMetrics);

    //calculate performance score
    const score = this.calculateScenarioScore(metrics, {
      averageLoadTime,
      totalSizeReduction: 0, //will be calculated separately
      formatDistribution,
      errorRate,
    });

    //generate recommendations
    const recommendations = this.generateScenarioRecommendations(metrics, scenarioName);

    return {
      scenario: scenarioName,
      passed: score >= TEST_CONFIG.THRESHOLDS.good.score,
      score,
      metrics,
      imageMetrics: {
        averageLoadTime,
        totalSizeReduction: 0,
        formatDistribution,
        errorRate,
      },
      recommendations,
      timestamp: Date.now(),
    };
  }

  //simulate scenario network and device conditions
  private async simulateScenarioConditions(scenario: any): Promise<void> {
    //in a real implementation, this would use Chrome DevTools Protocol
    //or similar tools to throttle network and CPU
    
    //for now, we'll simulate by adjusting preloading behavior
    if (scenario.network === '3g') {
      //reduce preloading aggressiveness
      (window as any).preloadManager?.toggle(false);
    }
  }

  //run image optimization tests
  private async runImageOptimizationTests(): Promise<ImageOptimizationTestResult[]> {
    const results: ImageOptimizationTestResult[] = [];
    
    //test with sample images
    for (const testImage of TEST_CONFIG.TEST_IMAGES) {
      const result = await this.testImageOptimization(testImage);
      results.push(result);
    }

    //test actual page images
    const pageImages = document.querySelectorAll('img[data-optimized="true"]');
    for (const img of Array.from(pageImages).slice(0, 10)) { //limit to 10 images
      const htmlImg = img as HTMLImageElement;
      const result = await this.testPageImageOptimization(htmlImg);
      if (result) results.push(result);
    }

    return results;
  }

  //test individual image optimization
  private async testImageOptimization(testImage: any): Promise<ImageOptimizationTestResult> {
    const startTime = performance.now();
    
    try {
      //simulate original image
      const originalSize = this.estimateOriginalImageSize(
        testImage.width,
        testImage.height,
        testImage.originalFormat
      );

      //test optimization
      const optimized = await imageProcessor.processImage('/test-image.jpg', {
        width: testImage.width,
        height: testImage.height,
        format: 'auto',
        quality: 85,
      });

      const loadTime = performance.now() - startTime;
      const sizeReduction = (originalSize - optimized.estimatedSize) / originalSize;
      
      const issues: string[] = [];
      
      //validate size reduction
      if (sizeReduction < TEST_CONFIG.TARGETS.fileSizeReduction) {
        issues.push(`Size reduction ${(sizeReduction * 100).toFixed(1)}% below target ${TEST_CONFIG.TARGETS.fileSizeReduction * 100}%`);
      }

      //validate load time
      if (loadTime > TEST_CONFIG.TARGETS.imageLoadTime) {
        issues.push(`Load time ${loadTime.toFixed(0)}ms exceeds target ${TEST_CONFIG.TARGETS.imageLoadTime}ms`);
      }

      //validate format modernization
      if (optimized.format === testImage.originalFormat && ['jpeg', 'png'].includes(optimized.format)) {
        issues.push('Image not converted to modern format (WebP, AVIF)');
      }

      return {
        imageSrc: '/test-image.jpg',
        originalSize,
        optimizedSize: optimized.estimatedSize,
        sizeReduction,
        originalFormat: testImage.originalFormat,
        optimizedFormat: optimized.format,
        quality: optimized.quality,
        loadTime,
        passed: issues.length === 0,
        issues,
      };

    } catch (error) {
      return {
        imageSrc: '/test-image.jpg',
        originalSize: 0,
        optimizedSize: 0,
        sizeReduction: 0,
        originalFormat: testImage.originalFormat,
        optimizedFormat: 'unknown',
        quality: 0,
        loadTime: performance.now() - startTime,
        passed: false,
        issues: [`Optimization failed: ${error}`],
      };
    }
  }

  //test page image optimization
  private async testPageImageOptimization(img: HTMLImageElement): Promise<ImageOptimizationTestResult | null> {
    const src = img.dataset.originalSrc || img.src;
    if (!src) return null;

    const startTime = performance.now();
    
    //estimate original vs optimized size
    const originalSize = this.estimateImageSizeFromElement(img, 'jpeg', 75);
    const optimizedSize = this.estimateImageSizeFromElement(img, 'webp', 85);
    
    const loadTime = performance.now() - startTime;
    const sizeReduction = (originalSize - optimizedSize) / originalSize;
    
    const issues: string[] = [];
    
    //validate format
    const currentFormat = this.detectImageFormat(src);
    if (['jpeg', 'png'].includes(currentFormat.toLowerCase())) {
      issues.push('Using legacy image format');
    }

    //validate loading strategy
    if (img.loading !== 'lazy' && !this.isAboveFold(img)) {
      issues.push('Non-critical image not using lazy loading');
    }

    //validate dimensions
    if (!img.width || !img.height) {
      issues.push('Missing explicit width/height attributes');
    }

    return {
      imageSrc: src,
      originalSize,
      optimizedSize,
      sizeReduction,
      originalFormat: 'jpeg',
      optimizedFormat: currentFormat,
      quality: 85,
      loadTime,
      passed: issues.length === 0 && sizeReduction >= 0.4, //40% minimum for real images
      issues,
    };
  }

  //validate file size reduction targets
  private async validateFileSizeReductions(): Promise<void> {
    const totalOriginalSize = this.imageResults.reduce((sum, result) => sum + result.originalSize, 0);
    const totalOptimizedSize = this.imageResults.reduce((sum, result) => sum + result.optimizedSize, 0);
    const overallReduction = (totalOriginalSize - totalOptimizedSize) / totalOriginalSize;

    if (overallReduction < TEST_CONFIG.TARGETS.fileSizeReduction) {
      console.warn(`⚠️ Overall size reduction ${(overallReduction * 100).toFixed(1)}% below target ${TEST_CONFIG.TARGETS.fileSizeReduction * 100}%`);
    } else {
      console.log(`✅ Size reduction target achieved: ${(overallReduction * 100).toFixed(1)}%`);
    }
  }

  //validate Core Web Vitals improvements
  private async validateWebVitalsImprovements(): Promise<void> {
    if (!this.baseline) {
      console.warn('No baseline metrics available for comparison');
      return;
    }

    const current = vitalsMonitor.getPerformanceSnapshot();
    
    //compare LCP improvement
    const lcpImprovement = this.baseline.lcp > 0 ? 
      (this.baseline.lcp - (current.vitals.LCP?.value || 0)) / this.baseline.lcp : 0;

    if (lcpImprovement >= TEST_CONFIG.TARGETS.lcpImprovement) {
      console.log(`✅ LCP improved by ${(lcpImprovement * 100).toFixed(1)}%`);
    } else {
      console.warn(`⚠️ LCP improvement ${(lcpImprovement * 100).toFixed(1)}% below target ${TEST_CONFIG.TARGETS.lcpImprovement * 100}%`);
    }

    //validate CLS
    const currentCLS = current.vitals.CLS?.value || 0;
    if (currentCLS <= TEST_CONFIG.TARGETS.clsThreshold) {
      console.log(`✅ CLS within target: ${currentCLS.toFixed(3)}`);
    } else {
      console.warn(`⚠️ CLS above target: ${currentCLS.toFixed(3)} > ${TEST_CONFIG.TARGETS.clsThreshold}`);
    }
  }

  //calculate scenario performance score
  private calculateScenarioScore(metrics: any, imageMetrics: any): number {
    let score = 0;
    let totalWeight = 0;

    //LCP score (weight: 30%)
    const lcpScore = this.calculateMetricScore(metrics.lcp, 2500, 4000);
    score += lcpScore * 0.3;
    totalWeight += 0.3;

    //FID score (weight: 10%)
    const fidScore = this.calculateMetricScore(metrics.fid, 100, 300);
    score += fidScore * 0.1;
    totalWeight += 0.1;

    //CLS score (weight: 25%)
    const clsScore = this.calculateMetricScore(metrics.cls, 0.1, 0.25, true);
    score += clsScore * 0.25;
    totalWeight += 0.25;

    //FCP score (weight: 15%)
    const fcpScore = this.calculateMetricScore(metrics.fcp, 1800, 3000);
    score += fcpScore * 0.15;
    totalWeight += 0.15;

    //Image load time score (weight: 20%)
    const imageScore = this.calculateMetricScore(imageMetrics.averageLoadTime, 1000, 2500);
    score += imageScore * 0.2;
    totalWeight += 0.2;

    return Math.round(score / totalWeight);
  }

  //calculate individual metric score
  private calculateMetricScore(value: number, goodThreshold: number, poorThreshold: number, inverse = false): number {
    if (value === 0) return 50; //neutral score for missing metrics

    if (inverse) {
      //for metrics where lower is better (like CLS)
      if (value <= goodThreshold) return 100;
      if (value >= poorThreshold) return 0;
      return 100 - ((value - goodThreshold) / (poorThreshold - goodThreshold)) * 100;
    } else {
      //for metrics where lower is better (like LCP, FID)
      if (value <= goodThreshold) return 100;
      if (value >= poorThreshold) return 0;
      return 100 - ((value - goodThreshold) / (poorThreshold - goodThreshold)) * 100;
    }
  }

  //generate comprehensive test report
  private generateComprehensiveReport(): ComprehensiveTestReport {
    const passedTests = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const overallPassRate = totalTests > 0 ? passedTests / totalTests : 0;

    //calculate average improvements
    const averageSizeReduction = this.imageResults.length > 0 ?
      this.imageResults.reduce((sum, r) => sum + r.sizeReduction, 0) / this.imageResults.length : 0;

    const averageScore = this.testResults.length > 0 ?
      this.testResults.reduce((sum, r) => sum + r.score, 0) / this.testResults.length : 0;

    //collect critical issues
    const criticalIssues: string[] = [];
    if (averageSizeReduction < TEST_CONFIG.TARGETS.fileSizeReduction) {
      criticalIssues.push(`Size reduction ${(averageSizeReduction * 100).toFixed(1)}% below 60% target`);
    }

    if (averageScore < TEST_CONFIG.THRESHOLDS.good.score) {
      criticalIssues.push(`Performance score ${averageScore.toFixed(0)} below good threshold (75)`);
    }

    //generate recommendations
    const recommendations = this.generateGlobalRecommendations();

    return {
      overallScore: Math.round(averageScore),
      passed: overallPassRate >= 0.8 && criticalIssues.length === 0,
      testResults: this.testResults,
      imageResults: this.imageResults,
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
        averageSizeReduction,
        averageLCPImprovement: 0, //would calculate from baseline comparison
        criticalIssues,
        recommendations,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  //utility methods
  private estimateOriginalImageSize(width: number, height: number, format: string): number {
    const pixels = width * height;
    const bytesPerPixel = format === 'png' ? 4 : 3; //rough estimate
    return Math.round(pixels * bytesPerPixel * 0.5); //with compression
  }

  private estimateImageSizeFromElement(img: HTMLImageElement, format: string, quality: number): number {
    const width = img.naturalWidth || img.width || 800;
    const height = img.naturalHeight || img.height || 600;
    return this.estimateOriginalImageSize(width, height, format) * (quality / 100);
  }

  private detectImageFormat(src: string): string {
    const extension = src.split('.').pop()?.toLowerCase();
    return extension || 'unknown';
  }

  private isAboveFold(img: HTMLImageElement): boolean {
    const rect = img.getBoundingClientRect();
    return rect.top < window.innerHeight;
  }

  private calculateFormatDistribution(metrics: ImagePerformanceMetric[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    metrics.forEach(metric => {
      const format = metric.metadata.format || 'unknown';
      distribution[format] = (distribution[format] || 0) + 1;
    });
    return distribution;
  }

  private calculateErrorRate(metrics: ImagePerformanceMetric[]): number {
    const totalImages = metrics.filter(m => m.name === 'image-load-time').length;
    const errorImages = metrics.filter(m => m.name === 'image-load-error').length;
    return totalImages > 0 ? errorImages / totalImages : 0;
  }

  private generateScenarioRecommendations(metrics: any, scenario: string): string[] {
    const recommendations: string[] = [];

    if (metrics.lcp > 4000) {
      recommendations.push('Optimize Largest Contentful Paint by improving image loading');
    }

    if (metrics.cls > 0.25) {
      recommendations.push('Reduce Cumulative Layout Shift by adding image dimensions');
    }

    if (metrics.fid > 300) {
      recommendations.push('Improve First Input Delay by optimizing JavaScript execution');
    }

    if (scenario.includes('mobile') && metrics.lcp > 3000) {
      recommendations.push('Implement aggressive image optimization for mobile devices');
    }

    return recommendations;
  }

  private generateGlobalRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedImageTests = this.imageResults.filter(r => !r.passed);

    if (failedImageTests.length > 0) {
      recommendations.push(`Optimize ${failedImageTests.length} images that failed validation`);
    }

    const legacyFormats = this.imageResults.filter(r => 
      ['jpeg', 'png'].includes(r.optimizedFormat.toLowerCase())
    ).length;

    if (legacyFormats > 0) {
      recommendations.push(`Convert ${legacyFormats} images to modern formats (WebP, AVIF)`);
    }

    const slowLoadingImages = this.imageResults.filter(r => r.loadTime > 2500).length;
    if (slowLoadingImages > 0) {
      recommendations.push(`Improve loading speed for ${slowLoadingImages} slow images`);
    }

    return recommendations;
  }

  //public API methods
  async validateImageOptimization(imageSrc: string): Promise<ImageOptimizationTestResult> {
    const img = document.querySelector(`img[src="${imageSrc}"]`) as HTMLImageElement;
    if (img) {
      return this.testPageImageOptimization(img) || this.createFailedResult(imageSrc);
    }
    return this.createFailedResult(imageSrc);
  }

  private createFailedResult(imageSrc: string): ImageOptimizationTestResult {
    return {
      imageSrc,
      originalSize: 0,
      optimizedSize: 0,
      sizeReduction: 0,
      originalFormat: 'unknown',
      optimizedFormat: 'unknown',
      quality: 0,
      loadTime: 0,
      passed: false,
      issues: ['Image not found or failed to analyze'],
    };
  }

  getTestSummary(): any {
    return {
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter(r => r.passed).length,
      averageScore: this.testResults.length > 0 ?
        this.testResults.reduce((sum, r) => sum + r.score, 0) / this.testResults.length : 0,
      averageSizeReduction: this.imageResults.length > 0 ?
        this.imageResults.reduce((sum, r) => sum + r.sizeReduction, 0) / this.imageResults.length : 0,
    };
  }
}

//singleton instance
export const performanceValidator = new PerformanceValidator();

//utility functions for testing
export const ValidationUtils = {
  //quick image validation
  validateImage: (src: string) => performanceValidator.validateImageOptimization(src),
  
  //run comprehensive tests
  runTests: () => performanceValidator.runComprehensiveTests(),
  
  //get test summary
  getSummary: () => performanceValidator.getTestSummary(),
  
  //validate specific metrics
  validateMetrics: (targetReduction: number = 0.6) => {
    const summary = performanceValidator.getTestSummary();
    return {
      passed: summary.averageSizeReduction >= targetReduction,
      actual: summary.averageSizeReduction,
      target: targetReduction,
      score: summary.averageScore,
    };
  },
};

//expose for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceValidator = performanceValidator;
  (window as any).ValidationUtils = ValidationUtils;
}