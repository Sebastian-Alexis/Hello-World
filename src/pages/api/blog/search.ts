// =============================================================================
// BLOG SEARCH API - Full-text search endpoint with advanced filtering
// GET /api/blog/search - Returns search results with ranking and highlighting
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';
import type { BlogSearchFilters, QueryOptions } from '@/lib/db/types';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get('q')?.trim();
    
    //validate search query
    if (!query) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search query is required',
        message: 'Please provide a search query using the "q" parameter',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (query.length < 2) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search query too short',
        message: 'Search query must be at least 2 characters long',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (query.length > 100) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search query too long',
        message: 'Search query must be less than 100 characters',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //extract search filters and options
    const filters: BlogSearchFilters & QueryOptions = {
      query,
      categories: searchParams.get('categories')?.split(',').map(Number).filter(Boolean),
      tags: searchParams.get('tags')?.split(',').map(Number).filter(Boolean),
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      status: (searchParams.get('status') as any) || 'published',
      page: Math.max(1, parseInt(searchParams.get('page') || '1')),
      limit: Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10'))), // 1-50 range
      sortBy: 'published_at', // Search results are ranked by relevance first
      sortOrder: 'DESC',
    };

    //validate date filters
    if (filters.dateFrom && isNaN(Date.parse(filters.dateFrom))) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid dateFrom parameter',
        message: 'dateFrom must be a valid ISO date string',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (filters.dateTo && isNaN(Date.parse(filters.dateTo))) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid dateTo parameter',
        message: 'dateTo must be a valid ISO date string',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //perform search
    const result = await db.searchBlogPosts(filters);

    //generate cache key based on search parameters
    const cacheKey = JSON.stringify({
      q: query,
      categories: filters.categories,
      tags: filters.tags,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      page: filters.page,
      limit: filters.limit,
    });
    
    const etag = `"search-${Buffer.from(cacheKey).toString('base64').slice(0, 16)}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=600',
          'ETag': etag,
        },
      });
    }

    //prepare search suggestions if no results found
    let suggestions: string[] = [];
    if (result.data.length === 0 && query.length >= 3) {
      suggestions = await db.getContentSuggestions(query, 'blog');
    }

    const responseData = {
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        query,
        searchTime: 0, // Could add actual search timing
        hasResults: result.data.length > 0,
        suggestions: suggestions.slice(0, 5), // Limit to 5 suggestions
        filters: {
          categories: filters.categories,
          tags: filters.tags,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        },
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min browser, 10min CDN
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Search-Query': encodeURIComponent(query),
        'X-Search-Results': result.data.length.toString(),
      },
    });

  } catch (error) {
    console.error('Blog search API error:', error);
    
    //determine if it's a search-specific error
    const isSearchError = error instanceof Error && 
      (error.message.includes('MATCH') || error.message.includes('FTS'));

    return new Response(JSON.stringify({
      success: false,
      error: isSearchError ? 'Search query format error' : 'Search failed',
      message: isSearchError 
        ? 'Invalid search query format. Please try different search terms.'
        : 'An error occurred while searching. Please try again.',
      timestamp: new Date().toISOString(),
    }), {
      status: isSearchError ? 400 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }
};