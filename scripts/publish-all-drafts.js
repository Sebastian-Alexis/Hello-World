import { db } from '../src/lib/db/queries.ts';

async function publishAllDrafts() {
  try {
    console.log('Fetching all draft posts...');
    
    // Get all draft posts
    const result = await db.getBlogPosts({
      status: 'draft',
      limit: 100
    });
    
    console.log(`Found ${result.data.length} draft posts`);
    
    for (const post of result.data) {
      console.log(`Publishing post: ${post.title} (ID: ${post.id})`);
      
      await db.updateBlogPost(post.id, {
        status: 'published',
        published_at: post.published_at || new Date().toISOString()
      });
      
      console.log(`✓ Published: ${post.title}`);
    }
    
    console.log('\nAll draft posts have been published!');
    process.exit(0);
  } catch (error) {
    console.error('Error publishing drafts:', error);
    process.exit(1);
  }
}

publishAllDrafts();