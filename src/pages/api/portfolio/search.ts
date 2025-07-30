// =============================================================================
// PORTFOLIO API - Search endpoint
// GET /api/portfolio/search - comprehensive portfolio search with filters
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50); // Max 50 items
    const category = searchParams.get('category');
    const technology = searchParams.get('technology');
    const status = searchParams.get('status');

    // Validate query
    if (!query.trim()) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search query is required',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Build filters
    const filters: any = {
      query: query.trim(),
      page,
      limit
    };

    if (category) {
      filters.categories = [parseInt(category)];
    }

    if (technology) {
      filters.technologies = [parseInt(technology)];
    }

    if (status) {
      filters.status = status;
    }

    // Perform search
    const result = await db.searchPortfolioProjects(filters);

    // Also search for suggestions if limited results
    let suggestions = [];
    if (result.data.length < 3 && query.length > 2) {
      try {
        suggestions = await db.getContentSuggestions(query, 'portfolio');
      } catch (suggestionError) {
        console.warn('Failed to get suggestions:', suggestionError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...result,
        query: query.trim(),
        suggestions: suggestions.slice(0, 5), // Limit suggestions
        searchMeta: {
          totalResults: result.pagination.total,
          searchTime: Date.now() - new Date().getTime(), // Placeholder
          hasExactMatch: result.data.some(project => 
            project.title.toLowerCase().includes(query.toLowerCase())
          )
        }
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache for search results
      }
    });

  } catch (error) {
    console.error('Portfolio search API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Search failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};