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

// Test API endpoint
const testFlightData = async () => {
  console.log('\n📡 Testing aviationstack API...');
  
  const testFlightNumber = 'AA100'; // American Airlines flight 100
  const apiKey = process.env.AVIATION_STACK_API;
  
  try {
    const response = await fetch(
      `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${testFlightNumber}&limit=1`
    );
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'API error');
    }
    
    if (data.data && data.data.length > 0) {
      console.log('✅ API connection successful!');
      console.log('Found flight:', data.data[0].flight.iata);
      console.log('Airline:', data.data[0].airline.name);
    } else {
      console.log('⚠️  API connected but no flights found for', testFlightNumber);
    }
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
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