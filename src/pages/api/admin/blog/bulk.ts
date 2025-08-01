import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db/queries';

//bulk operations on blog posts
export const POST: APIRoute = async ({ request }) => {
  try {
    //TODO: Add proper authentication when auth system is ready
    /*
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    */
    
    const { action, postIds } = await request.json();
    
    if (!action || !postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request. Action and postIds are required.' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    //validate all post IDs are numbers
    const validPostIds = postIds.filter(id => !isNaN(Number(id))).map(Number);
    if (validPostIds.length !== postIds.length) {
      return new Response(JSON.stringify({ 
        error: 'Invalid post IDs provided' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    let successCount = 0;
    const errors = [];
    
    switch (action) {
      case 'publish':
        for (const postId of validPostIds) {
          try {
            await db.updateBlogPost(postId, { 
              status: 'published',
              published_at: new Date().toISOString()
            });
            successCount++;
          } catch (error) {
            errors.push({ postId, error: error.message });
          }
        }
        break;
        
      case 'draft':
        for (const postId of validPostIds) {
          try {
            await db.updateBlogPost(postId, { status: 'draft' });
            successCount++;
          } catch (error) {
            errors.push({ postId, error: error.message });
          }
        }
        break;
        
      case 'delete':
        for (const postId of validPostIds) {
          try {
            await db.deleteBlogPost(postId);
            successCount++;
          } catch (error) {
            errors.push({ postId, error: error.message });
          }
        }
        break;
        
      default:
        return new Response(JSON.stringify({ 
          error: `Invalid action: ${action}. Valid actions are: publish, draft, delete` 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: `Successfully performed ${action} on ${successCount} posts`,
      successCount,
      totalCount: validPostIds.length,
      errors: errors.length > 0 ? errors : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Bulk operation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to perform bulk operation',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};