import { db } from '../src/lib/db/queries.js';

console.log('Testing blog post links...\n');

try {
  //get some blog posts
  const result = await db.getBlogPosts({ 
    limit: 5, 
    status: 'published' 
  });
  
  console.log(`Found ${result.posts.length} published posts:\n`);
  
  result.posts.forEach((post, index) => {
    console.log(`${index + 1}. ${post.title}`);
    console.log(`   Slug: ${post.slug}`);
    console.log(`   Link: /blog/${post.slug}`);
    console.log(`   Status: ${post.status}`);
    console.log(`   Published: ${post.published_at ? new Date(post.published_at).toLocaleDateString() : 'N/A'}`);
    console.log('');
  });
  
  if (result.posts.length === 0) {
    console.log('No published posts found. Make sure to run the publish-test-posts.js script first.');
  }
  
} catch (error) {
  console.error('Error testing blog links:', error);
}

process.exit(0);