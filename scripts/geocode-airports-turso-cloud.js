#!/usr/bin/env node

/**
 * Geocode Airports with [0,0] Coordinates - Turso Cloud Migration Script
 * 
 * This script connects to the Turso cloud database and geocodes airports
 * that have invalid [0,0] coordinates using the Mapbox Geocoding API.
 * 
 * Features:
 * - Uses cloud database credentials from .env
 * - Finds airports with latitude=0 AND longitude=0
 * - Uses Mapbox geocoding with proper error handling
 * - Updates cloud database with real coordinates
 * - Shows detailed progress and results
 * - Handles rate limiting and API errors gracefully
 */

import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  // Mapbox API rate limit (600 requests per minute for free tier)
  RATE_LIMIT_DELAY: 150, // ms between requests (allows ~400 requests/minute)
  BATCH_SIZE: 10, // Process airports in batches
  MAX_RETRIES: 3, // Maximum retries for failed geocoding attempts
  TIMEOUT: 10000, // Request timeout in milliseconds
};

/**
 * Get database client using cloud credentials
 */
function getCloudDbClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is required in .env file');
  }

  console.log(`📡 Connecting to Turso cloud database: ${url.split('@')[1] || url}`);

  return createClient({
    url,
    authToken,
  });
}

/**
 * Helper function for geocoding airports using Mapbox
 */
