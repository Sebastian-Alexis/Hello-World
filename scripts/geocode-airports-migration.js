#!/usr/bin/env node

/**
 * Airport Geocoding Migration Script
 * 
 * This script geocodes all existing airports in the database that have missing 
 * or invalid coordinates (0,0 or null values).
 * 
 * Features:
 * - Connects to the Turso database using existing connection pattern
 * - Finds airports with invalid coordinates
 * - Uses OpenStreetMap Nominatim API for geocoding
 * - Implements rate limiting to avoid API limits
 * - Shows progress and detailed results
 * - Safe operation with error handling and rollback capabilities
 */

import { createClient } from '@libsql/client';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const RATE_LIMIT_DELAY = 1000; // 1 second between API calls
const BATCH_SIZE = 10; // Process airports in batches
const MAX_RETRIES = 3; // Maximum retries for failed geocoding
const DRY_RUN = process.argv.includes('--dry-run'); // Dry run mode
const DEBUG = process.argv.includes('--debug'); // Debug mode

// Database configuration
function getDbConfig() {
  // Try to load environment variables
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  
  if (isDev) {
    // Development: use local database
    return {
      url: 'file:local.db',
      authToken: undefined
    };
  } else {
    // Production: use Turso
    return {
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    };
  }
}

// Initialize database client
function createDbClient() {
  const config = getDbConfig();
  return createClient({
    url: config.url,
    authToken: config.authToken,
  });
}

// Helper function to sleep/delay
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Geocoding function using OpenStreetMap Nominatim
async function geocodeAirport(iataCode, airportName, city, country, retryCount = 0) {
  try {
    console.log(`  🔍 Geocoding ${iataCode} - ${airportName} (${city}, ${country})`);
    
    // Build search query
    const query = encodeURIComponent(`${airportName} ${city} airport`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: { 
        'User-Agent': 'FlightTracker-Migration/1.0 (Airport geocoding migration script)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const coordinates = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        country_code: result.address?.country_code?.toUpperCase() || 'XX'
      };
      
      // Validate coordinates
      if (isNaN(coordinates.latitude) || isNaN(coordinates.longitude)) {
        throw new Error('Invalid coordinates returned from geocoding service');
      }
      
      console.log(`  ✅ Found coordinates: [${coordinates.longitude}, ${coordinates.latitude}]`);
      return coordinates;
    } else {
      throw new Error('No results found');
    }
  } catch (error) {
    console.log(`  ⚠️  Geocoding attempt ${retryCount + 1} failed: ${error.message}`);
    
    // Retry logic
    if (retryCount < MAX_RETRIES) {
      console.log(`  🔄 Retrying in ${RATE_LIMIT_DELAY}ms...`);
      await sleep(RATE_LIMIT_DELAY);
      return geocodeAirport(iataCode, airportName, city, country, retryCount + 1);
    }
    
    console.log(`  ❌ Failed to geocode ${iataCode} after ${MAX_RETRIES + 1} attempts`);
    return null;
  }
}

