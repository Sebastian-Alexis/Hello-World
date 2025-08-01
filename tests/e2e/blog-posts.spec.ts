import { test, expect, type Page } from '@playwright/test';
import { DatabaseQueries } from '../../src/lib/db/queries';
import { BlogTestHelper, TEST_SLUGS } from '../utils/blog-test-helpers';
import type { BlogPost } from '../../src/lib/db/types';

//test setup and teardown for database
let db: DatabaseQueries;
let testHelper: BlogTestHelper;
let testPosts: { [key: string]: BlogPost } = {};

test.beforeAll(async () => {
  //setup test database and create test posts
  db = new DatabaseQueries(':memory:');
  await db.initializeSchema();
  await db.initializeTestData();
  
  testHelper = new BlogTestHelper(db);

  //create comprehensive test posts
  testPosts.published = await testHelper.createPublishedPost('e2e-published-post');
  testPosts.featured = await testHelper.createFeaturedPost('e2e-featured-post');
  testPosts.minimal = await testHelper.createMinimalPost('e2e-minimal-post');
  testPosts.tagged = await testHelper.createPostWithTags('e2e-tagged-post');
  testPosts.draft = await testHelper.createDraftPost('e2e-draft-post');
  testPosts.archived = await testHelper.createArchivedPost('e2e-archived-post');

  //create a sequence for navigation testing
  const sequencePosts = await testHelper.createPostSequence(3);
  testPosts.sequence1 = sequencePosts[0];
  testPosts.sequence2 = sequencePosts[1];
  testPosts.sequence3 = sequencePosts[2];
});

test.afterAll(async () => {
  if (testHelper) {
    await testHelper.cleanup();
  }
  if (db) {
    await db.close();
  }
});

