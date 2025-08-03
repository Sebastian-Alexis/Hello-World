// Debug script to test the airport autofill issue
// Run this with: node debug-airport-autofill.js

async function testFlightFetch() {
  const testFlights = ['AA1', 'UA1', 'DL1', 'EK1', 'AF1'];
  
  console.log('🔍 Testing flight data fetch for airport autofill issue...\n');
  
  for (const flightCode of testFlights) {
    console.log(`Testing flight: ${flightCode}`);
    console.log('=' .repeat(50));
    
    try {
      const response = await fetch('http://localhost:4321/api/flights/fetch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          flightIata: flightCode
        })
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        const data = result.data;
        console.log('✅ Success! Raw API response:');
        console.log(JSON.stringify(result, null, 2));
        
        console.log('\n📋 Key airport data fields:');
        console.log(`- departure_airport_name: "${data.departure_airport_name}"`);
        console.log(`- departure_iata: "${data.departure_iata}"`);
        console.log(`- arrival_airport_name: "${data.arrival_airport_name}"`);
        console.log(`- arrival_iata: "${data.arrival_iata}"`);
        
        // Test what the client-side code expects
        console.log('\n🔧 Client-side airport lookup test:');
        console.log(`Looking for departure airport with IATA: ${data.departure_iata}`);
        console.log(`Looking for arrival airport with IATA: ${data.arrival_iata}`);
        
      } else {
        console.log('❌ Failed:', result.error || 'Unknown error');
      }
    } catch (error) {
      console.log('🌐 Network/Parse Error:', error.message);
    }
    
    console.log('\n');
  }
}

// Also test a sample of airports data to see what's available
async function testAirportsData() {
  console.log('🏢 Testing available airports data...\n');
  
  try {
    // This would be how we'd check if we had access to the database
    console.log('Note: Would need to check the actual airports database to see available IATA codes');
    console.log('The client-side code expects window.airportsData with this structure:');
    console.log(`[
  {
    id: 1,
    iata_code: "LAX",
    name: "Los Angeles International Airport",
    city: "Los Angeles",
    country: "United States"
  },
  // ... more airports
]`);
  } catch (error) {
    console.log('Error accessing airports data:', error.message);
  }
}

// Run the tests
(async () => {
  await testFlightFetch();
  await testAirportsData();
})();