import type { APIRoute } from 'astro';

//export analytics data
export const GET: APIRoute = async ({ request, url }) => {
  try {
    //check for authorization
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const format = url.searchParams.get('format') || 'csv';
    const startDate = url.searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = url.searchParams.get('end') || new Date().toISOString().split('T')[0];

    //mock analytics data for demonstration
    const analyticsData = {
      period: `${startDate} to ${endDate}`,
      totalPageViews: 15420,
      uniqueVisitors: 8650,
      sessions: 12340,
      bounceRate: 42.5,
      avgSessionDuration: 245,
      topPages: [
        { path: '/', views: 3240, title: 'Home' },
        { path: '/blog', views: 2150, title: 'Blog' },
        { path: '/portfolio', views: 1890, title: 'Portfolio' },
        { path: '/about', views: 1560, title: 'About' },
        { path: '/contact', views: 1120, title: 'Contact' }
      ],
      dailyStats: [
        { date: '2024-01-01', views: 420, visitors: 280 },
        { date: '2024-01-02', views: 380, visitors: 250 },
        { date: '2024-01-03', views: 450, visitors: 320 }
      ]
    };

    if (format === 'csv') {
      //generate CSV
      let csv = 'Date,Page Views,Unique Visitors\n';
      analyticsData.dailyStats.forEach(stat => {
        csv += `${stat.date},${stat.views},${stat.visitors}\n`;
      });
      
      csv += '\nTop Pages\n';
      csv += 'Path,Views,Title\n';
      analyticsData.topPages.forEach(page => {
        csv += `${page.path},${page.views},"${page.title}"\n`;
      });
      
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="analytics-${startDate}-${endDate}.csv"`
        }
      });
    } else if (format === 'pdf') {
      //for now, return JSON (in production, you'd generate a PDF)
      return new Response(JSON.stringify(analyticsData), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="analytics-${startDate}-${endDate}.json"`
        }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Analytics export error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to export analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};