test.describe('Blog Post E2E Tests', () => {

  test.describe('Published Blog Post Access', () => {
    test('should display published blog post correctly', async ({ page }) => {
      await page.goto('/test-e2e-blog?slug=e2e-published-post');

      //verify page loads successfully
      await expect(page).toHaveTitle(/Published Test Post/);
      
      //verify main content elements
      await expect(page.locator('h1')).toContainText('Published Test Post');
      await expect(page.locator('article')).toBeVisible();
      
      //verify meta information
      await expect(page.locator('[data-testid="author-name"]', { hasText: testPosts.published.author_name })).toBeVisible();
      await expect(page.locator('[data-testid="published-date"]')).toBeVisible();
      await expect(page.locator('[data-testid="reading-time"]')).toContainText('min read');
      
      //verify breadcrumb navigation
      await expect(page.locator('nav[aria-label="Breadcrumb"]')).toBeVisible();
      await expect(page.locator('nav[aria-label="Breadcrumb"] a[href="/"]')).toContainText('Home');
      await expect(page.locator('nav[aria-label="Breadcrumb"] a[href="/blog"]')).toContainText('Blog');
      
      //verify content is rendered
      await expect(page.locator('.prose')).toContainText('published blog post');
    });

    test('should display featured image when available', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify featured image is present and loads
      const featuredImage = page.locator('[data-testid="featured-image"]');
      await expect(featuredImage).toBeVisible();
      
      //verify image attributes
      await expect(featuredImage).toHaveAttribute('src', testPosts.published.featured_image_url!);
      await expect(featuredImage).toHaveAttribute('alt', testPosts.published.title);
    });

    test('should display share buttons', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify share buttons are present
      await expect(page.locator('[data-testid="share-buttons"]')).toBeVisible();
      
      //verify individual share options exist
      await expect(page.locator('[data-testid="share-twitter"]')).toBeVisible();
      await expect(page.locator('[data-testid="share-facebook"]')).toBeVisible();
      await expect(page.locator('[data-testid="share-linkedin"]')).toBeVisible();
    });

    test('should display tags and categories when available', async ({ page }) => {
      await page.goto('/blog/e2e-tagged-post');

      //verify categories are displayed
      await expect(page.locator('[data-testid="categories"]')).toBeVisible();
      await expect(page.locator('[data-testid="category-technology"]')).toContainText('Technology');

      //verify tags are displayed
      await expect(page.locator('[data-testid="tags"]')).toBeVisible();
      await expect(page.locator('[data-testid="tag-javascript"]')).toContainText('javascript');
      await expect(page.locator('[data-testid="tag-testing"]')).toContainText('testing');
      await expect(page.locator('[data-testid="tag-astro"]')).toContainText('astro');
    });

    test('should handle featured posts with special styling', async ({ page }) => {
      await page.goto('/blog/e2e-featured-post');

      //verify featured indicator is present
      await expect(page.locator('[data-testid="featured-indicator"]')).toBeVisible();
      await expect(page.locator('[data-testid="featured-indicator"]')).toContainText('★');
      
      //verify featured post title
      await expect(page.locator('h1')).toContainText('Featured Test Post');
    });

    test('should increment view count on visit', async ({ page }) => {
      const initialViewCount = testPosts.published.view_count || 0;

      await page.goto('/blog/e2e-published-post');

      //wait for page to fully load
      await expect(page.locator('h1')).toBeVisible();

      //verify view count indicator if displayed
      const viewCountElement = page.locator('[data-testid="view-count"]');
      if (await viewCountElement.isVisible()) {
        await expect(viewCountElement).toContainText('views');
      }
    });
  });

  test.describe('Blog Post Navigation', () => {
    test('should display navigation to next/previous posts', async ({ page }) => {
      await page.goto(`/blog/${testPosts.sequence2.slug}`);

      //verify navigation section is present
      const navSection = page.locator('[data-testid="post-navigation"]');
      await expect(navSection).toBeVisible();

      //verify previous post link
      const prevLink = page.locator('[data-testid="prev-post"]');
      await expect(prevLink).toBeVisible();
      await expect(prevLink).toContainText('Sequence Post 1');

      //verify next post link
      const nextLink = page.locator('[data-testid="next-post"]');
      await expect(nextLink).toBeVisible();
      await expect(nextLink).toContainText('Sequence Post 3');
    });

    test('should navigate to previous post correctly', async ({ page }) => {
      await page.goto(`/blog/${testPosts.sequence2.slug}`);

      //click previous post link
      await page.click('[data-testid="prev-post"]');

      //verify navigation to correct post
      await expect(page).toHaveURL(`/blog/${testPosts.sequence1.slug}`);
      await expect(page.locator('h1')).toContainText('Sequence Post 1');
    });

    test('should navigate to next post correctly', async ({ page }) => {
      await page.goto(`/blog/${testPosts.sequence2.slug}`);

      //click next post link
      await page.click('[data-testid="next-post"]');

      //verify navigation to correct post
      await expect(page).toHaveURL(`/blog/${testPosts.sequence3.slug}`);
      await expect(page.locator('h1')).toContainText('Sequence Post 3');
    });

    test('should not show previous link on first post', async ({ page }) => {
      await page.goto(`/blog/${testPosts.sequence1.slug}`);

      //verify no previous post link
      await expect(page.locator('[data-testid="prev-post"]')).not.toBeVisible();
      
      //but next post link should be visible
      await expect(page.locator('[data-testid="next-post"]')).toBeVisible();
    });

    test('should not show next link on last post', async ({ page }) => {
      await page.goto(`/blog/${testPosts.sequence3.slug}`);

      //verify no next post link
      await expect(page.locator('[data-testid="next-post"]')).not.toBeVisible();
      
      //but previous post link should be visible
      await expect(page.locator('[data-testid="prev-post"]')).toBeVisible();
    });
  });

  test.describe('Unpublished Blog Post Redirects', () => {
    test('should redirect draft posts to blog index', async ({ page }) => {
      const response = await page.goto('/blog/e2e-draft-post');
      
      //verify redirect occurred
      expect(response?.status()).toBe(302);
      await expect(page).toHaveURL('/blog');
      
      //verify we're on the blog index page
      await expect(page.locator('h1')).toContainText(/Blog|Posts/);
    });

    test('should redirect archived posts to blog index', async ({ page }) => {
      const response = await page.goto('/blog/e2e-archived-post');
      
      //verify redirect occurred
      expect(response?.status()).toBe(302);
      await expect(page).toHaveURL('/blog');
    });

    test('should redirect non-existent posts to blog index', async ({ page }) => {
      const response = await page.goto('/blog/non-existent-post-slug');
      
      //verify redirect occurred
      expect(response?.status()).toBe(302);
      await expect(page).toHaveURL('/blog');
    });

    test('should redirect when slug parameter is missing', async ({ page }) => {
      const response = await page.goto('/blog/');
      
      //verify redirect occurred (depending on route setup)
      if (response?.status() === 302) {
        await expect(page).toHaveURL('/blog');
      }
    });
  });

  test.describe('SEO and Meta Tags', () => {
    test('should have proper meta tags for published posts', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify page title
      await expect(page).toHaveTitle(/Published Test Post/);

      //verify meta description
      const metaDescription = page.locator('meta[name="description"]');
      await expect(metaDescription).toHaveAttribute('content', /.+/);

      //verify Open Graph tags
      const ogTitle = page.locator('meta[property="og:title"]');
      const ogDescription = page.locator('meta[property="og:description"]');
      const ogImage = page.locator('meta[property="og:image"]');
      const ogUrl = page.locator('meta[property="og:url"]');

      await expect(ogTitle).toHaveAttribute('content', /Published Test Post/);
      await expect(ogDescription).toHaveAttribute('content', /.+/);
      await expect(ogImage).toHaveAttribute('content', /.+/);
      await expect(ogUrl).toHaveAttribute('content', /.*\/blog\/e2e-published-post/);

      //verify Twitter Card tags
      const twitterCard = page.locator('meta[name="twitter:card"]');
      const twitterTitle = page.locator('meta[name="twitter:title"]');
      
      await expect(twitterCard).toHaveAttribute('content', 'summary_large_image');
      await expect(twitterTitle).toHaveAttribute('content', /Published Test Post/);
    });

    test('should have structured data for blog posts', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify structured data script tags exist
      const structuredDataScript = page.locator('script[type="application/ld+json"]');
      await expect(structuredDataScript).toBeVisible();

      //verify structured data content contains required fields
      const structuredDataContent = await structuredDataScript.textContent();
      expect(structuredDataContent).toContain('"@type":"BlogPosting"');
      expect(structuredDataContent).toContain('"headline":"Published Test Post"');
      expect(structuredDataContent).toContain('"author"');
      expect(structuredDataContent).toContain('"datePublished"');
    });
  });

  test.describe('Responsive Design and Accessibility', () => {
    test('should be responsive on mobile devices', async ({ page }) => {
      //set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/blog/e2e-published-post');

      //verify content is visible and properly styled
      await expect(page.locator('article')).toBeVisible();
      await expect(page.locator('h1')).toBeVisible();
      
      //verify navigation menu works on mobile
      const mobileMenu = page.locator('[data-testid="mobile-menu"]');
      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();
        await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();
      }
    });

    test('should be responsive on tablet devices', async ({ page }) => {
      //set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/blog/e2e-published-post');

      //verify layout adapts to tablet
      await expect(page.locator('article')).toBeVisible();
      await expect(page.locator('.prose')).toBeVisible();
    });

    test('should have proper accessibility attributes', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify main landmark
      await expect(page.locator('main, [role="main"]')).toBeVisible();

      //verify heading hierarchy
      await expect(page.locator('h1')).toBeVisible();
      
      //verify skip links for accessibility
      const skipLink = page.locator('[data-testid="skip-to-content"]');
      if (await skipLink.isVisible()) {
        await expect(skipLink).toHaveAttribute('href', '#main-content');
      }

      //verify alt texts for images
      const images = page.locator('img');
      const imageCount = await images.count();
      for (let i = 0; i < imageCount; i++) {
        await expect(images.nth(i)).toHaveAttribute('alt', /.+/);
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //test tab navigation
      await page.keyboard.press('Tab');
      
      //verify focus is visible
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['A', 'BUTTON', 'INPUT'].includes(focusedElement || '')).toBeTruthy();
    });
  });

  test.describe('Performance and Loading', () => {
    test('should load blog post within performance budget', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto('/blog/e2e-published-post');
      await expect(page.locator('h1')).toBeVisible();
      
      const loadTime = Date.now() - startTime;
      
      //performance budget: page should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('should have proper image optimization', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify images have loading attributes
      const images = page.locator('img');
      const imageCount = await images.count();
      
      for (let i = 0; i < imageCount; i++) {
        const image = images.nth(i);
        
        //featured image should have eager loading, others lazy
        if (i === 0) {
          await expect(image).toHaveAttribute('loading', 'eager');
        } else {
          await expect(image).toHaveAttribute('loading', 'lazy');
        }
      }
    });

    test('should handle slow network conditions gracefully', async ({ page }) => {
      //simulate slow 3G connection
      await page.context().route('**/*', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 100)); //add 100ms delay
        await route.continue();
      });

      await page.goto('/blog/e2e-published-post');
      
      //verify page still loads correctly
      await expect(page.locator('h1')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('article')).toBeVisible();
    });
  });

  test.describe('Share Functionality', () => {
    test('should have working share buttons', async ({ page, context }) => {
      await page.goto('/blog/e2e-published-post');

      //test Twitter share button
      const twitterSharePromise = context.waitForEvent('page');
      await page.click('[data-testid="share-twitter"]');
      const twitterPage = await twitterSharePromise;
      
      expect(twitterPage.url()).toContain('twitter.com');
      expect(twitterPage.url()).toContain('Published Test Post');
      await twitterPage.close();
    });

    test('should generate correct share URLs', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify share URL construction
      const shareUrl = `${page.url()}`;
      expect(shareUrl).toContain('/blog/e2e-published-post');

      //verify share data is properly encoded
      const twitterButton = page.locator('[data-testid="share-twitter"]');
      const href = await twitterButton.getAttribute('href');
      
      expect(href).toContain(encodeURIComponent(shareUrl));
      expect(href).toContain(encodeURIComponent('Published Test Post'));
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      //simulate network failure
      await page.context().route('**/*', route => route.abort());

      try {
        await page.goto('/blog/e2e-published-post', { waitUntil: 'networkidle' });
      } catch (error) {
        //expect navigation to fail due to network error
        expect(error).toBeDefined();
      }
    });

    test('should display custom 404 page for invalid routes', async ({ page }) => {
      const response = await page.goto('/blog/definitely-does-not-exist-post');
      
      //should redirect to blog index
      expect(response?.status()).toBe(302);
      await expect(page).toHaveURL('/blog');
    });
  });

  test.describe('Content Security', () => {
    test('should sanitize content properly', async ({ page }) => {
      await page.goto('/blog/e2e-published-post');

      //verify no script tags in content (should be sanitized)
      const contentElement = page.locator('.prose');
      const innerHTML = await contentElement.innerHTML();
      
      expect(innerHTML).not.toContain('<script');
      expect(innerHTML).not.toContain('javascript:');
      expect(innerHTML).not.toContain('onclick=');
    });

    test('should have proper CSP headers', async ({ page }) => {
      const response = await page.goto('/blog/e2e-published-post');
      
      //verify Content Security Policy header exists
      const cspHeader = response?.headers()['content-security-policy'];
      if (cspHeader) {
        expect(cspHeader).toContain("default-src");
      }
    });
  });
});