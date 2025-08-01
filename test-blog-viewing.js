import { getDbClient } from './src/lib/db/connection.js';
import { db } from './src/lib/db/queries.js';
import { ContentProcessor } from './src/lib/content/processor.js';
import chalk from 'chalk';

console.log(chalk.blue.bold('\n🧪 Blog Post Viewing Test Suite\n'));

const testSlug = 'testpublish';
let passedTests = 0;
let failedTests = 0;
const results = [];

async function runTest(name, testFn) {
  console.log(chalk.yellow(`\nRunning: ${name}`));
  try {
    const result = await testFn();
    if (result.success) {
      console.log(chalk.green(`✅ PASS: ${name}`));
      passedTests++;
      results.push({ name, success: true, details: result.details });
    } else {
      console.log(chalk.red(`❌ FAIL: ${name}`));
      console.log(chalk.red(`   Reason: ${result.error}`));
      failedTests++;
      results.push({ name, success: false, error: result.error, details: result.details });
    }
  } catch (error) {
    console.log(chalk.red(`❌ ERROR: ${name}`));
    console.log(chalk.red(`   ${error.message}`));
    console.log(error.stack);
    failedTests++;
    results.push({ name, success: false, error: error.message, stack: error.stack });
  }
}

// Test 1: Database Connection
await runTest('Database Connection', async () => {
  try {
    const client = getDbClient();
    const result = await client.execute('SELECT 1 as test');
    return { 
      success: result.rows.length > 0, 
      details: { connected: true }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test 2: Direct Database Query
await runTest('Direct Database Query for Blog Post', async () => {
  try {
    const client = getDbClient();
    const result = await client.execute(
      'SELECT * FROM blog_posts WHERE slug = ?',
      [testSlug]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'No post found with slug: ' + testSlug };
    }
    
    const post = result.rows[0];
    return { 
      success: true, 
      details: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        status: post.status,
        published_at: post.published_at,
        content_length: post.content?.length || 0
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test 3: getBlogPostBySlug Function
await runTest('getBlogPostBySlug Query Function', async () => {
  try {
    const post = await db.getBlogPostBySlug(testSlug);
    
    if (!post) {
      return { success: false, error: 'getBlogPostBySlug returned null' };
    }
    
    return { 
      success: true, 
      details: {
        id: post.id,
        title: post.title,
        slug: post.slug,
        status: post.status,
        hasCategories: Array.isArray(post.categories),
        hasTags: Array.isArray(post.tags)
      }
    };
  } catch (error) {
    return { success: false, error: error.message, stack: error.stack };
  }
});

// Test 4: Check Post Status
await runTest('Blog Post Status Check', async () => {
  try {
    const client = getDbClient();
    const result = await client.execute(
      'SELECT slug, status, published_at FROM blog_posts WHERE slug = ?',
      [testSlug]
    );
    
    if (result.rows.length === 0) {
      return { success: false, error: 'Post not found' };
    }
    
    const post = result.rows[0];
    const isPublished = post.status === 'published';
    const hasPublishedDate = post.published_at !== null;
    
    return { 
      success: isPublished && hasPublishedDate, 
      details: {
        status: post.status,
        published_at: post.published_at,
        isPublished,
        hasPublishedDate
      },
      error: !isPublished ? 'Post is not published' : !hasPublishedDate ? 'Post has no published date' : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test 5: Content Processing
await runTest('Content Processing', async () => {
  try {
    const post = await db.getBlogPostBySlug(testSlug);
    
    if (!post) {
      return { success: false, error: 'Post not found for content processing' };
    }
    
    // Test if content exists
    if (!post.content) {
      return { success: false, error: 'Post has no content' };
    }
    
    // Try to process content
    const processed = ContentProcessor.processContent(post.content, post.title);
    
    return { 
      success: true, 
      details: {
        contentLength: post.content.length,
        htmlLength: processed.html.length,
        hasHtml: processed.html.length > 0,
        wordCount: processed.wordCount,
        readingTime: processed.readingTime
      }
    };
  } catch (error) {
    return { success: false, error: error.message, stack: error.stack };
  }
});

// Test 6: Check for Import/Module Issues
await runTest('Module Import Check', async () => {
  try {
    // Check if all required modules are loaded
    const checks = {
      hasDb: typeof db === 'object',
      hasGetBlogPostBySlug: typeof db.getBlogPostBySlug === 'function',
      hasContentProcessor: typeof ContentProcessor === 'function',
      hasProcessContent: typeof ContentProcessor.processContent === 'function',
    };
    
    const allChecks = Object.values(checks).every(v => v === true);
    
    return { 
      success: allChecks, 
      details: checks,
      error: !allChecks ? 'Some modules are not properly loaded' : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test 7: Simulate Blog Page Logic
await runTest('Simulate Blog Page Logic', async () => {
  try {
    // This simulates what blog/[slug].astro does
    const slug = testSlug;
    
    if (!slug) {
      return { success: false, error: 'No slug provided (would redirect)' };
    }
    
    const post = await db.getBlogPostBySlug(slug);
    
    if (!post) {
      return { success: false, error: 'Post not found (would redirect)' };
    }
    
    // Try content processing
    const processed = ContentProcessor.processContent(post.content, post.title);
    
    // Try to get related posts
    const [nextPost, prevPost] = await Promise.all([
      db.getNextBlogPost(post.published_at, post.id).catch(() => null),
      db.getPreviousBlogPost(post.published_at, post.id).catch(() => null)
    ]);
    
    return { 
      success: true, 
      details: {
        postFound: true,
        contentProcessed: true,
        htmlLength: processed.html.length,
        hasNextPost: !!nextPost,
        hasPrevPost: !!prevPost
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Error in blog page logic: ${error.message}`,
      stack: error.stack 
    };
  }
});

// Test 8: Check All Blog Posts
await runTest('List All Blog Posts', async () => {
  try {
    const result = await db.getBlogPosts({ limit: 10, status: 'published' });
    
    return { 
      success: true, 
      details: {
        total: result.total,
        postsReturned: result.posts.length,
        posts: result.posts.map(p => ({
          id: p.id,
          title: p.title,
          slug: p.slug,
          status: p.status
        }))
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Test 9: Check URL Pattern
await runTest('URL Pattern Test', async () => {
  // This tests if the slug would work in a URL
  const testUrls = [
    `/blog/${testSlug}`,
    `/blog/debug-${testSlug}`,
    `/api/blog/${testSlug}`
  ];
  
  const validUrls = testUrls.filter(url => {
    // Check if URL is valid
    try {
      new URL(url, 'http://localhost:4321');
      return true;
    } catch {
      return false;
    }
  });
  
  return { 
    success: validUrls.length === testUrls.length, 
    details: {
      testUrls,
      validUrls,
      slug: testSlug
    }
  };
});

// Summary
console.log(chalk.blue.bold('\n📊 Test Summary\n'));
console.log(chalk.green(`Passed: ${passedTests}`));
console.log(chalk.red(`Failed: ${failedTests}`));
console.log(chalk.yellow(`Total: ${passedTests + failedTests}`));

// Detailed Results
console.log(chalk.blue.bold('\n📝 Detailed Results\n'));
results.forEach(result => {
  if (result.success) {
    console.log(chalk.green(`✅ ${result.name}`));
    if (result.details) {
      console.log(chalk.gray(JSON.stringify(result.details, null, 2)));
    }
  } else {
    console.log(chalk.red(`❌ ${result.name}`));
    console.log(chalk.red(`   Error: ${result.error}`));
    if (result.details) {
      console.log(chalk.gray(JSON.stringify(result.details, null, 2)));
    }
    if (result.stack && process.env.DEBUG) {
      console.log(chalk.gray(result.stack));
    }
  }
});

// Diagnosis
console.log(chalk.blue.bold('\n🔍 Diagnosis\n'));
if (failedTests === 0) {
  console.log(chalk.green('All tests passed! The blog viewing system should work correctly.'));
  console.log(chalk.yellow('If you still see redirects, the issue might be:'));
  console.log('1. Browser cache - try incognito mode');
  console.log('2. Development server needs restart');
  console.log('3. Check browser console for client-side errors');
} else {
  console.log(chalk.red('Some tests failed. Check the errors above for details.'));
  
  // Specific diagnostics based on failures
  const failedTestNames = results.filter(r => !r.success).map(r => r.name);
  
  if (failedTestNames.includes('Database Connection')) {
    console.log(chalk.red('\n❌ Database connection issue - check your Turso credentials'));
  }
  
  if (failedTestNames.includes('Content Processing')) {
    console.log(chalk.red('\n❌ Content processing issue - check ContentProcessor'));
  }
  
  if (failedTestNames.includes('Blog Post Status Check')) {
    console.log(chalk.red('\n❌ Post is not published or missing publish date'));
  }
}

process.exit(failedTests > 0 ? 1 : 0);