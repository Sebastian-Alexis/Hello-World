import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

const db = new DatabaseQueries();

export const GET: APIRoute = async () => {
  try {
    const statistics = await db.getFlightStatistics();

    return new Response(JSON.stringify({
      success: true,
      data: statistics
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error fetching flight statistics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch flight statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};