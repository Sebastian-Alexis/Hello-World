import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

//create new blog post
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
      allow_comments: true, //default to allow comments
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

    //validate required fields
    if (!blogData.title || !blogData.content) {
      return new Response(JSON.stringify({ 
        error: 'Title and content are required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    //auto-generate slug if not provided
    if (!blogData.slug) {
      blogData.slug = blogData.title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    }

    //check if slug already exists
    console.log('Checking for existing slug:', blogData.slug);
    const slugExists = await db.checkSlugExists(blogData.slug);
    console.log('Slug already exists:', slugExists);
    
    if (slugExists) {
      //append a number to make it unique
      let counter = 1;
      let newSlug = `${blogData.slug}-${counter}`;
      
      while (await db.checkSlugExists(newSlug)) {
        counter++;
        newSlug = `${blogData.slug}-${counter}`;
      }
      
      console.log('Generated unique slug:', newSlug);
      blogData.slug = newSlug;
    }

    console.log('Creating blog post with data:', JSON.stringify(blogData, null, 2));
    
    //create blog post in database with author ID
    const authorId = 1; //default admin user
    console.log('Calling db.createBlogPost with authorId:', authorId);
    
    const result = await db.createBlogPost(blogData, authorId);
    console.log('Blog post created successfully:', result);
    
    return new Response(JSON.stringify({ 
      success: true, 
      id: result.id,
      message: 'Blog post created successfully' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Blog creation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    // Return detailed error information for debugging
    return new Response(JSON.stringify({ 
      error: 'Failed to create blog post',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      type: typeof error
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

//get blog posts for admin
export const GET: APIRoute = async ({ request, url }) => {
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

    //get query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const status = url.searchParams.get('status');
    const search = url.searchParams.get('search');
    const category = url.searchParams.get('category');

    //get blog posts from database using existing function
    const result = await db.getBlogPosts({
      page,
      limit,
      // Note: may need to modify existing function to support status filtering
      // For now, get all posts
    });
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Blog fetch error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch blog posts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};