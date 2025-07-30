// =============================================================================
// PORTFOLIO API - Testimonials endpoint
// GET /api/portfolio/testimonials - client testimonials and recommendations
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20); // Max 20 items
    const featured = searchParams.get('featured') === 'true' ? true : undefined;
    const project_id = searchParams.get('project_id') ? parseInt(searchParams.get('project_id')!) : undefined;

    // Get testimonials with pagination
    const result = await db.getTestimonials({
      page,
      limit,
      featured,
      project_id
    });

    // If requesting featured testimonials specifically, also get the featured ones
    let featuredTestimonials = null;
    if (featured === true || searchParams.get('include_featured') === 'true') {
      featuredTestimonials = await db.getFeaturedTestimonials(5);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        ...result,
        featured: featuredTestimonials
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900' // 15 minutes cache
      }
    });

  } catch (error) {
    console.error('Testimonials API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch testimonials',
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