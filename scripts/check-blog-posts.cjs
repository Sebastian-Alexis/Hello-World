const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'hello-world.db');
console.log('Checking database at:', dbPath);

try {
  const db = new Database(dbPath, { readonly: true });
  
  //check all blog posts
  const posts = db.prepare('SELECT id, title, slug, status, published_at FROM blog_posts').all();
  
  console.log(`\nFound ${posts.length} blog posts:\n`);
  
  posts.forEach((post, index) => {
    console.log(`${index + 1}. ${post.title || 'Untitled'}`);
    console.log(`   ID: ${post.id}`);
    console.log(`   Slug: ${post.slug || 'NO SLUG'}`);
    console.log(`   Status: ${post.status}`);
    console.log(`   Published: ${post.published_at || 'Not published'}`);
    console.log('');
  });
  
  //check specifically for published posts
  const publishedPosts = posts.filter(p => p.status === 'published');
  console.log(`\nPublished posts: ${publishedPosts.length}`);
  
  //check for posts without slugs
  const postsWithoutSlugs = posts.filter(p => !p.slug);
  if (postsWithoutSlugs.length > 0) {
    console.log(`\n⚠️  Warning: ${postsWithoutSlugs.length} posts have no slug!`);
  }
  
  db.close();
} catch (error) {
  console.error('Error checking database:', error.message);
}