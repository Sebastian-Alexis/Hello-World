import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

const db = new DatabaseQueries();

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    // Filter parameters
    const airline = searchParams.get('airline') || undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;

    // Get flights with filters
    const flights = await db.getAllFlights(page, limit, {
      airline,
      year,
      status,
      search
    });

    return new Response(JSON.stringify({
      success: true,
      data: flights
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch flights'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const flightData = await request.json();

    // Validate required fields
    const requiredFields = ['departure_airport_id', 'arrival_airport_id', 'departure_time', 'arrival_time'];
    for (const field of requiredFields) {
      if (!flightData[field]) {
        return new Response(JSON.stringify({
          success: false,
          error: `Missing required field: ${field}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Set defaults
    if (!flightData.currency) flightData.currency = 'USD';
    if (!flightData.flight_status) flightData.flight_status = 'completed';
    if (flightData.is_favorite === undefined) flightData.is_favorite = false;

    const flight = await db.createFlight(flightData);

    return new Response(JSON.stringify({
      success: true,
      data: flight
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating flight:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create flight'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};