// =============================================================================
// PORTFOLIO API - Main portfolio projects endpoint
// GET /api/portfolio - paginated project listing with filtering
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '12'), 50); // Max 50 items
    const category = searchParams.get('category') || undefined;
    const technology = searchParams.get('technology') || undefined;
    const status = searchParams.get('status') || undefined;
    const featured = searchParams.get('featured') === 'true' ? true : undefined;
    const search = searchParams.get('search') || undefined;
    const sort = searchParams.get('sort') || 'latest';

    // Map sort parameter to database fields
    let sortBy = 'created_at';
    let sortOrder: 'ASC' | 'DESC' = 'DESC';
    
    switch (sort) {
      case 'latest':
        sortBy = 'created_at';
        sortOrder = 'DESC';
        break;
      case 'oldest':
        sortBy = 'created_at';
        sortOrder = 'ASC';
        break;
      case 'popular':
        sortBy = 'view_count';
        sortOrder = 'DESC';
        break;
      case 'alphabetical':
        sortBy = 'title';
        sortOrder = 'ASC';
        break;
    }

    // Use search if query provided, otherwise regular filtering
    let result;
    if (search) {
      result = await db.searchPortfolioProjects({
        query: search,
        categories: category ? [parseInt(category)] : undefined,
        technologies: technology ? [parseInt(technology)] : undefined,
        status: status as any,
        page,
        limit
      });
    } else {
      result = await db.getPortfolioProjects({
        page,
        limit,
        sortBy,
        sortOrder,
        status: status as any,
        featured,
        includeCategories: true,
        includeTechnologies: true
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      }
    });

  } catch (error) {
    console.error('Portfolio API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch portfolio projects',
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