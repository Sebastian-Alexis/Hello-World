import type { APIRoute } from 'astro';
import { db } from '../../../../lib/db/queries';

//delete a blog post
export const DELETE: APIRoute = async ({ params }) => {
  try {
    const postId = params.id;
    
    if (!postId || isNaN(Number(postId))) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
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
    
    //check if post exists
    const existingPost = await db.getBlogPostById(Number(postId));
    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    //delete the post
    await db.deleteBlogPost(Number(postId));
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Blog post deleted successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Blog deletion error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete blog post',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

//update a blog post
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const postId = params.id;
    
    if (!postId || isNaN(Number(postId))) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    //TODO: Add proper authentication
    
    //parse form data
    const formData = await request.formData();
    
    const blogData = {
      title: formData.get('title') as string,
      slug: formData.get('slug') as string,
      content: formData.get('content') as string,
      excerpt: formData.get('excerpt') as string || undefined,
      status: (formData.get('status') as string || 'draft') as 'draft' | 'published',
      featured_image: formData.get('featured_image') as string || undefined,
      meta_title: formData.get('meta_title') as string || undefined,
      meta_description: formData.get('meta_description') as string || undefined,
      canonical_url: undefined,
      og_image: formData.get('featured_image') as string || undefined,
      featured: formData.get('featured') === 'on',
      allow_comments: true,
      category_ids: formData.get('category') ? [parseInt(formData.get('category') as string)] : [],
      tag_ids: (() => {
        try {
          const tags = formData.get('tags') as string;
          if (!tags || tags === '') return [];
          const parsed = JSON.parse(tags);
          return Array.isArray(parsed) ? parsed.map(id => parseInt(id)) : [];
        } catch {
          return [];
        }
      })()
    };
    
    //check if post exists
    const existingPost = await db.getBlogPostById(Number(postId));
    if (!existingPost) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    //if slug changed, check for duplicates
    if (blogData.slug && blogData.slug !== existingPost.slug) {
      const slugExists = await db.checkSlugExists(blogData.slug);
      if (slugExists) {
        return new Response(JSON.stringify({ 
          error: 'Slug already exists' 
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    //update the post
    await db.updateBlogPost(Number(postId), blogData);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Blog post updated successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Blog update error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to update blog post',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

//get a single blog post
export const GET: APIRoute = async ({ params }) => {
  try {
    const postId = params.id;
    
    if (!postId || isNaN(Number(postId))) {
      return new Response(JSON.stringify({ error: 'Invalid post ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    //TODO: Add proper authentication
    
    const post = await db.getBlogPostById(Number(postId));
    
    if (!post) {
      return new Response(JSON.stringify({ error: 'Post not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify(post), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Blog fetch error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch blog post',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};