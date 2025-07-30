// =============================================================================
// PORTFOLIO API - Featured projects endpoint
// GET /api/portfolio/featured - featured projects for homepage showcase
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '6'), 12); // Max 12 featured items

    // Get featured portfolio projects
    const projects = await db.getFeaturedPortfolioProjects(limit);

    return new Response(JSON.stringify({
      success: true,
      data: projects,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600' // 10 minutes cache
      }
    });

  } catch (error) {
    console.error('Featured portfolio API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch featured projects',
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