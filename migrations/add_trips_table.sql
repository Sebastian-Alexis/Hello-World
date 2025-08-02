-- Add trips table for flight management
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
);

-- Add trip_id to flights table
ALTER TABLE flights ADD COLUMN trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_trips_blog_post_id ON trips(blog_post_id);
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);
CREATE INDEX idx_flights_trip_id ON flights(trip_id);

-- Create view for airport trips
CREATE VIEW airport_trips AS
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
WHERE t.is_active = 1;