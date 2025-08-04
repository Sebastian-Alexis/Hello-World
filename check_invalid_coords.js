#!/usr/bin/env node

import { createClient } from '@libsql/client';

async function checkInvalidCoordinates() {
  console.log('🔍 Checking for airports with invalid [0,0] coordinates...');
  
  try {
    // Create client (using same approach as setup-database.js)
    const client = createClient({
      url: 'file:local.db'
    });

    // Check for airports with [0,0] coordinates
    const result = await client.execute(`
      SELECT iata_code, name, city, country, latitude, longitude
      FROM airports 
      WHERE latitude = 0 AND longitude = 0
      ORDER BY iata_code
    `);

    if (result.rows.length === 0) {
      console.log('✅ No airports found with invalid [0,0] coordinates');
    } else {
      console.log(`⚠️  Found ${result.rows.length} airports with invalid [0,0] coordinates:`);
      console.log('\nIATA | Name | City | Country');
      console.log('-----|------|------|--------');
      
      result.rows.forEach(row => {
        console.log(`${row.iata_code} | ${row.name} | ${row.city} | ${row.country}`);
      });
      
      console.log('\n💡 These airports should be updated to have null coordinates or re-geocoded.');
      console.log('   You can update them with:');
      console.log('   UPDATE airports SET latitude = NULL, longitude = NULL WHERE latitude = 0 AND longitude = 0;');
    }

    await client.close();
  } catch (error) {
    console.error('❌ Error checking coordinates:', error.message);
    if (error.message.includes('no such table')) {
      console.log('💡 Run "npm run db:setup" first to create the database schema.');
    }
  }
}

checkInvalidCoordinates();