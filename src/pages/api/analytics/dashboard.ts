import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const timeframe = searchParams.get('timeframe') || '30d'; // 7d, 30d, 90d, 1y
    const includeDetailed = searchParams.get('detailed') === 'true';

    const db = new DatabaseQueries();
    
    // Calculate date range based on timeframe
    const endDate = new Date();
    const startDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Get analytics data
    const [
      portfolioStats,
      topProjects,
      recentViews,
      skillInteractions,
      trafficSources,
      pageViews
    ] = await Promise.all([
      getPortfolioOverview(db, startDate, endDate),
      getTopProjects(db, startDate, endDate, 10),
      getRecentViews(db, 20),
      getSkillInteractions(db, startDate, endDate),
      getTrafficSources(db, startDate, endDate),
      getPageViews(db, startDate, endDate)
    ]);

    const analytics = {
      timeframe,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      overview: portfolioStats,
      topProjects,
      recentViews,
      skillInteractions,
      trafficSources,
      pageViews
    };

    // Add detailed breakdowns if requested
    if (includeDetailed) {
      const [
        dailyViews,
        categoryBreakdown,
        technologyPopularity
      ] = await Promise.all([
        getDailyViews(db, startDate, endDate),
        getCategoryBreakdown(db, startDate, endDate),
        getTechnologyPopularity(db, startDate, endDate)
      ]);

      analytics.detailed = {
        dailyViews,
        categoryBreakdown,
        technologyPopularity
      };
    }

    return new Response(JSON.stringify({
      success: true,
      data: analytics
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analytics dashboard error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch analytics data'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function getPortfolioOverview(db: DatabaseQueries, startDate: Date, endDate: Date) {
  // Get total views in timeframe
  const totalViews = await db.query(`
    SELECT COUNT(*) as count
    FROM analytics_events 
    WHERE event_type = 'project_view' 
    AND created_at BETWEEN ? AND ?
  `, [startDate.toISOString(), endDate.toISOString()]);

  // Get unique projects viewed
  const uniqueProjects = await db.query(`
    SELECT COUNT(DISTINCT entity_id) as count
    FROM analytics_events 
    WHERE event_type = 'project_view' 
    AND entity_id IS NOT NULL
    AND created_at BETWEEN ? AND ?
  `, [startDate.toISOString(), endDate.toISOString()]);

  // Get page views
  const pageViews = await db.query(`
    SELECT COUNT(*) as count
    FROM analytics_events 
    WHERE event_type = 'page_view'
    AND created_at BETWEEN ? AND ?
  `, [startDate.toISOString(), endDate.toISOString()]);

  // Get skill interactions
  const skillInteractions = await db.query(`
    SELECT COUNT(*) as count
    FROM analytics_events 
    WHERE event_type = 'skill_interaction'
    AND created_at BETWEEN ? AND ?
  `, [startDate.toISOString(), endDate.toISOString()]);

  return {
    totalProjectViews: totalViews[0]?.count || 0,
    uniqueProjectsViewed: uniqueProjects[0]?.count || 0,
    totalPageViews: pageViews[0]?.count || 0,
    totalSkillInteractions: skillInteractions[0]?.count || 0
  };
}

async function getTopProjects(db: DatabaseQueries, startDate: Date, endDate: Date, limit: number) {
  const topProjects = await db.query(`
    SELECT 
      p.id,
      p.title,
      p.slug,
      p.featured_image,
      p.view_count as total_views,
      COUNT(ae.id) as period_views
    FROM projects p
    LEFT JOIN analytics_events ae ON ae.entity_id = p.id 
      AND ae.event_type = 'project_view'
      AND ae.created_at BETWEEN ? AND ?
    GROUP BY p.id, p.title, p.slug, p.featured_image, p.view_count
    ORDER BY period_views DESC, total_views DESC
    LIMIT ?
  `, [startDate.toISOString(), endDate.toISOString(), limit]);

  return topProjects;
}

async function getRecentViews(db: DatabaseQueries, limit: number) {
  const recentViews = await db.query(`
    SELECT 
      ae.created_at,
      ae.metadata,
      p.title,
      p.slug
    FROM analytics_events ae
    LEFT JOIN projects p ON p.id = ae.entity_id
    WHERE ae.event_type = 'project_view'
    ORDER BY ae.created_at DESC
    LIMIT ?
  `, [limit]);

  return recentViews.map(view => ({
    timestamp: view.created_at,
    project: {
      title: view.title,
      slug: view.slug
    },
    metadata: typeof view.metadata === 'string' ? JSON.parse(view.metadata) : view.metadata
  }));
}

async function getSkillInteractions(db: DatabaseQueries, startDate: Date, endDate: Date) {
  const interactions = await db.query(`
    SELECT 
      ae.metadata,
      COUNT(*) as count
    FROM analytics_events ae
    WHERE ae.event_type = 'skill_interaction'
    AND ae.created_at BETWEEN ? AND ?
    GROUP BY ae.metadata
    ORDER BY count DESC
  `, [startDate.toISOString(), endDate.toISOString()]);

  const processedInteractions = {
    totalInteractions: 0,
    byAction: {},
    byCategory: {}
  };

  interactions.forEach(interaction => {
    const metadata = typeof interaction.metadata === 'string' 
      ? JSON.parse(interaction.metadata) 
      : interaction.metadata;
    
    processedInteractions.totalInteractions += interaction.count;
    
    if (metadata.action) {
      processedInteractions.byAction[metadata.action] = 
        (processedInteractions.byAction[metadata.action] || 0) + interaction.count;
    }
    
    if (metadata.category) {
      processedInteractions.byCategory[metadata.category] = 
        (processedInteractions.byCategory[metadata.category] || 0) + interaction.count;
    }
  });

  return processedInteractions;
}

async function getTrafficSources(db: DatabaseQueries, startDate: Date, endDate: Date) {
  const sources = await db.query(`
    SELECT 
      ae.metadata,
      COUNT(*) as count
    FROM analytics_events ae
    WHERE ae.event_type IN ('project_view', 'page_view')
    AND ae.created_at BETWEEN ? AND ?
    AND ae.metadata IS NOT NULL
    GROUP BY ae.metadata
    ORDER BY count DESC
  `, [startDate.toISOString(), endDate.toISOString()]);

  const trafficSources = {
    direct: 0,
    search: 0,
    social: 0,
    referral: 0,
    other: 0,
    details: []
  };

  sources.forEach(source => {
    const metadata = typeof source.metadata === 'string' 
      ? JSON.parse(source.metadata) 
      : source.metadata;
    
    if (!metadata.referrer) {
      trafficSources.direct += source.count;
    } else if (metadata.referrer.includes('google') || metadata.referrer.includes('bing')) {
      trafficSources.search += source.count;
    } else if (metadata.referrer.includes('twitter') || metadata.referrer.includes('linkedin')) {
      trafficSources.social += source.count;
    } else {
      trafficSources.referral += source.count;
    }

    trafficSources.details.push({
      referrer: metadata.referrer,
      count: source.count
    });
  });

  return trafficSources;
}

async function getPageViews(db: DatabaseQueries, startDate: Date, endDate: Date) {
  const views = await db.query(`
    SELECT 
      ae.metadata,
      COUNT(*) as count
    FROM analytics_events ae
    WHERE ae.event_type = 'page_view'
    AND ae.created_at BETWEEN ? AND ?
    GROUP BY ae.metadata
    ORDER BY count DESC
  `, [startDate.toISOString(), endDate.toISOString()]);

  const pageViews = {};
  
  views.forEach(view => {
    const metadata = typeof view.metadata === 'string' 
      ? JSON.parse(view.metadata) 
      : view.metadata;
    
    if (metadata.path) {
      pageViews[metadata.path] = view.count;
    }
  });

  return pageViews;
}

async function getDailyViews(db: DatabaseQueries, startDate: Date, endDate: Date) {
  const dailyViews = await db.query(`
    SELECT 
      DATE(created_at) as date,
      event_type,
      COUNT(*) as count
    FROM analytics_events
    WHERE created_at BETWEEN ? AND ?
    AND event_type IN ('project_view', 'page_view')
    GROUP BY DATE(created_at), event_type
    ORDER BY date DESC
  `, [startDate.toISOString(), endDate.toISOString()]);

  const processedViews = {};
  
  dailyViews.forEach(view => {
    if (!processedViews[view.date]) {
      processedViews[view.date] = {
        project_views: 0,
        page_views: 0,
        total: 0
      };
    }
    
    processedViews[view.date][view.event_type.replace('_', '_')] = view.count;
    processedViews[view.date].total += view.count;
  });

  return processedViews;
}

async function getCategoryBreakdown(db: DatabaseQueries, startDate: Date, endDate: Date) {
  const breakdown = await db.query(`
    SELECT 
      c.name as category_name,
      COUNT(ae.id) as views
    FROM analytics_events ae
    JOIN projects p ON p.id = ae.entity_id
    JOIN project_categories pc ON pc.project_id = p.id
    JOIN categories c ON c.id = pc.category_id
    WHERE ae.event_type = 'project_view'
    AND ae.created_at BETWEEN ? AND ?
    GROUP BY c.id, c.name
    ORDER BY views DESC
  `, [startDate.toISOString(), endDate.toISOString()]);

  return breakdown;
}

async function getTechnologyPopularity(db: DatabaseQueries, startDate: Date, endDate: Date) {
  const popularity = await db.query(`
    SELECT 
      t.name as technology_name,
      COUNT(ae.id) as views
    FROM analytics_events ae
    JOIN projects p ON p.id = ae.entity_id
    JOIN project_technologies pt ON pt.project_id = p.id
    JOIN technologies t ON t.id = pt.technology_id
    WHERE ae.event_type = 'project_view'
    AND ae.created_at BETWEEN ? AND ?
    GROUP BY t.id, t.name
    ORDER BY views DESC
    LIMIT 20
  `, [startDate.toISOString(), endDate.toISOString()]);

  return popularity;
}