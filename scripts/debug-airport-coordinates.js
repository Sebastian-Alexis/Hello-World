// Debug script to examine actual airport coordinate values in the database
// This helps identify why the frontend shows [0,0] when migration finds no invalid coordinates
// Run with: node scripts/debug-airport-coordinates.js

import { createClient } from '@libsql/client';

async function debugAirportCoordinates() {
  console.log('🔍 Debugging Airport Coordinates in Database\n');
  
  try {
    // Create client for local development
    const client = createClient({
      url: 'file:local.db'
    });
    
    // 1. First, check if airports table exists and basic structure
    console.log('1. Checking airports table structure...');
    const tableInfo = await client.execute(`
      PRAGMA table_info(airports);
    `);
    
    console.log('Table structure:');
    tableInfo.rows.forEach(row => {
      console.log(`  - ${row.name}: ${row.type} (nullable: ${row.notnull === 0})`);
    });
    
    // 2. Count total airports
    const countResult = await client.execute('SELECT COUNT(*) as total FROM airports');
    const totalAirports = countResult.rows[0].total;
    console.log(`\n2. Total airports in database: ${totalAirports}`);
    
    if (totalAirports === 0) {
      console.log('❌ No airports found! Database is empty.');
      return;
    }
    
    // 3. Check for airports with exactly 0,0 coordinates
    const zeroCoordResults = await client.execute(`
      SELECT 
        id, iata_code, name, city, country,
        latitude, longitude,
        typeof(latitude) as lat_type,
        typeof(longitude) as lng_type
      FROM airports 
      WHERE latitude = 0 AND longitude = 0
    `);
    
    console.log(`\n3. Airports with exactly [0,0] coordinates: ${zeroCoordResults.rows.length}`);
    if (zeroCoordResults.rows.length > 0) {
      console.log('Found airports with [0,0] coordinates:');
      zeroCoordResults.rows.forEach(airport => {
        console.log(`  ❌ ${airport.iata_code}: ${airport.name}, ${airport.city} - [${airport.latitude}, ${airport.longitude}] (types: ${airport.lat_type}, ${airport.lng_type})`);
      });
    }
    
    // 4. Check for null coordinates
    const nullCoordResults = await client.execute(`
      SELECT 
        id, iata_code, name, city, country,
        latitude, longitude,
        typeof(latitude) as lat_type,
        typeof(longitude) as lng_type
      FROM airports 
      WHERE latitude IS NULL OR longitude IS NULL
    `);
    
    console.log(`\n4. Airports with NULL coordinates: ${nullCoordResults.rows.length}`);
    if (nullCoordResults.rows.length > 0) {
      console.log('Found airports with NULL coordinates:');
      nullCoordResults.rows.forEach(airport => {
        console.log(`  ❌ ${airport.iata_code}: ${airport.name}, ${airport.city} - [${airport.latitude}, ${airport.longitude}] (types: ${airport.lat_type}, ${airport.lng_type})`);
      });
    }
    
    // 5. Check coordinate ranges and data types
    const rangeResults = await client.execute(`
      SELECT 
        MIN(latitude) as min_lat,
        MAX(latitude) as max_lat,
        MIN(longitude) as min_lng,
        MAX(longitude) as max_lng,
        AVG(latitude) as avg_lat,
        AVG(longitude) as avg_lng,
        COUNT(DISTINCT typeof(latitude)) as lat_types,
        COUNT(DISTINCT typeof(longitude)) as lng_types
      FROM airports
    `);
    
    const ranges = rangeResults.rows[0];
    console.log('\n5. Coordinate ranges and statistics:');
    console.log(`  Latitude range: ${ranges.min_lat} to ${ranges.max_lat} (avg: ${ranges.avg_lat})`);
    console.log(`  Longitude range: ${ranges.min_lng} to ${ranges.max_lng} (avg: ${ranges.avg_lng})`);
    console.log(`  Data type variations: ${ranges.lat_types} latitude types, ${ranges.lng_types} longitude types`);
    
    // 6. Sample some airports with valid coordinates
    const validSample = await client.execute(`
      SELECT 
        id, iata_code, name, city, country,
        latitude, longitude,
        typeof(latitude) as lat_type,
        typeof(longitude) as lng_type
      FROM airports 
      WHERE latitude != 0 AND longitude != 0 
        AND latitude IS NOT NULL AND longitude IS NOT NULL
      ORDER BY id ASC
      LIMIT 10
    `);
    
    console.log(`\n6. Sample airports with valid coordinates (${validSample.rows.length} shown):`);
    validSample.rows.forEach(airport => {
      console.log(`  ✅ ${airport.iata_code}: ${airport.name}, ${airport.city} - [${airport.latitude}, ${airport.longitude}] (types: ${airport.lat_type}, ${airport.lng_type})`);
    });
    
    // 7. Check specific airports that might be in trips
    const testAirports = ['JFK', 'LAX', 'SFO', 'LHR', 'CDG', 'DXB', 'SIN', 'NRT'];
    console.log('\n7. Checking coordinates for common airports:');
    
    for (const iata of testAirports) {
      const airportResult = await client.execute(`
        SELECT 
          id, iata_code, name, city, country,
          latitude, longitude,
          typeof(latitude) as lat_type,
          typeof(longitude) as lng_type
        FROM airports 
        WHERE iata_code = ?
      `, [iata]);
      
      if (airportResult.rows.length > 0) {
        const airport = airportResult.rows[0];
        const status = (airport.latitude === 0 && airport.longitude === 0) ? '❌' : '✅';
        console.log(`  ${status} ${airport.iata_code}: ${airport.name} - [${airport.latitude}, ${airport.longitude}] (types: ${airport.lat_type}, ${airport.lng_type})`);
      } else {
        console.log(`  ❓ ${iata}: Not found in database`);
      }
    }
    
    // 8. Check if there are any flights and their airport relationships
    const flightsCheck = await client.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='flights'
    `);
    
    if (flightsCheck.rows.length > 0) {
      console.log('\n8. Checking flights table for airport coordinate issues:');
      
      const flightsWithAirports = await client.execute(`
        SELECT DISTINCT
          f.id as flight_id,
          f.flight_number,
          f.departure_airport_id,
          f.arrival_airport_id,
          dep.iata_code as dep_iata,
          dep.latitude as dep_lat,
          dep.longitude as dep_lng,
          arr.iata_code as arr_iata,
          arr.latitude as arr_lat,
          arr.longitude as arr_lng
        FROM flights f
        LEFT JOIN airports dep ON f.departure_airport_id = dep.id
        LEFT JOIN airports arr ON f.arrival_airport_id = arr.id
        LIMIT 5
      `);
      
      if (flightsWithAirports.rows.length > 0) {
        console.log('Sample flights with airport coordinates:');
        flightsWithAirports.rows.forEach(flight => {
          const depStatus = (flight.dep_lat === 0 && flight.dep_lng === 0) ? '❌ [0,0]' : '✅';
          const arrStatus = (flight.arr_lat === 0 && flight.arr_lng === 0) ? '❌ [0,0]' : '✅';
          console.log(`  Flight ${flight.flight_id} (${flight.flight_number}): ${flight.dep_iata} [${flight.dep_lat}, ${flight.dep_lng}] ${depStatus} → ${flight.arr_iata} [${flight.arr_lat}, ${flight.arr_lng}] ${arrStatus}`);
        });
      } else {
        console.log('  No flights found in database');
      }
    } else {
      console.log('\n8. No flights table found');
    }
    
    // 9. Summary and potential issues
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 COORDINATE DEBUG SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    
    const issues = [];
    
    if (zeroCoordResults.rows.length > 0) {
      issues.push(`${zeroCoordResults.rows.length} airports have [0,0] coordinates`);
    }
    
    if (nullCoordResults.rows.length > 0) {
      issues.push(`${nullCoordResults.rows.length} airports have NULL coordinates`);
    }
    
    if (ranges.min_lat === ranges.max_lat && ranges.min_lat === 0) {
      issues.push('All airports have latitude = 0');
    }
    
    if (ranges.min_lng === ranges.max_lng && ranges.min_lng === 0) {
      issues.push('All airports have longitude = 0');
    }
    
    if (issues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      issues.forEach(issue => console.log(`  • ${issue}`));
      
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('  • Run the geocoding migration script to populate coordinates');
      console.log('  • Check if airport data was imported correctly');
      console.log('  • Verify the geocoding service is working');
      console.log('  • Check if flights are using airports with valid coordinates');
    } else {
      console.log('\n✅ No coordinate issues found in airports table!');
      console.log('The frontend [0,0] issue might be:');
      console.log('  • A frontend mapping/display problem');
      console.log('  • Flights using airports that exist but have coordinate issues');
      console.log('  • A data serialization issue in the API');
      console.log('  • Flight data referencing airports not in the database');
      console.log('  • Default coordinates being returned when airports are not found');
      console.log('  • Check the flights table and airport relationships');
    }
    
  } catch (error) {
    console.error('❌ Error debugging airport coordinates:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug script
debugAirportCoordinates().catch(console.error);