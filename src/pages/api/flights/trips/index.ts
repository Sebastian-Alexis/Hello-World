import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { executeQuery, executeTransaction } from '@/lib/db';

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
  // Import authMiddleware for consistent authentication
  const { authMiddleware } = await import('@/lib/auth');
  
  // Check auth using the fixed middleware
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
      const requiredFields = ['flight_number', 'departure_time', 'arrival_time'];
      
      // Check for airport data - accept either IDs or IATA codes with names
      const hasDepAirportId = flight.departure_airport_id && Number.isInteger(flight.departure_airport_id);
      const hasDepAirportData = flight.departure_iata && flight.departure_airport_name;
      const hasArrAirportId = flight.arrival_airport_id && Number.isInteger(flight.arrival_airport_id);
      const hasArrAirportData = flight.arrival_iata && flight.arrival_airport_name;
      
      if (!hasDepAirportId && !hasDepAirportData) {
        requiredFields.push('departure airport (either ID or IATA code with name)');
      }
      
      if (!hasArrAirportId && !hasArrAirportData) {
        requiredFields.push('arrival airport (either ID or IATA code with name)');
      }
      
      const missingFields = requiredFields.filter(field => {
        if (field.includes('airport')) return false; // Already checked above
        return !flight[field];
      });
      
      if (missingFields.length > 0 || (!hasDepAirportId && !hasDepAirportData) || (!hasArrAirportId && !hasArrAirportData)) {
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

    // Helper function to lookup or create airport
    async function getOrCreateAirport(airportData) {
      const { airport_id, iata_code, airport_name, city, country } = airportData;
      
      // If we have an airport ID, validate it exists
      if (airport_id && Number.isInteger(airport_id)) {
        const existingAirport = await executeQuery(
          'SELECT id FROM airports WHERE id = ?',
          [airport_id]
        );
        
        if (existingAirport.rows && existingAirport.rows.length > 0) {
          return airport_id;
        }
      }
      
      // Otherwise, lookup or create by IATA code
      if (!iata_code || !airport_name) {
        throw new Error('Airport IATA code and name are required when airport ID is not provided');
      }
      
      // Check if airport exists by IATA code
      const existingByIata = await executeQuery(
        'SELECT id FROM airports WHERE iata_code = ?',
        [iata_code]
      );
      
      if (existingByIata.rows && existingByIata.rows.length > 0) {
        return existingByIata.rows[0].id;
      }
      
      // Create new airport with geocoding
      const coordinates = await geocodeAirport(iata_code, airport_name, city, country);
      
      // Log geocoding result
      if (!coordinates) {
        console.warn(`⚠️ Failed to geocode airport ${iata_code} - ${airport_name}. Storing with null coordinates.`);
      } else {
        console.log(`✅ Successfully geocoded ${iata_code}: [${coordinates.longitude}, ${coordinates.latitude}]`);
      }
      
      const airportResult = await executeQuery(`
        INSERT INTO airports (
          iata_code, name, city, country, country_code,
          latitude, longitude, type, is_active,
          has_visited, visit_count,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [
        iata_code,
        airport_name,
        city || 'Unknown',
        country || 'Unknown',
        coordinates?.country_code || 'XX',
        coordinates?.latitude ?? null,
        coordinates?.longitude ?? null,
        'airport',
        1,
        false,
        0
      ]);
      
      return airportResult.insertId;
    }
    
    // Helper function for geocoding airports using Mapbox
    async function geocodeAirport(iataCode, airportName, city, country) {
      try {
        // Get Mapbox access token from environment
        const mapboxToken = process.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.PUBLIC_MAPBOX_ACCESS_TOKEN;
        
        if (!mapboxToken) {
          console.warn('Mapbox access token not found in environment variables');
          return null;
        }

        // Build search query - use airport name with city for better accuracy
        // Remove redundant "airport" from query if it's already in the name
        const hasAirport = airportName.toLowerCase().includes('airport');
        const searchQuery = city ? 
          (hasAirport ? `${airportName} ${city}` : `${airportName} airport ${city}`) :
          (hasAirport ? airportName : `${airportName} airport`);
        const encodedQuery = encodeURIComponent(searchQuery);
        
        // Use Mapbox Geocoding API without types filter for better results
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&limit=1`,
          { 
            headers: { 'User-Agent': 'FlightTracker/1.0' }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const result = data.features[0];
            const [longitude, latitude] = result.center;
            
            // Check if coordinates are valid
            if (isNaN(latitude) || isNaN(longitude)) {
              console.warn(`Invalid coordinates from Mapbox geocoding for ${iataCode}: lat=${latitude}, lon=${longitude}`);
              return null;
            }
            
            // Extract country code from context
            let countryCode = 'XX';
            if (result.context) {
              const countryContext = result.context.find(ctx => ctx.id.startsWith('country'));
              if (countryContext && countryContext.short_code) {
                countryCode = countryContext.short_code.toUpperCase();
              }
            }
            
            return {
              latitude,
              longitude,
              country_code: countryCode
            };
          }
        } else {
          console.warn(`Mapbox geocoding API error for ${iataCode}: ${response.status} - ${response.statusText}`);
        }
      } catch (error) {
        console.warn(`Mapbox geocoding failed for ${iataCode} - ${airportName}:`, error.message);
      }
      
      // Return null to indicate geocoding failure
      return null;
    }

    // Process airports first to ensure they exist
    const processedFlights = [];
    for (const [index, flight] of flights.entries()) {
      try {
        // Get or create departure airport
        const departureAirportId = await getOrCreateAirport({
          airport_id: flight.departure_airport_id,
          iata_code: flight.departure_iata,
          airport_name: flight.departure_airport_name,
          city: flight.departure_city,
          country: flight.departure_country
        });
        
        // Get or create arrival airport
        const arrivalAirportId = await getOrCreateAirport({
          airport_id: flight.arrival_airport_id,
          iata_code: flight.arrival_iata,
          airport_name: flight.arrival_airport_name,
          city: flight.arrival_city,
          country: flight.arrival_country
        });
        
        // Calculate flight duration
        const depTime = new Date(flight.departure_time);
        const arrTime = new Date(flight.arrival_time);
        const durationMinutes = Math.round((arrTime.getTime() - depTime.getTime()) / (1000 * 60));

        processedFlights.push({
          flight_number: flight.flight_number,
          airline_code: flight.airline_code || null,
          airline_name: flight.airline_name || null,
          aircraft_type: flight.aircraft_type || null,
          departureAirportId,
          arrivalAirportId,
          departure_time: flight.departure_time,
          arrival_time: flight.arrival_time,
          flight_duration: durationMinutes,
          seat_number: flight.seat_number || null
        });
      } catch (flightError) {
        console.error(`Error processing flight ${index + 1}:`, flightError);
        throw new Error(`Failed to process flight ${index + 1}: ${flight.flight_number} - ${flightError.message}`);
      }
    }

    // Now use transaction for trip and flights creation
    try {
      // Since we can't reference the trip ID from the first query in a batch,
      // we'll use a two-step approach: create trip first, then batch flights
      
      // Create trip first to get ID
      const tripResult = await executeQuery(`
        INSERT INTO trips (name, start_date, end_date, blog_post_id, is_active)
        VALUES (?, ?, ?, ?, 1)
      `, [name, start_date, end_date, blog_post_id || null]);

      const tripId = tripResult.insertId;

      // Now create flight queries batch
      const flightQueries = [];
      const createdFlights = [];
      
      for (const flight of processedFlights) {
        flightQueries.push({
          query: `
            INSERT INTO flights (
              flight_number, airline_code, airline_name, aircraft_type,
              departure_airport_id, arrival_airport_id, 
              departure_time, arrival_time, flight_duration,
              seat_number, trip_id, flight_status,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          params: [
            flight.flight_number,
            flight.airline_code,
            flight.airline_name,
            flight.aircraft_type,
            flight.departureAirportId,
            flight.arrivalAirportId,
            flight.departure_time,
            flight.arrival_time,
            flight.flight_duration,
            flight.seat_number,
            tripId
          ]
        });

        createdFlights.push({
          flight_number: flight.flight_number
        });
      }

      // Execute flight creation batch
      if (flightQueries.length > 0) {
        await executeTransaction(flightQueries);
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
      console.error('Transaction error:', error);
      throw error;
    }

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