// =============================================================================
// PORTFOLIO API - Statistics endpoint
// GET /api/portfolio/statistics - comprehensive portfolio analytics and metrics
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get comprehensive portfolio statistics
    const stats = await db.getPortfolioStatistics();

    return new Response(JSON.stringify({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800' // 30 minutes cache
      }
    });

  } catch (error) {
    console.error('Portfolio statistics API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch portfolio statistics',
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