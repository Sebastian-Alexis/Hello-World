import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { authMiddleware } from '@/lib/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    const trips = await db.execute(`
      SELECT 
        t.*,
        bp.title as blog_post_title,
        bp.slug as blog_post_slug,
        COUNT(DISTINCT f.id) as flight_count
      FROM trips t
      LEFT JOIN blog_posts bp ON t.blog_post_id = bp.id
      LEFT JOIN flights f ON f.trip_id = t.id
      WHERE t.is_active = 1
      GROUP BY t.id
      ORDER BY t.start_date DESC
    `);

    // Get flights for each trip
    const tripsWithFlights = await Promise.all(
      trips.rows.map(async (trip) => {
        const flights = await db.execute(`
          SELECT 
            f.*,
            dep.iata_code as departure_iata,
            arr.iata_code as arrival_iata
          FROM flights f
          JOIN airports dep ON f.departure_airport_id = dep.id
          JOIN airports arr ON f.arrival_airport_id = arr.id
          WHERE f.trip_id = ?
          ORDER BY f.departure_time
        `, [trip.id]);

        return {
          ...trip,
          flights: flights.rows,
          blog_post: trip.blog_post_id ? {
            id: trip.blog_post_id,
            title: trip.blog_post_title,
            slug: trip.blog_post_slug
          } : null
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: tripsWithFlights
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching trips:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch trips'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
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

    // Create trip
    const result = await db.execute(`
      INSERT INTO trips (name, start_date, end_date, blog_post_id, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [name, start_date, end_date, blog_post_id || null]);

    const tripId = result.lastInsertRowId;

    // Update flights with trip_id
    for (const flightNumber of flight_numbers) {
      await db.execute(`
        UPDATE flights 
        SET trip_id = ?
        WHERE flight_number = ?
      `, [tripId, flightNumber]);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { id: tripId }
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error creating trip:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to create trip'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};