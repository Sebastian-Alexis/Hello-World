import type { APIRoute } from 'astro';
import { db } from '@/lib/db';
import { executeQuery } from '@/lib/db';

// Helper function for geocoding airports using Mapbox
async function geocodeAirport(iataCode: string, airportName: string, city: string, country: string) {
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