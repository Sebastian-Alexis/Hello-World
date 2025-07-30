// =============================================================================
// BLOG API - Main blog listing endpoint with filtering and pagination
// GET /api/blog - Returns paginated blog posts with advanced filtering
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';
import type { BlogPostQueryOptions, BlogSearchFilters } from '@/lib/db/types';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    
    //extract query parameters
    const options: BlogPostQueryOptions & BlogSearchFilters = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: Math.min(parseInt(searchParams.get('limit') || '10'), 50), // Max 50 posts per page
      status: (searchParams.get('status') as any) || 'published',
      featured: searchParams.get('featured') ? searchParams.get('featured') === 'true' : undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'published_at',
      sortOrder: (searchParams.get('sortOrder') as 'ASC' | 'DESC') || 'DESC',
      includeAuthor: searchParams.get('includeAuthor') !== 'false',
      includeCategories: searchParams.get('includeCategories') !== 'false',
      includeTags: searchParams.get('includeTags') !== 'false',
    };

    //handle search query
    const searchQuery = searchParams.get('q')?.trim();
    if (searchQuery) {
      //extract additional search filters
      const searchFilters: BlogSearchFilters = {
        query: searchQuery,
        categories: searchParams.get('categories')?.split(',').map(Number).filter(Boolean),
        tags: searchParams.get('tags')?.split(',').map(Number).filter(Boolean),
        dateFrom: searchParams.get('dateFrom') || undefined,
        dateTo: searchParams.get('dateTo') || undefined,
        ...options,
      };

      const result = await db.searchBlogPosts(searchFilters);
      
      return new Response(JSON.stringify({
        success: true,
        data: result.data,
        pagination: result.pagination,
        meta: {
          searchQuery,
          hasSearchResults: result.data.length > 0,
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min browser, 10min CDN
          'Vary': 'Accept-Encoding',
        },
      });
    }

    //regular blog post listing
    const result = await db.getBlogPosts(options);

    //check if this is a conditional request (for caching)
    const ifNoneMatch = request.headers.get('if-none-match');
    const etag = `"blog-${result.pagination.page}-${result.pagination.total}-${Date.now()}"`;
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=600',
          'ETag': etag,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        totalPosts: result.pagination.total,
        currentPage: result.pagination.page,
        timestamp: new Date().toISOString(),
        filters: {
          status: options.status,
          featured: options.featured,
          sortBy: options.sortBy,
          sortOrder: options.sortOrder,
        },
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=600',
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Total-Count': result.pagination.total.toString(),
      },
    });

  } catch (error) {
    console.error('Blog API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch blog posts',
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