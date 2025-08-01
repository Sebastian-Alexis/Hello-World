import type { APIRoute } from 'astro';
import { getDbClient } from '../../../lib/db/connection';

export const GET: APIRoute = async ({ url }) => {
  const slug = url.searchParams.get('slug') || 'testpublish';
  
  try {
    const client = getDbClient();
    
    //first check current status
    const checkResult = await client.execute(
      'SELECT id, title, slug, status, published_at FROM blog_posts WHERE slug = ?',
      [slug]
    );
    
    if (checkResult.rows.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Post not found',
        slug: slug
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const post = checkResult.rows[0];
    const beforeStatus = {
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      published_at: post.published_at
    };
    
    //force publish the post
    const updateResult = await client.execute(
      'UPDATE blog_posts SET status = ?, published_at = ? WHERE slug = ?',
      ['published', new Date().toISOString(), slug]
    );
    
    //check after update
    const afterResult = await client.execute(
      'SELECT id, title, slug, status, published_at FROM blog_posts WHERE slug = ?',
      [slug]
    );
    
    const afterPost = afterResult.rows[0];
    
    return new Response(JSON.stringify({
      success: true,
      before: beforeStatus,
      after: {
        id: afterPost.id,
        title: afterPost.title,
        slug: afterPost.slug,
        status: afterPost.status,
        published_at: afterPost.published_at
      },
      updateResult: {
        rowsAffected: updateResult.rowsAffected
      },
      testLinks: {
        blogPost: `/blog/${slug}`,
        debugPage: `/blog/debug-${slug}`,
        apiEndpoint: `/api/blog/${slug}`
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Update failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};