#!/usr/bin/env node

/**
 * Aviation Stack API Test Script
 * 
 * Tests the Aviation Stack API with multiple flight numbers to verify:
 * - API connectivity and authentication
 * - Response format and data structure
 * - Flight number availability
 * - Error handling
 */

import dotenv from 'dotenv';
import { validateEnv, getApiConfig } from './src/lib/env/index.ts';

// Load environment variables
dotenv.config();

const AVIATION_STACK_API_KEY = 'aaa91efc9dcc24641352b31dcde7b60c';
const BASE_URL = 'http://api.aviationstack.com/v1';

// Test flight numbers from major airlines
const TEST_FLIGHTS = [
  { code: 'AA1', airline: 'American Airlines', description: 'American Airlines Flight 1' },
  { code: 'UA1', airline: 'United Airlines', description: 'United Airlines Flight 1' },
  { code: 'DL1', airline: 'Delta Airlines', description: 'Delta Airlines Flight 1' },
  { code: 'BA1', airline: 'British Airways', description: 'British Airways Flight 1' },
  { code: 'LH1', airline: 'Lufthansa', description: 'Lufthansa Flight 1' },
  { code: 'AF1', airline: 'Air France', description: 'Air France Flight 1' },
  { code: 'EK1', airline: 'Emirates', description: 'Emirates Flight 1' },
  { code: 'QF1', airline: 'Qantas', description: 'Qantas Flight 1' }
];

/**
 * Makes HTTP request to Aviation Stack API
 */
async function makeApiRequest(endpoint, params = {}) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  
  // Add API key
  url.searchParams.append('access_key', AVIATION_STACK_API_KEY);
  
  // Add additional parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  console.log(`🔗 Making request to: ${url.toString()}`);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'PersonalWebsite/1.0 (Testing)'
      }
    });

    const data = await response.json();
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data: data,
      headers: Object.fromEntries(response.headers.entries())
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      statusText: 'Network Error',
      error: error.message,
      data: null
    };
  }
}

/**
 * Test API connection and basic functionality
 */
async function testApiConnection() {
  console.log('\n🧪 Testing API Connection...');
  console.log('=' .repeat(50));
  
  try {
    const result = await makeApiRequest('flights', { limit: 1 });
    
    if (result.success) {
      console.log('✅ API connection successful');
      console.log(`📊 Status: ${result.status} ${result.statusText}`);
      console.log(`📈 Rate Limit: ${result.headers['x-ratelimit-remaining'] || 'Unknown'} remaining`);
      console.log(`📊 Response size: ${JSON.stringify(result.data).length} bytes`);
      
      if (result.data.error) {
        console.log(`⚠️  API Error: ${JSON.stringify(result.data.error, null, 2)}`);
      } else {
        console.log(`📝 Total flights available: ${result.data.pagination?.total || 'Unknown'}`);
      }
    } else {
      console.log('❌ API connection failed');
      console.log(`📊 Status: ${result.status} ${result.statusText}`);
      console.log(`📝 Error: ${JSON.stringify(result.data, null, 2)}`);
    }
    
    return result;
  } catch (error) {
    console.log('❌ Connection test failed:', error.message);
    return null;
  }
}

/**
 * Test specific flight number
 */
