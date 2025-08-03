import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { executeQuery } from '@/lib/db';

export const POST: APIRoute = async ({ request }) => {
  try {
    const { iata_code, name, city, country } = await request.json();

    if (!iata_code || !name) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'IATA code and name are required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // First, try to find the airport by IATA code
    const existingAirport = await executeQuery(
      'SELECT * FROM airports WHERE iata_code = ?',
      [iata_code]
    );

    if (existingAirport.rows && existingAirport.rows.length > 0) {
      // Airport already exists, return it
      return new Response(
        JSON.stringify({
          success: true,
          data: existingAirport.rows[0],
          created: false,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Airport doesn't exist, create it
    // Extract city and country from the airport name if not provided
    let airportCity = city || 'Unknown';
    let airportCountry = country || 'Unknown';
    
    // Many airport names include the city, try to extract it
    if (!city && name.includes(',')) {
      const parts = name.split(',');
      airportCity = parts[0].trim();
    }

    // Create the new airport with placeholder coordinates
    // In a real app, you'd want to geocode these or get them from a proper source
    const result = await executeQuery(
      `INSERT INTO airports (
        iata_code, name, city, country, country_code,
        latitude, longitude, type, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        iata_code,
        name,
        airportCity,
        airportCountry,
        'XX', // Placeholder country code
        0.0,  // Placeholder latitude
        0.0,  // Placeholder longitude
        'airport',
        1
      ]
    );

    if (result.insertId) {
      // Fetch the newly created airport
      const newAirport = await executeQuery(
        'SELECT * FROM airports WHERE id = ?',
        [result.insertId]
      );

      return new Response(
        JSON.stringify({
          success: true,
          data: newAirport.rows[0],
          created: true,
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    throw new Error('Failed to create airport');
  } catch (error) {
    console.error('Error in airport lookup:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lookup/create airport',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};