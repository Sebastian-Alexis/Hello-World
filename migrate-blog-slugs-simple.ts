#!/usr/bin/env ts-node

//simplified blog slug migration script
//does not rely on Astro path aliases for easier execution

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

//load environment variables
dotenv.config();

interface BlogPost {
  id: number;
  title: string;
  slug: string | null;
  status: string;
  created_at: string;
}

//simplified slug generation function
function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') //remove special chars
    .replace(/[\s_-]+/g, '-') //replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); //trim hyphens from start/end
}

//get database client
function getDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  
  if (!url) {
    throw new Error('TURSO_DATABASE_URL environment variable is required');
  }
  
  return createClient({
    url,
    authToken,
    syncUrl: process.env.TURSO_SYNC_URL,
    syncInterval: 60,
  });
}

async function fixBlogSlugs() {
  console.log('🚀 Blog Slug Migration - Simplified Version\n');
  
  const client = getDbClient();
  
  try {
    //test connection
    console.log('🔍 Testing database connection...');
    await client.execute('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    //get posts without slugs
    console.log('📊 Finding posts with missing slugs...');
    const postsWithoutSlug = await client.execute(`
      SELECT id, title, slug, status, created_at
      FROM blog_posts 
      WHERE slug IS NULL OR slug = '' OR TRIM(slug) = ''
      ORDER BY created_at ASC
    `);
    
    console.log(`Found ${postsWithoutSlug.rows.length} posts needing slugs`);
    
    if (postsWithoutSlug.rows.length === 0) {
      console.log('🎉 All blog posts already have slugs!');
      return;
    }
    
    //show posts that need fixing
    console.log('\n📋 Posts that need slug generation:');  
    for (const post of postsWithoutSlug.rows as BlogPost[]) {
      const truncatedTitle = post.title.length > 50 
        ? post.title.substring(0, 50) + '...' 
        : post.title;
      console.log(`  • Post ${post.id} (${post.status}): "${truncatedTitle}"`);
    }
    
    //get existing slugs for uniqueness check
    const existingSlugsResult = await client.execute(`
      SELECT slug 
      FROM blog_posts 
      WHERE slug IS NOT NULL AND TRIM(slug) != ''
    `);
    
    const existingSlugs = new Set(
      existingSlugsResult.rows
        .map(row => row.slug as string)
        .filter(slug => slug && slug.trim())
    );
    
    console.log(`\n📝 Found ${existingSlugs.size} existing valid slugs`);
    
    //generate unique slugs  
    const updates: { id: number; slug: string; title: string }[] = [];
    
    for (const post of postsWithoutSlug.rows as BlogPost[]) {
      let baseSlug = generateSlugFromTitle(post.title);
      
      //handle edge cases where title might generate empty slug
      if (!baseSlug || baseSlug.trim() === '') {
        baseSlug = `post-${post.id}`;
        console.log(`  ⚠️  Post ${post.id} has problematic title, using fallback: "${baseSlug}"`);
      }
      
      let finalSlug = baseSlug;
      let counter = 1;
      
      //ensure uniqueness
      while (existingSlugs.has(finalSlug)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      existingSlugs.add(finalSlug);
      updates.push({ id: post.id, slug: finalSlug, title: post.title });
      
      const truncatedTitle = post.title.length > 40 
        ? post.title.substring(0, 40) + '...' 
        : post.title;
      console.log(`  ✏️  Post ${post.id}: "${truncatedTitle}" → "${finalSlug}"`);
    }
    
    //perform batch update
    console.log('\n🔄 Performing batch update...');
    const statements = updates.map(({ id, slug }) => ({
      sql: 'UPDATE blog_posts SET slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [slug, id]
    }));
    
    await client.batch(statements, 'write');
    console.log(`✅ Successfully updated ${updates.length} blog posts!`);
    
    //verify the fix
    const remaining = await client.execute(`
      SELECT COUNT(*) as count 
      FROM blog_posts 
      WHERE slug IS NULL OR slug = '' OR TRIM(slug) = ''
    `);
    
    const remainingCount = remaining.rows[0]?.count as number;
    
    if (remainingCount === 0) {
      console.log('🎉 All blog posts now have valid slugs!');
    } else {
      console.log(`⚠️  ${remainingCount} posts still need manual attention`);
    }
    
    //final summary
    console.log('\n📊 Migration Summary:');
    console.log(`  • Posts fixed: ${updates.length}`);
    console.log(`  • Posts remaining: ${remainingCount}`);
    console.log(`  • Total existing slugs: ${existingSlugs.size}`);
    
    if (updates.length > 0) {
      console.log('\n🔗 Test these URLs to verify navigation works:');
      console.log('  • /blog (main blog page)');  
      console.log('  • /blog/[slug] (individual posts)');
      console.log('  • /api/blog/[slug] (API endpoints)');
    }
    
    console.log('\n🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    throw error;
  } finally {
    await client.close();
  }
}

//quick health check function
async function quickCheck() {
  const client = getDbClient();
  
  try {
    const [missingResult, totalResult] = await Promise.all([
      client.execute(`
        SELECT COUNT(*) as count 
        FROM blog_posts 
        WHERE slug IS NULL OR slug = '' OR TRIM(slug) = ''
      `),
      client.execute('SELECT COUNT(*) as count FROM blog_posts')
    ]);
    
    const missing = missingResult.rows[0]?.count as number;
    const total = totalResult.rows[0]?.count as number;
    
    console.log('📊 Blog Slug Health Check:');
    console.log(`  • Total posts: ${total}`);
    console.log(`  • Missing slugs: ${missing}`);
    console.log(`  • Valid slugs: ${total - missing}`);
    
    if (missing === 0) {
      console.log('✅ All blog posts have slugs!');
    } else {
      console.log(`⚠️  ${missing} posts need slug generation`);
      console.log('   Run: npx ts-node migrate-blog-slugs-simple.ts');
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
  } finally {
    await client.close();
  }
}

//main execution
async function main() {
  const action = process.argv[2] || 'migrate';
  
  if (action === 'check') {
    await quickCheck();
  } else {
    await fixBlogSlugs();
  }
}

//run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
}