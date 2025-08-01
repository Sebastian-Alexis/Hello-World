import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async () => {
  try {
    //create a test blog post
    const testPost = {
      title: 'Test Blog Post for Navigation',
      slug: 'test-blog-post-navigation',
      content: '# Test Blog Post\n\nThis is a test blog post to verify navigation is working correctly.\n\n## Features\n\n- Markdown content\n- Proper slug\n- Published status\n\n## Testing\n\nIf you can see this post, the navigation is working!',
      excerpt: 'This is a test blog post to verify navigation is working correctly.',
      status: 'published' as const,
      featured_image_url: 'https://images.unsplash.com/photo-1516259762381-22954d7d3ad2?w=800',
      author_id: 1,
      tags: ['test', 'navigation'],
      categories: ['Technology']
    };
    
    const postId = await db.createBlogPost(testPost);
    
    //fetch the created post to verify
    const createdPost = await db.getBlogPostBySlug('test-blog-post-navigation');
    
    return new Response(JSON.stringify({
      success: true,
      postId,
      post: createdPost,
      url: `/blog/${testPost.slug}`
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Failed to create test post',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};