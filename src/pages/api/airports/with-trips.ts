import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { executeQuery } from '@/lib/db';

export const GET: APIRoute = async () => {
  try {
    // Get all airports that have associated trips
    const airports = await executeQuery(`
      SELECT DISTINCT
        a.id,
        a.iata_code,
        a.name,
        a.city,
        a.country,
        a.latitude,
        a.longitude,
        COUNT(DISTINCT t.id) as trip_count
      FROM airports a
      JOIN (
        SELECT DISTINCT departure_airport_id as airport_id, trip_id
        FROM flights
        WHERE trip_id IS NOT NULL
        UNION
        SELECT DISTINCT arrival_airport_id as airport_id, trip_id
        FROM flights
        WHERE trip_id IS NOT NULL
      ) f ON a.id = f.airport_id
      JOIN trips t ON f.trip_id = t.id
      WHERE t.is_active = 1
      GROUP BY a.id
    `);

    // For each airport, get the associated trips with flight details
    const airportsWithTrips = await Promise.all(
      airports.rows.map(async (airport) => {
        const trips = await executeQuery(`
          SELECT DISTINCT
            t.id,
            t.name,
            t.start_date,
            t.end_date,
            t.blog_post_id,
            bp.title as blog_post_title,
            bp.slug as blog_post_slug,
            bp.thumbnail_url as blog_post_thumbnail,
            bp.excerpt as blog_post_excerpt,
            f.id as flight_id,
            f.flight_number,
            f.departure_time,
            f.arrival_time,
            f.departure_airport_id,
            f.arrival_airport_id,
            dep.iata_code as departure_iata,
            dep.name as departure_name,
            dep.latitude as departure_lat,
            dep.longitude as departure_lng,
            arr.iata_code as arrival_iata,
            arr.name as arrival_name,
            arr.latitude as arrival_lat,
            arr.longitude as arrival_lng,
            CASE 
              WHEN f.departure_airport_id = ? THEN 'departure'
              WHEN f.arrival_airport_id = ? THEN 'arrival'
            END as flight_type,
            CASE 
              WHEN f.departure_airport_id = ? THEN arr.iata_code
              WHEN f.arrival_airport_id = ? THEN dep.iata_code
            END as next_airport_iata,
            CASE 
              WHEN f.departure_airport_id = ? THEN arr.name
              WHEN f.arrival_airport_id = ? THEN dep.name
            END as next_airport_name,
            CASE 
              WHEN f.departure_airport_id = ? THEN arr.latitude
              WHEN f.arrival_airport_id = ? THEN dep.latitude
            END as next_airport_lat,
            CASE 
              WHEN f.departure_airport_id = ? THEN arr.longitude
              WHEN f.arrival_airport_id = ? THEN dep.longitude
            END as next_airport_lng
          FROM trips t
          JOIN flights f ON f.trip_id = t.id
          LEFT JOIN blog_posts bp ON t.blog_post_id = bp.id
          JOIN airports dep ON f.departure_airport_id = dep.id
          JOIN airports arr ON f.arrival_airport_id = arr.id
          WHERE t.is_active = 1
            AND (f.departure_airport_id = ? OR f.arrival_airport_id = ?)
          ORDER BY t.start_date DESC, f.departure_time
        `, [
          airport.id, airport.id, // for flight_type
          airport.id, airport.id, // for next_airport_iata
          airport.id, airport.id, // for next_airport_name
          airport.id, airport.id, // for next_airport_lat
          airport.id, airport.id, // for next_airport_lng
          airport.id, airport.id  // for WHERE clause
        ]);

        // Group trips by trip ID
        const tripMap = new Map();
        trips.rows.forEach((row) => {
          if (!tripMap.has(row.id)) {
            tripMap.set(row.id, {
              id: row.id,
              name: row.name,
              start_date: row.start_date,
              end_date: row.end_date,
              blog_post: row.blog_post_id ? {
                id: row.blog_post_id,
                title: row.blog_post_title,
                slug: row.blog_post_slug,
                thumbnail: row.blog_post_thumbnail,
                excerpt: row.blog_post_excerpt
              } : null,
              flights: []
            });
          }

          tripMap.get(row.id).flights.push({
            id: row.flight_id,
            flight_number: row.flight_number,
            departure_time: row.departure_time,
            arrival_time: row.arrival_time,
            flight_type: row.flight_type,
            next_airport: {
              iata: row.next_airport_iata,
              name: row.next_airport_name,
              latitude: row.next_airport_lat,
              longitude: row.next_airport_lng
            }
          });
        });

        return {
          id: airport.id,
          iata_code: airport.iata_code,
          name: airport.name,
          city: airport.city,
          country: airport.country,
          coordinates: [airport.longitude, airport.latitude],
          trip_count: airport.trip_count,
          trips: Array.from(tripMap.values())
        };
      })
    );

    return new Response(
      JSON.stringify({
        success: true,
        data: airportsWithTrips
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching airports with trips:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch airports with trips'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};