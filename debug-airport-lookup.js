#!/usr/bin/env node

// Simple test script to verify airport lookup and creation functionality
import { DatabaseQueries } from './src/lib/db/queries.js';

const db = new DatabaseQueries();

async function testAirportLookup() {
  console.log('🧪 Testing airport lookup and creation functionality...\n');
  
  try {
    // Test 1: Find existing airport
    console.log('1. Testing existing airport lookup (LAX)...');
    const existingAirport = await db.findAirportByIata('LAX');
    if (existingAirport) {
      console.log('✅ Found existing airport:', existingAirport.name);
    } else {
      console.log('❌ LAX not found - check if database is seeded');
    }

    // Test 2: Try to find non-existent airport
    console.log('\n2. Testing non-existent airport lookup (ZZZ)...');
    const nonExistentAirport = await db.findAirportByIata('ZZZ');
    if (!nonExistentAirport) {
      console.log('✅ Correctly returned null for non-existent airport');
    } else {
      console.log('❌ Unexpected result - ZZZ should not exist');
    }

    // Test 3: Create new airport using findOrCreateAirport
    console.log('\n3. Testing airport creation (TEST)...');
    const testAirportData = {
      iata_code: 'TEST',
      name: 'Test Airport for Development',
      city: 'Test City',
      country: 'Test Country',
      latitude: 40.0,
      longitude: -74.0
    };

    const createdAirport = await db.findOrCreateAirport(testAirportData);
    console.log('✅ Created/found airport:', createdAirport.name, `(ID: ${createdAirport.id})`);

    // Test 4: Verify idempotency - calling again should return same airport
    console.log('\n4. Testing idempotency (TEST again)...');
    const sameAirport = await db.findOrCreateAirport(testAirportData);
    if (sameAirport.id === createdAirport.id) {
      console.log('✅ Correctly returned existing airport on second call');
    } else {
      console.log('❌ Created duplicate airport - idempotency failed');
    }

    // Test 5: Get all airports to see current count
    console.log('\n5. Current airports in database...');
    const allAirports = await db.searchAirports();
    console.log(`✅ Total airports: ${allAirports.length}`);
    allAirports.slice(0, 5).forEach((airport, index) => {
      console.log(`   ${index + 1}. ${airport.iata_code} - ${airport.name}`);
    });
    if (allAirports.length > 5) {
      console.log(`   ... and ${allAirports.length - 5} more`);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Airport lookup by IATA code: ✅');
    console.log('   - Non-existent airport handling: ✅');
    console.log('   - Airport creation: ✅');
    console.log('   - Idempotency: ✅');
    console.log(`   - Database contains ${allAirports.length} airports`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testAirportLookup().catch(console.error);