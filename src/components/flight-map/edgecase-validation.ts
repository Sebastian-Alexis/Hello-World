import type { Flight, Airport, FilterOptions } from './types';

// Enhanced validation utilities for edge cases

/**
 * Validate coordinate values
 */
export function isValidCoordinate(lng: any, lat: any): boolean {
    return typeof lng === 'number' && 
           typeof lat === 'number' && 
           !isNaN(lng) && 
           !isNaN(lat) && 
           lng >= -180 && lng <= 180 && 
           lat >= -90 && lat <= 90;
}

/**
 * Check if coordinates are at Null Island (0,0)
 */
export function isNullIsland(lng: number, lat: number): boolean {
    return lng === 0 && lat === 0;
}

/**
 * Check if coordinates cross the international date line
 */
export function crossesDateLine(originLng: number, destLng: number): boolean {
    return Math.abs(destLng - originLng) > 180;
}

/**
 * Check if coordinates are in polar regions
 */
export function isPolarRegion(lat: number): boolean {
    return Math.abs(lat) > 80;
}

/**
 * Validate airport data integrity
 */
export function validateAirport(airport: Airport): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
} {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Required fields check
    if (!airport.name || airport.name.trim().length === 0) {
        issues.push('Missing or empty airport name');
    }
    if (!airport.iata_code || airport.iata_code.trim().length === 0) {
        issues.push('Missing or empty IATA code');
    }
    if (!airport.city || airport.city.trim().length === 0) {
        issues.push('Missing or empty city');
    }
    if (!airport.country || airport.country.trim().length === 0) {
        issues.push('Missing or empty country');
    }

    // Coordinate validation
    const hasCoordinatesField = Array.isArray(airport.coordinates) && airport.coordinates.length === 2;
    const hasLatLngFields = typeof airport.latitude === 'number' && typeof airport.longitude === 'number';

    if (!hasCoordinatesField && !hasLatLngFields) {
        issues.push('Missing coordinate data - no valid coordinates field or lat/lng fields');
    } else {
        // Check coordinates field
        if (hasCoordinatesField) {
            const [lng, lat] = airport.coordinates;
            if (!isValidCoordinate(lng, lat)) {
                issues.push(`Invalid coordinates field: [${lng}, ${lat}]`);
            } else if (isNullIsland(lng, lat)) {
                warnings.push('Coordinates at Null Island (0,0) - likely missing data');
            } else if (isPolarRegion(lat)) {
                warnings.push(`Airport in polar region (lat: ${lat})`);
            }
        }

        // Check lat/lng fields
        if (hasLatLngFields) {
            if (!isValidCoordinate(airport.longitude, airport.latitude)) {
                issues.push(`Invalid lat/lng fields: [${airport.longitude}, ${airport.latitude}]`);
            } else if (isNullIsland(airport.longitude, airport.latitude)) {
                warnings.push('Lat/lng at Null Island (0,0) - likely missing data');
            } else if (isPolarRegion(airport.latitude)) {
                warnings.push(`Airport in polar region (lat: ${airport.latitude})`);
            }
        }
    }

    // Visit count validation
    if (typeof airport.visit_count !== 'number' || airport.visit_count < 0) {
        warnings.push(`Invalid visit count: ${airport.visit_count}`);
    }

    return {
        isValid: issues.length === 0,
        issues,
        warnings
    };
}

/**
 * Validate flight data integrity
 */
export function validateFlight(flight: Flight): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
} {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Required fields check
    if (!flight.flight_id || flight.flight_id.trim().length === 0) {
        issues.push('Missing or empty flight ID');
    }
    if (!flight.departure_time) {
        issues.push('Missing departure time');
    } else {
        const depTime = new Date(flight.departure_time);
        if (isNaN(depTime.getTime())) {
            issues.push('Invalid departure time format');
        }
    }

    // Coordinate validation
    if (!Array.isArray(flight.origin) || flight.origin.length !== 2) {
        issues.push('Invalid origin coordinates format');
    } else {
        const [originLng, originLat] = flight.origin;
        if (!isValidCoordinate(originLng, originLat)) {
            issues.push(`Invalid origin coordinates: [${originLng}, ${originLat}]`);
        } else if (isNullIsland(originLng, originLat)) {
            warnings.push('Origin at Null Island (0,0) - likely missing data');
        } else if (isPolarRegion(originLat)) {
            warnings.push(`Origin in polar region (lat: ${originLat})`);
        }
    }

    if (!Array.isArray(flight.destination) || flight.destination.length !== 2) {
        issues.push('Invalid destination coordinates format');
    } else {
        const [destLng, destLat] = flight.destination;
        if (!isValidCoordinate(destLng, destLat)) {
            issues.push(`Invalid destination coordinates: [${destLng}, ${destLat}]`);
        } else if (isNullIsland(destLng, destLat)) {
            warnings.push('Destination at Null Island (0,0) - likely missing data');
        } else if (isPolarRegion(destLat)) {
            warnings.push(`Destination in polar region (lat: ${destLat})`);
        }
    }

    // Same origin/destination check
    if (Array.isArray(flight.origin) && Array.isArray(flight.destination)) {
        const [originLng, originLat] = flight.origin;
        const [destLng, destLat] = flight.destination;
        
        if (isValidCoordinate(originLng, originLat) && isValidCoordinate(destLng, destLat)) {
            if (originLng === destLng && originLat === destLat) {
                warnings.push('Origin and destination are identical');
            } else {
                // Calculate distance
                const distance = calculateGreatCircleDistance(flight.origin, flight.destination);
                if (distance < 1) {
                    warnings.push(`Very short flight distance: ${distance.toFixed(2)} km`);
                }
                
                // Check for trans-Pacific flights crossing date line
                if (crossesDateLine(originLng, destLng)) {
                    warnings.push('Flight crosses international date line');
                }
            }
        }
    }

    // Flight status validation
    const validStatuses = ['booked', 'completed', 'cancelled', 'delayed'];
    if (!validStatuses.includes(flight.flight_status)) {
        issues.push(`Invalid flight status: ${flight.flight_status}`);
    }

    return {
        isValid: issues.length === 0,
        issues,
        warnings
    };
}

