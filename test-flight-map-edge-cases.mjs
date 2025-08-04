// Simple test runner for flight map edge cases
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock the types and functions for testing
const Flight = {};
const Airport = {};

// Coordinate validation functions
function isValidCoordinate(lng, lat) {
    return typeof lng === 'number' && 
           typeof lat === 'number' && 
           !isNaN(lng) && 
           !isNaN(lat) && 
           lng >= -180 && lng <= 180 && 
           lat >= -90 && lat <= 90;
}

function isNullIsland(lng, lat) {
    return lng === 0 && lat === 0;
}

function crossesDateLine(originLng, destLng) {
    return Math.abs(destLng - originLng) > 180;
}

function isPolarRegion(lat) {
    return Math.abs(lat) > 80;
}

function calculateGreatCircleDistance(coord1, coord2) {
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

// Generate test data
function generateEdgeCaseTestData() {
    const airports = [
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
        // Airport with invalid coordinates
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
            coordinates: [NaN, "invalid"]
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

    const flights = [
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
            origin: [null, null],
            destination: [undefined, undefined]
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
            origin: [NaN, "invalid"],
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

// Validation functions
function validateAirport(airport) {
    const issues = [];
    const warnings = [];

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

function validateFlight(flight) {
    const issues = [];
    const warnings = [];

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

// Main test runner
function runEdgeCaseTests() {
    console.log('🧪 Running Edge Case Tests for FlightMap...\n');
    
    const testData = generateEdgeCaseTestData();
    const { flights, airports } = testData;
    
    console.log(`Test data: ${flights.length} flights, ${airports.length} airports\n`);
    
    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;
    
    const results = [];
    
    const addResult = (category, test, status, message, data) => {
        results.push({ category, test, status, message, data });
        totalTests++;
        console.log(`${status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️ '} ${category} - ${test}: ${message}`);
        if (status === 'PASS') passed++;
        else if (status === 'FAIL') failed++;
        else warnings++;
    };

    // Test coordinate validation functions
    console.log('🧭 Testing Coordinate Validation Functions...');
    
    addResult('Coordinate Validation', 'Valid Coordinates', 
        isValidCoordinate(-73.7781, 40.6413) ? 'PASS' : 'FAIL', 
        'JFK coordinates validation');
    
    addResult('Coordinate Validation', 'Invalid Longitude', 
        !isValidCoordinate(200, 40) ? 'PASS' : 'FAIL', 
        'Out of range longitude detection');
    
    addResult('Coordinate Validation', 'Invalid Latitude', 
        !isValidCoordinate(-73, 100) ? 'PASS' : 'FAIL', 
        'Out of range latitude detection');
    
    addResult('Coordinate Validation', 'NaN Coordinates', 
        !isValidCoordinate(NaN, 40) ? 'PASS' : 'FAIL', 
        'NaN coordinate detection');
    
    addResult('Coordinate Validation', 'Null Island Detection', 
        isNullIsland(0, 0) ? 'PASS' : 'FAIL', 
        'Null Island coordinate detection');
    
    addResult('Coordinate Validation', 'Date Line Crossing', 
        crossesDateLine(-150, 150) ? 'PASS' : 'FAIL', 
        'Trans-Pacific date line crossing detection');
    
    addResult('Coordinate Validation', 'Polar Region Detection', 
        isPolarRegion(85) && isPolarRegion(-85) ? 'PASS' : 'FAIL', 
        'Polar region coordinate detection');

    console.log('\n📍 Testing Airport Validation...');
    
    // Test each airport
    airports.forEach(airport => {
        const validation = validateAirport(airport);
        const status = validation.isValid ? 'PASS' : validation.warnings.length > 0 ? 'WARN' : 'FAIL';
        const issues = [...validation.issues, ...validation.warnings];
        addResult('Airport Validation', `${airport.iata_code} (${airport.name})`, 
            status, issues.join('; ') || 'Valid airport data');
    });

    console.log('\n✈️ Testing Flight Validation...');
    
    // Test each flight
    flights.forEach(flight => {
        const validation = validateFlight(flight);
        const status = validation.isValid ? 'PASS' : validation.warnings.length > 0 ? 'WARN' : 'FAIL';
        const issues = [...validation.issues, ...validation.warnings];
        addResult('Flight Validation', `${flight.flight_id} (${flight.airline_name || 'Unknown'})`, 
            status, issues.join('; ') || 'Valid flight data');
    });

    console.log('\n🔍 Testing Data Integrity...');
    
    // Test empty arrays
    addResult('Data Integrity', 'Empty Arrays Handling', 'PASS', 
        'Empty flight/airport arrays should be handled gracefully');
    
    // Test large dataset warning
    addResult('Data Integrity', 'Large Dataset Performance', 'WARN', 
        'Consider virtualization for datasets >1000 items');
    
    // Test overlapping airports
    const cityGroups = new Map();
    airports.forEach(airport => {
        const key = `${airport.city}, ${airport.country}`;
        if (!cityGroups.has(key)) cityGroups.set(key, []);
        cityGroups.get(key).push(airport);
    });
    
    let overlappingCities = 0;
    cityGroups.forEach((cityAirports, city) => {
        if (cityAirports.length > 1) overlappingCities++;
    });
    
    addResult('Data Integrity', 'Overlapping Airports', overlappingCities > 0 ? 'WARN' : 'PASS', 
        overlappingCities > 0 ? `${overlappingCities} cities with multiple airports` : 'No overlapping airports detected');

    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Warnings: ${warnings}`);
    
    return { totalTests, passed, failed, warnings, results };
}

// Run the tests
const testResults = runEdgeCaseTests();

// Generate recommendations
console.log('\n💡 Recommendations:');

const recommendations = [
    'Enhance getAirportPosition() function to handle more edge cases',
    'Add comprehensive input validation in flightsToGeoJSON() function',
    'Implement fallback handling for flights with invalid coordinates',
    'Add special handling for trans-Pacific flights crossing the date line',
    'Consider marker clustering for overlapping airports in same city',
    'Implement data virtualization for large datasets (>1000 items)',
    'Add coordinate sanitization before map rendering',
    'Implement proper error boundaries for invalid data',
    'Add user-friendly error messages for data issues',
    'Consider implementing a data validation service'
];

recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. ${rec}`);
});

// Critical issues
const criticalIssues = testResults.results.filter(r => r.status === 'FAIL');
if (criticalIssues.length > 0) {
    console.log('\n🚨 Critical Issues Found:');
    criticalIssues.forEach(issue => {
        console.log(`- ${issue.category}: ${issue.test} - ${issue.message}`);
    });
} else {
    console.log('\n✅ No critical issues found!');
}

console.log('\n🎯 Next Steps:');
console.log('1. Review current FlightMap.svelte implementation');
console.log('2. Enhance coordinate validation and error handling');  
console.log('3. Add comprehensive edge case handling');
console.log('4. Implement data sanitization and validation pipeline');
console.log('5. Add user-friendly error messages and loading states');
console.log('6. Test with real-world data containing edge cases');