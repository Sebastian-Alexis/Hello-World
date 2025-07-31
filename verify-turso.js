#!/usr/bin/env node

import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function verifyTursoDatabase() {
  console.log('🔍 Verifying Turso database...');
  
  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
      syncUrl: process.env.TURSO_SYNC_URL,
    });

    console.log('📡 Connected to Turso database:', process.env.TURSO_DATABASE_URL);

    // List all tables
    const tables = await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
    
    console.log('\n📊 Tables in Turso database:');
    if (tables.rows.length === 0) {
      console.log('   ❌ No tables found!');
    } else {
      tables.rows.forEach(row => console.log(`   ✅ ${row.name}`));
    }

    // Specifically check blog_posts
    try {
      const blogPostsCheck = await client.execute('SELECT COUNT(*) as count FROM blog_posts');
      console.log(`\n✅ blog_posts table exists with ${blogPostsCheck.rows[0]?.count} records`);
    } catch (error) {
      console.log('\n❌ blog_posts table check failed:', error.message);
    }

    await client.close();
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
  }
}

verifyTursoDatabase();