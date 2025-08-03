#!/usr/bin/env node

/**
 * Aviation Stack API - Correct Usage Examples
 * Based on official API documentation from aviationstack.com
 * 
 * Run with: node aviation-api-examples.js
 */

const dotenv = require('dotenv');
dotenv.config();

const API_KEY = process.env.AVIATION_STACK_API;
const BASE_URL = 'https://api.aviationstack.com/v1';

if (!API_KEY) {
  console.error('❌ Please set AVIATION_STACK_API in your .env file');
  process.exit(1);
}

console.log('📚 Aviation Stack API - Correct Usage Examples\n');

// Example 1: Basic Flight Search (Real-time)
const example1_basicFlightSearch = async () => {
  console.log('📡 Example 1: Basic Real-time Flight Search');
  console.log('===========================================');
  
  const url = `${BASE_URL}/flights?access_key=${API_KEY}&limit=5`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.log('❌ Error:', data.error.message);
      return;
    }
    
    console.log(`✅ Found ${data.data?.length || 0} flights`);
    console.log(`   Total available: ${data.pagination?.total || 'N/A'}`);
    
    if (data.data && data.data.length > 0) {
      const flight = data.data[0];
      console.log('   Sample flight:');
      console.log(`   - Flight: ${flight.flight?.iata || 'N/A'}`);
      console.log(`   - Airline: ${flight.airline?.name || 'N/A'}`);
      console.log(`   - Route: ${flight.departure?.iata || 'N/A'} → ${flight.arrival?.iata || 'N/A'}`);
      console.log(`   - Status: ${flight.flight_status || 'N/A'}`);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  console.log();
};

