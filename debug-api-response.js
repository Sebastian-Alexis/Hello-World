// Debug script to test Aviation Stack API directly
// Run this with: node debug-api-response.js

const API_KEY = 'aaa91efc9dcc24641352b31dcde7b60c';

async function testAviationStackAPI() {
  const testFlights = ['AA1', 'UA1', 'DL1', 'EK1', 'AF1'];
  
  console.log('🛩️  Testing Aviation Stack API directly...\n');
  
  for (const flightCode of testFlights) {
    console.log(`Testing flight: ${flightCode}`);
    console.log('=' .repeat(50));
    
    const url = `https://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${flightCode}&limit=1`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('✅ Raw Aviation Stack API Response:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.data && data.data.length > 0) {
        const flight = data.data[0];
        console.log('\n📋 Airport data structure:');
        console.log('Departure:');
        console.log(`  - airport: "${flight.departure.airport}"`);
        console.log(`  - iata: "${flight.departure.iata}"`);
        console.log('Arrival:');
        console.log(`  - airport: "${flight.arrival.airport}"`);
        console.log(`  - iata: "${flight.arrival.iata}"`);
        
        // Test how our API endpoint would transform this
        console.log('\n🔧 Our API endpoint transformation:');
        console.log(`departure_airport_name: "${flight.departure.airport}"`);
        console.log(`departure_iata: "${flight.departure.iata}"`);
        console.log(`arrival_airport_name: "${flight.arrival.airport}"`);
        console.log(`arrival_iata: "${flight.arrival.iata}"`);
      } else {
        console.log('❌ No flight data found');
        if (data.error) {
          console.log('Error:', data.error);
        }
      }
    } catch (error) {
      console.log('🌐 Network/Parse Error:', error.message);
    }
    
    console.log('\n');
  }
}

// Test the API
testAviationStackAPI();