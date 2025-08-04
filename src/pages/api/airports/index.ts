import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

const db = new DatabaseQueries();

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
  
  // Return null to indicate geocoding failure
  return null;
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    
    // Search parameters
    const query = searchParams.get('search') || searchParams.get('q') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);

    // Get airports with search
    const airports = await db.searchAirports(query, limit);

    return new Response(JSON.stringify({
      success: true,
      data: airports
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800' // Cache for 30 minutes
      }
    });
  } catch (error) {
    console.error('Error fetching airports:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch airports'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const airportData = await request.json();

    // Validate core required fields (coordinates are now optional)
    const requiredFields = ['iata_code', 'name', 'city', 'country'];
    for (const field of requiredFields) {
      if (!airportData[field]) {
        return new Response(JSON.stringify({
          success: false,
          error: `Missing required field: ${field}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Set defaults
    if (!airportData.type) airportData.type = 'airport';
    if (airportData.is_active === undefined) airportData.is_active = true;
    if (airportData.has_visited === undefined) airportData.has_visited = false;
    if (airportData.visit_count === undefined) airportData.visit_count = 0;

    // Track if geocoding was performed
    let wasGeocoded = false;
    const originalData = { ...airportData };

    // Automatic geocoding if coordinates are not provided
    if (!airportData.latitude || !airportData.longitude) {
      console.log(`🔍 Attempting to geocode airport: ${airportData.iata_code} - ${airportData.name}`);
      
      const coordinates = await geocodeAirport(
        airportData.iata_code,
        airportData.name,
        airportData.city,
        airportData.country
      );
      
      if (coordinates) {
        airportData.latitude = coordinates.latitude;
        airportData.longitude = coordinates.longitude;
        // Update country_code if geocoding provides a better one
        if (!airportData.country_code) {
          airportData.country_code = coordinates.country_code;
        }
        wasGeocoded = true;
        console.log(`✅ Successfully geocoded ${airportData.iata_code}: [${coordinates.longitude}, ${coordinates.latitude}]`);
      } else {
        console.warn(`⚠️ Failed to geocode airport ${airportData.iata_code}. Storing with null coordinates.`);
        // Set to null instead of 0,0 to indicate missing data
        airportData.latitude = null;
        airportData.longitude = null;
      }
    }

    // Ensure country_code is provided (fallback if not set)
    if (!airportData.country_code) {
      airportData.country_code = 'XX'; // Unknown country code
    }

    const airport = await db.createAirport(airportData);

    return new Response(JSON.stringify({
      success: true,
      data: airport,
      geocoded: wasGeocoded
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating airport:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create airport'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};