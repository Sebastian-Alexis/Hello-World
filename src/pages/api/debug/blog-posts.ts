import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async () => {
  try {
    const result = await db.getBlogPosts({ 
      limit: 10, 
      status: 'published' 
    });
    
    const debug = {
      totalPosts: result.total,
      postsReturned: result.posts.length,
      posts: result.posts.map(post => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        status: post.status,
        published_at: post.published_at,
        link: `/blog/${post.slug}`,
        hasSlug: !!post.slug,
        slugLength: post.slug?.length || 0
      }))
    };
    
    return new Response(JSON.stringify(debug, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch blog posts',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};