// Example 2: Search by Flight IATA Code
const example2_searchByFlightIata = async () => {
  console.log('🔍 Example 2: Search by Flight IATA Code');
  console.log('=========================================');
  
  const flightCodes = ['AA100', 'UA1', 'DL1', 'BA1'];
  
  for (const flightCode of flightCodes) {
    console.log(`\nSearching for flight: ${flightCode}`);
    
    const url = `${BASE_URL}/flights?access_key=${API_KEY}&flight_iata=${flightCode}&limit=1`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.log(`   ❌ Error: ${data.error.message}`);
        continue;
      }
      
      if (data.data && data.data.length > 0) {
        const flight = data.data[0];
        console.log(`   ✅ Found: ${flight.flight.iata}`);
        console.log(`   Airline: ${flight.airline.name}`);
        console.log(`   Route: ${flight.departure.iata} → ${flight.arrival.iata}`);
        console.log(`   Status: ${flight.flight_status}`);
        console.log(`   Date: ${flight.flight_date}`);
      } else {
        console.log(`   ⚠️  No active flights found for ${flightCode}`);
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log();
};

// Example 3: Search by Airline
const example3_searchByAirline = async () => {
  console.log('✈️  Example 3: Search by Airline');
  console.log('=================================');
  
  const airlines = [
    { iata: 'AA', name: 'American Airlines' },
    { iata: 'UA', name: 'United Airlines' },
    { iata: 'DL', name: 'Delta Air Lines' }
  ];
  
  for (const airline of airlines) {
    console.log(`\nSearching for ${airline.name} (${airline.iata}) flights:`);
    
    const url = `${BASE_URL}/flights?access_key=${API_KEY}&airline_iata=${airline.iata}&limit=3`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.log(`   ❌ Error: ${data.error.message}`);
        if (data.error.code === 'function_access_restricted') {
          console.log('   💡 This feature requires a paid Aviation Stack plan');
        }
        continue;
      }
      
      const count = data.data?.length || 0;
      console.log(`   ✅ Found ${count} flights`);
      
      if (count > 0) {
        data.data.forEach((flight, index) => {
          console.log(`   ${index + 1}. ${flight.flight.iata}: ${flight.departure.iata} → ${flight.arrival.iata} (${flight.flight_status})`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log();
};

// Example 4: Search by Airport (Departure)
const example4_searchByAirport = async () => {
  console.log('🏢 Example 4: Search by Departure Airport');
  console.log('==========================================');
  
  const airports = [
    { iata: 'JFK', name: 'John F. Kennedy International' },
    { iata: 'LAX', name: 'Los Angeles International' },
    { iata: 'ORD', name: 'Chicago O\'Hare International' }
  ];
  
  for (const airport of airports) {
    console.log(`\nSearching for departures from ${airport.name} (${airport.iata}):`);
    
    const url = `${BASE_URL}/flights?access_key=${API_KEY}&dep_iata=${airport.iata}&limit=3`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.log(`   ❌ Error: ${data.error.message}`);
        if (data.error.code === 'function_access_restricted') {
          console.log('   💡 This feature requires a paid Aviation Stack plan');
        }
        continue;
      }
      
      const count = data.data?.length || 0;
      console.log(`   ✅ Found ${count} departing flights`);
      
      if (count > 0) {
        data.data.forEach((flight, index) => {
          console.log(`   ${index + 1}. ${flight.flight.iata} (${flight.airline.name}): ${flight.departure.iata} → ${flight.arrival.iata} at ${flight.departure.scheduled || 'N/A'}`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log();
};

// Example 5: Search by Flight Status
const example5_searchByStatus = async () => {
  console.log('📊 Example 5: Search by Flight Status');
  console.log('======================================');
  
  const statuses = ['active', 'scheduled', 'landed'];
  
  for (const status of statuses) {
    console.log(`\nSearching for ${status} flights:`);
    
    const url = `${BASE_URL}/flights?access_key=${API_KEY}&flight_status=${status}&limit=3`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.log(`   ❌ Error: ${data.error.message}`);
        if (data.error.code === 'function_access_restricted') {
          console.log('   💡 This feature requires a paid Aviation Stack plan');
        }
        continue;
      }
      
      const count = data.data?.length || 0;
      console.log(`   ✅ Found ${count} ${status} flights`);
      
      if (count > 0) {
        data.data.forEach((flight, index) => {
          console.log(`   ${index + 1}. ${flight.flight.iata}: ${flight.departure.iata} → ${flight.arrival.iata} (${flight.flight_status})`);
        });
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
  
  console.log();
};

// Example 6: Historical Data (Paid Plans Only)
const example6_historicalData = async () => {
  console.log('📅 Example 6: Historical Flight Data (Paid Plans)');
  console.log('==================================================');
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD format
  
  console.log(`Searching for historical flights on ${dateStr}:`);
  
  const url = `${BASE_URL}/flights?access_key=${API_KEY}&flight_date=${dateStr}&limit=3`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ Error: ${data.error.message}`);
      if (data.error.code === 'function_access_restricted') {
        console.log('💡 Historical data requires a paid plan (Basic or higher)');
        console.log('   Free plan only supports real-time and live flight data');
      }
      return;
    }
    
    const count = data.data?.length || 0;
    console.log(`✅ Found ${count} historical flights`);
    
    if (count > 0) {
      data.data.forEach((flight, index) => {
        console.log(`${index + 1}. ${flight.flight.iata} (${flight.airline.name}): ${flight.departure.iata} → ${flight.arrival.iata}`);
      });
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
  
  console.log();
};

// Example 7: Combined Parameters
const example7_combinedSearch = async () => {
  console.log('🎯 Example 7: Combined Parameter Search');
  console.log('========================================');
  
  console.log('Searching for active American Airlines flights from JFK:');
  
  const url = `${BASE_URL}/flights?access_key=${API_KEY}&airline_iata=AA&dep_iata=JFK&flight_status=active&limit=5`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.error) {
      console.log(`❌ Error: ${data.error.message}`);
      if (data.error.code === 'function_access_restricted') {
        console.log('💡 Advanced filtering requires a paid plan');
      }
      return;
    }
    
    const count = data.data?.length || 0;
    console.log(`✅ Found ${count} matching flights`);
    
    if (count > 0) {
      data.data.forEach((flight, index) => {
        console.log(`${index + 1}. ${flight.flight.iata}: ${flight.departure.iata} → ${flight.arrival.iata}`);
        console.log(`    Departure: ${flight.departure.scheduled || 'N/A'}`);
        console.log(`    Status: ${flight.flight_status}`);
      });
    } else {
      console.log('   This is normal - specific combinations may not have active flights at this moment');
    }
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
  }
  
  console.log();
};

// Run all examples
const runAllExamples = async () => {
  console.log('🚀 Starting Aviation Stack API Examples\n');
  
  await example1_basicFlightSearch();
  await example2_searchByFlightIata();
  await example3_searchByAirline();
  await example4_searchByAirport();
  await example5_searchByStatus();
  await example6_historicalData();
  await example7_combinedSearch();
  
  console.log('📚 Key Takeaways:');
  console.log('==================');
  console.log('✅ Always include access_key parameter');
  console.log('✅ Use proper IATA codes (AA100, not aa100)');
  console.log('✅ Handle both success and error responses');
  console.log('✅ Check for data.error before accessing data.data');
  console.log('✅ Free plan supports basic flight searches');
  console.log('✅ Paid plans unlock historical data and advanced filtering');
  console.log('');
  console.log('🔗 Useful Links:');
  console.log('   - API Documentation: https://aviationstack.com/documentation');
  console.log('   - Account Dashboard: https://aviationstack.com/dashboard');
  console.log('   - Upgrade Plans: https://aviationstack.com/product');
};

// Execute all examples
runAllExamples().catch(console.error);