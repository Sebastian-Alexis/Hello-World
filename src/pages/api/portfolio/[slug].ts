// =============================================================================
// PORTFOLIO API - Individual project endpoint
// GET /api/portfolio/[slug] - detailed project with case studies, skills, testimonials
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { slug } = params;
    
    if (!slug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Project slug is required',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Get enhanced project data with all related information
    const project = await db.getEnhancedPortfolioProjectBySlug(slug);
    
    if (!project) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Project not found',
        timestamp: new Date().toISOString()
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Increment view count
    await db.incrementProjectViewCount(project.id);

    return new Response(JSON.stringify({
      success: true,
      data: project,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600' // 10 minutes cache
      }
    });

  } catch (error) {
    console.error('Portfolio project API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch project',
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