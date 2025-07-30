// =============================================================================
// BLOG CATEGORY API - Blog posts filtered by category
// GET /api/blog/categories/[slug] - Returns posts in specific category
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';
import type { QueryOptions } from '@/lib/db/types';

export const GET: APIRoute = async ({ params, url, request }) => {
  try {
    const { slug } = params;
    
    if (!slug || typeof slug !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or missing category slug',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const searchParams = new URL(request.url).searchParams;
    
    //extract query options
    const options: QueryOptions = {
      page: Math.max(1, parseInt(searchParams.get('page') || '1')),
      limit: Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10'))),
      sortBy: (searchParams.get('sortBy') as any) || 'published_at',
      sortOrder: (searchParams.get('sortOrder') as 'ASC' | 'DESC') || 'DESC',
    };

    //validate category exists
    const categories = await db.getBlogCategories(true);
    const category = categories.find(cat => cat.slug === slug);
    
    if (!category) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Category not found',
        message: `No category found with slug: ${slug}`,
        availableCategories: categories.map(cat => ({
          slug: cat.slug,
          name: cat.name,
          post_count: cat.post_count,
        })),
        timestamp: new Date().toISOString(),
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    //get posts in this category
    const result = await db.getBlogPostsByCategory(slug, options);

    //generate etag for caching
    const etag = `"category-${category.id}-${options.page}-${result.pagination.total}-${category.updated_at}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=600, s-maxage=1800',
          'ETag': etag,
        },
      });
    }

    const responseData = {
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        category: {
          id: category.id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          color: category.color,
          icon: category.icon,
          post_count: category.post_count,
        },
        totalPostsInCategory: category.post_count,
        currentPage: result.pagination.page,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600, s-maxage=1800', // 10min browser, 30min CDN
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Category-Name': category.name,
        'X-Category-Posts': category.post_count.toString(),
      },
    });

  } catch (error) {
    console.error('Blog category API error:', { slug: params.slug, error });
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch category posts',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }
};