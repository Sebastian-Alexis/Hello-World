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
    const { name, start_date, end_date, blog_post_id, flights } = data;

    // Validate required fields
    if (!name || !start_date || !end_date || !flights || !Array.isArray(flights) || flights.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields. Trip name, dates, and at least one flight are required.'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate each flight has required fields
    for (const [index, flight] of flights.entries()) {
      const requiredFields = ['flight_number', 'departure_airport_id', 'arrival_airport_id', 'departure_time', 'arrival_time'];
      const missingFields = requiredFields.filter(field => !flight[field]);
      
      if (missingFields.length > 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Flight ${index + 1} is missing required fields: ${missingFields.join(', ')}`
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Validate airport IDs are integers
      if (!Number.isInteger(flight.departure_airport_id) || !Number.isInteger(flight.arrival_airport_id)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Flight ${index + 1} has invalid airport IDs`
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Validate dates
      const depTime = new Date(flight.departure_time);
      const arrTime = new Date(flight.arrival_time);
      if (isNaN(depTime.getTime()) || isNaN(arrTime.getTime())) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Flight ${index + 1} has invalid departure or arrival time`
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      if (depTime >= arrTime) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Flight ${index + 1} departure time must be before arrival time`
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Create trip
    const result = await executeQuery(`
      INSERT INTO trips (name, start_date, end_date, blog_post_id, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [name, start_date, end_date, blog_post_id || null]);

    const tripId = result.insertId;

    // Create flight records
    const createdFlights = [];
    for (const [index, flight] of flights.entries()) {
      try {
        // Calculate flight duration
        const depTime = new Date(flight.departure_time);
        const arrTime = new Date(flight.arrival_time);
        const durationMinutes = Math.round((arrTime.getTime() - depTime.getTime()) / (1000 * 60));

        const flightResult = await executeQuery(`
          INSERT INTO flights (
            flight_number, airline_code, airline_name, aircraft_type,
            departure_airport_id, arrival_airport_id, 
            departure_time, arrival_time, flight_duration,
            seat_number, trip_id, flight_status,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          flight.flight_number,
          flight.airline_code || null,
          flight.airline_name || null,
          flight.aircraft_type || null,
          flight.departure_airport_id,
          flight.arrival_airport_id,
          flight.departure_time,
          flight.arrival_time,
          durationMinutes,
          flight.seat_number || null,
          tripId
        ]);

        createdFlights.push({
          id: flightResult.insertId,
          flight_number: flight.flight_number
        });
      } catch (flightError) {
        console.error(`Error creating flight ${index + 1}:`, flightError);
        // If we fail to create a flight, we should rollback the trip
        // For now, we'll continue but log the error
        throw new Error(`Failed to create flight ${index + 1}: ${flight.flight_number}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { 
          id: tripId,
          flights_created: createdFlights.length,
          flights: createdFlights
        }
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