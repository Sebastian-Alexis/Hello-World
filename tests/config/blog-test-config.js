/**
 * Blog Post Test Configuration
 * Centralized configuration for all blog post tests
 */

export const BLOG_TEST_CONFIG = {
  //database configuration
  database: {
    testDbUrl: ':memory:',
    initTimeout: 10000,
    queryTimeout: 5000,
    cleanupTimeout: 3000
  },

  //test data configuration
  testData: {
    defaultAuthorId: 1,
    maxSlugLength: 200,
    maxTitleLength: 255,
    maxContentLength: 50000,
    maxExcerptLength: 500,
    sampleImages: [
      'https://example.com/test-image-1.jpg',
      'https://example.com/test-image-2.jpg',
      'https://example.com/test-image-3.jpg'
    ],
    sampleTags: ['javascript', 'typescript', 'astro', 'testing', 'web-development'],
    sampleCategories: ['Technology', 'Tutorials', 'Development', 'Best Practices']
  },

  //performance budgets
  performance: {
    maxPageLoadTime: 3000, //3 seconds
    maxDatabaseQueryTime: 100, //100ms
    maxContentProcessingTime: 500, //500ms
    maxImageLoadTime: 2000, //2 seconds
    minLighthouseScore: 90
  },

  //e2e test configuration
  e2e: {
    baseUrl: 'http://localhost:4321',
    timeout: 30000,
    retries: 2,
    browsers: ['chromium', 'firefox', 'webkit'],
    viewports: {
      mobile: { width: 375, height: 667 },
      tablet: { width: 768, height: 1024 },
      desktop: { width: 1920, height: 1080 }
    }
  },

  //route configuration
  routes: {
    blogIndex: '/blog',
    blogPost: '/blog/{slug}',
    adminLogin: '/admin/login',
    adminDashboard: '/admin'
  },

  //expected behavior configuration
  behavior: {
    publishedPostShouldLoad: true,
    draftPostShouldRedirect: true,
    archivedPostShouldRedirect: true,
    nonExistentPostShouldRedirect: true,
    emptySlugShouldRedirect: true,
    redirectTarget: '/blog',
    viewCountShouldIncrement: true,
    contentShouldBeSanitized: true
  },

  //seo configuration
  seo: {
    requiredMetaTags: [
      'title',
      'description',
      'og:title',
      'og:description',
      'og:url',
      'og:type',
      'twitter:card',
      'twitter:title'
    ],
    requiredStructuredData: [
      '@context',
      '@type',
      'headline',
      'author',
      'datePublished'
    ],
    maxTitleLength: 60,
    maxDescriptionLength: 160
  },

  //accessibility configuration
  accessibility: {
    requiredElements: [
      'main',
      'nav[aria-label="Breadcrumb"]',
      'h1',
      'article'
    ],
    requiredAltTexts: true,
    keyboardNavigation: true,
    colorContrast: 'AA'
  },

  //security configuration
  security: {
    preventSqlInjection: true,
    sanitizeContent: true,
    validateCsp: true,
    testMaliciousInputs: [
      "'; DROP TABLE blog_posts; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "<script>alert('xss')</script>",
      "javascript:alert('xss')",
      "onclick=alert('xss')"
    ]
  },

  //test environment configuration
  testEnvironment: {
    nodeEnv: 'test',
    logLevel: 'warn',
    mockExternalServices: true,
    useInMemoryDb: true,
    cleanupBetweenTests: true
  },

  //coverage thresholds
  coverage: {
    statements: 80,
    branches: 80,
    functions: 80,
    lines: 80,
    excludePatterns: [
      'node_modules/',
      'tests/',
      'dist/',
      '**/*.d.ts',
      '**/*.config.{js,ts}'
    ]
  }
};

//test utilities configuration
export const TEST_UTILITIES = {
  //mock data generators
  generators: {
    randomSlug: () => `test-post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    randomTitle: () => `Test Post ${Date.now()}`,
    randomContent: (length = 1000) => 'Lorem ipsum '.repeat(Math.ceil(length / 12)).substr(0, length),
    randomExcerpt: () => 'This is a test excerpt for blog post testing purposes.',
    randomImage: () => BLOG_TEST_CONFIG.testData.sampleImages[Math.floor(Math.random() * BLOG_TEST_CONFIG.testData.sampleImages.length)],
    randomTags: (count = 3) => BLOG_TEST_CONFIG.testData.sampleTags.slice(0, count),
    randomCategory: () => BLOG_TEST_CONFIG.testData.sampleCategories[Math.floor(Math.random() * BLOG_TEST_CONFIG.testData.sampleCategories.length)]
  },

  //assertion helpers
  assertions: {
    isValidSlug: (slug) => /^[a-z0-9-]+$/.test(slug),
    isValidUrl: (url) => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    },
    isValidDate: (date) => !isNaN(Date.parse(date)),
    hasRequiredFields: (post) => {
      return post && 
             typeof post.title === 'string' && 
             typeof post.slug === 'string' && 
             typeof post.content === 'string' && 
             typeof post.status === 'string';
    }
  },

  //wait helpers for async operations
  waitHelpers: {
    forElement: (page, selector, timeout = 10000) => 
      page.waitForSelector(selector, { timeout }),
    forNavigation: (page, timeout = 10000) => 
      page.waitForNavigation({ timeout }),
    forResponse: (page, urlPattern, timeout = 10000) => 
      page.waitForResponse(urlPattern, { timeout }),
    forDatabase: (operation, timeout = 5000) => 
      Promise.race([
        operation,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Database operation timeout')), timeout)
        )
      ])
  }
};

//environment-specific configurations
export const ENVIRONMENT_CONFIG = {
  development: {
    ...BLOG_TEST_CONFIG,
    performance: {
      ...BLOG_TEST_CONFIG.performance,
      maxPageLoadTime: 5000 //more lenient in dev
    }
  },
  
  testing: {
    ...BLOG_TEST_CONFIG,
    testEnvironment: {
      ...BLOG_TEST_CONFIG.testEnvironment,
      logLevel: 'error' //suppress logs in testing
    }
  },
  
  ci: {
    ...BLOG_TEST_CONFIG,
    e2e: {
      ...BLOG_TEST_CONFIG.e2e,
      retries: 3, //more retries in CI
      timeout: 45000 //longer timeout for CI
    }
  }
};

//get configuration based on environment
export function getTestConfig(env = process.env.NODE_ENV || 'development') {
  return ENVIRONMENT_CONFIG[env] || BLOG_TEST_CONFIG;
}

export default BLOG_TEST_CONFIG;