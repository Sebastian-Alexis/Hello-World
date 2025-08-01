#!/usr/bin/env ts-node

//simple test to verify database connection and check for blog posts

import { getDbClient } from './src/lib/db/connection.ts';

async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  const client = getDbClient();
  
  try {
    //basic connectivity test
    await client.execute('SELECT 1');
    console.log('✅ Database connection successful');
    
    //check if blog_posts table exists
    const tableCheck = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='blog_posts'
    `);
    
    if (tableCheck.rows.length === 0) {
      console.log('❌ blog_posts table not found');
      return;
    }
    
    console.log('✅ blog_posts table exists');
    
    //count total posts
    const totalPosts = await client.execute('SELECT COUNT(*) as count FROM blog_posts');
    const count = totalPosts.rows[0]?.count as number;
    console.log(`📊 Total blog posts: ${count}`);
    
    //check for posts without slugs
    const missingSlugPosts = await client.execute(`
      SELECT COUNT(*) as count 
      FROM blog_posts 
      WHERE slug IS NULL OR slug = '' OR TRIM(slug) = ''
    `);
    
    const missingCount = missingSlugPosts.rows[0]?.count as number;
    console.log(`📊 Posts missing slugs: ${missingCount}`);
    
    if (missingCount > 0) {
      //show some examples
      const examples = await client.execute(`
        SELECT id, title, slug 
        FROM blog_posts 
        WHERE slug IS NULL OR slug = '' OR TRIM(slug) = ''
        LIMIT 3
      `);
      
      console.log('\n📋 Examples of posts needing slugs:');
      for (const post of examples.rows) {
        const title = (post.title as string)?.substring(0, 50) + '...';  
        console.log(`  • Post ${post.id}: "${title}" (slug: ${post.slug || 'NULL'})`);
      }
    }
    
    //check for existing valid slugs
    const validSlugs = await client.execute(`
      SELECT COUNT(*) as count 
      FROM blog_posts 
      WHERE slug IS NOT NULL AND TRIM(slug) != ''
    `);
    
    const validCount = validSlugs.rows[0]?.count as number;
    console.log(`📊 Posts with valid slugs: ${validCount}`);
    
    console.log('\n🏁 Database connection test completed');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

if (require.main === module) {
  testConnection().finally(() => {
    console.log('\n👋 Test completed');
    process.exit(0);
  });
}

export { testConnection };