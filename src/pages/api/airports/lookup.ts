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
        const latitude = parseFloat(result.lat);
        const longitude = parseFloat(result.lon);
        
        // Check if parseFloat returned NaN
        if (isNaN(latitude) || isNaN(longitude)) {
          console.warn(`Invalid coordinates from geocoding for ${iataCode}: lat=${result.lat}, lon=${result.lon}`);
          return null;
        }
        
        return {
          latitude,
          longitude,
          country_code: result.address?.country_code?.toUpperCase() || 'XX'
        };
      }
    }
  } catch (error) {
    console.warn(`Geocoding failed for ${iataCode} - ${airportName}:`, error.message);
  }
  
  // Instead of fallback to Null Island (0,0), return null to indicate failure
  // This prevents the database from being populated with invalid coordinates
  return null;
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
    
    // Handle failed geocoding - use null for coordinates instead of 0,0
    const latitude = coordinates?.latitude ?? null;
    const longitude = coordinates?.longitude ?? null;
    const countryCode = coordinates?.country_code || 'XX';
    
    // Log geocoding attempt
    if (!coordinates) {
      console.warn(`⚠️ Failed to geocode airport ${iata_code} - ${name}. Storing with null coordinates.`);
    } else {
      console.log(`✅ Successfully geocoded ${iata_code}: [${longitude}, ${latitude}]`);
    }
    
    // Create the new airport with geocoded coordinates (null if geocoding failed)
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
        countryCode,
        latitude,
        longitude,
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