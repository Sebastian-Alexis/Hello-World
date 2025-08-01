import { test, expect } from '@playwright/test';

test.describe('Simple Blog E2E Tests', () => {
  
  test('should load test blog system page', async ({ page }) => {
    // Test the existing test-blog-system page
    await page.goto('/test-blog-system');
    
    // Verify page loads
    await expect(page).toHaveTitle(/Blog System Test/);
    
    // Check for test results
    await expect(page.locator('h1')).toContainText('Blog System Test Results');
    
    // Check summary section exists
    const summary = page.locator('.summary');
    await expect(summary).toBeVisible();
    
    // Verify test results are displayed
    const testResults = page.locator('.success, .error');
    const count = await testResults.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should display test results correctly', async ({ page }) => {
    await page.goto('/test-blog-system');
    
    // Check for specific test sections
    await expect(page.locator('text=getBlogPostBySlug')).toBeVisible();
    await expect(page.locator('text=ContentProcessor')).toBeVisible();
    await expect(page.locator('text=Full blog page simulation')).toBeVisible();
    
    // Verify quick links section
    const quickLinks = page.locator('text=Quick Links');
    await expect(quickLinks).toBeVisible();
  });

  test('should have proper styling', async ({ page }) => {
    await page.goto('/test-blog-system');
    
    // Check that success results have green styling
    const successElements = page.locator('.success');
    const successCount = await successElements.count();
    
    if (successCount > 0) {
      const firstSuccess = successElements.first();
      await expect(firstSuccess).toHaveCSS('color', 'rgb(0, 128, 0)'); // green
    }
    
    // Check that error results have red styling
    const errorElements = page.locator('.error');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      const firstError = errorElements.first();
      await expect(firstError).toHaveCSS('color', 'rgb(255, 0, 0)'); // red
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/test-blog-system');
    
    // Verify content is visible on mobile
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.summary')).toBeVisible();
    
    // Check that content fits within viewport
    const body = page.locator('body');
    const bodyBox = await body.boundingBox();
    expect(bodyBox?.width).toBeLessThanOrEqual(375);
  });

  test('should handle navigation', async ({ page }) => {
    await page.goto('/test-blog-system');
    
    // Find and click a link if available
    const blogLink = page.locator('a[href="/blog"]');
    if (await blogLink.isVisible()) {
      await blogLink.click();
      // Verify navigation occurred
      await expect(page).toHaveURL(/\/blog/);
    }
  });
});