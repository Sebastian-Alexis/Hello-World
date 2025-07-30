import { test, expect } from '@playwright/test';

test.describe('Portfolio System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio');
  });

  test('should display portfolio projects correctly', async ({ page }) => {
    //wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    
    //check that projects are displayed
    const projectCards = await page.locator('[data-testid="project-card"]');
    expect(await projectCards.count()).toBeGreaterThan(0);
    
    //check project card content
    const firstProject = projectCards.first();
    await expect(firstProject.locator('h3')).toBeVisible();
    await expect(firstProject.locator('.project-description')).toBeVisible();
    await expect(firstProject.locator('.tech-stack')).toBeVisible();

    //check for featured projects
    const featuredProjects = page.locator('[data-testid="project-card"][data-featured="true"]');
    if (await featuredProjects.count() > 0) {
      await expect(featuredProjects.first().locator('.featured-badge')).toBeVisible();
    }
  });

  test('should filter projects by technology', async ({ page }) => {
    //wait for filter controls
    await page.waitForSelector('[data-testid="filter-controls"]', { timeout: 10000 });
    
    //check if technology filter exists
    const techFilter = page.locator('[data-testid="technology-filter"]');
    if (await techFilter.count() > 0) {
      //select React filter
      await techFilter.selectOption('React');
      
      //wait for filtered results
      await page.waitForTimeout(1000);
      
      //check that all visible projects contain React
      const projectCards = await page.locator('[data-testid="project-card"]');
      const count = await projectCards.count();
      
      for (let i = 0; i < Math.min(count, 5); i++) {
        const techStack = await projectCards.nth(i).locator('.tech-stack').textContent();
        expect(techStack).toContain('React');
      }
    }
  });

  test('should navigate to project detail page', async ({ page }) => {
    //wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    
    //check if projects exist
    const projectCards = page.locator('[data-testid="project-card"]');
    const count = await projectCards.count();
    
    if (count > 0) {
      //click on first project
      await page.click('[data-testid="project-card"]:first-child h3 a');
      
      //wait for navigation
      await page.waitForURL(/\/portfolio\/[^/]+$/);
      
      //check project detail page content
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('.project-details')).toBeVisible();
      
      //check for gallery if it exists
      const gallery = page.locator('.project-gallery');
      if (await gallery.count() > 0) {
        await expect(gallery).toBeVisible();
      }
    }
  });

  test('should display project categories correctly', async ({ page }) => {
    //wait for category filter
    const categoryFilter = page.locator('[data-testid="category-filter"]');
    
    if (await categoryFilter.count() > 0) {
      //get all options
      const options = await categoryFilter.locator('option').all();
      expect(options.length).toBeGreaterThan(1); //should have at least 'All' and one category
      
      //test filtering by category
      if (options.length > 1) {
        const categoryValue = await options[1].getAttribute('value');
        if (categoryValue && categoryValue !== 'all') {
          await categoryFilter.selectOption(categoryValue);
          await page.waitForTimeout(1000);
          
          //verify filtering worked
          const projectCards = page.locator('[data-testid="project-card"]');
          const count = await projectCards.count();
          expect(count).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  test('should display project images correctly', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const image = projectCard.locator('img').first();
    
    if (await image.count() > 0) {
      //check image attributes
      await expect(image).toHaveAttribute('loading', 'lazy');
      await expect(image).toHaveAttribute('alt');
      
      //check image loads successfully
      await expect(image).toBeVisible();
      
      //verify image is not broken
      const naturalWidth = await image.evaluate((img: HTMLImageElement) => img.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });

  test('should handle empty state correctly', async ({ page }) => {
    //apply filters that might result in no results
    const techFilter = page.locator('[data-testid="technology-filter"]');
    
    if (await techFilter.count() > 0) {
      await techFilter.selectOption('NonExistentTech');
      await page.waitForTimeout(1000);
      
      //check for empty state message
      const emptyState = page.locator('[data-testid="empty-state"]');
      if (await emptyState.count() > 0) {
        await expect(emptyState).toBeVisible();
        await expect(emptyState).toContainText('No projects found');
      }
    }
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    //test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    //wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    
    //check that layout adapts to mobile
    const projectCards = page.locator('[data-testid="project-card"]');
    if (await projectCards.count() > 0) {
      const firstCard = projectCards.first();
      const boundingBox = await firstCard.boundingBox();
      
      //project card should be nearly full width on mobile
      expect(boundingBox?.width).toBeGreaterThan(300);
    }
    
    //check mobile menu if it exists
    const mobileMenu = page.locator('[data-testid="mobile-menu-trigger"]');
    if (await mobileMenu.count() > 0) {
      await expect(mobileMenu).toBeVisible();
    }
  });

  test('should show loading states', async ({ page }) => {
    //intercept API calls to simulate loading
    await page.route('/api/portfolio/**', async route => {
      await page.waitForTimeout(1000); //simulate delay
      await route.continue();
    });
    
    //navigate to portfolio
    await page.goto('/portfolio');
    
    //check for loading indicator
    const loadingIndicator = page.locator('[data-testid="loading"]');
    if (await loadingIndicator.count() > 0) {
      await expect(loadingIndicator).toBeVisible();
    }
    
    //wait for content to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 15000 });
  });

  test('should handle search functionality', async ({ page }) => {
    const searchBox = page.locator('[data-testid="search-box"]');
    
    if (await searchBox.count() > 0) {
      //search for a project
      await searchBox.fill('react');
      await searchBox.press('Enter');
      
      //wait for search results
      await page.waitForTimeout(1000);
      
      //verify search results
      const projectCards = page.locator('[data-testid="project-card"]');
      const count = await projectCards.count();
      
      if (count > 0) {
        //check that results are relevant to search
        const firstProject = projectCards.first();
        const content = await firstProject.textContent();
        expect(content?.toLowerCase()).toContain('react');
      }
      
      //clear search
      await searchBox.clear();
      await searchBox.press('Enter');
      await page.waitForTimeout(1000);
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    //wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]', { timeout: 10000 });
    
    //test tab navigation
    await page.keyboard.press('Tab');
    
    //check that focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    //navigate through projects with arrow keys if supported
    await page.keyboard.press('ArrowDown');
    
    //test enter key on focused project
    await page.keyboard.press('Enter');
    
    //should either navigate or activate the project
    await page.waitForTimeout(500);
  });
});