import type { APIRoute } from 'astro';
import { fetchFlightByIata, mapAviationstackToFlightData } from '../../../lib/api/aviationstack';
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

    // Look up airports by IATA codes
    const airports = await db.getAirports();
    const departureAirport = airports.find(
      (a) => a.iata_code === flightData.departure.iata
    );
    const arrivalAirport = airports.find(
      (a) => a.iata_code === flightData.arrival.iata
    );

    if (!departureAirport || !arrivalAirport) {
      console.log('Airport lookup failed, sending 404');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'One or both airports not found in database',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Map the flight data to our schema
    console.log('Mapping flight data to schema...');
    const mappedData = mapAviationstackToFlightData(
      flightData,
      departureAirport.id,
      arrivalAirport.id
    );
    console.log('Mapped data:', mappedData);

    const responseData = {
      success: true,
      data: {
        ...mappedData,
        // Include airport names for display
        departure_airport_name: departureAirport.name,
        departure_iata: departureAirport.iata_code,
        arrival_airport_name: arrivalAirport.name,
        arrival_iata: arrivalAirport.iata_code,
      },
    };
    
    console.log('Sending success response:', responseData);
    
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