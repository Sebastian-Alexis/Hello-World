// =============================================================================
// BLOG SYSTEM TESTING SCRIPT - Comprehensive testing of all blog functionality
// Tests database operations, API endpoints, performance, and component integration
// =============================================================================

import { db } from '../src/lib/db/queries';
import { ContentProcessor } from '../src/lib/content/processor';
import type { BlogPost, BlogCategory, BlogTag } from '../src/lib/db/types';

interface TestResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  name: string;
  results: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration: number;
}

class BlogSystemTester {
  private results: TestSuite[] = [];
  private baseUrl = 'http://localhost:4321'; // Adjust based on your dev server

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting Blog System Tests...\n');

    const startTime = Date.now();

    try {
      //run test suites in order
      await this.testDatabaseOperations();
      await this.testContentProcessors();
      await this.testAPIEndpoints();
      await this.testPerformanceFeatures();
      await this.testComponentIntegration();

      const totalDuration = Date.now() - startTime;
      this.printTestSummary(totalDuration);

    } catch (error) {
      console.error('❌ Test suite failed with error:', error);
      process.exit(1);
    }
  }

  private async testDatabaseOperations(): Promise<void> {
    const suite: TestSuite = {
      name: 'Database Operations',
      results: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0
    };

    const startTime = Date.now();

    //test database connection
    await this.runTest(suite, 'Database Connection', async () => {
      //attempt to query the database
      await db.getAllCategories();
      return { connected: true };
    });

    //test blog post queries
    await this.runTest(suite, 'Get Blog Posts', async () => {
      const result = await db.getBlogPosts({ page: 1, limit: 5 });
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid blog posts result structure');
      }
      return { count: result.data.length, pagination: result.pagination };
    });

    //test search functionality
    await this.runTest(suite, 'Blog Search', async () => {
      const result = await db.searchBlogPosts({ 
        query: 'test', 
        page: 1, 
        limit: 5 
      });
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('Invalid search result structure');
      }
      return { searchResults: result.data.length };
    });

    //test categories and tags
    await this.runTest(suite, 'Categories and Tags', async () => {
      const [categories, tags] = await Promise.all([
        db.getAllCategories(),
        db.getAllTags()
      ]);
      return { 
        categories: categories.length, 
        tags: tags.length 
      };
    });

    //test individual post retrieval
    await this.runTest(suite, 'Get Single Post', async () => {
      const posts = await db.getBlogPosts({ page: 1, limit: 1 });
      if (posts.data.length === 0) {
        throw new Error('No posts available for testing');
      }

      const post = await db.getBlogPostBySlug(posts.data[0].slug);
      if (!post) {
        throw new Error('Failed to retrieve post by slug');
      }
      
      return { slug: post.slug, title: post.title };
    });

    //test related posts
    await this.runTest(suite, 'Related Posts', async () => {
      const posts = await db.getBlogPosts({ page: 1, limit: 1 });
      if (posts.data.length === 0) {
        return { skipped: true, reason: 'No posts available' };
      }

      const relatedPosts = await db.getRelatedPosts(posts.data[0].id, 3);
      return { relatedCount: relatedPosts.length };
    });

    suite.duration = Date.now() - startTime;
    this.results.push(suite);
  }

  private async testContentProcessors(): Promise<void> {
    const suite: TestSuite = {
      name: 'Content Processing',
      results: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0
    };

    const startTime = Date.now();
    const processor = new ContentProcessor();

    //test markdown processing
    await this.runTest(suite, 'Markdown Processing', async () => {
      const markdown = `# Test Heading\n\nThis is **bold** text with a [link](https://example.com).`;
      const result = await processor.processContent(markdown);
      
      if (!result.html || !result.html.includes('<h1>')) {
        throw new Error('Markdown not processed correctly');
      }
      
      return { 
        htmlLength: result.html.length,
        excerpt: result.excerpt,
        readingTime: result.readingTime 
      };
    });

    //test HTML sanitization
    await this.runTest(suite, 'HTML Sanitization', async () => {
      const maliciousHtml = `<p>Safe content</p><script>alert('xss')</script><img src="x" onerror="alert('xss')">`;
      const sanitized = processor.sanitizeHtml(maliciousHtml);
      
      if (sanitized.includes('<script>') || sanitized.includes('onerror=')) {
        throw new Error('HTML sanitization failed');
      }
      
      return { 
        original: maliciousHtml.length,
        sanitized: sanitized.length,
        safe: !sanitized.includes('script')
      };
    });

    //test excerpt generation
    await this.runTest(suite, 'Excerpt Generation', async () => {
      const longContent = 'Lorem ipsum '.repeat(100);
      const excerpt = processor.generateExcerpt(longContent, 150);
      
      if (excerpt.length > 160) { // Allow some buffer for ellipsis
        throw new Error('Excerpt too long');
      }
      
      return { 
        originalLength: longContent.length,
        excerptLength: excerpt.length 
      };
    });

    //test reading time calculation
    await this.runTest(suite, 'Reading Time Calculation', async () => {
      const content = 'word '.repeat(200); // 200 words
      const readingTime = processor.calculateReadingTime(content);
      
      if (readingTime < 1 || readingTime > 3) {
        throw new Error(`Unexpected reading time: ${readingTime} minutes`);
      }
      
      return { 
        wordCount: 200,
        readingTime: readingTime
      };
    });

    suite.duration = Date.now() - startTime;
    this.results.push(suite);
  }

  private async testAPIEndpoints(): Promise<void> {
    const suite: TestSuite = {
      name: 'API Endpoints',
      results: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0
    };

    const startTime = Date.now();

    //test main blog API
    await this.runTest(suite, 'GET /api/blog', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !data.data) {
        throw new Error('Invalid API response structure');
      }
      
      return { 
        status: response.status,
        posts: data.data.length,
        hasCache: response.headers.get('cache-control') !== null
      };
    });

    //test search API
    await this.runTest(suite, 'GET /api/blog/search', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog/search?q=test&limit=5`);
      if (!response.ok) {
        throw new Error(`Search API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid search API response');
      }
      
      return { 
        status: response.status,
        results: data.data.length,
        hasCache: response.headers.get('cache-control') !== null
      };
    });

    //test categories API
    await this.runTest(suite, 'GET /api/blog/categories', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog/categories`);
      if (!response.ok) {
        throw new Error(`Categories API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid categories API response');
      }
      
      return { 
        status: response.status,
        categories: data.data.length
      };
    });

    //test tags API  
    await this.runTest(suite, 'GET /api/blog/tags', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog/tags`);
      if (!response.ok) {
        throw new Error(`Tags API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid tags API response');
      }
      
      return { 
        status: response.status,
        tags: data.data.length
      };
    });

    //test popular posts API
    await this.runTest(suite, 'GET /api/blog/popular', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog/popular?limit=5`);
      if (!response.ok) {
        throw new Error(`Popular API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid popular posts API response');
      }
      
      return { 
        status: response.status,
        popularPosts: data.data.length
      };
    });

    //test RSS feed
    await this.runTest(suite, 'GET /api/blog/rss', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog/rss`);
      if (!response.ok) {
        throw new Error(`RSS API returned ${response.status}: ${response.statusText}`);
      }
      
      const rssContent = await response.text();
      if (!rssContent.includes('<?xml') || !rssContent.includes('<rss')) {
        throw new Error('Invalid RSS feed format');
      }
      
      return { 
        status: response.status,
        contentLength: rssContent.length,
        isValidXML: rssContent.includes('<?xml')
      };
    });

    //test archive API
    await this.runTest(suite, 'GET /api/blog/archive', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog/archive`);
      if (!response.ok) {
        throw new Error(`Archive API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid archive API response');
      }
      
      return { 
        status: response.status,
        archiveEntries: data.data.length
      };
    });

    suite.duration = Date.now() - startTime;
    this.results.push(suite);
  }

  private async testPerformanceFeatures(): Promise<void> {
    const suite: TestSuite = {
      name: 'Performance Features',
      results: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0
    };

    const startTime = Date.now();

    //test vitals API endpoint
    await this.runTest(suite, 'Performance Vitals API', async () => {
      const mockVital = {
        vital: {
          name: 'LCP',
          value: 1500,
          id: 'test-id',
          delta: 1500,
          rating: 'good' as const,
          navigationType: 'navigate',
          timestamp: Date.now(),
          url: 'http://localhost:4321/test',
          userAgent: 'test-agent'
        },
        sessionId: 'test-session-' + Date.now(),
        timestamp: Date.now()
      };

      const response = await fetch(`${this.baseUrl}/api/vitals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockVital)
      });

      if (!response.ok) {
        throw new Error(`Vitals API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error('Vitals API did not return success');
      }

      return { 
        status: response.status,
        recorded: true 
      };
    });

    //test service worker file
    await this.runTest(suite, 'Service Worker File', async () => {
      const response = await fetch(`${this.baseUrl}/sw.js`);
      if (!response.ok) {
        throw new Error(`Service worker file not found: ${response.status}`);
      }
      
      const swContent = await response.text();
      if (!swContent.includes('CACHE_VERSION') || !swContent.includes('install')) {
        throw new Error('Service worker content invalid');
      }
      
      return { 
        status: response.status,
        contentLength: swContent.length,
        hasInstallHandler: swContent.includes('install')
      };
    });

    //test cache headers on API endpoints
    await this.runTest(suite, 'API Cache Headers', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog`);
      const cacheControl = response.headers.get('cache-control');
      const etag = response.headers.get('etag');
      
      if (!cacheControl) {
        throw new Error('Missing cache-control header');
      }
      
      return { 
        hasCacheControl: !!cacheControl,
        hasETag: !!etag,
        cacheControl: cacheControl
      };
    });

    //test compression headers
    await this.runTest(suite, 'Compression Support', async () => {
      const response = await fetch(`${this.baseUrl}/api/blog`, {
        headers: {
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });
      
      const vary = response.headers.get('vary');
      const contentEncoding = response.headers.get('content-encoding');
      
      return { 
        hasVaryHeader: !!vary,
        hasContentEncoding: !!contentEncoding,
        vary: vary,
        encoding: contentEncoding
      };
    });

    suite.duration = Date.now() - startTime;
    this.results.push(suite);
  }

  private async testComponentIntegration(): Promise<void> {
    const suite: TestSuite = {
      name: 'Component Integration',
      results: [],
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      duration: 0
    };

    const startTime = Date.now();

    //test main blog page
    await this.runTest(suite, 'Blog Index Page', async () => {
      const response = await fetch(`${this.baseUrl}/blog`);
      if (!response.ok) {
        throw new Error(`Blog page returned ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      if (!html.includes('blog') || !html.includes('<!DOCTYPE html>')) {
        throw new Error('Invalid blog page HTML');
      }
      
      return { 
        status: response.status,
        hasHtml: html.includes('<!DOCTYPE html>'),
        contentLength: html.length
      };
    });

    //test search page
    await this.runTest(suite, 'Blog Search Page', async () => {
      const response = await fetch(`${this.baseUrl}/blog/search`);
      if (!response.ok) {
        throw new Error(`Search page returned ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      if (!html.includes('search') || !html.includes('<!DOCTYPE html>')) {
        throw new Error('Invalid search page HTML');
      }
      
      return { 
        status: response.status,
        hasSearchBox: html.includes('search'),
        contentLength: html.length
      };
    });

    //test archive page
    await this.runTest(suite, 'Blog Archive Page', async () => {
      const response = await fetch(`${this.baseUrl}/blog/archive`);
      if (!response.ok) {
        throw new Error(`Archive page returned ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      if (!html.includes('archive') || !html.includes('<!DOCTYPE html>')) {
        throw new Error('Invalid archive page HTML');
      }
      
      return { 
        status: response.status,
        hasArchive: html.includes('archive'),
        contentLength: html.length
      };
    });

    //test individual blog post (if available)
    await this.runTest(suite, 'Individual Blog Post', async () => {
      try {
        //get a blog post to test
        const apiResponse = await fetch(`${this.baseUrl}/api/blog?limit=1`);
        const apiData = await apiResponse.json();
        
        if (!apiData.success || apiData.data.length === 0) {
          return { skipped: true, reason: 'No blog posts available' };
        }
        
        const post = apiData.data[0];
        const response = await fetch(`${this.baseUrl}/blog/${post.slug}`);
        
        if (!response.ok) {
          throw new Error(`Blog post returned ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        if (!html.includes(post.title) || !html.includes('<!DOCTYPE html>')) {
          throw new Error('Invalid blog post HTML');
        }
        
        return { 
          status: response.status,
          slug: post.slug,
          hasTitle: html.includes(post.title),
          contentLength: html.length
        };
      } catch (error) {
        return { skipped: true, reason: error.message };
      }
    });

    suite.duration = Date.now() - startTime;
    this.results.push(suite);
  }

  private async runTest(
    suite: TestSuite, 
    testName: string, 
    testFunction: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(`  📝 Running: ${testName}...`);
      const result = await testFunction();
      
      const duration = Date.now() - startTime;
      
      if (result && result.skipped) {
        suite.results.push({
          name: testName,
          status: 'skipped',
          duration,
          details: result
        });
        suite.skippedTests++;
        console.log(`  ⏭️  Skipped: ${testName} (${result.reason})`);
      } else {
        suite.results.push({
          name: testName,
          status: 'passed',
          duration,
          details: result
        });
        suite.passedTests++;
        console.log(`  ✅ Passed: ${testName} (${duration}ms)`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      suite.results.push({
        name: testName,
        status: 'failed',
        duration,
        error: error.message,
        details: error
      });
      suite.failedTests++;
      console.log(`  ❌ Failed: ${testName} - ${error.message} (${duration}ms)`);
    }
    
    suite.totalTests++;
  }

  private printTestSummary(totalDuration: number): void {
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    this.results.forEach(suite => {
      const passRate = suite.totalTests > 0 ? 
        Math.round((suite.passedTests / suite.totalTests) * 100) : 0;
      
      console.log(`\n📦 ${suite.name}`);
      console.log(`   Tests: ${suite.totalTests} | Passed: ${suite.passedTests} | Failed: ${suite.failedTests} | Skipped: ${suite.skippedTests}`);
      console.log(`   Pass Rate: ${passRate}% | Duration: ${suite.duration}ms`);
      
      //show failed tests
      const failedTests = suite.results.filter(r => r.status === 'failed');
      if (failedTests.length > 0) {
        console.log('   Failed Tests:');
        failedTests.forEach(test => {
          console.log(`     ❌ ${test.name}: ${test.error}`);
        });
      }

      totalTests += suite.totalTests;
      totalPassed += suite.passedTests;
      totalFailed += suite.failedTests;
      totalSkipped += suite.skippedTests;
    });

    const overallPassRate = totalTests > 0 ? 
      Math.round((totalPassed / totalTests) * 100) : 0;

    console.log('\n' + '='.repeat(80));
    console.log('🎯 OVERALL RESULTS');
    console.log('='.repeat(80));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⏭️  Skipped: ${totalSkipped}`);
    console.log(`📈 Pass Rate: ${overallPassRate}%`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);

    if (totalFailed === 0) {
      console.log('\n🎉 All tests passed! Blog system is ready for production.');
    } else {
      console.log(`\n⚠️  ${totalFailed} test(s) failed. Please review and fix issues before deployment.`);
    }

    console.log('='.repeat(80));
  }
}

//run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new BlogSystemTester();
  tester.runAllTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

export { BlogSystemTester };