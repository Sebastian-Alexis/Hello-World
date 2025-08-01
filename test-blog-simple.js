import { getDbClient } from './src/lib/db/connection.js';
import { db } from './src/lib/db/queries.js';
import { ContentProcessor } from './src/lib/content/processor.js';

console.log('\n=== Blog Post Viewing Test ===\n');

const testSlug = 'testpublish';

try {
  // Test 1: Database Connection
  console.log('1. Testing database connection...');
  const client = getDbClient();
  const testConn = await client.execute('SELECT 1 as test');
  console.log('✓ Database connected\n');

  // Test 2: Direct query
  console.log('2. Testing direct query...');
  const directQuery = await client.execute(
    'SELECT id, title, slug, status, published_at, content FROM blog_posts WHERE slug = ?',
    [testSlug]
  );
  console.log(`✓ Found ${directQuery.rows.length} posts`);
  if (directQuery.rows.length > 0) {
    const post = directQuery.rows[0];
    console.log(`  - ID: ${post.id}`);
    console.log(`  - Title: ${post.title}`);
    console.log(`  - Slug: ${post.slug}`);
    console.log(`  - Status: ${post.status}`);
    console.log(`  - Published: ${post.published_at}`);
    console.log(`  - Content length: ${post.content?.length || 0}\n`);
  }

  // Test 3: getBlogPostBySlug
  console.log('3. Testing getBlogPostBySlug...');
  try {
    const post = await db.getBlogPostBySlug(testSlug);
    if (post) {
      console.log('✓ getBlogPostBySlug returned post');
      console.log(`  - Title: ${post.title}`);
      console.log(`  - Categories: ${post.categories?.length || 0}`);
      console.log(`  - Tags: ${post.tags?.length || 0}\n`);
    } else {
      console.log('✗ getBlogPostBySlug returned null\n');
    }
  } catch (error) {
    console.log('✗ getBlogPostBySlug failed:', error.message);
    console.log(error.stack + '\n');
  }

  // Test 4: Content Processing
  console.log('4. Testing content processing...');
  const testPost = directQuery.rows[0];
  if (testPost && testPost.content) {
    try {
      const processed = ContentProcessor.processContent(testPost.content, testPost.title);
      console.log('✓ Content processed successfully');
      console.log(`  - HTML length: ${processed.html.length}`);
      console.log(`  - Word count: ${processed.wordCount}`);
      console.log(`  - Reading time: ${processed.readingTime} min\n`);
    } catch (error) {
      console.log('✗ Content processing failed:', error.message);
      console.log(error.stack + '\n');
    }
  } else {
    console.log('✗ No content to process\n');
  }

  // Test 5: Related posts
  console.log('5. Testing related posts...');
  if (testPost) {
    try {
      const [nextPost, prevPost] = await Promise.all([
        db.getNextBlogPost(testPost.published_at, testPost.id),
        db.getPreviousBlogPost(testPost.published_at, testPost.id)
      ]);
      console.log(`✓ Related posts query completed`);
      console.log(`  - Next post: ${nextPost ? nextPost.slug : 'none'}`);
      console.log(`  - Previous post: ${prevPost ? prevPost.slug : 'none'}\n`);
    } catch (error) {
      console.log('✗ Related posts failed:', error.message + '\n');
    }
  }

  // Test 6: Full blog page simulation
  console.log('6. Simulating full blog page logic...');
  try {
    // This is exactly what blog/[slug].astro does
    const slug = testSlug;
    
    if (!slug) {
      throw new Error('No slug - would redirect');
    }
    
    const post = await db.getBlogPostBySlug(slug);
    
    if (!post) {
      throw new Error('Post not found - would redirect');
    }
    
    const processed = ContentProcessor.processContent(post.content, post.title);
    const processedContent = processed.html;
    
    const [nextPost, prevPost] = await Promise.all([
      db.getNextBlogPost(post.published_at, post.id),
      db.getPreviousBlogPost(post.published_at, post.id)
    ]);
    
    await db.incrementBlogPostViewCount(post.id).catch(console.error);
    
    console.log('✓ All blog page operations succeeded!');
    console.log('  The page should render without redirecting.\n');
  } catch (error) {
    console.log('✗ Blog page simulation failed:', error.message);
    console.log('  This is why the page redirects!\n');
    console.log('Error details:', error.stack);
  }

} catch (error) {
  console.error('Fatal error:', error);
  process.exit(1);
}

console.log('\n=== Test Complete ===\n');
process.exit(0);