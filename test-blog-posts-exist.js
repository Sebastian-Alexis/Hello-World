import { db } from './src/lib/db/queries.js';

async function checkBlogPosts() {
  try {
    //check for any blog posts
    const allPosts = await db.getBlogPosts({ limit: 10 });
    console.log('Total blog posts found:', allPosts.data.length);
    
    if (allPosts.data.length > 0) {
      console.log('\nBlog posts:');
      allPosts.data.forEach(post => {
        console.log(`- "${post.title}" (slug: ${post.slug}, status: ${post.status})`);
      });
      
      //test specific slug
      const testSlug = allPosts.data[0].slug;
      console.log(`\nTesting getBlogPostBySlug with slug: ${testSlug}`);
      const specificPost = await db.getBlogPostBySlug(testSlug);
      console.log('Result:', specificPost ? `Found: ${specificPost.title}` : 'Not found');
    } else {
      console.log('No blog posts found in the database');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkBlogPosts();