import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { executeQuery } from '@/lib/db';

// Helper function for geocoding airports
async function geocodeAirport(iataCode: string, airportName: string, city: string, country: string) {
  try {
    // Try to get coordinates from a geocoding service
    // Using OpenStreetMap Nominatim as a free alternative
    const query = encodeURIComponent(`${airportName} ${city} airport`);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
      { 
        headers: { 'User-Agent': 'FlightTracker/1.0' }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data && data.length > 0) {
        const result = data[0];
        return {
          latitude: parseFloat(result.lat) || 0.0,
          longitude: parseFloat(result.lon) || 0.0,
          country_code: result.address?.country_code?.toUpperCase() || 'XX'
        };
      }
    }
  } catch (error) {
    console.warn(`Geocoding failed for ${iataCode} - ${airportName}:`, error.message);
  }
  
  // Fallback to default coordinates
  return {
    latitude: 0.0,
    longitude: 0.0,
    country_code: 'XX'
  };
}

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

    // Geocode the airport location
    const coordinates = await geocodeAirport(iata_code, name, airportCity, airportCountry);
    
    // Create the new airport with geocoded coordinates
    const result = await executeQuery(
      `INSERT INTO airports (
        iata_code, name, city, country, country_code,
        latitude, longitude, type, is_active,
        has_visited, visit_count,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        iata_code,
        name,
        airportCity,
        airportCountry,
        coordinates.country_code,
        coordinates.latitude,
        coordinates.longitude,
        'airport',
        1,
        false,
        0
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