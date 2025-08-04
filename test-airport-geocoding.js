#!/usr/bin/env node

/**
 * Test script for automatic airport geocoding functionality
 * Tests the /api/airports endpoint with and without coordinates
 */

const testAirportGeocoding = async () => {
  const baseUrl = 'http://localhost:4321'; // Adjust if different
  
  console.log('🧪 Testing Automatic Airport Geocoding...\n');

  // Test data for airport without coordinates (should trigger geocoding)
  const testAirport = {
    iata_code: 'TEST',
    name: 'Paris Charles de Gaulle Airport',
    city: 'Paris',
    country: 'France'
  };

  try {
    console.log('📤 Sending request without coordinates...');
    console.log('Airport data:', JSON.stringify(testAirport, null, 2));
    
    const response = await fetch(`${baseUrl}/api/airports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testAirport)
    });

    const result = await response.json();
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(result, null, 2));

    if (result.success) {
      if (result.geocoded) {
        console.log('✅ Geocoding worked! Airport was automatically geocoded.');
        console.log(`📍 Coordinates: [${result.data.longitude}, ${result.data.latitude}]`);
      } else {
        console.log('ℹ️ Airport was created but geocoding was not needed (coordinates were provided).');
      }
      
      if (result.data.latitude && result.data.longitude) {
        console.log('✅ Airport has valid coordinates!');
      } else {
        console.log('⚠️ Airport was created but geocoding failed - coordinates are null.');
      }
    } else {
      console.log('❌ Failed to create airport:', result.error);
    }

  } catch (error) {
    console.error('❌ Error testing geocoding:', error.message);
    
    if (error.message.includes('fetch')) {
      console.log('\n💡 Make sure your development server is running on localhost:4321');
      console.log('   Run: npm run dev');
    }
  }

  console.log('\n🔬 Test completed!');
};

// Run the test
testAirportGeocoding();