// =============================================================================
// BLOG CATEGORIES API - List all blog categories with post counts
// GET /api/blog/categories - Returns all active blog categories
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    
    //extract parameters
    const includeEmpty = searchParams.get('includeEmpty') === 'true';
    const sortBy = searchParams.get('sortBy') || 'post_count'; // 'name', 'post_count', 'created_at'
    const sortOrder = (searchParams.get('sortOrder')?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    const limit = searchParams.get('limit') ? Math.min(100, Math.max(1, parseInt(searchParams.get('limit')!))) : undefined;

    //get categories
    const allCategories = await db.getBlogCategories(true);
    
    //filter out empty categories if requested
    let categories = includeEmpty 
      ? allCategories 
      : allCategories.filter(cat => cat.post_count > 0);

    //sort categories
    categories.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'post_count':
          comparison = a.post_count - b.post_count;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        default:
          comparison = a.post_count - b.post_count;
      }
      
      return sortOrder === 'DESC' ? -comparison : comparison;
    });

    //apply limit if specified
    if (limit) {
      categories = categories.slice(0, limit);
    }

    //calculate statistics
    const totalCategories = allCategories.length;
    const activeCategories = allCategories.filter(cat => cat.post_count > 0).length;
    const totalPosts = allCategories.reduce((sum, cat) => sum + cat.post_count, 0);
    const mostPopular = allCategories.length > 0 
      ? allCategories.reduce((max, cat) => cat.post_count > max.post_count ? cat : max)
      : null;

    //generate etag for caching
    const etag = `"categories-${totalCategories}-${totalPosts}-${Date.now()}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30min browser, 1hr CDN
          'ETag': etag,
        },
      });
    }

    const responseData = {
      success: true,
      data: categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        color: cat.color,
        icon: cat.icon,
        post_count: cat.post_count,
        is_active: cat.is_active,
        created_at: cat.created_at,
        updated_at: cat.updated_at,
      })),
      meta: {
        statistics: {
          totalCategories,
          activeCategories,
          totalPosts,
          averagePostsPerCategory: activeCategories > 0 ? Math.round(totalPosts / activeCategories) : 0,
          mostPopular: mostPopular ? {
            name: mostPopular.name,
            slug: mostPopular.slug,
            post_count: mostPopular.post_count,
          } : null,
        },
        filters: {
          includeEmpty,
          sortBy,
          sortOrder,
          limit: limit || 'none',
          applied: categories.length,
        },
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30min browser, 1hr CDN
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Total-Categories': totalCategories.toString(),
        'X-Active-Categories': activeCategories.toString(),
      },
    });

  } catch (error) {
    console.error('Blog categories API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch blog categories',
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