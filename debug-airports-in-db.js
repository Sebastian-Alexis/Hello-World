// Debug script to check what airports are in the database
// Run this with: node debug-airports-in-db.js

import { db } from './src/lib/db/queries.js';

async function checkAirportsInDatabase() {
  console.log('🏢 Checking airports in database...\n');
  
  try {
    // Get all airports
    const allAirports = await db.searchAirports(undefined, 500);
    console.log(`Total airports in database: ${allAirports.length}`);
    
    if (allAirports.length === 0) {
      console.log('❌ No airports found in database!');
      console.log('This explains why autofill is not working.');
      return;
    }
    
    // Check for specific airports that appear in our test flights
    const testAirports = ['JFK', 'LAX', 'SFO', 'SIN', 'LHR', 'DXB', 'CDG'];
    
    console.log('\n🔍 Looking for test flight airports:');
    for (const iata of testAirports) {
      const found = allAirports.find(airport => airport.iata_code === iata);
      if (found) {
        console.log(`✅ ${iata}: ${found.name}, ${found.city} (ID: ${found.id})`);
      } else {
        console.log(`❌ ${iata}: Not found in database`);
      }
    }
    
    // Show first 10 airports as sample
    console.log('\n📋 First 10 airports in database:');
    allAirports.slice(0, 10).forEach(airport => {
      console.log(`- ${airport.iata_code}: ${airport.name}, ${airport.city}, ${airport.country} (ID: ${airport.id})`);
    });
    
    // Test the specific search that the client-side code does
    console.log('\n🔧 Testing client-side airport lookup logic:');
    
    // This simulates what happens in the form when API returns flight data
    const testFlightData = {
      departure_iata: 'JFK',
      arrival_iata: 'LAX'
    };
    
    console.log(`Looking for departure airport: ${testFlightData.departure_iata}`);
    const depAirport = allAirports.find(a => a.iata_code === testFlightData.departure_iata);
    if (depAirport) {
      console.log(`✅ Found: ${depAirport.iata_code} - ${depAirport.name}, ${depAirport.city}`);
      console.log(`Expected form value: "${testFlightData.departure_iata} - ${depAirport.name}, ${depAirport.city}"`);
    } else {
      console.log(`❌ Not found in database`);
    }
    
    console.log(`Looking for arrival airport: ${testFlightData.arrival_iata}`);
    const arrAirport = allAirports.find(a => a.iata_code === testFlightData.arrival_iata);
    if (arrAirport) {
      console.log(`✅ Found: ${arrAirport.iata_code} - ${arrAirport.name}, ${arrAirport.city}`);
      console.log(`Expected form value: "${testFlightData.arrival_iata} - ${arrAirport.name}, ${arrAirport.city}"`);
    } else {
      console.log(`❌ Not found in database`);
    }
    
  } catch (error) {
    console.error('Error accessing database:', error);
  }
}

checkAirportsInDatabase();