import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

const db = new DatabaseQueries();

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '0');
    
    if (!id || isNaN(id)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid flight ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const flight = await db.getFlightById(id);

    if (!flight) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Flight not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: flight
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600' // Cache for 10 minutes
      }
    });
  } catch (error) {
    console.error('Error fetching flight:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch flight'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const id = parseInt(params.id || '0');
    
    if (!id || isNaN(id)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid flight ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const flightData = await request.json();
    
    // Check if flight exists
    const existingFlight = await db.getFlightById(id);
    if (!existingFlight) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Flight not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update flight (this would need to be implemented in DatabaseQueries)
    // For now, return success - implementation would need updateFlight method
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Flight update functionality pending implementation'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating flight:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update flight'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = parseInt(params.id || '0');
    
    if (!id || isNaN(id)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid flight ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check if flight exists
    const existingFlight = await db.getFlightById(id);
    if (!existingFlight) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Flight not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Delete flight (this would need to be implemented in DatabaseQueries)
    // For now, return success - implementation would need deleteFlight method
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Flight deletion functionality pending implementation'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting flight:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to delete flight'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};