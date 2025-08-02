import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { executeQuery } from '@/lib/db';
import { extractSessionFromCookie } from '@/lib/auth/session';
import { verifyToken } from '@/lib/auth/jwt';

export const GET: APIRoute = async ({ request }) => {
  try {
    const trips = await executeQuery(`
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
        const flights = await executeQuery(`
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
  // Check authentication via JWT token in cookie
  const cookieHeader = request.headers.get('Cookie');
  const token = extractSessionFromCookie(cookieHeader);
  
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Verify JWT token
  try {
    const tokenPayload = await verifyToken(token);
    
    // Check admin role
    if (tokenPayload.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Optionally verify session if sessionId is in token
    if (tokenPayload.sessionId) {
      const sessionResult = await executeQuery(
        'SELECT * FROM user_sessions WHERE id = ? AND expires_at > datetime("now")',
        [tokenPayload.sessionId]
      );

      if (!sessionResult.rows || sessionResult.rows.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Session expired' }),
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }
  } catch (error) {
    console.error('Token verification error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Authentication failed';
    if (error.message.includes('expired')) {
      errorMessage = 'Your session has expired. Please log in again.';
    } else if (error.message.includes('invalid')) {
      errorMessage = 'Invalid authentication token';
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 401,
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
    const result = await executeQuery(`
      INSERT INTO trips (name, start_date, end_date, blog_post_id, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [name, start_date, end_date, blog_post_id || null]);

    const tripId = result.insertId;

    // Update flights with trip_id
    for (const flightNumber of flight_numbers) {
      await executeQuery(`
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