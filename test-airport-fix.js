#!/usr/bin/env node

/**
 * Test script for the airport ID fix implementation
 * Tests the new airport creation and lookup functionality
 */

const baseUrl = process.env.BASE_URL || 'http://localhost:4321';

console.log('🧪 Testing Airport Fix Implementation');
console.log('=====================================');

// Test data - using real flight data that should work
const testTripData = {
  name: 'Test Trip - Airport Fix',
  start_date: '2024-01-15',
  end_date: '2024-01-16',
  flights: [
    {
      flight_number: 'AA1',
      airline_name: 'American Airlines',
      airline_code: 'AA',
      aircraft_type: 'Boeing 737',
      departure_time: '2024-01-15T08:00:00',
      arrival_time: '2024-01-15T11:30:00',
      seat_number: '12A',
      // Using IATA codes and names instead of IDs
      departure_iata: 'JFK',
      departure_airport_name: 'John F. Kennedy International Airport',
      departure_city: 'New York',
      departure_country: 'United States',
      arrival_iata: 'LAX',
      arrival_airport_name: 'Los Angeles International Airport',
      arrival_city: 'Los Angeles',
      arrival_country: 'United States'
    }
  ]
};

async function testAirportLookup() {
  console.log('\n🔍 Testing airport lookup API...');
  
  try {
    const response = await fetch(`${baseUrl}/api/airports/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        iata_code: 'JFK',
        name: 'John F. Kennedy International Airport',
        city: 'New York',
        country: 'United States'
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Airport lookup successful');
      console.log(`   Airport ID: ${result.data.id}`);
      console.log(`   Created: ${result.created}`);
      console.log(`   Coordinates: ${result.data.latitude}, ${result.data.longitude}`);
      return true;
    } else {
      console.log('❌ Airport lookup failed:', result.error);
      return false;
    }
  } catch (error) {
    console.log('❌ Airport lookup error:', error.message);
    return false;
  }
}

async function testFlightCreation() {
  console.log('\n✈️ Testing flight trip creation with IATA codes...');
  
  try {
    const response = await fetch(`${baseUrl}/api/flights/trips`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This would normally require authentication
        // For testing, you might need to disable auth temporarily
      },
      body: JSON.stringify(testTripData)
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Flight trip creation successful');
      console.log(`   Trip ID: ${result.data.id}`);
      console.log(`   Flights created: ${result.data.flights_created}`);
      return true;
    } else {
      console.log('❌ Flight trip creation failed:', result.error);
      if (response.status === 401) {
        console.log('   (Authentication required - expected in production)');
      }
      return false;
    }
  } catch (error) {
    console.log('❌ Flight trip creation error:', error.message);
    return false;
  }
}

async function runTests() {
  console.log(`Testing against: ${baseUrl}`);
  
  const lookupSuccess = await testAirportLookup();
  const flightSuccess = await testFlightCreation();
  
  console.log('\n📊 Test Results:');
  console.log('================');
  console.log(`Airport Lookup: ${lookupSuccess ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Flight Creation: ${flightSuccess ? '✅ PASS' : '❌ FAIL'}`);
  
  if (lookupSuccess && flightSuccess) {
    console.log('\n🎉 All tests passed! Airport fix implementation is working.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the implementation.');
  }
  
  console.log('\n📝 Key Improvements Implemented:');
  console.log('  • Airport creation with IATA codes and names');
  console.log('  • Geocoding integration for proper coordinates');
  console.log('  • Transaction-based flight creation');
  console.log('  • Form support for IATA codes instead of requiring IDs');
  console.log('  • Fallback handling for missing airport data');
}

// Run the tests
runTests().catch(console.error);