import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;
    
    const trip = await db.execute(`
      SELECT 
        t.*,
        bp.title as blog_post_title,
        bp.slug as blog_post_slug
      FROM trips t
      LEFT JOIN blog_posts bp ON t.blog_post_id = bp.id
      WHERE t.id = ? AND t.is_active = 1
    `, [id]);

    if (!trip.rows[0]) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Trip not found'
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get flights for this trip
    const flights = await db.execute(`
      SELECT 
        f.*,
        dep.iata_code as departure_iata,
        dep.name as departure_airport_name,
        arr.iata_code as arrival_iata,
        arr.name as arrival_airport_name
      FROM flights f
      JOIN airports dep ON f.departure_airport_id = dep.id
      JOIN airports arr ON f.arrival_airport_id = arr.id
      WHERE f.trip_id = ?
      ORDER BY f.departure_time
    `, [id]);

    const tripData = {
      ...trip.rows[0],
      flights: flights.rows,
      blog_post: trip.rows[0].blog_post_id ? {
        id: trip.rows[0].blog_post_id,
        title: trip.rows[0].blog_post_title,
        slug: trip.rows[0].blog_post_slug
      } : null
    };

    return new Response(
      JSON.stringify({
        success: true,
        data: tripData
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching trip:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch trip'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  const authResult = await authMiddleware(request, { required: true, roles: ['admin'] });
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ error: authResult.error || 'Unauthorized' }),
      { 
        status: authResult.status || 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { id } = params;
    const data = await request.json();
    const { name, start_date, end_date, blog_post_id, flight_numbers } = data;

    // Validate required fields
    if (!name || !start_date || !end_date || !flight_numbers?.length) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Update trip
    await db.execute(`
      UPDATE trips 
      SET name = ?, start_date = ?, end_date = ?, blog_post_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, start_date, end_date, blog_post_id || null, id]);

    // Remove trip_id from all flights currently associated with this trip
    await db.execute(`
      UPDATE flights 
      SET trip_id = NULL
      WHERE trip_id = ?
    `, [id]);

    // Update flights with new trip_id
    for (const flightNumber of flight_numbers) {
      await db.execute(`
        UPDATE flights 
        SET trip_id = ?
        WHERE flight_number = ?
      `, [id, flightNumber]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { id }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error updating trip:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to update trip'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  const authResult = await authMiddleware(request, { required: true, roles: ['admin'] });
  if (!authResult.success) {
    return new Response(
      JSON.stringify({ error: authResult.error || 'Unauthorized' }),
      { 
        status: authResult.status || 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { id } = params;

    // Remove trip_id from associated flights
    await db.execute(`
      UPDATE flights 
      SET trip_id = NULL
      WHERE trip_id = ?
    `, [id]);

    // Soft delete the trip
    await db.execute(`
      UPDATE trips 
      SET is_active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Trip deleted successfully'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error deleting trip:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to delete trip'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};