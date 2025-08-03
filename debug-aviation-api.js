#!/usr/bin/env node

/**
 * Comprehensive Aviation Stack API Debug Script
 * This script will help you diagnose and fix Aviation Stack API integration issues
 * Run with: node debug-aviation-api.js
 */

const dotenv = require('dotenv');
dotenv.config();

console.log('🔍 Aviation Stack API Integration Debugger\n');

// Step 1: Environment Variable Check
console.log('📋 Step 1: Environment Configuration');
console.log('=====================================');

const apiKey = process.env.AVIATION_STACK_API;
if (!apiKey) {
  console.log('❌ AVIATION_STACK_API is not set in environment variables');
  console.log('💡 Solutions:');
  console.log('   1. Create a .env file in your project root');
  console.log('   2. Add: AVIATION_STACK_API=your_api_key_here');
  console.log('   3. Get your API key from: https://aviationstack.com/');
  process.exit(1);
} else {
  console.log('✅ AVIATION_STACK_API is configured');
  console.log(`   Key length: ${apiKey.length} characters`);
  console.log(`   Key preview: ${apiKey.substring(0, 8)}...`);
}

// Step 2: API Key Validation
console.log('\n📡 Step 2: API Key Validation');
console.log('==============================');

const testApiKey = async () => {
  try {
    const testUrl = `https://api.aviationstack.com/v1/flights?access_key=${apiKey}&limit=1`;
    console.log('Testing API connection...');
    
    const response = await fetch(testUrl);
    console.log(`Response status: ${response.status} ${response.statusText}`);
    
    const data = await response.json();
    
    if (data.error) {
      console.log('❌ API Key Error:', data.error.code);
      console.log('   Message:', data.error.message);
      
      switch (data.error.code) {
        case 'invalid_access_key':
          console.log('💡 Your API key appears to be invalid');
          console.log('   - Double-check the key from your Aviation Stack dashboard');
          console.log('   - Ensure no extra spaces or characters');
          break;
        case 'inactive_user':
          console.log('💡 Your Aviation Stack account is inactive');
          console.log('   - Check your account status at aviationstack.com');
          break;
        case 'usage_limit_reached':
          console.log('💡 You have reached your monthly API limit');
          console.log('   - Check your usage at aviationstack.com/dashboard');
          break;
        case 'rate_limit_reached':
          console.log('💡 You are making requests too quickly');
          console.log('   - Wait a moment and try again');
          break;
      }
      return false;
    } else {
      console.log('✅ API key is valid and working');
      console.log(`   Total flights available: ${data.pagination?.total || 'N/A'}`);
      return true;
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
    console.log('💡 Check your internet connection');
    return false;
  }
};

// Step 3: Flight Search Tests
console.log('\n🛫 Step 3: Flight Search Tests');
console.log('===============================');

const testFlightSearch = async () => {
  const testScenarios = [
    { 
      name: 'Real-time flights (no specific flight)',
      params: { limit: 1 },
      description: 'Tests general API access'
    },
    { 
      name: 'American Airlines flights',
      params: { airline_iata: 'AA', limit: 5 },
      description: 'Tests airline filtering'
    },
    { 
      name: 'Flights from JFK',
      params: { dep_iata: 'JFK', limit: 5 },
      description: 'Tests departure airport filtering'
    },
    { 
      name: 'Active flights only',
      params: { flight_status: 'active', limit: 5 },
      description: 'Tests flight status filtering'
    }
  ];

  for (const scenario of testScenarios) {
    console.log(`\n🔍 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    try {
      const params = new URLSearchParams({
        access_key: apiKey,
        ...scenario.params
      });
      
      const url = `https://api.aviationstack.com/v1/flights?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.error) {
        console.log(`   ❌ Error: ${data.error.code} - ${data.error.message}`);
        if (data.error.code === 'function_access_restricted') {
          console.log('   💡 This feature requires a paid Aviation Stack plan');
        }
      } else {
        const count = data.data?.length || 0;
        console.log(`   ✅ Found ${count} flights`);
        
        if (count > 0) {
          const flight = data.data[0];
          console.log(`   Sample: ${flight.flight?.iata || 'N/A'} - ${flight.airline?.name || 'N/A'}`);
          console.log(`   Route: ${flight.departure?.iata || 'N/A'} → ${flight.arrival?.iata || 'N/A'}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
    }
  }
};

// Step 4: Integration Test
console.log('\n🔧 Step 4: Integration with Your Code');
console.log('=====================================');

const testIntegration = async () => {
  try {
    console.log('Testing your aviationstack.ts integration...');
    
    // Try to import and test your functions
    const { fetchFlightByIata } = require('./src/lib/api/aviationstack.ts');
    
    console.log('✅ Successfully imported aviationstack module');
    
    // Test with a common flight
    const testFlight = 'AA100';
    console.log(`Testing fetchFlightByIata with: ${testFlight}`);
    
    const result = await fetchFlightByIata(testFlight);
    
    if (result) {
      console.log('✅ Integration test successful!');
      console.log(`   Found flight: ${result.flight.iata}`);
      console.log(`   Airline: ${result.airline.name}`);
    } else {
      console.log('⚠️  Integration works but no flight data found');
      console.log('   This is normal if the test flight is not currently scheduled');
    }
  } catch (error) {
    console.log('❌ Integration test failed:', error.message);
    console.log('💡 This could be due to:');
    console.log('   - TypeScript compilation issues');
    console.log('   - Missing dependencies');
    console.log('   - Environment configuration problems');
  }
};

// Step 5: Plan Information
console.log('\n📊 Step 5: Plan Limitations Check');
console.log('==================================');

const checkPlanLimitations = () => {
  console.log('Aviation Stack API Plan Features:');
  console.log('');
  console.log('FREE PLAN:');
  console.log('✅ Real-time flight data');
  console.log('✅ Flight search by IATA/ICAO');
  console.log('✅ 1,000 requests/month');
  console.log('❌ Historical flight data (flight_date parameter)');
  console.log('❌ HTTPS access');
  console.log('❌ Advanced filtering');
  console.log('');
  console.log('PAID PLANS:');
  console.log('✅ All free features');
  console.log('✅ Historical data access');
  console.log('✅ HTTPS encryption');
  console.log('✅ Higher rate limits');
  console.log('✅ Advanced search parameters');
  console.log('');
  console.log('💡 If you get "function_access_restricted" errors,');
  console.log('   consider upgrading to a paid plan at aviationstack.com');
};

// Run all tests
const runAllTests = async () => {
  const apiValid = await testApiKey();
  
  if (apiValid) {
    await testFlightSearch();
    await testIntegration();
  }
  
  checkPlanLimitations();
  
  console.log('\n✨ Debug session completed!');
  console.log('');
  console.log('🎯 Summary & Next Steps:');
  console.log('========================');
  
  if (!apiValid) {
    console.log('❌ Primary Issue: API key is invalid or account has issues');
    console.log('   → Fix your API key configuration first');
  } else {
    console.log('✅ API key is working correctly');
    console.log('   → Your integration should work for supported features');
  }
  
  console.log('');
  console.log('📚 Useful Resources:');
  console.log('   - Aviation Stack Dashboard: https://aviationstack.com/dashboard');
  console.log('   - API Documentation: https://aviationstack.com/documentation');
  console.log('   - Support: https://aviationstack.com/contact');
};

// Execute
runAllTests().catch(console.error);