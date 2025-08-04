// Debug script to check if flights reference airports that don't exist in the airports table
// This helps identify why the frontend shows airports with [0,0] coordinates
// Run with: node scripts/check-flight-airport-references.js

import { createClient } from '@libsql/client';

async function checkFlightAirportReferences() {
  console.log('🔍 Checking Flight Airport References\n');
  
  try {
    // Create client for local development
    const client = createClient({
      url: 'file:local.db'
    });
    
    // 1. Check if required tables exist
    console.log('1. Checking table existence...');
    const flightsTableCheck = await client.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='flights'
    `);
    
    const airportsTableCheck = await client.execute(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='airports'
    `);
    
    if (flightsTableCheck.rows.length === 0) {
      console.log('❌ Flights table not found!');
      return;
    }
    
    if (airportsTableCheck.rows.length === 0) {
      console.log('❌ Airports table not found!');
      return;
    }
    
    console.log('✅ Both flights and airports tables exist');
    
    // 2. Count total flights and airports
    const flightCount = await client.execute('SELECT COUNT(*) as total FROM flights');
    const airportCount = await client.execute('SELECT COUNT(*) as total FROM airports');
    
    console.log(`\n2. Database counts:`);
    console.log(`   Total flights: ${flightCount.rows[0].total}`);
    console.log(`   Total airports: ${airportCount.rows[0].total}`);
    
    if (flightCount.rows[0].total === 0) {
      console.log('❌ No flights found! Nothing to check.');
      return;
    }
    
    // 3. Get all unique airport IDs used in flights
    console.log('\n3. Analyzing airport IDs referenced by flights...');
    
    const flightAirportIds = await client.execute(`
      SELECT DISTINCT 
        departure_airport_id,
        arrival_airport_id
      FROM flights
      WHERE departure_airport_id IS NOT NULL 
        AND arrival_airport_id IS NOT NULL
    `);
    
    // Extract unique airport IDs
    const referencedAirportIds = new Set();
    flightAirportIds.rows.forEach(row => {
      if (row.departure_airport_id) referencedAirportIds.add(row.departure_airport_id);
      if (row.arrival_airport_id) referencedAirportIds.add(row.arrival_airport_id);
    });
    
    console.log(`   Flights reference ${referencedAirportIds.size} unique airport IDs`);
    
    // 4. Check which referenced airport IDs don't exist in airports table
    console.log('\n4. Checking for missing airports...');
    
    const missingAirportIds = [];
    const existingAirportIds = [];
    
    for (const airportId of referencedAirportIds) {
      const airportCheck = await client.execute(`
        SELECT id, iata_code, name, city, latitude, longitude 
        FROM airports 
        WHERE id = ?
      `, [airportId]);
      
      if (airportCheck.rows.length === 0) {
        missingAirportIds.push(airportId);
      } else {
        existingAirportIds.push({
          id: airportId,
          ...airportCheck.rows[0]
        });
      }
    }
    
    console.log(`   Missing airports: ${missingAirportIds.length}`);
    console.log(`   Existing airports: ${existingAirportIds.length}`);
    
    // 5. Show missing airport details
    if (missingAirportIds.length > 0) {
      console.log('\n5. ❌ MISSING AIRPORTS DETAILS:');
      console.log('   The following airport IDs are referenced by flights but don\'t exist in airports table:');
      
      for (const missingId of missingAirportIds) {
        // Find flights that reference this missing airport
        const flightsUsingMissing = await client.execute(`
          SELECT 
            id, 
            flight_number, 
            airline_name,
            departure_airport_id,
            arrival_airport_id,
            departure_time,
            CASE 
              WHEN departure_airport_id = ? THEN 'departure'
              WHEN arrival_airport_id = ? THEN 'arrival'
              ELSE 'both'
            END as reference_type
          FROM flights 
          WHERE departure_airport_id = ? OR arrival_airport_id = ?
          ORDER BY departure_time DESC
          LIMIT 5
        `, [missingId, missingId, missingId, missingId]);
        
        console.log(`\n   Airport ID ${missingId}:`);
        console.log(`     Referenced by ${flightsUsingMissing.rows.length} flight(s)`);
        
        flightsUsingMissing.rows.forEach(flight => {
          console.log(`     • Flight ${flight.id} (${flight.flight_number || 'N/A'} - ${flight.airline_name || 'N/A'})`);
          console.log(`       Used as: ${flight.reference_type}`);
          console.log(`       Date: ${flight.departure_time}`);
          console.log(`       Dep ID: ${flight.departure_airport_id}, Arr ID: ${flight.arrival_airport_id}`);
        });
      }
    }
    
    // 6. Check existing airports for coordinate issues
    console.log('\n6. Checking existing airports for coordinate issues...');
    
    const airportsWithIssues = [];
    const validAirports = [];
    
    existingAirportIds.forEach(airport => {
      if (airport.latitude === 0 && airport.longitude === 0) {
        airportsWithIssues.push(airport);
      } else if (airport.latitude === null || airport.longitude === null) {
        airportsWithIssues.push(airport);
      } else {
        validAirports.push(airport);
      }
    });
    
    console.log(`   Airports with coordinate issues: ${airportsWithIssues.length}`);
    console.log(`   Airports with valid coordinates: ${validAirports.length}`);
    
    if (airportsWithIssues.length > 0) {
      console.log('\n   ⚠️ AIRPORTS WITH COORDINATE ISSUES:');
      airportsWithIssues.forEach(airport => {
        console.log(`     • ${airport.iata_code}: ${airport.name} (${airport.city})`);
        console.log(`       Coordinates: [${airport.latitude}, ${airport.longitude}]`);
        console.log(`       ID: ${airport.id}`);
      });
    }
    
    // 7. Show sample flights with complete airport information
    console.log('\n7. Sample flights with airport coordinate status:');
    
    const sampleFlights = await client.execute(`
      SELECT 
        f.id,
        f.flight_number,
        f.airline_name,
        f.departure_time,
        f.departure_airport_id,
        f.arrival_airport_id,
        dep.iata_code as dep_iata,
        dep.name as dep_name,
        dep.latitude as dep_lat,
        dep.longitude as dep_lng,
        arr.iata_code as arr_iata,
        arr.name as arr_name,
        arr.latitude as arr_lat,
        arr.longitude as arr_lng
      FROM flights f
      LEFT JOIN airports dep ON f.departure_airport_id = dep.id
      LEFT JOIN airports arr ON f.arrival_airport_id = arr.id
      ORDER BY f.departure_time DESC
      LIMIT 10
    `);
    
    if (sampleFlights.rows.length > 0) {
      sampleFlights.rows.forEach(flight => {
        console.log(`\n   Flight ${flight.id} (${flight.flight_number || 'N/A'}):`);
        
        // Departure airport status
        if (!flight.dep_iata) {
          console.log(`     ❌ Departure: Airport ID ${flight.departure_airport_id} NOT FOUND`);
        } else if (flight.dep_lat === 0 && flight.dep_lng === 0) {
          console.log(`     ⚠️ Departure: ${flight.dep_iata} (${flight.dep_name}) - [0,0] coordinates`);
        } else if (flight.dep_lat === null || flight.dep_lng === null) {
          console.log(`     ⚠️ Departure: ${flight.dep_iata} (${flight.dep_name}) - NULL coordinates`);
        } else {
          console.log(`     ✅ Departure: ${flight.dep_iata} (${flight.dep_name}) - [${flight.dep_lat}, ${flight.dep_lng}]`);
        }
        
        // Arrival airport status
        if (!flight.arr_iata) {
          console.log(`     ❌ Arrival: Airport ID ${flight.arrival_airport_id} NOT FOUND`);
        } else if (flight.arr_lat === 0 && flight.arr_lng === 0) {
          console.log(`     ⚠️ Arrival: ${flight.arr_iata} (${flight.arr_name}) - [0,0] coordinates`);
        } else if (flight.arr_lat === null || flight.arr_lng === null) {
          console.log(`     ⚠️ Arrival: ${flight.arr_iata} (${flight.arr_name}) - NULL coordinates`);
        } else {
          console.log(`     ✅ Arrival: ${flight.arr_iata} (${flight.arr_name}) - [${flight.arr_lat}, ${flight.arr_lng}]`);
        }
      });
    } else {
      console.log('   No flights found to analyze');
    }
    
    // 8. Check for flights with NULL airport references
    console.log('\n8. Checking for flights with NULL airport references...');
    
    const nullReferenceFlights = await client.execute(`
      SELECT 
        id, 
        flight_number, 
        airline_name,
        departure_airport_id,
        arrival_airport_id,
        departure_time
      FROM flights 
      WHERE departure_airport_id IS NULL 
         OR arrival_airport_id IS NULL
      LIMIT 10
    `);
    
    if (nullReferenceFlights.rows.length > 0) {
      console.log(`   Found ${nullReferenceFlights.rows.length} flights with NULL airport references:`);
      nullReferenceFlights.rows.forEach(flight => {
        console.log(`     • Flight ${flight.id} (${flight.flight_number || 'N/A'})`);
        console.log(`       Dep ID: ${flight.departure_airport_id || 'NULL'}, Arr ID: ${flight.arrival_airport_id || 'NULL'}`);
      });
    } else {
      console.log('   ✅ No flights with NULL airport references found');
    }
    
    // 9. Summary and recommendations
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 FLIGHT AIRPORT REFERENCE ANALYSIS SUMMARY');
    console.log('═══════════════════════════════════════════════════');
    
    const issues = [];
    
    if (missingAirportIds.length > 0) {
      issues.push(`${missingAirportIds.length} airport IDs referenced by flights don't exist in airports table`);
    }
    
    if (airportsWithIssues.length > 0) {
      issues.push(`${airportsWithIssues.length} airports have [0,0] or NULL coordinates`);
    }
    
    if (nullReferenceFlights.rows.length > 0) {
      issues.push(`${nullReferenceFlights.rows.length} flights have NULL airport references`);
    }
    
    if (issues.length > 0) {
      console.log('\n❌ ISSUES FOUND:');
      issues.forEach(issue => console.log(`  • ${issue}`));
      
      console.log('\n💡 RECOMMENDATIONS:');
      
      if (missingAirportIds.length > 0) {
        console.log('  • Fix missing airport references:');
        console.log('    - Add missing airports to the airports table');
        console.log('    - Update flight records to use correct airport IDs');
        console.log('    - Check flight import/creation process');
      }
      
      if (airportsWithIssues.length > 0) {
        console.log('  • Fix coordinate issues:');
        console.log('    - Run geocoding migration to populate coordinates');
        console.log('    - Verify geocoding service is working correctly');
        console.log('    - Check airport data import process');
      }
      
      if (nullReferenceFlights.rows.length > 0) {
        console.log('  • Fix NULL references:');
        console.log('    - Update flights to reference valid airports');
        console.log('    - Add validation to prevent NULL airport references');
      }
      
      console.log('\n🎯 ROOT CAUSE ANALYSIS:');
      console.log('  The frontend shows [0,0] coordinates because:');
      
      if (missingAirportIds.length > 0) {
        console.log('    - Flights reference airports that don\'t exist');
        console.log('    - Frontend likely creates default airports with [0,0] coordinates');
      }
      
      if (airportsWithIssues.length > 0) {
        console.log('    - Existing airports have invalid coordinates');
        console.log('    - These airports need proper geocoding');
      }
      
    } else {
      console.log('\n✅ NO REFERENCE ISSUES FOUND!');
      console.log('All flights reference valid airports with proper coordinates.');
      console.log('The [0,0] coordinate issue might be:');
      console.log('  • A frontend mapping/display problem');
      console.log('  • Data serialization issue in the API');
      console.log('  • Flight component not properly handling airport data');
      console.log('  • Check the frontend flight map component');
    }
    
    console.log('\n📈 STATISTICS:');
    console.log(`  • Total flights: ${flightCount.rows[0].total}`);
    console.log(`  • Total airports: ${airportCount.rows[0].total}`);
    console.log(`  • Unique airports referenced by flights: ${referencedAirportIds.size}`);
    console.log(`  • Missing airport references: ${missingAirportIds.length}`);
    console.log(`  • Airports with coordinate issues: ${airportsWithIssues.length}`);
    console.log(`  • Valid airports with coordinates: ${validAirports.length}`);
    
  } catch (error) {
    console.error('❌ Error checking flight airport references:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the debug script
checkFlightAirportReferences().catch(console.error);