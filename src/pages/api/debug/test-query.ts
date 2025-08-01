import type { APIRoute } from 'astro';
import { getDbClient } from '../../../lib/db/connection';
import { executeQuery } from '../../../lib/db/connection';

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug') || 'testpublish';
  
  try {
    const client = getDbClient();
    
    //test 1: direct client query
    const directResult = await client.execute(
      'SELECT id, title, slug, status, published_at FROM blog_posts WHERE slug = ?',
      [slug]
    );
    
    //test 2: using executeQuery
    const executeResult = await executeQuery<{id: number, title: string, slug: string, status: string, published_at: string}>(
      'SELECT id, title, slug, status, published_at FROM blog_posts WHERE slug = ?',
      [slug]
    );
    
    //test 3: check with status filter
    const withStatusResult = await client.execute(
      'SELECT id, title, slug, status, published_at FROM blog_posts WHERE slug = ? AND status = ?',
      [slug, 'published']
    );
    
    //test 4: get all posts to see what's there
    const allPosts = await client.execute(
      'SELECT id, title, slug, status, published_at FROM blog_posts LIMIT 10'
    );
    
    const response = {
      requestedSlug: slug,
      tests: {
        directQuery: {
          rowCount: directResult.rows.length,
          rows: directResult.rows
        },
        executeQuery: {
          rowCount: executeResult.rows.length,
          rows: executeResult.rows
        },
        withStatusFilter: {
          rowCount: withStatusResult.rows.length,
          rows: withStatusResult.rows
        },
        allPosts: {
          rowCount: allPosts.rows.length,
          rows: allPosts.rows
        }
      },
      analysis: {
        slugFound: directResult.rows.length > 0,
        isPublished: withStatusResult.rows.length > 0,
        problem: directResult.rows.length > 0 && withStatusResult.rows.length === 0 
          ? 'Post exists but is not published'
          : directResult.rows.length === 0 
            ? 'Post does not exist with this slug'
            : 'Post exists and is published'
      }
    };
    
    return new Response(JSON.stringify(response, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, null, 2), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};