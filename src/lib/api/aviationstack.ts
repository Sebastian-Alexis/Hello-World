import { getApiConfig } from '../env';

interface AviationstackFlightResponse {
  pagination?: {
    limit: number;
    offset: number;
    count: number;
    total: number;
  };
  data?: AviationstackFlight[];
  error?: {
    code: string;
    message: string;
  };
}

interface AviationstackFlight {
  flight_date: string;
  flight_status: string;
  departure: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    delay: number | null;
    scheduled: string;
    estimated: string;
    actual: string | null;
    estimated_runway: string | null;
    actual_runway: string | null;
  };
  arrival: {
    airport: string;
    timezone: string;
    iata: string;
    icao: string;
    terminal: string | null;
    gate: string | null;
    baggage: string | null;
    delay: number | null;
    scheduled: string;
    estimated: string;
    actual: string | null;
    estimated_runway: string | null;
    actual_runway: string | null;
  };
  airline: {
    name: string;
    iata: string;
    icao: string;
  };
  flight: {
    number: string;
    iata: string;
    icao: string;
    codeshared: null | {
      airline: {
        name: string;
        iata: string;
        icao: string;
      };
      flight: {
        number: string;
        iata: string;
        icao: string;
      };
    };
  };
  aircraft?: {
    registration: string;
    iata: string;
    icao: string;
    icao24: string;
  };
  live?: {
    updated: string;
    latitude: number;
    longitude: number;
    altitude: number;
    direction: number;
    speed_horizontal: number;
    speed_vertical: number;
    is_ground: boolean;
  };
}

export class AviationstackError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'AviationstackError';
  }
}

/**
 * Fetches flight data by flight IATA code (e.g., AA1234)
 * Note: The free plan supports flight_iata but not flight_date parameter.
 * Returns the most recent flight data for the given flight number.
 */
export async function fetchFlightByIata(
  flightIata: string,
  flightDate?: string
): Promise<AviationstackFlight | null> {
  const config = getApiConfig();
  
  if (!config.aviationStackApi) {
    throw new AviationstackError('Aviationstack API key is not configured');
  }

  const params = new URLSearchParams({
    access_key: config.aviationStackApi,
    flight_iata: flightIata,
  });

  // Note: flight_date parameter is not supported on free plan
  // We'll search without date to get the most recent flight data
  // If a paid plan is available in the future, uncomment the following:
  // if (flightDate) {
  //   params.append('flight_date', flightDate);
  // }

  try {
    const response = await fetch(
      `https://api.aviationstack.com/v1/flights?${params.toString()}`
    );

    if (!response.ok) {
      throw new AviationstackError(
        `API request failed: ${response.statusText}`,
        response.status
      );
    }

    const data: AviationstackFlightResponse = await response.json();

    // Check for API access restrictions (common with free plans)
    if (data.error && data.error.code === 'function_access_restricted') {
      throw new AviationstackError(
        'This search feature requires a paid Aviation Stack plan. The free plan supports flight number search but not date-specific searches. Showing most recent flight data instead.',
        403
      );
    }

    // Return the first matching flight or null if no flights found
    return data.data && data.data.length > 0 ? data.data[0] : null;
  } catch (error) {
    if (error instanceof AviationstackError) {
      throw error;
    }
    throw new AviationstackError(
      `Failed to fetch flight data: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Maps Aviationstack flight data to our database schema format
 */
export function mapAviationstackToFlightData(
  flight: AviationstackFlight,
  departureAirportId: number,
  arrivalAirportId: number
) {
  // Calculate flight duration in minutes
  const departureTime = new Date(flight.departure.scheduled);
  const arrivalTime = new Date(flight.arrival.scheduled);
  const durationMinutes = Math.round(
    (arrivalTime.getTime() - departureTime.getTime()) / (1000 * 60)
  );

  return {
    flight_number: flight.flight.iata,
    airline_code: flight.airline.iata,
    airline_name: flight.airline.name,
    aircraft_type: flight.aircraft?.iata || null,
    departure_airport_id: departureAirportId,
    arrival_airport_id: arrivalAirportId,
    departure_time: flight.departure.scheduled,
    arrival_time: flight.arrival.scheduled,
    flight_duration: durationMinutes,
    // Note: Aviationstack doesn't provide distance, this would need to be calculated separately
    distance_km: null,
    // These fields would come from the form
    seat_number: null,
    class: null,
    booking_reference: null,
    ticket_price: null,
    currency: 'USD',
    notes: null,
    photos: [],
    trip_purpose: null,
    is_favorite: false,
    flight_status: mapFlightStatus(flight.flight_status),
    blog_post_id: null,
    trip_id: null,
  };
}

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