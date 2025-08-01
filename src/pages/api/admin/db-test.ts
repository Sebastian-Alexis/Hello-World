import type { APIRoute } from 'astro';
import { getDbClient } from '../../../lib/db/connection';
import { getDbConfig } from '../../../lib/env';

export const GET: APIRoute = async () => {
  try {
    console.log('Testing Turso database connection...');
    
    // Get database config
    const config = getDbConfig();
    console.log('Database URL:', config.url);
    console.log('Has auth token:', !!config.authToken);
    
    // Get database client
    const client = getDbClient();
    
    // Test basic query
    const result = await client.execute('SELECT 1 as test');
    console.log('Basic query successful:', result);
    
    // Check if blog_posts table exists
    try {
      const tableCheck = await client.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='blog_posts'
      `);
      console.log('Table check result:', tableCheck);
      
      const hasTable = tableCheck.rows.length > 0;
      
      // If no table, list all tables
      if (!hasTable) {
        const allTables = await client.execute(`
          SELECT name FROM sqlite_master 
          WHERE type='table'
          ORDER BY name
        `);
        console.log('All tables:', allTables.rows);
      }
      
      return new Response(JSON.stringify({
        success: true,
        connection: 'Connected to Turso',
        databaseUrl: config.url,
        hasAuthToken: !!config.authToken,
        hasBlogPostsTable: hasTable,
        tables: !hasTable ? (await client.execute(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)).rows : []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (tableError) {
      console.error('Table check error:', tableError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Table check failed',
        details: tableError instanceof Error ? tableError.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('Database test error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};