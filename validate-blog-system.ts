#!/usr/bin/env ts-node

//comprehensive blog system validation
//checks for all potential navigation issues

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

dotenv.config();

interface BlogPost {
  id: number;
  title: string;
  slug: string;
  status: string;
  published_at: string | null;
  created_at: string;
}

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

async function validateBlogSystem() {
  console.log('🔍 Comprehensive Blog System Validation\n');
  
  const client = getDbClient();
  let hasIssues = false;
  
  try {
    //test connection
    console.log('1️⃣ Testing database connection...');
    await client.execute('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    //check table structure
    console.log('2️⃣ Validating table structure...');
    const tableInfo = await client.execute('PRAGMA table_info(blog_posts)');
    const columns = tableInfo.rows.map(row => (row as any).name);
    
    const requiredColumns = ['id', 'title', 'slug', 'status', 'content', 'created_at'];
    const missingColumns = requiredColumns.filter(col => !columns.includes(col));
    
    if (missingColumns.length > 0) {
      console.log(`❌ Missing required columns: ${missingColumns.join(', ')}`);
      hasIssues = true;
    } else {
      console.log('✅ All required columns present');
    }
    
    //check indexes
    const indexes = await client.execute('PRAGMA index_list(blog_posts)');
    const slugIndex = indexes.rows.find(row => (row as any).name.includes('slug'));
    
    if (slugIndex) {
      console.log('✅ Slug index exists');
    } else {
      console.log('⚠️  No slug index found - may impact performance');
    }
    
    console.log();
    
    //check all posts
    console.log('3️⃣ Validating blog posts...');
    const allPosts = await client.execute(`
      SELECT id, title, slug, status, published_at, created_at
      FROM blog_posts 
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Total posts: ${allPosts.rows.length}`);
    
    if (allPosts.rows.length === 0) {
      console.log('ℹ️  No blog posts found - this is normal for a new site\n');
      return !hasIssues;
    }
    
    const posts = allPosts.rows as BlogPost[];
    
    //check for null/empty slugs
    const postsWithoutSlugs = posts.filter(p => !p.slug || p.slug.trim() === '');
    if (postsWithoutSlugs.length > 0) {
      console.log(`❌ ${postsWithoutSlugs.length} posts have missing slugs:`);
      postsWithoutSlugs.forEach(p => {
        console.log(`  • Post ${p.id}: "${p.title.substring(0, 40)}..."`);
      });
      hasIssues = true;
    } else {
      console.log('✅ All posts have slugs');
    }
    
    //check for duplicate slugs
    const slugCounts = new Map<string, number>();
    posts.forEach(p => {
      if (p.slug) {
        slugCounts.set(p.slug, (slugCounts.get(p.slug) || 0) + 1);
      }
    });
    
    const duplicateSlugs = Array.from(slugCounts.entries()).filter(([, count]) => count > 1);
    if (duplicateSlugs.length > 0) {
      console.log(`❌ ${duplicateSlugs.length} duplicate slugs found:`);
      duplicateSlugs.forEach(([slug, count]) => {
        console.log(`  • "${slug}" appears ${count} times`);
      });
      hasIssues = true;
    } else {
      console.log('✅ All slugs are unique');
    }
    
    //check slug format
    const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const invalidSlugs = posts.filter(p => p.slug && !SLUG_REGEX.test(p.slug));
    if (invalidSlugs.length > 0) {
      console.log(`❌ ${invalidSlugs.length} posts have invalid slug format:`);
      invalidSlugs.forEach(p => {
        console.log(`  • Post ${p.id}: "${p.slug}"`);
      });
      hasIssues = true;
    } else {
      console.log('✅ All slugs have valid format');
    }
    
    //check published posts
    const publishedPosts = posts.filter(p => p.status === 'published');
    console.log(`📊 Published posts: ${publishedPosts.length}`);
    
    const publishedWithoutPublishDate = publishedPosts.filter(p => !p.published_at);
    if (publishedWithoutPublishDate.length > 0) {
      console.log(`⚠️  ${publishedWithoutPublishDate.length} published posts missing publish date`);
    }
    
    console.log();
    
    //test a few sample navigation URLs
    console.log('4️⃣ Testing navigation URLs...');
    const samplePosts = publishedPosts.slice(0, 3);
    
    if (samplePosts.length > 0) {
      console.log('📝 Sample URLs to test:');
      samplePosts.forEach(p => {
        console.log(`  • /blog/${p.slug} (Post: "${p.title.substring(0, 30)}...")`);
        console.log(`  • /api/blog/${p.slug} (API endpoint)`);
      });
    } else {
      console.log('ℹ️  No published posts to test');
    }
    
    console.log();
    
    //check categories and tags relationships
    console.log('5️⃣ Checking related data...');
    
    const [categoriesResult, tagsResult, postCategoriesResult, postTagsResult] = await Promise.all([
      client.execute('SELECT COUNT(*) as count FROM blog_categories').catch(() => ({ rows: [{ count: 0 }] })),
      client.execute('SELECT COUNT(*) as count FROM blog_tags').catch(() => ({ rows: [{ count: 0 }] })),
      client.execute('SELECT COUNT(*) as count FROM blog_post_categories').catch(() => ({ rows: [{ count: 0 }] })),
      client.execute('SELECT COUNT(*) as count FROM blog_post_tags').catch(() => ({ rows: [{ count: 0 }] }))
    ]);
    
    console.log(`📊 Categories: ${categoriesResult.rows[0]?.count || 0}`);
    console.log(`📊 Tags: ${tagsResult.rows[0]?.count || 0}`);  
    console.log(`📊 Post-Category relationships: ${postCategoriesResult.rows[0]?.count || 0}`);
    console.log(`📊 Post-Tag relationships: ${postTagsResult.rows[0]?.count || 0}`);
    
    console.log();
    
    //final summary
    console.log('🏁 Validation Summary:');
    if (hasIssues) {
      console.log('❌ Issues found that may cause navigation problems');
      console.log('\n🔧 Recommended actions:');
      console.log('  1. Fix any missing or duplicate slugs');
      console.log('  2. Ensure all published posts have valid slugs');
      console.log('  3. Test navigation URLs manually');
      console.log('  4. Check server logs for 404 errors');
    } else {
      console.log('✅ Blog system appears healthy');
      console.log('\n✨ If you are still experiencing navigation issues:');
      console.log('  1. Check your routing configuration');
      console.log('  2. Verify API endpoints are working');  
      console.log('  3. Clear browser cache and try again');
      console.log('  4. Check server logs for specific error messages');
    }
    
    //show some debugging info
    console.log('\n🐛 Debugging Information:');
    console.log(`  • Database URL: ${process.env.TURSO_DATABASE_URL?.replace(/\/\/.*@/, '//***@')}`);
    console.log(`  • Total tables: ${(await client.execute("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'")).rows[0]?.count}`);
    console.log(`  • Node environment: ${process.env.NODE_ENV || 'development'}`);
    
    return !hasIssues;
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
    return false;
  } finally {
    await client.close();
  }
}

//run validation
if (import.meta.url === `file://${process.argv[1]}`) {
  validateBlogSystem().then(isHealthy => {
    console.log(`\n🎯 Blog system is ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    process.exit(isHealthy ? 0 : 1);
  }).catch(error => {
    console.error('\n💥 Validation script failed:', error);
    process.exit(1);
  });
}