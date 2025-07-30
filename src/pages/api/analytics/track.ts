import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

//prevent prerendering for server-side API endpoint
export const prerender = false;

//track page views and events
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: type and data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const db = new DatabaseQueries();

    switch (type) {
      case 'project_view':
        await handleProjectView(db, data);
        break;
      case 'skill_interaction':
        await handleSkillInteraction(db, data);
        break;
      case 'page_view':
        await handlePageView(db, data);
        break;
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid tracking type'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Event tracked successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function handleProjectView(db: DatabaseQueries, data: any) {
  const { projectId, slug, referrer, userAgent, timestamp } = data;
  
  if (!projectId && !slug) {
    throw new Error('Project ID or slug is required');
  }

  // Update project view count
  if (projectId) {
    await db.incrementProjectViews(projectId);
  } else if (slug) {
    const project = await db.getProjectBySlug(slug);
    if (project) {
      await db.incrementProjectViews(project.id);
    }
  }

  // Log detailed view analytics
  await db.logAnalyticsEvent({
    event_type: 'project_view',
    entity_type: 'project',
    entity_id: projectId || null,
    metadata: {
      slug,
      referrer,
      userAgent,
      timestamp: timestamp || new Date().toISOString()
    }
  });
}

async function handleSkillInteraction(db: DatabaseQueries, data: any) {
  const { skillId, action, category, timestamp } = data;
  
  await db.logAnalyticsEvent({
    event_type: 'skill_interaction',
    entity_type: 'skill',
    entity_id: skillId || null,
    metadata: {
      action, // 'view', 'expand', 'chart_toggle', etc.
      category,
      timestamp: timestamp || new Date().toISOString()
    }
  });
}

async function handlePageView(db: DatabaseQueries, data: any) {
  const { path, referrer, userAgent, timestamp } = data;
  
  await db.logAnalyticsEvent({
    event_type: 'page_view',
    entity_type: 'page',
    entity_id: null,
    metadata: {
      path,
      referrer,
      userAgent,
      timestamp: timestamp || new Date().toISOString()
    }
  });
}