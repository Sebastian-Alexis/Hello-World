import { createClient } from '@libsql/client';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function addTripsTable() {
  console.log('🚀 Adding trips table and updating flights table...');
  
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:local.db',
    authToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN,
  });

  try {
    // Create trips table
    console.log('📝 Creating trips table...');
    await client.execute(`
      CREATE TABLE IF NOT EXISTS trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        blog_post_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE SET NULL
      )
    `);
    console.log('✅ Trips table created');

    // Check if trip_id column exists in flights table
    console.log('📝 Checking if trip_id column exists in flights table...');
    try {
      const result = await client.execute("PRAGMA table_info(flights)");
      const columns = result.rows;
      const hasTripId = columns.some(col => col.name === 'trip_id');
      
      if (!hasTripId) {
        console.log('📝 Adding trip_id column to flights table...');
        await client.execute(`
          ALTER TABLE flights ADD COLUMN trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL
        `);
        console.log('✅ Added trip_id column to flights table');
      } else {
        console.log('✅ trip_id column already exists in flights table');
      }
    } catch (error) {
      console.log('⚠️  Could not check/add trip_id column:', error.message);
    }

    // Create indexes
    console.log('📝 Creating indexes...');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_trips_blog_post_id ON trips(blog_post_id)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_trips_dates ON trips(start_date, end_date)');
    await client.execute('CREATE INDEX IF NOT EXISTS idx_flights_trip_id ON flights(trip_id)');
    console.log('✅ Indexes created');

    // Create the airport_trips view
    console.log('📝 Creating airport_trips view...');
    await client.execute(`
      CREATE VIEW IF NOT EXISTS airport_trips AS
      SELECT DISTINCT
        a.id as airport_id,
        a.iata_code,
        a.name as airport_name,
        a.city,
        a.country,
        a.latitude,
        a.longitude,
        t.id as trip_id,
        t.name as trip_name,
        t.start_date,
        t.end_date,
        t.blog_post_id,
        f.id as flight_id,
        f.flight_number,
        f.departure_time,
        f.arrival_time,
        CASE 
          WHEN f.departure_airport_id = a.id THEN 'departure'
          WHEN f.arrival_airport_id = a.id THEN 'arrival'
        END as flight_type,
        CASE 
          WHEN f.departure_airport_id = a.id THEN arr.iata_code
          WHEN f.arrival_airport_id = a.id THEN dep.iata_code
        END as connected_airport_iata,
        CASE 
          WHEN f.departure_airport_id = a.id THEN arr.latitude
          WHEN f.arrival_airport_id = a.id THEN dep.latitude
        END as connected_latitude,
        CASE 
          WHEN f.departure_airport_id = a.id THEN arr.longitude
          WHEN f.arrival_airport_id = a.id THEN dep.longitude
        END as connected_longitude
      FROM airports a
      JOIN flights f ON (f.departure_airport_id = a.id OR f.arrival_airport_id = a.id)
      LEFT JOIN trips t ON f.trip_id = t.id
      LEFT JOIN airports dep ON f.departure_airport_id = dep.id
      LEFT JOIN airports arr ON f.arrival_airport_id = arr.id
      WHERE t.is_active = 1
    `);
    console.log('✅ airport_trips view created');

    console.log('✨ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the migration
addTripsTable().catch(console.error);