async function testFlightNumber(flight) {
  console.log(`\n🛩️  Testing ${flight.description} (${flight.code})...`);
  console.log('-'.repeat(50));
  
  try {
    // Try different search methods
    const searchMethods = [
      { name: 'By Flight IATA', params: { flight_iata: flight.code } },
      { name: 'By Flight Number', params: { flight_number: flight.code } },
      { name: 'By Airline + Number', params: { airline_iata: flight.code.substring(0, 2), flight_number: flight.code.substring(2) } }
    ];
    
    for (const method of searchMethods) {
      console.log(`\n  📋 Method: ${method.name}`);
      const result = await makeApiRequest('flights', method.params);
      
      if (result.success && result.data && !result.data.error) {
        const flights = result.data.data || [];
        console.log(`  ✅ Found ${flights.length} flights`);
        
        if (flights.length > 0) {
          const flight = flights[0];
          console.log(`  📍 Route: ${flight.departure?.airport || 'Unknown'} → ${flight.arrival?.airport || 'Unknown'}`);
          console.log(`  🕐 Departure: ${flight.departure?.scheduled || 'Unknown'}`);
          console.log(`  🕑 Arrival: ${flight.arrival?.scheduled || 'Unknown'}`);
          console.log(`  📊 Status: ${flight.flight_status || 'Unknown'}`);
          console.log(`  ✈️  Aircraft: ${flight.aircraft?.registration || 'Unknown'}`);
          
          // Show full object structure for first successful result
          if (method === searchMethods[0]) {
            console.log(`\n  📋 Full flight data structure:`);
            console.log(JSON.stringify(flight, null, 2));
          }
          
          return { success: true, data: flight, method: method.name };
        }
      } else {
        console.log(`  ❌ ${method.name}: ${result.data?.error?.message || 'No data found'}`);
      }
      
      // Small delay between requests to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`  ⚠️  No data found for ${flight.code} using any method`);
    return { success: false, data: null };
    
  } catch (error) {
    console.log(`  ❌ Error testing ${flight.code}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Test API endpoints
 */
async function testApiEndpoints() {
  console.log('\n🔍 Testing API Endpoints...');
  console.log('=' .repeat(50));
  
  const endpoints = [
    { name: 'Airlines', endpoint: 'airlines', params: { limit: 5 } },
    { name: 'Airports', endpoint: 'airports', params: { limit: 5 } },
    { name: 'Aircraft Types', endpoint: 'aircraft', params: { limit: 5 } },
    { name: 'Countries', endpoint: 'countries', params: { limit: 5 } }
  ];
  
  for (const test of endpoints) {
    console.log(`\n📊 Testing ${test.name}...`);
    
    try {
      const result = await makeApiRequest(test.endpoint, test.params);
      
      if (result.success && result.data && !result.data.error) {
        const items = result.data.data || [];
        console.log(`✅ ${test.name}: Found ${items.length} items`);
        
        if (items.length > 0) {
          console.log(`📋 Sample: ${JSON.stringify(items[0], null, 2)}`);
        }
      } else {
        console.log(`❌ ${test.name}: ${result.data?.error?.message || 'Failed'}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} error:`, error.message);
    }
    
    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Test environment configuration
 */
async function testEnvironmentConfig() {
  console.log('\n⚙️  Testing Environment Configuration...');
  console.log('=' .repeat(50));
  
  try {
    // Test environment validation
    const env = validateEnv();
    console.log('✅ Environment validation successful');
    
    // Test API configuration
    const apiConfig = getApiConfig();
    console.log(`📊 Configured Aviation API Key: ${apiConfig.aviationStackApi ? '✅ Present' : '❌ Missing'}`);
    console.log(`📊 Mapbox Token: ${apiConfig.mapboxToken ? '✅ Present' : '❌ Missing'}`);
    
    return true;
  } catch (error) {
    console.log('❌ Environment configuration error:', error.message);
    return false;
  }
}

/**
 * Main test function
 */
async function runTests() {
  console.log('🚀 Aviation Stack API Test Suite');
  console.log('================================');
  console.log(`📅 Started at: ${new Date().toISOString()}`);
  console.log(`🔑 API Key: ${AVIATION_STACK_API_KEY.substring(0, 8)}...`);
  console.log(`🌐 Base URL: ${BASE_URL}`);
  
  const results = {
    connection: null,
    environment: null,
    endpoints: [],
    flights: [],
    summary: {
      total: 0,
      successful: 0,
      failed: 0
    }
  };
  
  // Test environment configuration
  results.environment = await testEnvironmentConfig();
  
  // Test basic API connection
  results.connection = await testApiConnection();
  
  // Test API endpoints
  await testApiEndpoints();
  
  // Test flight numbers
  console.log('\n✈️  Testing Flight Numbers...');
  console.log('=' .repeat(50));
  
  for (const flight of TEST_FLIGHTS) {
    const result = await testFlightNumber(flight);
    results.flights.push({
      flight: flight.code,
      airline: flight.airline,
      success: result.success,
      method: result.method || null,
      error: result.error || null
    });
    
    results.summary.total++;
    if (result.success) {
      results.summary.successful++;
    } else {
      results.summary.failed++;
    }
    
    // Rate limit delay
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Print summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(50));
  console.log(`🔌 Connection: ${results.connection?.success ? '✅ Success' : '❌ Failed'}`);
  console.log(`⚙️  Environment: ${results.environment ? '✅ Valid' : '❌ Invalid'}`);
  console.log(`✈️  Flight Tests: ${results.summary.successful}/${results.summary.total} successful`);
  
  console.log('\n📋 Flight Test Results:');
  results.flights.forEach(flight => {
    const status = flight.success ? '✅' : '❌';
    const method = flight.method ? ` (${flight.method})` : '';
    console.log(`  ${status} ${flight.flight} - ${flight.airline}${method}`);
    if (flight.error) {
      console.log(`    Error: ${flight.error}`);
    }
  });
  
  console.log('\n🎯 Recommendations:');
  if (results.summary.successful === 0) {
    console.log('❌ No flights found - API might be using a free plan with limited access');
    console.log('💡 Consider upgrading to a paid plan for real-time flight data');
    console.log('💡 Test with more recent/active flight numbers');
  } else if (results.summary.successful < results.summary.total / 2) {
    console.log('⚠️  Limited flight data available');
    console.log('💡 Focus on flights that returned data for implementation');
  } else {
    console.log('✅ Good API response rate - proceed with implementation');
  }
  
  if (!results.connection?.success) {
    console.log('❌ Connection issues detected');
    console.log('💡 Check API key and network connectivity');
    console.log('💡 Verify API endpoint URLs');
  }
  
  console.log(`\n🏁 Test completed at: ${new Date().toISOString()}`);
  
  // Save results to file for later analysis
  const fs = await import('fs/promises');
  await fs.writeFile(
    'aviation-api-test-results.json',
    JSON.stringify({
      timestamp: new Date().toISOString(),
      apiKey: `${AVIATION_STACK_API_KEY.substring(0, 8)}...`,
      results
    }, null, 2)
  );
  
  console.log('💾 Results saved to aviation-api-test-results.json');
}

// Run tests if script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

export { runTests, testFlightNumber, testApiConnection };