import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const GET: APIRoute = async () => {
  try {
    const startTime = performance.now();
    
    //simple database ping - check if we can query
    const result = await db.prepare('SELECT 1 as ping').get();
    
    const responseTime = performance.now() - startTime;
    
    if (result?.ping === 1) {
      return new Response(JSON.stringify({
        status: 'healthy',
        message: 'Database connection successful',
        responseTime: Math.round(responseTime),
        timestamp: Date.now(),
        details: {
          connected: true,
          ping: result.ping,
        },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } else {
      return new Response(JSON.stringify({
        status: 'unhealthy',
        message: 'Database ping failed',
        responseTime: Math.round(responseTime),
        timestamp: Date.now(),
        error: 'Invalid ping response',
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
  } catch (error) {
    console.error('Database health check failed:', error);
    
    return new Response(JSON.stringify({
      status: 'unhealthy',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown database error',
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