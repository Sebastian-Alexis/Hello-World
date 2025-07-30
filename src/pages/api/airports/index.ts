import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

const db = new DatabaseQueries();

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    
    // Search parameters
    const query = searchParams.get('search') || searchParams.get('q') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    // Get airports with search
    const airports = await db.searchAirports(query, limit);

    return new Response(JSON.stringify({
      success: true,
      data: airports
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800' // Cache for 30 minutes
      }
    });
  } catch (error) {
    console.error('Error fetching airports:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch airports'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const airportData = await request.json();

    // Validate required fields
    const requiredFields = ['iata_code', 'name', 'city', 'country', 'country_code', 'latitude', 'longitude'];
    for (const field of requiredFields) {
      if (!airportData[field]) {
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
    if (!airportData.type) airportData.type = 'airport';
    if (airportData.is_active === undefined) airportData.is_active = true;
    if (airportData.has_visited === undefined) airportData.has_visited = false;
    if (airportData.visit_count === undefined) airportData.visit_count = 0;

    const airport = await db.createAirport(airportData);

    return new Response(JSON.stringify({
      success: true,
      data: airport
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating airport:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create airport'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};