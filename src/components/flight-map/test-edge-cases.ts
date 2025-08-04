import { 
    validateDataset, 
    validateFlight, 
    validateAirport, 
    generateEdgeCaseTestData,
    isValidCoordinate,
    isNullIsland,
    crossesDateLine,
    isPolarRegion
} from './edgecase-validation';
import type { Flight, Airport } from './types';

/**
 * Comprehensive edge case testing for FlightMap component
 */
export function runEdgeCaseTests(): {
    summary: {
        totalTests: number;
        passed: number;
        failed: number;
        warnings: number;
    };
    results: Array<{
        category: string;
        test: string;
        status: 'PASS' | 'FAIL' | 'WARN';
        message: string;
        data?: any;
    }>;
} {
    const results: Array<{
        category: string;
        test: string;
        status: 'PASS' | 'FAIL' | 'WARN';
        message: string;
        data?: any;
    }> = [];

    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;

    const addResult = (category: string, test: string, status: 'PASS' | 'FAIL' | 'WARN', message: string, data?: any) => {
        results.push({ category, test, status, message, data });
        totalTests++;
        if (status === 'PASS') passed++;
        else if (status === 'FAIL') failed++;
        else warnings++;
    };

    // Generate test data
    const testData = generateEdgeCaseTestData();
    const { flights, airports } = testData;

    console.log('🧪 Running Edge Case Tests for FlightMap...');
    console.log(`Test data: ${flights.length} flights, ${airports.length} airports`);

    // Category 1: Missing Coordinates Tests
    console.log('\n📍 Testing Missing Coordinates...');
    
    // Test airports with null/undefined coordinates
    const nullAirport = airports.find(a => a.iata_code === 'NULL');
    if (nullAirport) {
        const validation = validateAirport(nullAirport);
        if (validation.warnings.some(w => w.includes('Null Island'))) {
            addResult('Missing Coordinates', 'Null Island Detection', 'WARN', 
                'Airport at Null Island (0,0) detected and warned about', nullAirport);
        } else {
            addResult('Missing Coordinates', 'Null Island Detection', 'FAIL', 
                'Failed to detect Null Island coordinates', nullAirport);
        }
    }

    // Test airports with invalid coordinate values
    const invalidAirport = airports.find(a => a.iata_code === 'INV');
    if (invalidAirport) {
        const validation = validateAirport(invalidAirport);
        if (!validation.isValid && validation.issues.some(i => i.includes('Invalid coordinates'))) {
            addResult('Missing Coordinates', 'Invalid Coordinates Detection', 'PASS', 
                'Invalid coordinate values properly detected', invalidAirport);
        } else {
            addResult('Missing Coordinates', 'Invalid Coordinates Detection', 'FAIL', 
                'Failed to detect invalid coordinate values', invalidAirport);
        }
    }

    // Test flights with missing origin or destination
    const missingCoordsFlight = flights.find(f => f.flight_id === 'MISSING001');
    if (missingCoordsFlight) {
        const validation = validateFlight(missingCoordsFlight);
        if (!validation.isValid) {
            addResult('Missing Coordinates', 'Missing Flight Coordinates', 'PASS', 
                'Missing flight coordinates properly detected', missingCoordsFlight);
        } else {
            addResult('Missing Coordinates', 'Missing Flight Coordinates', 'FAIL', 
                'Failed to detect missing flight coordinates', missingCoordsFlight);
        }
    }

    // Category 2: Same Origin/Destination Tests
    console.log('\n🔄 Testing Same Origin/Destination...');
    
    const sameOriginDestFlight = flights.find(f => f.flight_id === 'TEST001');
    if (sameOriginDestFlight) {
        const validation = validateFlight(sameOriginDestFlight);
        if (validation.warnings.some(w => w.includes('identical'))) {
            addResult('Same Origin/Destination', 'Identical Coordinates', 'WARN', 
                'Same origin/destination properly detected', sameOriginDestFlight);
        } else {
            addResult('Same Origin/Destination', 'Identical Coordinates', 'FAIL', 
                'Failed to detect identical origin/destination', sameOriginDestFlight);
        }
    }

    const shortFlight = flights.find(f => f.flight_id === 'SHORT001');
    if (shortFlight) {
        const validation = validateFlight(shortFlight);
        if (validation.warnings.some(w => w.includes('Very short flight'))) {
            addResult('Same Origin/Destination', 'Short Distance Flight', 'WARN', 
                'Very short flight distance properly detected', shortFlight);
        } else {
            addResult('Same Origin/Destination', 'Short Distance Flight', 'FAIL', 
                'Failed to detect very short flight distance', shortFlight);
        }
    }

    // Category 3: Extreme Coordinates Tests
    console.log('\n🌍 Testing Extreme Coordinates...');
    
    const transpacificFlight = flights.find(f => f.flight_id === 'PA123');
    if (transpacificFlight) {
        const [originLng] = transpacificFlight.origin;
        const [destLng] = transpacificFlight.destination;
        if (crossesDateLine(originLng, destLng)) {
            const validation = validateFlight(transpacificFlight);
            if (validation.warnings.some(w => w.includes('date line'))) {
                addResult('Extreme Coordinates', 'Date Line Crossing', 'WARN', 
                    'Date line crossing properly detected', transpacificFlight);
            } else {
                addResult('Extreme Coordinates', 'Date Line Crossing', 'FAIL', 
                    'Failed to warn about date line crossing', transpacificFlight);
            }
        }
    }

    const polarAirport = airports.find(a => a.iata_code === 'MCM');
    if (polarAirport) {
        const validation = validateAirport(polarAirport);
        if (validation.warnings.some(w => w.includes('polar region'))) {
            addResult('Extreme Coordinates', 'Polar Region Detection', 'WARN', 
                'Polar region airport properly detected', polarAirport);
        } else {
            addResult('Extreme Coordinates', 'Polar Region Detection', 'FAIL', 
                'Failed to detect polar region airport', polarAirport);
        }
    }

    const nullIslandFlight = flights.find(f => f.flight_id === 'NULL001');
    if (nullIslandFlight) {
        const [destLng, destLat] = nullIslandFlight.destination;
        if (isNullIsland(destLng, destLat)) {
            addResult('Extreme Coordinates', 'Null Island Flight', 'WARN', 
                'Flight to Null Island detected', nullIslandFlight);
        } else {
            addResult('Extreme Coordinates', 'Null Island Flight', 'FAIL', 
                'Failed to detect flight to Null Island', nullIslandFlight);
        }
    }

    // Category 4: Data Integrity Tests
    console.log('\n🔍 Testing Data Integrity...');
    
    const datasetValidation = validateDataset(flights, airports);
    
    if (datasetValidation.flightValidation.invalid > 0) {
        addResult('Data Integrity', 'Invalid Flights Detection', 'PASS', 
            `Detected ${datasetValidation.flightValidation.invalid} invalid flights`, 
            datasetValidation.flightValidation);
    } else {
        addResult('Data Integrity', 'Invalid Flights Detection', 'WARN', 
            'No invalid flights detected in test data');
    }

    if (datasetValidation.airportValidation.invalid > 0) {
        addResult('Data Integrity', 'Invalid Airports Detection', 'PASS', 
            `Detected ${datasetValidation.airportValidation.invalid} invalid airports`, 
            datasetValidation.airportValidation);
    } else {
        addResult('Data Integrity', 'Invalid Airports Detection', 'WARN', 
            'No invalid airports detected in test data');
    }

    // Test empty arrays
    const emptyValidation = validateDataset([], []);
    if (emptyValidation.datasetIssues.includes('Empty flights array') && 
        emptyValidation.datasetIssues.includes('Empty airports array')) {
        addResult('Data Integrity', 'Empty Arrays Detection', 'PASS', 
            'Empty arrays properly detected');
    } else {
        addResult('Data Integrity', 'Empty Arrays Detection', 'FAIL', 
            'Failed to detect empty arrays');
    }

    // Test large dataset warning
    const largeFlights = Array.from({ length: 1001 }, (_, i) => ({
        ...flights[0],
        id: i + 1000,
        flight_id: `LARGE${i}`
    }));
    const largeValidation = validateDataset(largeFlights, airports);
    if (largeValidation.performance.isLargeDataset) {
        addResult('Data Integrity', 'Large Dataset Detection', 'WARN', 
            'Large dataset properly detected and warned about');
    } else {
        addResult('Data Integrity', 'Large Dataset Detection', 'FAIL', 
            'Failed to detect large dataset');
    }

    // Category 5: UI Edge Cases Tests
    console.log('\n🖥️ Testing UI Edge Cases...');
    
    // Test overlapping airports in same city
    const duplicateCityAirports: Airport[] = [
        {
            id: 100,
            name: "Airport 1",
            iata_code: "TEST1",
            city: "Test City",
            country: "Test Country",
            country_code: "TC",
            latitude: 40.0,
            longitude: -74.0,
            has_visited: false,
            visit_count: 0,
            coordinates: [-74.0, 40.0]
        },
        {
            id: 101,
            name: "Airport 2", 
            iata_code: "TEST2",
            city: "Test City",
            country: "Test Country",
            country_code: "TC",
            latitude: 40.1,
            longitude: -74.1,
            has_visited: false,
            visit_count: 0,
            coordinates: [-74.1, 40.1]
        }
    ];

    const overlapValidation = validateDataset(flights, [...airports, ...duplicateCityAirports]);
    if (overlapValidation.datasetIssues.some(issue => issue.includes('Multiple airports'))) {
        addResult('UI Edge Cases', 'Overlapping Airports Detection', 'WARN', 
            'Multiple airports in same city properly detected');
    } else {
        addResult('UI Edge Cases', 'Overlapping Airports Detection', 'FAIL', 
            'Failed to detect multiple airports in same city');
    }

    // Test multiple flights between same airports
    const duplicateRouteFlights = flights.filter(f => 
        f.origin[0] === flights[0].origin[0] && f.origin[1] === flights[0].origin[1] &&
        f.destination[0] === flights[0].destination[0] && f.destination[1] === flights[0].destination[1]
    );
    
    if (duplicateRouteFlights.length > 1) {
        addResult('UI Edge Cases', 'Multiple Same Route Flights', 'WARN', 
            `Found ${duplicateRouteFlights.length} flights on same route - may cause UI overlap`);
    } else {
        addResult('UI Edge Cases', 'Multiple Same Route Flights', 'PASS', 
            'No duplicate route flights detected');
    }

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Warnings: ${warnings}`);

    return {
        summary: { totalTests, passed, failed, warnings },
        results
    };
}

/**
 * Test specific coordinate validation functions
 */
export function testCoordinateValidation(): void {
    console.log('\n🧭 Testing Coordinate Validation Functions...');
    
    // Test valid coordinates
    console.log('Valid coordinates:', isValidCoordinate(-73.7781, 40.6413)); // Should be true
    
    // Test invalid coordinates
    console.log('Invalid longitude:', isValidCoordinate(200, 40)); // Should be false
    console.log('Invalid latitude:', isValidCoordinate(-73, 100)); // Should be false
    console.log('NaN coordinates:', isValidCoordinate(NaN, 40)); // Should be false
    console.log('String coordinates:', isValidCoordinate("invalid" as any, 40)); // Should be false
    
    // Test Null Island
    console.log('Null Island detection:', isNullIsland(0, 0)); // Should be true
    console.log('Non-Null Island:', isNullIsland(-73.7781, 40.6413)); // Should be false
    
    // Test date line crossing
    console.log('Date line crossing (Pacific):', crossesDateLine(-150, 150)); // Should be true
    console.log('No date line crossing:', crossesDateLine(-73, -118)); // Should be false
    
    // Test polar regions
    console.log('North polar region:', isPolarRegion(85)); // Should be true
    console.log('South polar region:', isPolarRegion(-85)); // Should be true
    console.log('Non-polar region:', isPolarRegion(40)); // Should be false
}

/**
 * Run all tests and return formatted results
 */
export function runAllEdgeCaseTests(): {
    validation: ReturnType<typeof runEdgeCaseTests>;
    recommendations: string[];
    criticalIssues: string[];
} {
    console.log('🚀 Starting comprehensive edge case testing...\n');
    
    // Run coordinate validation tests
    testCoordinateValidation();
    
    // Run main edge case tests
    const validation = runEdgeCaseTests();
    
    // Analyze results and generate recommendations
    const recommendations: string[] = [];
    const criticalIssues: string[] = [];
    
    validation.results.forEach(result => {
        if (result.status === 'FAIL') {
            criticalIssues.push(`${result.category}: ${result.test} - ${result.message}`);
        }
    });
    
    // Generate recommendations based on test results
    if (validation.summary.failed > 0) {
        recommendations.push('Implement comprehensive input validation before rendering map components');
    }
    
    if (validation.results.some(r => r.test.includes('Null Island'))) {
        recommendations.push('Add fallback handling for airports/flights with missing coordinate data');
    }
    
    if (validation.results.some(r => r.test.includes('Date Line'))) {
        recommendations.push('Implement special handling for trans-Pacific flights crossing the international date line');
    }
    
    if (validation.results.some(r => r.test.includes('Polar'))) {
        recommendations.push('Consider special projection or zoom constraints for polar region airports');
    }
    
    if (validation.results.some(r => r.test.includes('Large Dataset'))) {
        recommendations.push('Implement data virtualization or clustering for large datasets (>1000 items)');
    }
    
    if (validation.results.some(r => r.test.includes('Overlapping'))) {
        recommendations.push('Implement marker clustering or smart positioning for overlapping airports');
    }
    
    console.log('\n✅ Edge case testing completed!');
    
    return {
        validation,
        recommendations,
        criticalIssues
    };
}