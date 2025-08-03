import type { APIRoute } from 'astro';
import { fetchFlightByIata } from '../../../lib/api/aviationstack';
import { DatabaseQueries } from '../../../lib/db/queries';

const db = new DatabaseQueries();

export const POST: APIRoute = async ({ request }) => {
  try {
    const { flightIata, flightDate } = await request.json();

    if (!flightIata) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Flight IATA code is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch flight data from Aviationstack
    const flightData = await fetchFlightByIata(flightIata, flightDate);

    if (!flightData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Flight not found',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate flight duration
    const departureTime = new Date(flightData.departure.scheduled);
    const arrivalTime = new Date(flightData.arrival.scheduled);
    const durationMinutes = Math.round(
      (arrivalTime.getTime() - departureTime.getTime()) / (1000 * 60)
    );

    // Find or create airports in the database
    let departureAirport, arrivalAirport;
    
    try {
      [departureAirport, arrivalAirport] = await Promise.all([
        db.findOrCreateAirport({
          iata_code: flightData.departure.iata,
          name: flightData.departure.airport,
          city: extractCityFromAirportName(flightData.departure.airport),
        }),
        db.findOrCreateAirport({
          iata_code: flightData.arrival.iata,
          name: flightData.arrival.airport,
          city: extractCityFromAirportName(flightData.arrival.airport),
        })
      ]);
    } catch (airportError) {
      console.error('Error creating airports:', airportError);
      // Fall back to basic data without airport IDs
      const responseData = {
        success: true,
        data: {
          flight_number: flightData.flight.iata,
          airline_code: flightData.airline.iata,
          airline_name: flightData.airline.name,
          aircraft_type: flightData.aircraft?.iata || null,
          departure_airport_name: flightData.departure.airport,
          departure_iata: flightData.departure.iata,
          arrival_airport_name: flightData.arrival.airport,
          arrival_iata: flightData.arrival.iata,
          departure_time: flightData.departure.scheduled,
          arrival_time: flightData.arrival.scheduled,
          duration_minutes: durationMinutes,
          flight_status: mapFlightStatus(flightData.flight_status),
          // Additional useful data from Aviation Stack
          departure_terminal: flightData.departure.terminal,
          departure_gate: flightData.departure.gate,
          arrival_terminal: flightData.arrival.terminal,
          arrival_gate: flightData.arrival.gate,
          arrival_baggage: flightData.arrival.baggage,
          // Warning about airport creation failure
          warning: 'Airports could not be created in database, form submission may require manual airport selection',
        },
      };
      
      return new Response(
        JSON.stringify(responseData),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Map the flight data with airport IDs
    const responseData = {
      success: true,
      data: {
        flight_number: flightData.flight.iata,
        airline_code: flightData.airline.iata,
        airline_name: flightData.airline.name,
        aircraft_type: flightData.aircraft?.iata || null,
        departure_airport_id: departureAirport.id,
        departure_airport_name: flightData.departure.airport,
        departure_iata: flightData.departure.iata,
        arrival_airport_id: arrivalAirport.id,
        arrival_airport_name: flightData.arrival.airport,
        arrival_iata: flightData.arrival.iata,
        departure_time: flightData.departure.scheduled,
        arrival_time: flightData.arrival.scheduled,
        duration_minutes: durationMinutes,
        flight_status: mapFlightStatus(flightData.flight_status),
        // Additional useful data from Aviation Stack
        departure_terminal: flightData.departure.terminal,
        departure_gate: flightData.departure.gate,
        arrival_terminal: flightData.arrival.terminal,
        arrival_gate: flightData.arrival.gate,
        arrival_baggage: flightData.arrival.baggage,
      },
    };
    
    return new Response(
      JSON.stringify(responseData),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error fetching flight data:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch flight data',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

/**
 * Maps Aviationstack flight status to our database enum values
 */
function mapFlightStatus(status: string): string {
  const statusMap: Record<string, string> = {
    scheduled: 'booked',
    active: 'booked',
    landed: 'completed',
    cancelled: 'cancelled',
    incident: 'cancelled',
    diverted: 'delayed',
  };

  return statusMap[status] || 'completed';
}

/**
 * Attempts to extract city name from airport name
 * This is a simple heuristic - in production you might want more sophisticated parsing
 */
function extractCityFromAirportName(airportName: string): string {
  // Common patterns to try to extract city names
  const patterns = [
    // "John F Kennedy International Airport" -> "New York" (would need mapping)
    // "Los Angeles International Airport" -> "Los Angeles"
    /^([^(]+?)\s+(International|Regional|Municipal|Airport)/i,
    // "London Heathrow Airport" -> "London"
    /^([^-]+?)\s+[\w\s]+Airport/i,
    // Simple fallback - take first word(s) before common airport terms
    /^([^-]+?)(?:\s+(?:International|Regional|Municipal|Airport|Intl))/i,
  ];

  for (const pattern of patterns) {
    const match = airportName.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // If no patterns match, use the airport name as city (better than "Unknown")
  return airportName;
}