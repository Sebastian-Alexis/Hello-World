// =============================================================================
// PORTFOLIO API - Experience endpoint
// GET /api/portfolio/experience - work experience and education data
// =============================================================================

//prevent prerendering for server-side API endpoint
export const prerender = false;

import type { APIRoute } from 'astro';
import { db } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    // Get all experience data in parallel
    const [workExperience, education] = await Promise.all([
      db.getAllWorkExperience(),
      db.getAllEducation()
    ]);

    // Calculate career statistics
    const currentJob = workExperience.find(exp => exp.is_current);
    const firstJob = workExperience[workExperience.length - 1]; // Last in DESC order = first chronologically
    
    let yearsExperience = 0;
    if (firstJob?.start_date) {
      const startDate = new Date(firstJob.start_date);
      const endDate = currentJob?.is_current ? new Date() : new Date(workExperience[0]?.end_date || new Date());
      yearsExperience = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365));
    }

    // Get unique companies and roles
    const companies = [...new Set(workExperience.map(exp => exp.company))];
    const technologies = [...new Set(
      workExperience
        .flatMap(exp => exp.technologies_used || [])
        .filter(Boolean)
    )];

    return new Response(JSON.stringify({
      success: true,
      data: {
        workExperience,
        education,
        statistics: {
          yearsExperience,
          totalPositions: workExperience.length,
          companiesWorkedFor: companies.length,
          educationCompleted: education.filter(edu => !edu.is_current).length,
          currentEducation: education.filter(edu => edu.is_current).length,
          technologiesUsed: technologies.length,
          currentPosition: currentJob ? {
            company: currentJob.company,
            position: currentJob.position,
            startDate: currentJob.start_date
          } : null
        },
        timeline: {
          work: workExperience.map(exp => ({
            id: exp.id,
            title: exp.position,
            company: exp.company,
            startDate: exp.start_date,
            endDate: exp.end_date,
            isCurrent: exp.is_current,
            type: 'work'
          })),
          education: education.map(edu => ({
            id: edu.id,
            title: edu.degree,
            company: edu.institution,
            startDate: edu.start_date,
            endDate: edu.end_date,
            isCurrent: edu.is_current,
            type: 'education'
          }))
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
    console.error('Experience API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch experience data',
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