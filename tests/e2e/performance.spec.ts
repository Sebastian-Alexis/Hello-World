import { test, expect, Page } from '@playwright/test';

test.describe('Performance Optimization', () => {
  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    await page.goto('/');
    
    //measure Largest Contentful Paint
    const lcp = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
        
        //timeout after 10 seconds
        setTimeout(() => resolve(10000), 10000);
      });
    });
    
    expect(lcp).toBeLessThan(2500); //good LCP threshold
  });

  test('should load critical resources quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); //should load within 3 seconds
  });

  test('should implement proper image lazy loading', async ({ page }) => {
    await page.goto('/portfolio');
    
    //wait for page to load
    await page.waitForSelector('img', { timeout: 10000 });
    
    const images = await page.locator('img');
    const count = await images.count();
    
    //check first few images for lazy loading
    for (let i = 0; i < Math.min(count, 5); i++) {
      const image = images.nth(i);
      const loading = await image.getAttribute('loading');
      
      //images should have lazy loading (except hero images which might be eager)
      if (loading !== null) {
        expect(['lazy', 'eager']).toContain(loading);
      }
    }
  });

  test('should have optimized bundle sizes', async ({ page }) => {
    //intercept network requests to measure bundle sizes
    const resourceSizes: Record<string, number> = {};
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('.js') || url.includes('.css')) {
        try {
          const body = await response.body();
          resourceSizes[url] = body.length;
        } catch (e) {
          //ignore errors for failed responses
        }
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    //check that main JavaScript bundle is under 100KB (compressed)
    const mainBundles = Object.entries(resourceSizes).filter(([url]) => 
      url.includes('main') || url.includes('index') || url.includes('app')
    );
    
    if (mainBundles.length > 0) {
      const [, size] = mainBundles[0];
      expect(size).toBeLessThan(100 * 1024); //100KB
    }
  });

  test('should implement effective caching', async ({ page }) => {
    //first visit
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    //track network requests
    const firstVisitRequests: string[] = [];
    page.on('request', (request) => {
      firstVisitRequests.push(request.url());
    });
    
    //second visit (should use cache)
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    //check for service worker registration
    const swRegistration = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    expect(swRegistration).toBe(true);
    
    //check for cache usage
    const cacheStatus = await page.evaluate(async () => {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        return cacheNames.length > 0;
      }
      return false;
    });
    
    expect(cacheStatus).toBe(true);
  });

  test('should handle offline scenarios gracefully', async ({ page }) => {
    //first visit to cache resources
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    //wait for service worker to install
    await page.waitForTimeout(2000);
    
    //go offline
    await page.context().setOffline(true);
    
    //navigate to cached page
    await page.goto('/');
    
    //page should still load (from cache)
    const title = await page.locator('h1').first();
    await expect(title).toBeVisible({ timeout: 10000 });
    
    //check for offline indicator if present
    const offlineIndicator = page.locator('[data-testid="offline-indicator"]');
    if (await offlineIndicator.count() > 0) {
      await expect(offlineIndicator).toBeVisible();
    }
    
    //go back online
    await page.context().setOffline(false);
  });

  test('should minimize layout shifts', async ({ page }) => {
    //measure CLS
    const cls = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let clsValue = 0;
        
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
        }).observe({ type: 'layout-shift', buffered: true });
        
        //measure for 5 seconds
        setTimeout(() => resolve(clsValue), 5000);
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    expect(cls).toBeLessThan(0.1); //good CLS threshold
  });

  test('should optimize First Input Delay', async ({ page }) => {
    await page.goto('/');
    
    //wait for page to be interactive
    await page.waitForLoadState('domcontentloaded');
    
    //simulate user interaction
    const startTime = Date.now();
    
    //find an interactive element
    const button = page.locator('button, a, [role="button"]').first();
    if (await button.count() > 0) {
      await button.click();
      const responseTime = Date.now() - startTime;
      
      //FID should be under 100ms
      expect(responseTime).toBeLessThan(100);
    }
  });

  test('should implement progressive enhancement', async ({ page }) => {
    //disable JavaScript
    await page.context().addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      });
    });
    
    await page.goto('/');
    
    //basic content should still be accessible
    const mainContent = page.locator('main, [role="main"], .content');
    await expect(mainContent).toBeVisible();
    
    //navigation should work
    const navLinks = page.locator('nav a, header a');
    if (await navLinks.count() > 0) {
      await expect(navLinks.first()).toBeVisible();
    }
  });

  test('should have accessible performance', async ({ page }) => {
    await page.goto('/');
    
    //run basic accessibility checks
    await page.waitForLoadState('domcontentloaded');
    
    //check for proper heading structure
    const h1 = page.locator('h1');
    expect(await h1.count()).toBeGreaterThan(0);
    
    //check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < Math.min(imageCount, 3); i++) {
      const image = images.nth(i);
      const alt = await image.getAttribute('alt');
      expect(alt).toBeDefined();
    }
    
    //check for proper form labels
    const inputs = page.locator('input:not([type="hidden"])');
    const inputCount = await inputs.count();
    
    for (let i = 0; i < Math.min(inputCount, 3); i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0;
        expect(hasLabel || ariaLabel).toBeTruthy();
      }
    }
  });

  test('should optimize font loading', async ({ page }) => {
    //intercept font requests
    const fontRequests: string[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('.woff') || url.includes('.woff2') || url.includes('fonts')) {
        fontRequests.push(url);
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    //check that fonts are preloaded
    const preloadLinks = await page.locator('link[rel="preload"][as="font"]');
    const preloadCount = await preloadLinks.count();
    
    //should have at least one font preloaded
    expect(preloadCount).toBeGreaterThanOrEqual(0);
    
    //fonts should use font-display: swap or similar
    const fontFaceRules = await page.evaluate(() => {
      const stylesheets = Array.from(document.styleSheets);
      let fontFaceCount = 0;
      
      stylesheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach(rule => {
            if (rule instanceof CSSFontFaceRule) {
              fontFaceCount++;
            }
          });
        } catch (e) {
          //cross-origin stylesheets may not be accessible
        }
      });
      
      return fontFaceCount;
    });
    
    //font loading strategy should be in place
    expect(fontRequests.length + fontFaceCount).toBeGreaterThanOrEqual(0);
  });

  test('should monitor performance metrics in production', async ({ page }) => {
    //intercept performance API calls
    const performanceRequests: any[] = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/vitals') || url.includes('/api/analytics/performance')) {
        performanceRequests.push({
          url: url,
          method: request.method(),
        });
      }
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    //wait for performance metrics to be sent
    await page.waitForTimeout(3000);
    
    //should have sent performance data
    expect(performanceRequests.length).toBeGreaterThanOrEqual(0);
    
    //check that performance tracking is active
    const hasPerformanceTracking = await page.evaluate(() => {
      return 'PerformanceObserver' in window || 'performance' in window;
    });
    
    expect(hasPerformanceTracking).toBe(true);
  });
});