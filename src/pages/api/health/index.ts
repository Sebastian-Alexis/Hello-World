import type { APIRoute } from 'astro';
import { getSystemHealth } from '../../../lib/monitoring/health';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    const summary = url.searchParams.get('summary') === 'true';

    const health = await getSystemHealth();

    //return summary if requested
    if (summary) {
      const summaryData = {
        status: health.status,
        timestamp: health.timestamp,
        duration: health.duration,
        summary: health.summary,
        metadata: health.metadata,
      };

      return new Response(JSON.stringify(summaryData), {
        status: health.status === 'healthy' ? 200 : 
               health.status === 'degraded' ? 200 : 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    //determine http status based on health
    let httpStatus = 200;
    if (health.status === 'unhealthy') {
      httpStatus = 503; // Service Unavailable
    } else if (health.status === 'degraded') {
      httpStatus = 200; // OK but degraded
    }

    return new Response(JSON.stringify(health), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Health check endpoint error:', error);
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
};