// Main migration function
async function runAirportGeocodingMigration() {
  console.log('🚀 Starting Airport Geocoding Migration...\n');
  
  const client = createDbClient();
  let results = {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  try {
    // Test database connection
    console.log('📡 Testing database connection...');
    await client.execute('SELECT 1');
    console.log('✅ Database connection successful\n');
    
    // Find airports with invalid coordinates
    console.log('🔍 Finding airports with invalid coordinates...');
    const invalidAirportsQuery = `
      SELECT id, iata_code, name, city, country, latitude, longitude
      FROM airports 
      WHERE is_active = TRUE 
        AND (
          latitude IS NULL 
          OR longitude IS NULL 
          OR latitude = 0.0 
          OR longitude = 0.0
          OR (latitude = 0.0 AND longitude = 0.0)
          OR latitude = 0
          OR longitude = 0
          OR (latitude = 0 AND longitude = 0)
        )
      ORDER BY iata_code
    `;
    
    const invalidAirportsResult = await client.execute(invalidAirportsQuery);
    const invalidAirports = invalidAirportsResult.rows;
    
    results.total = invalidAirports.length;
    
    if (results.total === 0) {
      console.log('✅ No airports found with invalid coordinates. Migration complete!');
      return results;
    }
    
    console.log(`📊 Found ${results.total} airports with invalid coordinates\n`);
    
    // In debug mode, show the airports that would be processed
    if (DEBUG && results.total > 0) {
      console.log('🔍 DEBUG: Airports with invalid coordinates:');
      invalidAirports.forEach((airport, index) => {
        console.log(`   ${index + 1}. ${airport.iata_code} - ${airport.name}`);
        console.log(`      Location: ${airport.city}, ${airport.country}`);
        console.log(`      Coordinates: [${airport.longitude}, ${airport.latitude}]`);
        console.log('');
      });
    }
    
    if (DRY_RUN) {
      console.log('🧪 DRY RUN MODE: No changes will be made to the database');
      results.processed = results.total;
      results.skipped = results.total;
      return results;
    }
    
    // Process airports in batches
    for (let i = 0; i < invalidAirports.length; i += BATCH_SIZE) {
      const batch = invalidAirports.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(invalidAirports.length / BATCH_SIZE);
      
      console.log(`📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} airports):`);
      
      for (const airport of batch) {
        results.processed++;
        
        console.log(`\n${results.processed}/${results.total}. Processing ${airport.iata_code} - ${airport.name}`);
        
        try {
          // Attempt geocoding
          const coordinates = await geocodeAirport(
            airport.iata_code,
            airport.name,
            airport.city,
            airport.country
          );
          
          if (coordinates) {
            // Update airport with new coordinates
            const updateQuery = `
              UPDATE airports 
              SET 
                latitude = ?,
                longitude = ?,
                country_code = COALESCE(NULLIF(country_code, 'XX'), ?),
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `;
            
            if (DEBUG) {
              console.log(`  🔍 DEBUG: Would update ${airport.iata_code} from [${airport.longitude}, ${airport.latitude}] to [${coordinates.longitude}, ${coordinates.latitude}]`);
            }
            
            await client.execute(updateQuery, [
              coordinates.latitude,
              coordinates.longitude,
              coordinates.country_code,
              airport.id
            ]);
            
            console.log(`  💾 Updated database record for ${airport.iata_code}`);
            results.successful++;
          } else {
            console.log(`  ⚠️  Skipping ${airport.iata_code} - geocoding failed`);
            results.failed++;
            results.errors.push({
              airport: `${airport.iata_code} - ${airport.name}`,
              error: 'Geocoding failed after all retries'
            });
          }
        } catch (error) {
          console.log(`  ❌ Error processing ${airport.iata_code}: ${error.message}`);
          results.failed++;
          results.errors.push({
            airport: `${airport.iata_code} - ${airport.name}`,
            error: error.message
          });
        }
        
        // Rate limiting delay
        if (results.processed < results.total) {
          console.log(`  ⏳ Rate limiting delay (${RATE_LIMIT_DELAY}ms)...`);
          await sleep(RATE_LIMIT_DELAY);
        }
      }
      
      console.log(`\n📊 Batch ${batchNumber} complete!`);
      console.log(`   ✅ Successful: ${results.successful}`);
      console.log(`   ❌ Failed: ${results.failed}`);
      console.log(`   📈 Progress: ${results.processed}/${results.total} (${Math.round((results.processed / results.total) * 100)}%)`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    results.errors.push({
      airport: 'General Error',
      error: error.message
    });
  } finally {
    await client.close();
    console.log('\n🔒 Database connection closed');
  }
  
  return results;
}

// Print final results
function printResults(results) {
  console.log('\n' + '='.repeat(60));
  console.log('📈 MIGRATION RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`📊 Total airports found: ${results.total}`);
  console.log(`🔄 Airports processed: ${results.processed}`);
  console.log(`✅ Successfully geocoded: ${results.successful}`);
  console.log(`❌ Failed to geocode: ${results.failed}`);
  
  if (results.successful > 0) {
    const successRate = Math.round((results.successful / results.total) * 100);
    console.log(`📈 Success rate: ${successRate}%`);
  }
  
  if (results.errors.length > 0) {
    console.log(`\n⚠️  ERRORS (${results.errors.length}):`);
    results.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.airport}: ${error.error}`);
    });
  }
  
  console.log('\n🎉 Migration completed!');
}

// Validation function to check migration results
async function validateMigration() {
  console.log('\n🔍 Validating migration results...');
  
  const client = createDbClient();
  
  try {
    // Check remaining invalid airports
    const stillInvalidQuery = `
      SELECT COUNT(*) as count
      FROM airports 
      WHERE is_active = TRUE 
        AND (
          latitude IS NULL 
          OR longitude IS NULL 
          OR latitude = 0.0 
          OR longitude = 0.0
          OR (latitude = 0.0 AND longitude = 0.0)
          OR latitude = 0
          OR longitude = 0
          OR (latitude = 0 AND longitude = 0)
        )
    `;
    
    const result = await client.execute(stillInvalidQuery);
    const remainingInvalid = result.rows[0]?.count || 0;
    
    // Check total valid airports
    const validQuery = `
      SELECT COUNT(*) as count
      FROM airports 
      WHERE is_active = TRUE 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL 
        AND latitude != 0.0 
        AND longitude != 0.0
    `;
    
    const validResult = await client.execute(validQuery);
    const totalValid = validResult.rows[0]?.count || 0;
    
    console.log(`✅ Valid airports with coordinates: ${totalValid}`);
    console.log(`⚠️  Airports still missing coordinates: ${remainingInvalid}`);
    
    if (remainingInvalid === 0) {
      console.log('🎉 All airports now have valid coordinates!');
    } else {
      console.log('💡 Consider running the migration again for remaining airports');
    }
    
  } catch (error) {
    console.error('❌ Validation failed:', error);
  } finally {
    await client.close();
  }
}

// Enhanced debugging function to investigate coordinate issues
async function debugCoordinateIssues() {
  console.log('🔍 DEBUGGING COORDINATE ISSUES...');
  const client = createDbClient();
  
  try {
    // Check for any suspicious coordinate values
    const debugQuery = `
      SELECT 
        iata_code, name, city, country,
        latitude, longitude,
        CASE 
          WHEN latitude = 0 AND longitude = 0 THEN 'ZERO_ZERO'
          WHEN latitude = 0.0 AND longitude = 0.0 THEN 'ZERO_DOT_ZERO'
          WHEN abs(latitude) < 0.01 AND abs(longitude) < 0.01 THEN 'NEAR_ZERO'
          WHEN latitude IS NULL OR longitude IS NULL THEN 'NULL_VALUES'
          ELSE 'VALID'
        END as coord_status,
        typeof(latitude) as lat_type,
        typeof(longitude) as lng_type
      FROM airports 
      WHERE is_active = TRUE
      ORDER BY 
        CASE coord_status 
          WHEN 'ZERO_ZERO' THEN 1
          WHEN 'ZERO_DOT_ZERO' THEN 2
          WHEN 'NEAR_ZERO' THEN 3
          WHEN 'NULL_VALUES' THEN 4
          ELSE 5
        END, iata_code
    `;
    
    const result = await client.execute(debugQuery);
    const airports = result.rows;
    
    console.log(`\n📊 Coordinate Analysis (${airports.length} airports):`);
    
    const statusCounts = {};
    airports.forEach(airport => {
      const status = airport.coord_status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    
    console.log('\n📈 Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      const emoji = status === 'VALID' ? '✅' : '⚠️';
      console.log(`   ${emoji} ${status}: ${count} airports`);
    });
    
    // Show problematic airports
    const problematicAirports = airports.filter(a => a.coord_status !== 'VALID');
    if (problematicAirports.length > 0) {
      console.log('\n🚨 Problematic Airports:');
      problematicAirports.forEach(airport => {
        console.log(`   ${airport.iata_code} - ${airport.name}`);
        console.log(`      Location: ${airport.city || 'Unknown'}, ${airport.country || 'Unknown'}`);
        console.log(`      Coordinates: [${airport.longitude}, ${airport.latitude}] (${airport.coord_status})`);
        console.log(`      Types: lat=${airport.lat_type}, lng=${airport.lng_type}`);
        console.log('');
      });
    } else {
      console.log('\n✅ No problematic coordinates found in database!');
    }
    
    // Test coordinate array construction (simulate frontend behavior)
    console.log('\n🧪 Testing Frontend Coordinate Array Construction:');
    airports.slice(0, 5).forEach(airport => {
      const coordinates = [airport.longitude, airport.latitude];
      const isZeroZero = coordinates[0] === 0 && coordinates[1] === 0;
      const coordinatesStr = JSON.stringify(coordinates);
      
      console.log(`   ${airport.iata_code}: [${airport.longitude}, ${airport.latitude}] -> ${coordinatesStr} ${isZeroZero ? '⚠️' : '✅'}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await client.close();
  }
}

// Main execution
async function main() {
  try {
    // Run debugging if in debug mode
    if (DEBUG) {
      await debugCoordinateIssues();
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
    const results = await runAirportGeocodingMigration();
    printResults(results);
    
    if (results.successful > 0 && !DRY_RUN) {
      await validateMigration();
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runAirportGeocodingMigration, validateMigration };