/**
 * Calculate great circle distance between two coordinates
 */
function calculateGreatCircleDistance(
    coord1: [number, number],
    coord2: [number, number]
): number {
    const [lng1, lat1] = coord1;
    const [lng2, lat2] = coord2;
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Validate entire dataset
 */
export function validateDataset(
    flights: Flight[],
    airports: Airport[]
): {
    flightValidation: { valid: number; invalid: number; warnings: number };
    airportValidation: { valid: number; invalid: number; warnings: number };
    datasetIssues: string[];
    performance: { airportsCount: number; flightsCount: number; isLargeDataset: boolean };
} {
    const datasetIssues: string[] = [];
    let validFlights = 0;
    let invalidFlights = 0;
    let flightWarnings = 0;
    let validAirports = 0;
    let invalidAirports = 0;
    let airportWarnings = 0;

    // Validate flights
    flights.forEach(flight => {
        const result = validateFlight(flight);
        if (result.isValid) {
            validFlights++;
        } else {
            invalidFlights++;
        }
        if (result.warnings.length > 0) {
            flightWarnings++;
        }
    });

    // Validate airports
    airports.forEach(airport => {
        const result = validateAirport(airport);
        if (result.isValid) {
            validAirports++;
        } else {
            invalidAirports++;
        }
        if (result.warnings.length > 0) {
            airportWarnings++;
        }
    });

    // Dataset-level validations
    if (flights.length === 0) {
        datasetIssues.push('Empty flights array');
    }
    if (airports.length === 0) {
        datasetIssues.push('Empty airports array');
    }

    // Check for flights referencing non-existent airports
    const airportIataCodes = new Set(airports.map(a => a.iata_code));
    const orphanedFlights = flights.filter(flight => {
        // This would require mapping flight origin/destination to airport IATA codes
        // For now, we'll skip this check as the current data structure uses coordinates directly
        return false;
    });

    // Performance considerations
    const isLargeDataset = flights.length > 1000 || airports.length > 500;
    if (isLargeDataset) {
        datasetIssues.push(`Large dataset detected: ${flights.length} flights, ${airports.length} airports - consider pagination or virtualization`);
    }

    // Check for overlapping airports (same city)
    const airportsByCity = new Map<string, Airport[]>();
    airports.forEach(airport => {
        const key = `${airport.city}, ${airport.country}`;
        if (!airportsByCity.has(key)) {
            airportsByCity.set(key, []);
        }
        airportsByCity.get(key)!.push(airport);
    });

    airportsByCity.forEach((cityAirports, city) => {
        if (cityAirports.length > 1) {
            datasetIssues.push(`Multiple airports in ${city}: ${cityAirports.length} airports may overlap on map`);
        }
    });

    return {
        flightValidation: {
            valid: validFlights,
            invalid: invalidFlights,
            warnings: flightWarnings
        },
        airportValidation: {
            valid: validAirports,
            invalid: invalidAirports,
            warnings: airportWarnings
        },
        datasetIssues,
        performance: {
            airportsCount: airports.length,
            flightsCount: flights.length,
            isLargeDataset
        }
    };
}

/**
 * Generate test data with edge cases
 */
export function generateEdgeCaseTestData(): { flights: Flight[]; airports: Airport[] } {
    const airports: Airport[] = [
        // Valid airport
        {
            id: 1,
            name: "John F. Kennedy International Airport",
            iata_code: "JFK",
            city: "New York",
            country: "United States",
            country_code: "US",
            latitude: 40.6413,
            longitude: -73.7781,
            has_visited: true,
            visit_count: 5,
            coordinates: [-73.7781, 40.6413]
        },
        // Airport at Null Island
        {
            id: 2,
            name: "Null Island Airport",
            iata_code: "NULL",
            city: "Null City",
            country: "Null Country",
            country_code: "NULL",
            latitude: 0,
            longitude: 0,
            has_visited: false,
            visit_count: 0,
            coordinates: [0, 0]
        },
        // Airport with invalid coordinates in coordinates field
        {
            id: 3,
            name: "Invalid Coords Airport",
            iata_code: "INV",
            city: "Invalid City", 
            country: "Invalid Country",
            country_code: "INV",
            latitude: 45.0,
            longitude: -122.0,
            has_visited: false,
            visit_count: 0,
            coordinates: [NaN, "invalid" as any]
        },
        // Polar region airport
        {
            id: 4,
            name: "McMurdo Station",
            iata_code: "MCM",
            city: "McMurdo",
            country: "Antarctica", 
            country_code: "AQ",
            latitude: -77.8419,
            longitude: 166.6863,
            has_visited: true,
            visit_count: 2,
            coordinates: [166.6863, -77.8419]
        },
        // Missing required fields
        {
            id: 5,
            name: "",
            iata_code: "",
            city: "",
            country: "",
            country_code: "",
            latitude: 35.6762,
            longitude: 139.6503,
            has_visited: false,
            visit_count: 0,
            coordinates: [139.6503, 35.6762]
        }
    ];

    const flights: Flight[] = [
        // Valid flight
        {
            id: 1,
            flight_id: "AA100",
            flight_number: "AA100",
            airline_name: "American Airlines",
            departure_airport_name: "JFK",
            arrival_airport_name: "LAX",
            departure_time: "2024-01-15T10:30:00Z",
            flight_status: "completed",
            distance_km: 3983,
            origin: [-73.7781, 40.6413],
            destination: [-118.2437, 34.0522]
        },
        // Same origin and destination
        {
            id: 2,
            flight_id: "TEST001",
            flight_number: "TEST001",
            airline_name: "Test Airlines",
            departure_airport_name: "JFK",
            arrival_airport_name: "JFK",
            departure_time: "2024-01-15T14:30:00Z",
            flight_status: "cancelled",
            origin: [-73.7781, 40.6413],
            destination: [-73.7781, 40.6413]
        },
        // Trans-Pacific flight crossing dateline
        {
            id: 3,
            flight_id: "PA123",
            flight_number: "PA123",
            airline_name: "Pacific Airlines",
            departure_airport_name: "LAX",  
            arrival_airport_name: "NRT",
            departure_time: "2024-01-16T02:00:00Z",
            flight_status: "booked",
            distance_km: 8815,
            origin: [-118.2437, 34.0522], // LAX
            destination: [140.3928, 35.7647] // NRT Tokyo
        },
        // Flight with missing coordinates
        {
            id: 4,
            flight_id: "MISSING001",
            flight_number: "MISSING001", 
            airline_name: "Missing Airlines",
            departure_airport_name: "UNKNOWN",
            arrival_airport_name: "UNKNOWN",
            departure_time: "2024-01-17T08:00:00Z",
            flight_status: "booked",
            origin: [null as any, null as any],
            destination: [undefined as any, undefined as any]
        },
        // Flight with invalid coordinates
        {
            id: 5,
            flight_id: "INVALID001",
            flight_number: "INVALID001",
            airline_name: "Invalid Airlines", 
            departure_airport_name: "INVALID",
            arrival_airport_name: "INVALID",
            departure_time: "2024-01-18T12:00:00Z",
            flight_status: "delayed",
            origin: [NaN, "invalid" as any],
            destination: [500, -200] // Out of valid range
        },
        // Very short flight (< 1km)
        {
            id: 6,
            flight_id: "SHORT001",
            flight_number: "SHORT001",
            airline_name: "Short Airlines",
            departure_airport_name: "CLOSE1",
            arrival_airport_name: "CLOSE2", 
            departure_time: "2024-01-19T16:00:00Z",
            flight_status: "completed",
            distance_km: 0.5,
            origin: [-73.7781, 40.6413],
            destination: [-73.7780, 40.6414] // Very close coordinates
        },
        // Flight to Null Island
        {
            id: 7,
            flight_id: "NULL001",
            flight_number: "NULL001",
            airline_name: "Null Airlines",
            departure_airport_name: "JFK", 
            arrival_airport_name: "NULL",
            departure_time: "2024-01-20T20:00:00Z",
            flight_status: "booked",
            origin: [-73.7781, 40.6413],
            destination: [0, 0] // Null Island
        }
    ];

    return { flights, airports };
}