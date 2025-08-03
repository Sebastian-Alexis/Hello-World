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
 * Enhanced with proper error handling and API documentation compliance
 */
export async function fetchFlightByIata(
  flightIata: string,
  flightDate?: string
): Promise<AviationstackFlight | null> {
  const config = getApiConfig();
  
  if (!config.aviationStackApi) {
    throw new AviationstackError('Aviationstack API key is not configured. Please set AVIATION_STACK_API in your .env file.');
  }

  // Validate flight IATA format (should be 2-3 letter airline code + 1-4 digit flight number)
  if (!/^[A-Z]{2,3}\d{1,4}$/i.test(flightIata)) {
    throw new AviationstackError(`Invalid flight IATA format: ${flightIata}. Expected format: AA1234`);
  }

  const params = new URLSearchParams({
    access_key: config.aviationStackApi,
    flight_iata: flightIata.toUpperCase(),
    limit: '1', // Only need the first result
  });

  // Add flight_date for historical searches (only works with paid plans)
  if (flightDate) {
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flightDate)) {
      throw new AviationstackError(`Invalid date format: ${flightDate}. Expected format: YYYY-MM-DD`);
    }
    params.append('flight_date', flightDate);
  }

  const url = `https://api.aviationstack.com/v1/flights?${params.toString()}`;
  
  console.log('=== AVIATIONSTACK API DEBUG ===');
  console.log('API URL:', url);
  console.log('Request params:', Object.fromEntries(params.entries()));
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlightTracker/1.0',
      },
    });

    console.log('Aviation Stack API Response status:', response.status);
    console.log('Aviation Stack API Response statusText:', response.statusText);
    console.log('Aviation Stack API Response headers:', Object.fromEntries(response.headers.entries()));

    // Handle HTTP errors
    if (!response.ok) {
      const errorText = await response.text();
      console.log('Aviation Stack API error response text:', errorText);
      throw new AviationstackError(
        `HTTP ${response.status}: ${response.statusText}. ${errorText}`,
        response.status
      );
    }

    const responseText = await response.text();
    console.log('Raw Aviation Stack API response:', responseText);
    
    let data: AviationstackFlightResponse;
    try {
      data = JSON.parse(responseText);
      console.log('Parsed Aviation Stack API response:', data);
    } catch (parseError) {
      console.error('Aviation Stack API JSON parsing error:', parseError);
      throw new AviationstackError('Invalid JSON response from Aviation Stack API');
    }

    // Handle API-specific errors
    if (data.error) {
      const errorCode = data.error.code;
      const errorMessage = data.error.message;
      
      switch (errorCode) {
        case 'invalid_access_key':
          throw new AviationstackError('Invalid API key. Please check your AVIATION_STACK_API configuration.', 401);
        case 'missing_access_key':
          throw new AviationstackError('API key is missing from the request.', 401);
        case 'inactive_user':
          throw new AviationstackError('Your Aviation Stack account is inactive.', 401);
        case 'function_access_restricted':
          throw new AviationstackError('This feature requires a paid Aviation Stack plan. Free plan limitations apply.', 403);
        case 'https_access_restricted':
          throw new AviationstackError('HTTPS access requires a paid plan. Consider upgrading your Aviation Stack subscription.', 403);
        case 'usage_limit_reached':
          throw new AviationstackError('Monthly API usage limit reached. Please upgrade your plan or wait for the next billing cycle.', 429);
        case 'rate_limit_reached':
          throw new AviationstackError('API rate limit exceeded. Please reduce request frequency.', 429);
        case 'validation_error':
          throw new AviationstackError(`Validation error: ${errorMessage}`, 400);
        default:
          throw new AviationstackError(`API Error (${errorCode}): ${errorMessage}`, 500);
      }
    }

    // Return the first matching flight or null if no flights found
    console.log('Flight search results:', {
      hasData: !!data.data,
      resultCount: data.data?.length || 0,
      flights: data.data
    });
    
    if (data.data && data.data.length > 0) {
      console.log('Returning first flight:', data.data[0]);
      return data.data[0];
    }
    
    console.log('No flights found, returning null');
    return null;
  } catch (error) {
    if (error instanceof AviationstackError) {
      throw error;
    }
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new AviationstackError('Network error: Unable to connect to Aviation Stack API. Please check your internet connection.');
    }
    
    throw new AviationstackError(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Alternative search by flight number and airline code
 * Useful when user provides separate airline and flight number
 */
export async function fetchFlightByNumber(
  airlineIata: string,
  flightNumber: string,
  flightDate?: string
): Promise<AviationstackFlight | null> {
  // Construct the flight IATA code
  const flightIata = `${airlineIata.toUpperCase()}${flightNumber}`;
  return fetchFlightByIata(flightIata, flightDate);
}

/**
 * Search flights with multiple parameters for more flexible queries
 */
export async function searchFlights(params: {
  flightIata?: string;
  flightNumber?: string;
  airlineIata?: string;
  depIata?: string;
  arrIata?: string;
  flightDate?: string;
  flightStatus?: 'scheduled' | 'active' | 'landed' | 'cancelled' | 'incident' | 'diverted';
  limit?: number;
}): Promise<AviationstackFlight[]> {
  const config = getApiConfig();
  
  if (!config.aviationStackApi) {
    throw new AviationstackError('Aviationstack API key is not configured. Please set AVIATION_STACK_API in your .env file.');
  }

  const urlParams = new URLSearchParams({
    access_key: config.aviationStackApi,
    limit: (params.limit || 10).toString(),
  });

  // Add optional parameters
  if (params.flightIata) urlParams.append('flight_iata', params.flightIata.toUpperCase());
  if (params.flightNumber) urlParams.append('flight_number', params.flightNumber);
  if (params.airlineIata) urlParams.append('airline_iata', params.airlineIata.toUpperCase());
  if (params.depIata) urlParams.append('dep_iata', params.depIata.toUpperCase());
  if (params.arrIata) urlParams.append('arr_iata', params.arrIata.toUpperCase());
  if (params.flightDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.flightDate)) {
      throw new AviationstackError(`Invalid date format: ${params.flightDate}. Expected format: YYYY-MM-DD`);
    }
    urlParams.append('flight_date', params.flightDate);
  }
  if (params.flightStatus) urlParams.append('flight_status', params.flightStatus);

  const url = `https://api.aviationstack.com/v1/flights?${urlParams.toString()}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FlightTracker/1.0',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new AviationstackError(
        `HTTP ${response.status}: ${response.statusText}. ${errorText}`,
        response.status
      );
    }

    const data: AviationstackFlightResponse = await response.json();

    if (data.error) {
      const errorCode = data.error.code;
      const errorMessage = data.error.message;
      
      switch (errorCode) {
        case 'invalid_access_key':
          throw new AviationstackError('Invalid API key. Please check your AVIATION_STACK_API configuration.', 401);
        case 'function_access_restricted':
          throw new AviationstackError('This search feature requires a paid Aviation Stack plan.', 403);
        case 'usage_limit_reached':
          throw new AviationstackError('Monthly API usage limit reached.', 429);
        case 'rate_limit_reached':
          throw new AviationstackError('API rate limit exceeded. Please reduce request frequency.', 429);
        default:
          throw new AviationstackError(`API Error (${errorCode}): ${errorMessage}`, 500);
      }
    }

    return data.data || [];
  } catch (error) {
    if (error instanceof AviationstackError) {
      throw error;
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new AviationstackError('Network error: Unable to connect to Aviation Stack API.');
    }
    
    throw new AviationstackError(
      `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
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