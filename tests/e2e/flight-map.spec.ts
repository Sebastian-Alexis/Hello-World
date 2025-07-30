import { test, expect } from '@playwright/test';

test.describe('Flight Map System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flights');
  });

  test('should display interactive map', async ({ page }) => {
    //wait for map to initialize (longer timeout for map loading)
    await page.waitForSelector('.mapboxgl-map', { timeout: 15000 });
    
    //check map is visible
    await expect(page.locator('.mapboxgl-map')).toBeVisible();
    
    //check map controls
    await expect(page.locator('.mapboxgl-ctrl-zoom-in')).toBeVisible();
    await expect(page.locator('.mapboxgl-ctrl-zoom-out')).toBeVisible();
    
    //check fullscreen control if available
    const fullscreenControl = page.locator('.mapboxgl-ctrl-fullscreen');
    if (await fullscreenControl.count() > 0) {
      await expect(fullscreenControl).toBeVisible();
    }

    //verify map has loaded by checking canvas element
    const mapCanvas = page.locator('.mapboxgl-canvas');
    await expect(mapCanvas).toBeVisible();
  });

  test('should display flight statistics', async ({ page }) => {
    //wait for statistics to load
    await page.waitForSelector('[data-testid="flight-stats"]', { timeout: 10000 });
    
    //check statistics are displayed
    const stats = page.locator('[data-testid="flight-stats"]');
    await expect(stats.locator('[data-testid="total-flights"]')).toBeVisible();
    await expect(stats.locator('[data-testid="total-distance"]')).toBeVisible();
    await expect(stats.locator('[data-testid="unique-airports"]')).toBeVisible();
    
    //verify statistics show meaningful data
    const totalFlights = await stats.locator('[data-testid="total-flights"]').textContent();
    const totalDistance = await stats.locator('[data-testid="total-distance"]').textContent();
    
    expect(totalFlights).toMatch(/^\d+/); //should start with a number
    expect(totalDistance).toMatch(/^\d+/); //should start with a number
  });

  test('should filter flights by year', async ({ page }) => {
    //wait for year filter to be available
    const yearFilter = page.locator('[data-testid="year-filter"]');
    await page.waitForSelector('[data-testid="year-filter"]', { timeout: 10000 });
    
    if (await yearFilter.count() > 0) {
      //get initial statistics
      const initialFlights = await page.locator('[data-testid="total-flights"]').textContent();
      
      //select year filter (use current year or available option)
      const options = await yearFilter.locator('option').all();
      if (options.length > 1) {
        const yearValue = await options[1].getAttribute('value');
        if (yearValue) {
          await yearFilter.selectOption(yearValue);
          
          //wait for map to update
          await page.waitForTimeout(2000);
          
          //check that statistics updated (might be same or different)
          const filteredFlights = await page.locator('[data-testid="total-flights"]').textContent();
          expect(filteredFlights).toMatch(/^\d+/);
          
          //map should still be visible after filtering
          await expect(page.locator('.mapboxgl-map')).toBeVisible();
        }
      }
    }
  });

  test('should display flight paths on map', async ({ page }) => {
    //wait for map and data to load
    await page.waitForSelector('.mapboxgl-map', { timeout: 15000 });
    await page.waitForTimeout(3000); //additional time for flight data to load
    
    //check for flight path elements (these might be SVG paths or canvas elements)
    const mapContainer = page.locator('.mapboxgl-map');
    
    //verify map has some interactivity
    await mapContainer.click({ position: { x: 200, y: 200 } });
    
    //check for flight information popup or tooltip
    const popup = page.locator('.mapboxgl-popup');
    if (await popup.count() > 0) {
      await expect(popup).toBeVisible();
    }
  });

  test('should show airport information', async ({ page }) => {
    //wait for map to load
    await page.waitForSelector('.mapboxgl-map', { timeout: 15000 });
    
    //check for airport markers or information
    const airportList = page.locator('[data-testid="airport-list"]');
    if (await airportList.count() > 0) {
      await expect(airportList).toBeVisible();
      
      //check that airports have proper information
      const airports = airportList.locator('.airport-item');
      if (await airports.count() > 0) {
        const firstAirport = airports.first();
        await expect(firstAirport.locator('.airport-code')).toBeVisible();
        await expect(firstAirport.locator('.airport-name')).toBeVisible();
      }
    }
  });

  test('should handle map interactions', async ({ page }) => {
    //wait for map to load
    await page.waitForSelector('.mapboxgl-map', { timeout: 15000 });
    
    const mapContainer = page.locator('.mapboxgl-map');
    
    //test zoom in
    await page.click('.mapboxgl-ctrl-zoom-in');
    await page.waitForTimeout(500);
    
    //test zoom out
    await page.click('.mapboxgl-ctrl-zoom-out');
    await page.waitForTimeout(500);
    
    //test map dragging
    await mapContainer.hover({ position: { x: 300, y: 300 } });
    await page.mouse.down();
    await page.mouse.move(350, 350);
    await page.mouse.up();
    
    //map should still be functional after interactions
    await expect(mapContainer).toBeVisible();
  });

  test('should display flight details modal', async ({ page }) => {
    //wait for flight list or map
    await page.waitForSelector('[data-testid="flight-item"], .mapboxgl-map', { timeout: 15000 });
    
    //try clicking on a flight item if available
    const flightItems = page.locator('[data-testid="flight-item"]');
    if (await flightItems.count() > 0) {
      await flightItems.first().click();
      
      //check for modal or detail view
      const modal = page.locator('[data-testid="flight-modal"]');
      if (await modal.count() > 0) {
        await expect(modal).toBeVisible();
        await expect(modal.locator('.flight-details')).toBeVisible();
        
        //check for close button
        const closeButton = modal.locator('[data-testid="close-modal"]');
        if (await closeButton.count() > 0) {
          await closeButton.click();
          await expect(modal).not.toBeVisible();
        }
      }
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    //set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    //wait for map to load
    await page.waitForSelector('.mapboxgl-map', { timeout: 15000 });
    
    //check that map adapts to mobile
    const mapContainer = page.locator('.mapboxgl-map');
    const boundingBox = await mapContainer.boundingBox();
    
    expect(boundingBox?.width).toBeLessThanOrEqual(375);
    
    //check that statistics are visible on mobile
    const stats = page.locator('[data-testid="flight-stats"]');
    if (await stats.count() > 0) {
      await expect(stats).toBeVisible();
    }
    
    //check mobile navigation if available
    const mobileNav = page.locator('[data-testid="mobile-nav"]');
    if (await mobileNav.count() > 0) {
      await expect(mobileNav).toBeVisible();
    }
  });

  test('should handle loading states', async ({ page }) => {
    //intercept API calls to simulate loading
    await page.route('/api/flights/**', async route => {
      await page.waitForTimeout(2000); //simulate delay
      await route.continue();
    });
    
    //navigate to flights page
    await page.goto('/flights');
    
    //check for loading indicator
    const loadingIndicator = page.locator('[data-testid="loading"], .loading-spinner');
    if (await loadingIndicator.count() > 0) {
      await expect(loadingIndicator).toBeVisible();
    }
    
    //wait for content to load
    await page.waitForSelector('.mapboxgl-map, [data-testid="flight-stats"]', { timeout: 20000 });
  });

  test('should handle offline state', async ({ page }) => {
    //go offline
    await page.context().setOffline(true);
    
    //navigate to flights page
    await page.goto('/flights');
    
    //check for offline message or cached content
    const offlineMessage = page.locator('[data-testid="offline-message"]');
    const cachedContent = page.locator('.mapboxgl-map, [data-testid="flight-stats"]');
    
    //should show either offline message or cached content
    const hasOfflineMessage = await offlineMessage.count() > 0 && await offlineMessage.isVisible();
    const hasCachedContent = await cachedContent.count() > 0 && await cachedContent.isVisible();
    
    expect(hasOfflineMessage || hasCachedContent).toBe(true);
    
    //go back online
    await page.context().setOffline(false);
  });

  test('should support keyboard navigation', async ({ page }) => {
    //wait for page to load
    await page.waitForSelector('[data-testid="flight-stats"], .mapboxgl-map', { timeout: 15000 });
    
    //test tab navigation
    await page.keyboard.press('Tab');
    
    //check that focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    //navigate through interactive elements
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }
    
    //test escape key for closing modals
    await page.keyboard.press('Escape');
  });

  test('should display error states gracefully', async ({ page }) => {
    //intercept API calls to simulate errors
    await page.route('/api/flights/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    //navigate to flights page
    await page.goto('/flights');
    
    //check for error message
    const errorMessage = page.locator('[data-testid="error-message"]');
    if (await errorMessage.count() > 0) {
      await expect(errorMessage).toBeVisible();
      
      //check for retry button
      const retryButton = page.locator('[data-testid="retry-button"]');
      if (await retryButton.count() > 0) {
        await expect(retryButton).toBeVisible();
      }
    }
  });
});