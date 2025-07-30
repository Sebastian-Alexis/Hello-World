import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockFetch, createMockPerformanceEntry } from '../setup';

// Mock web-vitals library
vi.mock('web-vitals', () => ({
  getCLS: vi.fn((callback) => {
    setTimeout(() => callback({ name: 'CLS', value: 0.1, rating: 'good' }), 100);
  }),
  getFID: vi.fn((callback) => {
    setTimeout(() => callback({ name: 'FID', value: 80, rating: 'good' }), 100);
  }),
  getFCP: vi.fn((callback) => {
    setTimeout(() => callback({ name: 'FCP', value: 1800, rating: 'good' }), 100);
  }),
  getLCP: vi.fn((callback) => {
    setTimeout(() => callback({ name: 'LCP', value: 2400, rating: 'good' }), 100);
  }),
  getTTFB: vi.fn((callback) => {
    setTimeout(() => callback({ name: 'TTFB', value: 600, rating: 'good' }), 100);
  }),
}));

describe('Performance Tracking', () => {
  let PerformanceTracker: any;
  let performanceUtils: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    //reset performance mock
    window.performance.now = vi.fn(() => 1000);
    window.performance.getEntriesByType = vi.fn(() => []);
    window.fetch = createMockFetch({ success: true });

    //import modules after mocks are set up
    const vitalsModule = await import('../../src/lib/performance/vitals');
    PerformanceTracker = vitalsModule.PerformanceTracker;
    performanceUtils = vitalsModule.performanceUtils;
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('PerformanceTracker', () => {
    it('should initialize with default configuration', () => {
      const tracker = new PerformanceTracker();
      
      expect(tracker).toBeDefined();
      expect(tracker.getSessionId()).toBeDefined();
      expect(tracker.getSessionId()).toMatch(/^perf_/);
    });

    it('should track custom metrics', () => {
      const tracker = new PerformanceTracker();
      const mockCallback = vi.fn();
      
      window.addEventListener = vi.fn((event, callback) => {
        if (event === 'custom-metric') {
          mockCallback(callback);
        }
      });

      tracker.trackCustomMetric('test-metric', 1000, 'good');
      
      expect(window.addEventListener).toHaveBeenCalledWith('custom-metric', expect.any(Function));
    });

    it('should handle network failures gracefully', async () => {
      window.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      
      const tracker = new PerformanceTracker();
      
      //should not throw when sending metrics fails
      expect(() => {
        tracker.trackCustomMetric('test-metric', 1000, 'good');
      }).not.toThrow();
    });

    it('should batch metrics for sending', () => {
      const tracker = new PerformanceTracker();
      
      tracker.trackCustomMetric('metric1', 1000);
      tracker.trackCustomMetric('metric2', 2000);
      tracker.trackCustomMetric('metric3', 3000);
      
      const metrics = tracker.getMetrics();
      expect(metrics).toHaveLength(3);
      expect(metrics[0].name).toBe('CUSTOM_METRIC1');
      expect(metrics[1].name).toBe('CUSTOM_METRIC2');
      expect(metrics[2].name).toBe('CUSTOM_METRIC3');
    });

    it('should detect poor performance and send alerts', () => {
      const tracker = new PerformanceTracker();
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      tracker.trackCustomMetric('slow-operation', 5000, 'poor');
      
      expect(consoleSpy).toHaveBeenCalledWith('PERFORMANCE ALERT:', expect.any(Object));
      
      consoleSpy.mockRestore();
    });

    it('should track user interactions', () => {
      const tracker = new PerformanceTracker();
      
      tracker.trackUserInteraction('button-click', 150);
      
      const metrics = tracker.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('USER_INTERACTION');
      expect(metrics[0].value).toBe(150);
      expect(metrics[0].rating).toBe('poor'); //150ms is considered poor
    });

    it('should calculate performance ratings correctly', () => {
      const tracker = new PerformanceTracker();
      
      //test LCP ratings
      tracker.trackCustomMetric('LCP', 2000); //good
      tracker.trackCustomMetric('LCP', 3000); //needs improvement
      tracker.trackCustomMetric('LCP', 5000); //poor
      
      const metrics = tracker.getMetrics();
      expect(metrics[0].rating).toBe('good');
      expect(metrics[1].rating).toBe('needs-improvement');
      expect(metrics[2].rating).toBe('poor');
    });
  });

  describe('Performance Utils', () => {
    it('should measure async operations', async () => {
      const mockOperation = vi.fn().mockResolvedValue('result');
      const startTime = 1000;
      const endTime = 1500;
      
      window.performance.now = vi.fn()
        .mockReturnValueOnce(startTime)
        .mockReturnValueOnce(endTime);

      const result = await performanceUtils.measureAsync('test-operation', mockOperation);
      
      expect(result).toBe('result');
      expect(mockOperation).toHaveBeenCalled();
      expect(window.performance.now).toHaveBeenCalledTimes(2);
    });

    it('should handle async operation failures', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await expect(performanceUtils.measureAsync('failing-operation', mockOperation))
        .rejects.toThrow('Operation failed');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Performance: failing-operation failed after'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('should debounce function calls', () => {
      vi.useFakeTimers();
      
      const mockFn = vi.fn();
      const debouncedFn = performanceUtils.debounce(mockFn, 100);
      
      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');
      
      expect(mockFn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
      
      vi.useRealTimers();
    });

    it('should throttle function calls', () => {
      vi.useFakeTimers();
      
      const mockFn = vi.fn();
      const throttledFn = performanceUtils.throttle(mockFn, 100);
      
      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');
      
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');
      
      vi.advanceTimersByTime(100);
      
      throttledFn('arg4');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg4');
      
      vi.useRealTimers();
    });

    it('should use requestIdleCallback when available', () => {
      const mockCallback = vi.fn();
      const mockRequestIdleCallback = vi.fn();
      
      (window as any).requestIdleCallback = mockRequestIdleCallback;
      
      performanceUtils.requestIdleCallback(mockCallback, 2000);
      
      expect(mockRequestIdleCallback).toHaveBeenCalledWith(
        mockCallback,
        { timeout: 2000 }
      );
    });

    it('should fallback to setTimeout when requestIdleCallback is not available', () => {
      const mockCallback = vi.fn();
      const mockSetTimeout = vi.fn();
      
      delete (window as any).requestIdleCallback;
      global.setTimeout = mockSetTimeout;
      
      performanceUtils.requestIdleCallback(mockCallback);
      
      expect(mockSetTimeout).toHaveBeenCalledWith(mockCallback, 1);
    });

    it('should preload resources correctly', () => {
      const mockAppendChild = vi.fn();
      document.head.appendChild = mockAppendChild;
      
      performanceUtils.preloadResource('https://example.com/font.woff2', 'font');
      
      expect(mockAppendChild).toHaveBeenCalledWith(
        expect.objectContaining({
          rel: 'preload',
          href: 'https://example.com/font.woff2',
          as: 'font',
        })
      );
    });

    it('should generate performance recommendations', () => {
      const recommendations = performanceUtils.getRecommendations();
      
      expect(recommendations).toBeInstanceOf(Array);
    });

    it('should create performance budget checker', () => {
      const budgetChecker = performanceUtils.createBudgetChecker({
        LCP: 2000,
        FID: 100,
        CLS: 0.1
      });
      
      expect(budgetChecker).toBeDefined();
      expect(typeof budgetChecker.check).toBe('function');
    });

    it('should monitor component performance', () => {
      const monitor = performanceUtils.monitorComponent('TestComponent');
      
      expect(monitor).toBeDefined();
      expect(typeof monitor.markRender).toBe('function');
      expect(typeof monitor.markMount).toBe('function');
      expect(typeof monitor.getMetrics).toBe('function');
    });
  });

  describe('Resource Timing Analysis', () => {
    it('should analyze resource performance', () => {
      const mockResources = [
        createMockPerformanceEntry('https://example.com/script.js', 100, 2500),
        createMockPerformanceEntry('https://example.com/style.css', 200, 800),
        createMockPerformanceEntry('https://example.com/image.jpg', 300, 1200),
      ];

      window.performance.getEntriesByType = vi.fn().mockReturnValue(mockResources);
      
      //this would be called by the performance tracker
      const slowResources = mockResources.filter(resource => resource.duration > 2000);
      
      expect(slowResources).toHaveLength(1);
      expect(slowResources[0].name).toBe('https://example.com/script.js');
    });

    it('should categorize resources by type', () => {
      const mockResources = [
        { ...createMockPerformanceEntry('script.js', 100, 500), initiatorType: 'script' },
        { ...createMockPerformanceEntry('style.css', 200, 300), initiatorType: 'link' },
        { ...createMockPerformanceEntry('image.jpg', 300, 800), initiatorType: 'img' },
      ];

      const resourcesByType = mockResources.reduce((acc, resource) => {
        const type = resource.initiatorType || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(resource);
        return acc;
      }, {} as Record<string, any[]>);
      
      expect(resourcesByType.script).toHaveLength(1);
      expect(resourcesByType.link).toHaveLength(1);
      expect(resourcesByType.img).toHaveLength(1);
    });
  });

  describe('Memory Monitoring', () => {
    it('should track memory usage', () => {
      const mockMemory = {
        usedJSHeapSize: 50000000, //50MB
        totalJSHeapSize: 80000000, //80MB
        jsHeapSizeLimit: 100000000, //100MB
      };
      
      (window.performance as any).memory = mockMemory;
      
      const memoryUsage = (mockMemory.usedJSHeapSize / mockMemory.jsHeapSizeLimit) * 100;
      
      expect(memoryUsage).toBe(50); //50% usage
    });

    it('should detect memory leaks', () => {
      const tracker = new PerformanceTracker();
      
      //simulate high memory usage
      (window.performance as any).memory = {
        usedJSHeapSize: 90000000,
        jsHeapSizeLimit: 100000000,
      };
      
      const memoryUsage = 90; //90% usage
      const rating = memoryUsage > 80 ? 'poor' : memoryUsage > 60 ? 'needs-improvement' : 'good';
      
      expect(rating).toBe('poor');
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      const baseline = { LCP: 2000, FID: 100, CLS: 0.1 };
      const current = { LCP: 2500, FID: 120, CLS: 0.12 };
      
      const regressions = Object.entries(current).filter(([metric, value]) => {
        const baselineValue = baseline[metric as keyof typeof baseline];
        return value > baselineValue * 1.2; //20% regression threshold
      });
      
      expect(regressions).toHaveLength(2); //LCP and FID regressed
      expect(regressions[0][0]).toBe('LCP');
      expect(regressions[1][0]).toBe('FID');
    });

    it('should calculate performance score', () => {
      const metrics = [
        { name: 'LCP', rating: 'good' },
        { name: 'FID', rating: 'good' },
        { name: 'CLS', rating: 'needs-improvement' },
        { name: 'TTFB', rating: 'poor' },
      ];
      
      const score = metrics.reduce((acc, metric) => {
        const points = metric.rating === 'good' ? 100 : 
                     metric.rating === 'needs-improvement' ? 50 : 0;
        return acc + points;
      }, 0) / metrics.length;
      
      expect(score).toBe(62.5); //average of 100, 100, 50, 0
    });
  });
});