#!/usr/bin/env node

//script to fix published blog posts that are missing published_at timestamps
//this addresses the migration issue where posts were published but don't have published_at set

import { db } from '../src/lib/db/queries.js';

async function fixPublishedPosts() {
  console.log('🔧 Fixing published blog posts without published_at timestamps...');
  
  try {
    //find all published posts without published_at
    const postsToFix = await db.executeQuery(`
      SELECT id, title, status, created_at, updated_at, published_at
      FROM blog_posts 
      WHERE status = 'published' 
      AND published_at IS NULL
    `);

    if (postsToFix.rows.length === 0) {
      console.log('✅ No published posts found without published_at timestamps.');
      return;
    }

    console.log(`📝 Found ${postsToFix.rows.length} published posts without published_at timestamps:`);
    
    for (const post of postsToFix.rows) {
      console.log(`  - ${post.title} (ID: ${post.id})`);
      
      //use updated_at as published_at, or created_at if updated_at is not available
      const publishedAt = post.updated_at || post.created_at;
      
      await db.executeQuery(
        'UPDATE blog_posts SET published_at = ? WHERE id = ?',
        [publishedAt, post.id]
      );
      
      console.log(`    ✅ Set published_at to ${publishedAt}`);
    }

    console.log(`\n🎉 Successfully fixed ${postsToFix.rows.length} published posts!`);
    
    //verify the fix
    const verifyResult = await db.executeQuery(`
      SELECT COUNT(*) as count
      FROM blog_posts 
      WHERE status = 'published' 
      AND published_at IS NULL
    `);
    
    console.log(`\n🔍 Verification: ${verifyResult.rows[0].count} published posts still missing published_at`);
    
  } catch (error) {
    console.error('❌ Error fixing published posts:', error);
    throw error;
  }
}

//run the fix if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fixPublishedPosts().catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
}

export { fixPublishedPosts };