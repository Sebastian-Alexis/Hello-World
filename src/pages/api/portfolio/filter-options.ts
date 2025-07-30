// =============================================================================
// PORTFOLIO API - Filter options endpoint
// GET /api/portfolio/filter-options - available categories and technologies for filtering
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ request }) => {
  try {
    // Get all available filter options in parallel
    const [categories, technologies] = await Promise.all([
      db.getProjectCategories(),
      db.getProjectTechnologies()
    ]);

    return new Response(JSON.stringify({
      success: true,
      data: {
        categories: categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          color: cat.color,
          icon: cat.icon
        })),
        technologies: technologies.map(tech => ({
          id: tech.id,
          name: tech.name,
          slug: tech.slug,
          category: tech.category,
          color: tech.color
        }))
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // 1 hour cache (filter options change rarely)
      }
    });

  } catch (error) {
    console.error('Portfolio filter options API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch filter options',
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