// =============================================================================
// PORTFOLIO API - Skills endpoint
// GET /api/portfolio/skills - skills with proficiency levels and categories
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // Parse query parameters
    const searchParams = new URL(request.url).searchParams;
    const category = searchParams.get('category') || undefined;

    // Get skills and categories in parallel
    const [skills, categories] = await Promise.all([
      db.getAllSkills(category),
      db.getSkillCategories()
    ]);

    return new Response(JSON.stringify({
      success: true,
      data: {
        skills,
        categories,
        summary: {
          total: skills.length,
          byCategory: categories,
          expertLevel: skills.filter(skill => skill.proficiency_level >= 4).length,
          averageProficiency: skills.length > 0 
            ? Math.round((skills.reduce((sum, skill) => sum + skill.proficiency_level, 0) / skills.length) * 10) / 10
            : 0
        }
      },
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800' // 30 minutes cache
      }
    });

  } catch (error) {
    console.error('Skills API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch skills',
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