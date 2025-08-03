#!/usr/bin/env node

/**
 * Test script for flight API integration
 * Run with: node test-flight-api.js
 */

// Test environment variable
if (!process.env.AVIATION_STACK_API) {
  console.error('❌ AVIATION_STACK_API environment variable is not set');
  console.log('Please add AVIATION_STACK_API=your_api_key to your .env file');
  process.exit(1);
} else {
  console.log('✅ AVIATION_STACK_API environment variable is set');
}

// Test API endpoint with multiple scenarios
const testFlightData = async () => {
  console.log('\n📡 Testing aviationstack API...');
  
  const apiKey = process.env.AVIATION_STACK_API;
  const testFlights = ['AA100', 'UA1', 'DL1'];
  
  for (const testFlightNumber of testFlights) {
    console.log(`\n🔍 Testing flight: ${testFlightNumber}`);
    
    try {
      const url = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${testFlightNumber}&limit=1`;
      console.log('   Request URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
      
      const response = await fetch(url);
      
      console.log('   Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('   Error response:', errorText);
        continue;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.log('   API Error:', data.error.code, '-', data.error.message);
        
        // Provide specific guidance based on error
        switch (data.error.code) {
          case 'invalid_access_key':
            console.log('   💡 Solution: Check that your API key is correct');
            break;
          case 'missing_access_key':
            console.log('   💡 Solution: Ensure AVIATION_STACK_API is set in .env file');
            break;
          case 'function_access_restricted':
            console.log('   💡 Solution: This feature requires a paid Aviation Stack plan');
            break;
          case 'usage_limit_reached':
            console.log('   💡 Solution: You have reached your monthly API limit');
            break;
          case 'rate_limit_reached':
            console.log('   💡 Solution: You are making requests too quickly');
            break;
        }
        continue;
      }
      
      if (data.data && data.data.length > 0) {
        const flight = data.data[0];
        console.log('   ✅ Flight found!');
        console.log('   Flight:', flight.flight.iata);
        console.log('   Airline:', flight.airline.name);
        console.log('   Route:', `${flight.departure.iata} → ${flight.arrival.iata}`);
        console.log('   Status:', flight.flight_status);
        console.log('   Date:', flight.flight_date);
        
        // Test successful - break early
        console.log('\n✅ API connection fully verified!');
        return;
      } else {
        console.log(`   ⚠️  No flights found for ${testFlightNumber}`);
      }
    } catch (error) {
      console.log('   ❌ Request failed:', error.message);
    }
  }
  
  console.log('\n⚠️  API tests completed but no successful flight data retrieved');
  console.log('This could be normal if the test flights are not currently scheduled');
};

// Test database connection
const testDatabaseTables = async () => {
  console.log('\n🗄️  Testing database tables...');
  
  try {
    const { createClient } = require('@libsql/client');
    const dotenv = require('dotenv');
    dotenv.config();
    
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    
    // Test flights table
    const flightsResult = await client.execute('SELECT COUNT(*) as count FROM flights');
    console.log('✅ Flights table exists with', flightsResult.rows[0].count, 'records');
    
    // Test trips table
    const tripsResult = await client.execute('SELECT COUNT(*) as count FROM trips');
    console.log('✅ Trips table exists with', tripsResult.rows[0].count, 'records');
    
    // Test airports table
    const airportsResult = await client.execute('SELECT COUNT(*) as count FROM airports');
    console.log('✅ Airports table exists with', airportsResult.rows[0].count, 'records');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    console.log('Make sure your Turso database credentials are correctly set in .env');
  }
};

// Run tests
console.log('🚀 Starting Flight API Integration Tests\n');

(async () => {
  await testFlightData();
  await testDatabaseTables();
  console.log('\n✨ Tests completed!');
})();