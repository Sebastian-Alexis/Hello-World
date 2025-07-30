import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

const db = new DatabaseQueries();

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '0');
    
    if (!id || isNaN(id)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid airport ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const airport = await db.getAirportById(id);

    if (!airport) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Airport not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: airport
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error fetching airport:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch airport'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};