async function geocodeAirport(iataCode, airportName, city, country, retryCount = 0) {
  try {
    // Get Mapbox access token from environment
    const mapboxToken = process.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.PUBLIC_MAPBOX_ACCESS_TOKEN;
    
    if (!mapboxToken) {
      throw new Error('Mapbox access token not found in environment variables');
    }

    // Build search query - use airport name with city for better accuracy
    const hasAirport = airportName.toLowerCase().includes('airport');
    const searchQuery = city && city !== 'Unknown' ? 
      (hasAirport ? `${airportName} ${city}` : `${airportName} airport ${city}`) :
      (hasAirport ? airportName : `${airportName} airport`);
    
    const encodedQuery = encodeURIComponent(searchQuery);
    
    // Use Mapbox Geocoding API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.TIMEOUT);
    
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&limit=1`,
      { 
        headers: { 'User-Agent': 'FlightTracker-Migration/1.0' },
        signal: controller.signal
      }
    );
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const result = data.features[0];
      const [longitude, latitude] = result.center;
      
      // Validate coordinates
      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error(`Invalid coordinates: lat=${latitude}, lon=${longitude}`);
      }
      
      // Extract country code from context
      let countryCode = 'XX';
      if (result.context) {
        const countryContext = result.context.find(ctx => ctx.id.startsWith('country'));
        if (countryContext && countryContext.short_code) {
          countryCode = countryContext.short_code.toUpperCase();
        }
      }
      
      return {
        latitude,
        longitude,
        country_code: countryCode,
        place_name: result.place_name
      };
    } else {
      throw new Error('No results found');
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    
    // Retry logic for transient errors
    if (retryCount < CONFIG.MAX_RETRIES && 
        (error.message.includes('timeout') || 
         error.message.includes('HTTP 5') || 
         error.message.includes('ENOTFOUND'))) {
      
      console.warn(`  ⚠️  Retry ${retryCount + 1}/${CONFIG.MAX_RETRIES} for ${iataCode}: ${error.message}`);
      await sleep(CONFIG.RATE_LIMIT_DELAY * (retryCount + 1)); // Exponential backoff
      return geocodeAirport(iataCode, airportName, city, country, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Sleep utility function
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Update airport coordinates in the database
 */
async function updateAirportCoordinates(client, airportId, coordinates) {
  const result = await client.execute(
    `UPDATE airports 
     SET latitude = ?, longitude = ?, country_code = ?, updated_at = CURRENT_TIMESTAMP 
     WHERE id = ?`,
    [coordinates.latitude, coordinates.longitude, coordinates.country_code, airportId]
  );
  
  return result.rowsAffected > 0;
}

/**
 * Main migration function
 */
async function migrateAirportCoordinates() {
  let client;
  
  try {
    console.log('🚀 Starting Airport Geocoding Migration');
    console.log('=====================================');
    
    // Initialize database client
    client = getCloudDbClient();
    
    // Test connection
    console.log('🔍 Testing database connection...');
    await client.execute('SELECT 1');
    console.log('✅ Database connection successful');
    
    // Find airports with [0,0] coordinates
    console.log('🔍 Finding airports with [0,0] coordinates...');
    const result = await client.execute(
      `SELECT id, iata_code, name, city, country, country_code 
       FROM airports 
       WHERE latitude = 0 AND longitude = 0 
       ORDER BY iata_code`
    );
    
    const airportsToGeocode = result.rows || [];
    console.log(`📍 Found ${airportsToGeocode.length} airports with [0,0] coordinates`);
    
    if (airportsToGeocode.length === 0) {
      console.log('🎉 No airports need geocoding. All done!');
      return;
    }
    
    // Display airports to be processed
    console.log('\n📋 Airports to geocode:');
    airportsToGeocode.forEach((airport, index) => {
      console.log(`  ${index + 1}. ${airport.iata_code} - ${airport.name} (${airport.city}, ${airport.country})`);
    });
    
    console.log(`\n⚙️  Configuration:`);
    console.log(`   • Rate limit delay: ${CONFIG.RATE_LIMIT_DELAY}ms`);
    console.log(`   • Batch size: ${CONFIG.BATCH_SIZE}`);
    console.log(`   • Max retries: ${CONFIG.MAX_RETRIES}`);
    console.log(`   • Request timeout: ${CONFIG.TIMEOUT}ms`);
    
    // Process in batches
    const results = {
      success: 0,
      failed: 0,
      total: airportsToGeocode.length,
      errors: []
    };
    
    console.log(`\n🔄 Processing ${results.total} airports...`);
    console.log('='.repeat(50));
    
    for (let i = 0; i < airportsToGeocode.length; i += CONFIG.BATCH_SIZE) {
      const batch = airportsToGeocode.slice(i, i + CONFIG.BATCH_SIZE);
      const batchNum = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(airportsToGeocode.length / CONFIG.BATCH_SIZE);
      
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} airports):`);
      
      for (const airport of batch) {
        const progress = `[${results.success + results.failed + 1}/${results.total}]`;
        
        try {
          console.log(`  ${progress} ${airport.iata_code} - ${airport.name}`);
          
          // Geocode the airport
          const coordinates = await geocodeAirport(
            airport.iata_code,
            airport.name,
            airport.city,
            airport.country
          );
          
          // Update database
          const updated = await updateAirportCoordinates(client, airport.id, coordinates);
          
          if (updated) {
            console.log(`    ✅ [${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}] - ${coordinates.place_name}`);
            results.success++;
          } else {
            throw new Error('Database update failed');
          }
          
        } catch (error) {
          console.log(`    ❌ Failed: ${error.message}`);
          results.failed++;
          results.errors.push({
            airport: `${airport.iata_code} - ${airport.name}`,
            error: error.message
          });
        }
        
        // Rate limiting delay
        if (i + batch.indexOf(airport) < airportsToGeocode.length - 1) {
          await sleep(CONFIG.RATE_LIMIT_DELAY);
        }
      }
    }
    
    // Final results
    console.log('\n' + '='.repeat(50));
    console.log('📊 Migration Results:');
    console.log(`   ✅ Successfully geocoded: ${results.success}`);
    console.log(`   ❌ Failed to geocode: ${results.failed}`);
    console.log(`   📈 Success rate: ${((results.success / results.total) * 100).toFixed(1)}%`);
    
    if (results.errors.length > 0) {
      console.log('\n❌ Failed airports:');
      results.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.airport}: ${error.error}`);
      });
    }
    
    // Verify results
    console.log('\n🔍 Verifying results...');
    const remainingResult = await client.execute(
      'SELECT COUNT(*) as count FROM airports WHERE latitude = 0 AND longitude = 0'
    );
    const remainingCount = remainingResult.rows[0]?.count || 0;
    
    console.log(`📍 Airports still with [0,0] coordinates: ${remainingCount}`);
    
    if (remainingCount === 0) {
      console.log('🎉 All airports successfully geocoded!');
    } else if (remainingCount < airportsToGeocode.length) {
      console.log('✅ Migration partially successful. Consider running again for failed airports.');
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (client) {
      try {
        await client.close();
        console.log('🔌 Database connection closed');
      } catch (error) {
        console.warn('⚠️  Warning: Failed to close database connection:', error.message);
      }
    }
  }
}

/**
 * Check required environment variables
 */
function checkEnvironment() {
  const required = ['TURSO_DATABASE_URL'];
  const optional = ['TURSO_AUTH_TOKEN', 'VITE_MAPBOX_ACCESS_TOKEN', 'PUBLIC_MAPBOX_ACCESS_TOKEN'];
  
  console.log('🔧 Environment Check:');
  
  for (const env of required) {
    if (!process.env[env]) {
      console.error(`❌ Missing required environment variable: ${env}`);
      process.exit(1);
    }
    console.log(`   ✅ ${env}: ${process.env[env].substring(0, 20)}...`);
  }
  
  for (const env of optional) {
    if (process.env[env]) {
      console.log(`   ✅ ${env}: ${process.env[env].substring(0, 20)}...`);
    } else {
      console.log(`   ⚠️  ${env}: Not set`);
    }
  }
  
  // Check for Mapbox token
  const hasMapboxToken = process.env.VITE_MAPBOX_ACCESS_TOKEN || process.env.PUBLIC_MAPBOX_ACCESS_TOKEN;
  if (!hasMapboxToken) {
    console.error('❌ No Mapbox access token found. Set VITE_MAPBOX_ACCESS_TOKEN or PUBLIC_MAPBOX_ACCESS_TOKEN');
    process.exit(1);
  }
  
  console.log('');
}

// Run the migration
if (import.meta.url === `file://${process.argv[1]}`) {
  checkEnvironment();
  migrateAirportCoordinates()
    .then(() => {
      console.log('🏁 Migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}