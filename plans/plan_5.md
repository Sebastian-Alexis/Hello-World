# Plan 5: Interactive Flight Map & Travel System

**Session Goal**: Implement complete flight tracking system with interactive map, travel statistics, and route visualization  
**Estimated Time**: 4-5 hours  
**Prerequisites**: Plans 1-4 completed (foundation, layout, blog system, and admin panel)  

## Development Phase: Flight Tracking & Visualization System

### Todo List

#### 1. Flight Data Management
- [ ] Implement all flight-related database queries in DatabaseQueries class
- [ ] Create flight CRUD operations with airport relationship management
- [ ] Build airport data import system from aviation APIs
- [ ] Implement flight route calculation and distance algorithms
- [ ] Create flight statistics aggregation methods
- [ ] Set up flight status tracking and notifications
- [ ] Add flight photo and documentation management
- [ ] Test all flight data operations thoroughly

#### 2. Interactive Map Component
- [ ] Set up Mapbox GL JS with deck.gl integration
- [ ] Create FlightMap.svelte component with full interactivity
- [ ] Implement airport markers with custom styling
- [ ] Build flight route arcs with animation effects
- [ ] Add map clustering for dense airport regions
- [ ] Create interactive popups with flight details
- [ ] Implement map layer toggles and filtering
- [ ] Add responsive design for mobile map usage

#### 3. Flight API Endpoints
- [ ] Create GET /api/flights for paginated flight listing
- [ ] Implement GET /api/flights/[id] for individual flight details
- [ ] Build POST/PUT/DELETE endpoints for admin flight management
- [ ] Create GET /api/airports for airport data with search
- [ ] Implement flight statistics API endpoints
- [ ] Add flight route optimization suggestions
- [ ] Create export functionality for flight data
- [ ] Test all API endpoints with comprehensive scenarios

#### 4. Travel Statistics Dashboard
- [ ] Build comprehensive travel statistics component
- [ ] Create total distance and flight time calculations
- [ ] Implement country and continent visit tracking
- [ ] Build airline and aircraft type statistics
- [ ] Create monthly/yearly travel pattern analysis
- [ ] Add travel cost tracking and budget analysis
- [ ] Implement travel goals and achievement system
- [ ] Create shareable travel statistics widgets

#### 5. Flight Frontend Pages
- [ ] Build main flight map page with full interactivity
- [ ] Create individual flight detail pages with photos
- [ ] Implement flight search and filtering system
- [ ] Build airport detail pages with visit history
- [ ] Create travel statistics overview page
- [ ] Add flight timeline and chronological view
- [ ] Implement travel blog integration with flights
- [ ] Test all pages across devices and screen sizes

#### 6. Map Performance Optimization
- [ ] Implement efficient data loading with clustering
- [ ] Create viewport-based data fetching
- [ ] Add progressive loading for large datasets
- [ ] Optimize rendering performance for smooth animations
- [ ] Implement caching strategies for map tiles
- [ ] Create WebGL performance monitoring
- [ ] Add fallback rendering for low-performance devices
- [ ] Test performance across various devices and connections

#### 7. Advanced Map Features
- [ ] Build custom map themes and styling
- [ ] Implement 3D flight path visualization
- [ ] Create time-based animation of travel history
- [ ] Add weather overlay integration
- [ ] Implement route planning and optimization
- [ ] Create shared map links and embedding
- [ ] Add fullscreen mode with enhanced controls
- [ ] Build screenshot and sharing functionality

#### 8. Travel Data Integration
- [ ] Build flight data import from booking confirmations
- [ ] Create integration with airline APIs for real-time updates
- [ ] Implement photo geotagging and flight association
- [ ] Add travel document scanning and OCR
- [ ] Create backup and sync functionality
- [ ] Build data export for external travel apps
- [ ] Implement privacy controls for shared data
- [ ] Add automated travel expense categorization

## Detailed Implementation Steps

### Step 1: Flight Database Operations (75 minutes)

**Extended Database Queries** (lib/db/queries.ts):
```typescript
// Add to existing DatabaseQueries class
export class DatabaseQueries {
  // ... existing methods

  // Flight management methods
  async createFlight(flightData: Omit<Flight, 'id' | 'created_at' | 'updated_at'>): Promise<Flight> {
    const result = await this.db.execute({
      sql: `INSERT INTO flights (
        flight_number, airline_code, airline_name, aircraft_type,
        departure_airport_id, arrival_airport_id, departure_date, departure_time,
        arrival_date, arrival_time, duration_minutes, distance_km,
        seat_number, flight_class, booking_reference, price_paid, currency,
        notes, photos, flight_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        flightData.flight_number, flightData.airline_code, flightData.airline_name,
        flightData.aircraft_type, flightData.departure_airport_id, flightData.arrival_airport_id,
        flightData.departure_date, flightData.departure_time, flightData.arrival_date,
        flightData.arrival_time, flightData.duration_minutes, flightData.distance_km,
        flightData.seat_number, flightData.flight_class, flightData.booking_reference,
        flightData.price_paid, flightData.currency, flightData.notes,
        JSON.stringify(flightData.photos || []), flightData.flight_status
      ]
    });

    return this.getFlightById(result.lastInsertRowid as number);
  }

  async getFlightById(id: number): Promise<Flight | null> {
    const result = await this.db.execute({
      sql: `SELECT f.*, 
              da.name as departure_airport_name, da.city as departure_city,
              da.country as departure_country, da.latitude as dep_lat, da.longitude as dep_lng,
              aa.name as arrival_airport_name, aa.city as arrival_city,
              aa.country as arrival_country, aa.latitude as arr_lat, aa.longitude as arr_lng,
              bp.title as blog_post_title, bp.slug as blog_post_slug
            FROM flights f
            JOIN airports da ON f.departure_airport_id = da.id
            JOIN airports aa ON f.arrival_airport_id = aa.id
            LEFT JOIN blog_posts bp ON f.blog_post_id = bp.id
            WHERE f.id = ?`,
      args: [id]
    });

    if (result.rows.length === 0) return null;
    
    const row = result.rows[0] as any;
    return {
      ...row,
      photos: JSON.parse(row.photos || '[]'),
      origin: [row.dep_lng, row.dep_lat],
      destination: [row.arr_lng, row.arr_lat]
    };
  }

  async getAllFlights(page = 1, limit = 50): Promise<PaginatedResponse<Flight>> {
    const offset = (page - 1) * limit;
    
    const [flightsResult, countResult] = await Promise.all([
      this.db.execute({
        sql: `SELECT f.*, 
                da.name as departure_airport_name, da.iata_code as departure_iata,
                da.city as departure_city, da.country as departure_country,
                da.latitude as dep_lat, da.longitude as dep_lng,
                aa.name as arrival_airport_name, aa.iata_code as arrival_iata,
                aa.city as arrival_city, aa.country as arrival_country,
                aa.latitude as arr_lat, aa.longitude as arr_lng
              FROM flights f
              JOIN airports da ON f.departure_airport_id = da.id
              JOIN airports aa ON f.arrival_airport_id = aa.id
              ORDER BY f.departure_date DESC, f.departure_time DESC
              LIMIT ? OFFSET ?`,
        args: [limit, offset]
      }),
      this.db.execute('SELECT COUNT(*) as count FROM flights')
    ]);

    const flights = flightsResult.rows.map((row: any) => ({
      ...row,
      photos: JSON.parse(row.photos || '[]'),
      origin: [row.dep_lng, row.dep_lat],
      destination: [row.arr_lng, row.arr_lat]
    }));

    const total = (countResult.rows[0] as any).count;
    const totalPages = Math.ceil(total / limit);

    return {
      data: flights,
      total,
      totalPages,
      currentPage: page,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
  }

  async getFlightStatistics(): Promise<{
    totalFlights: number;
    totalDistance: number;
    totalFlightTime: number;
    uniqueAirports: number;
    uniqueCountries: number;
    uniqueAirlines: number;
    favoriteAirline: string;
    longestFlight: Flight;
    mostVisitedAirport: string;
  }> {
    const [statsResult, longestFlightResult, favoriteAirlineResult, mostVisitedResult] = await Promise.all([
      this.db.execute(`
        SELECT 
          COUNT(*) as total_flights,
          SUM(distance_km) as total_distance,
          SUM(duration_minutes) as total_flight_time,
          COUNT(DISTINCT departure_airport_id) + COUNT(DISTINCT arrival_airport_id) as unique_airports
        FROM flights
        WHERE flight_status = 'completed'
      `),
      this.db.execute(`
        SELECT f.*, 
          da.name as departure_airport_name, da.iata_code as departure_iata,
          aa.name as arrival_airport_name, aa.iata_code as arrival_iata
        FROM flights f
        JOIN airports da ON f.departure_airport_id = da.id
        JOIN airports aa ON f.arrival_airport_id = aa.id
        WHERE f.flight_status = 'completed' AND f.distance_km IS NOT NULL
        ORDER BY f.distance_km DESC
        LIMIT 1
      `),
      this.db.execute(`
        SELECT airline_name, COUNT(*) as flight_count
        FROM flights
        WHERE flight_status = 'completed' AND airline_name IS NOT NULL
        GROUP BY airline_name
        ORDER BY flight_count DESC
        LIMIT 1
      `),
      this.db.execute(`
        SELECT a.name, a.iata_code, COUNT(*) as visit_count
        FROM (
          SELECT departure_airport_id as airport_id FROM flights WHERE flight_status = 'completed'
          UNION ALL
          SELECT arrival_airport_id as airport_id FROM flights WHERE flight_status = 'completed'
        ) f
        JOIN airports a ON f.airport_id = a.id
        GROUP BY a.id, a.name, a.iata_code
        ORDER BY visit_count DESC
        LIMIT 1
      `)
    ]);

    const stats = statsResult.rows[0] as any;
    const longestFlight = longestFlightResult.rows[0] as any;
    const favoriteAirline = favoriteAirlineResult.rows[0] as any;
    const mostVisited = mostVisitedResult.rows[0] as any;

    // Get unique countries count
    const countriesResult = await this.db.execute(`
      SELECT COUNT(DISTINCT country) as unique_countries
      FROM (
        SELECT da.country FROM flights f JOIN airports da ON f.departure_airport_id = da.id
        WHERE f.flight_status = 'completed'
        UNION
        SELECT aa.country FROM flights f JOIN airports aa ON f.arrival_airport_id = aa.id
        WHERE f.flight_status = 'completed'
      )
    `);

    const uniqueCountries = (countriesResult.rows[0] as any).unique_countries;

    return {
      totalFlights: stats.total_flights || 0,
      totalDistance: stats.total_distance || 0,
      totalFlightTime: stats.total_flight_time || 0,
      uniqueAirports: Math.floor((stats.unique_airports || 0) / 2), // Divide by 2 to avoid double counting
      uniqueCountries: uniqueCountries || 0,
      uniqueAirlines: await this.getUniqueAirlinesCount(),
      favoriteAirline: favoriteAirline?.airline_name || 'N/A',
      longestFlight: longestFlight || null,
      mostVisitedAirport: mostVisited ? `${mostVisited.name} (${mostVisited.iata_code})` : 'N/A'
    };
  }

  private async getUniqueAirlinesCount(): Promise<number> {
    const result = await this.db.execute(`
      SELECT COUNT(DISTINCT airline_name) as count
      FROM flights
      WHERE flight_status = 'completed' AND airline_name IS NOT NULL
    `);
    
    return (result.rows[0] as any).count || 0;
  }

  // Airport management methods
  async createAirport(airportData: Omit<Airport, 'id' | 'created_at' | 'updated_at'>): Promise<Airport> {
    const result = await this.db.execute({
      sql: `INSERT INTO airports (
        iata_code, icao_code, name, city, country, country_code,
        latitude, longitude, altitude, timezone, has_visited, visit_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        airportData.iata_code, airportData.icao_code, airportData.name,
        airportData.city, airportData.country, airportData.country_code,
        airportData.latitude, airportData.longitude, airportData.altitude,
        airportData.timezone, airportData.has_visited, airportData.visit_count
      ]
    });

    return this.getAirportById(result.lastInsertRowid as number);
  }

  async getAirportById(id: number): Promise<Airport | null> {
    const result = await this.db.execute({
      sql: 'SELECT * FROM airports WHERE id = ?',
      args: [id]
    });

    if (result.rows.length === 0) return null;
    
    const airport = result.rows[0] as any;
    return {
      ...airport,
      coordinates: [airport.longitude, airport.latitude]
    };
  }

  async searchAirports(query: string, limit = 20): Promise<Airport[]> {
    const result = await this.db.execute({
      sql: `SELECT * FROM airports 
            WHERE name LIKE ? OR city LIKE ? OR iata_code LIKE ? OR country LIKE ?
            ORDER BY has_visited DESC, visit_count DESC, name ASC
            LIMIT ?`,
      args: [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`, limit]
    });

    return result.rows.map((row: any) => ({
      ...row,
      coordinates: [row.longitude, row.latitude]
    }));
  }

  // Update airport visit information when flight is added
  async updateAirportVisits(airportId: number, visitDate: string): Promise<void> {
    await this.db.execute({
      sql: `UPDATE airports SET 
              has_visited = TRUE,
              visit_count = visit_count + 1,
              first_visit_date = COALESCE(first_visit_date, ?),
              last_visit_date = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?`,
      args: [visitDate, visitDate, airportId]
    });
  }
}
```

### Step 2: Interactive Flight Map Component (90 minutes)

**Flight Map Component** (src/components/flight/FlightMap.svelte):
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import mapboxgl from 'mapbox-gl';
  import { Deck } from '@deck.gl/core';
  import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
  import { MapboxLayer } from '@deck.gl/mapbox';
  import type { Flight, Airport } from '../../lib/db/types';

  export let flights: Flight[] = [];
  export let airports: Airport[] = [];
  export let selectedFlight: Flight | null = null;
  export let height = '600px';
  export let showControls = true;
  export let theme: 'light' | 'dark' = 'light';

  let mapContainer: HTMLDivElement;
  let map: mapboxgl.Map;
  let deck: Deck;
  let mounted = false;

  // Map configuration
  const MAPBOX_ACCESS_TOKEN = import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN;
  const INITIAL_VIEW_STATE = {
    longitude: 0,
    latitude: 20,
    zoom: 2,
    pitch: 0,
    bearing: 0
  };

  // Layer configurations
  let showAirports = true;
  let showFlights = true;
  let showRoutes = true;
  let animateRoutes = true;
  let clusteredView = false;

  // Filter states
  let selectedAirline = '';
  let selectedYear = '';
  let selectedStatus = '';

  $: airlines = [...new Set(flights.map(f => f.airline_name).filter(Boolean))];
  $: years = [...new Set(flights.map(f => new Date(f.departure_date).getFullYear()))].sort().reverse();
  $: statuses = ['completed', 'booked', 'cancelled'];

  // Filter flights based on current filters
  $: filteredFlights = flights.filter(flight => {
    if (selectedAirline && flight.airline_name !== selectedAirline) return false;
    if (selectedYear && new Date(flight.departure_date).getFullYear().toString() !== selectedYear) return false;
    if (selectedStatus && flight.flight_status !== selectedStatus) return false;
    return true;
  });

  // Create visited airports from flights
  $: visitedAirports = airports.filter(airport => 
    filteredFlights.some(flight => 
      flight.departure_airport_id === airport.id || flight.arrival_airport_id === airport.id
    )
  );

  onMount(async () => {
    if (!MAPBOX_ACCESS_TOKEN) {
      console.error('Mapbox access token is required');
      return;
    }

    // Initialize Mapbox map
    map = new mapboxgl.Map({
      container: mapContainer,
      style: theme === 'dark' 
        ? 'mapbox://styles/mapbox/dark-v11' 
        : 'mapbox://styles/mapbox/light-v11',
      ...INITIAL_VIEW_STATE,
      accessToken: MAPBOX_ACCESS_TOKEN
    });

    // Initialize deck.gl
    deck = new Deck({
      canvas: 'deck-canvas',
      width: '100%',
      height: '100%',
      initialViewState: INITIAL_VIEW_STATE,
      controller: true,
      layers: []
    });

    // Add deck.gl to map
    map.on('load', () => {
      updateLayers();
      mounted = true;
    });

    // Handle map style changes
    map.on('style.load', () => {
      if (mounted) updateLayers();
    });

    // Handle click events
    deck.setProps({
      onClick: handleMapClick,
      onHover: handleMapHover
    });
  });

  onDestroy(() => {
    deck?.finalize();
    map?.remove();
  });

  function updateLayers() {
    const layers = [];

    // Airport layer
    if (showAirports && visitedAirports.length > 0) {
      layers.push(
        new ScatterplotLayer({
          id: 'airports',
          data: visitedAirports,
          getPosition: (d: Airport) => d.coordinates,
          getRadius: (d: Airport) => Math.max(50000, d.visit_count * 25000),
          getFillColor: (d: Airport) => {
            if (selectedFlight) {
              const isOrigin = selectedFlight.departure_airport_id === d.id;
              const isDestination = selectedFlight.arrival_airport_id === d.id;
              if (isOrigin) return [34, 197, 94, 200]; // Green for origin
              if (isDestination) return [239, 68, 68, 200]; // Red for destination
            }
            return d.has_visited ? [59, 130, 246, 180] : [156, 163, 175, 120];
          },
          getLineColor: [255, 255, 255, 100],
          getLineWidth: 2,
          pickable: true,
          radiusMinPixels: 4,
          radiusMaxPixels: 20,
          updateTriggers: {
            getFillColor: [selectedFlight?.id]
          }
        })
      );
    }

    // Flight routes layer
    if (showRoutes && filteredFlights.length > 0) {
      layers.push(
        new ArcLayer({
          id: 'flight-routes',
          data: filteredFlights,
          getSourcePosition: (d: Flight) => d.origin,
          getTargetPosition: (d: Flight) => d.destination,
          getSourceColor: [34, 197, 94, 150],
          getTargetColor: [239, 68, 68, 150],
          getWidth: (d: Flight) => {
            if (selectedFlight?.id === d.id) return 8;
            return d.distance_km ? Math.max(2, Math.min(6, d.distance_km / 2000)) : 3;
          },
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 0, 200],
          updateTriggers: {
            getWidth: [selectedFlight?.id]
          }
        })
      );
    }

    // Add layers to deck
    if (mounted && map.isStyleLoaded()) {
      // Remove existing layers
      if (map.getLayer('airports')) map.removeLayer('airports');
      if (map.getLayer('flight-routes')) map.removeLayer('flight-routes');

      // Add new layers
      layers.forEach(layer => {
        if (layer instanceof ScatterplotLayer) {
          map.addLayer(new MapboxLayer({ id: 'airports', deck: deck }), 'airports');
        } else if (layer instanceof ArcLayer) {
          map.addLayer(new MapboxLayer({ id: 'flight-routes', deck: deck }), 'flight-routes');
        }
      });

      deck.setProps({ layers });
    }
  }

  function handleMapClick(info: any) {
    if (info.object) {
      if (info.layer?.id === 'airports') {
        const airport = info.object as Airport;
        showAirportPopup(airport, info.coordinate);
      } else if (info.layer?.id === 'flight-routes') {
        const flight = info.object as Flight;
        selectedFlight = flight;
        showFlightPopup(flight, info.coordinate);
      }
    }
  }

  function handleMapHover(info: any) {
    map.getCanvas().style.cursor = info.object ? 'pointer' : 'grab';
  }

  function showAirportPopup(airport: Airport, coordinate: [number, number]) {
    const popup = new mapboxgl.Popup({ offset: 25 })
      .setLngLat(coordinate)
      .setHTML(`
        <div class="p-3 min-w-[200px]">
          <h3 class="font-bold text-lg">${airport.name}</h3>
          <p class="text-sm text-gray-600">${airport.city}, ${airport.country}</p>
          <p class="text-sm"><strong>IATA:</strong> ${airport.iata_code}</p>
          <p class="text-sm"><strong>Visits:</strong> ${airport.visit_count}</p>
          ${airport.first_visit_date ? `<p class="text-sm"><strong>First Visit:</strong> ${new Date(airport.first_visit_date).toLocaleDateString()}</p>` : ''}
        </div>
      `)
      .addTo(map);
  }

  function showFlightPopup(flight: Flight, coordinate: [number, number]) {
    const popup = new mapboxgl.Popup({ offset: 25 })
      .setLngLat(coordinate)
      .setHTML(`
        <div class="p-3 min-w-[250px]">
          <h3 class="font-bold text-lg">${flight.flight_number}</h3>
          <p class="text-sm text-gray-600">${flight.airline_name || 'Unknown Airline'}</p>
          <p class="text-sm"><strong>Route:</strong> ${flight.departure_airport_name} → ${flight.arrival_airport_name}</p>
          <p class="text-sm"><strong>Date:</strong> ${new Date(flight.departure_date).toLocaleDateString()}</p>
          ${flight.distance_km ? `<p class="text-sm"><strong>Distance:</strong> ${flight.distance_km.toLocaleString()} km</p>` : ''}
          ${flight.duration_minutes ? `<p class="text-sm"><strong>Duration:</strong> ${Math.floor(flight.duration_minutes / 60)}h ${flight.duration_minutes % 60}m</p>` : ''}
          <div class="mt-2">
            <a href="/flights/${flight.id}" class="text-blue-600 hover:text-blue-800 text-sm font-medium">View Details →</a>
          </div>
        </div>
      `)
      .addTo(map);
  }

  function resetFilters() {
    selectedAirline = '';
    selectedYear = '';
    selectedStatus = '';
    selectedFlight = null;
  }

  function fitToFlights() {
    if (filteredFlights.length === 0) return;

    const coordinates = filteredFlights.flatMap(flight => [
      flight.origin,
      flight.destination
    ]);

    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord);
    }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

    map.fitBounds(bounds, { padding: 50 });
  }

  // Update layers when filters change
  $: if (mounted) updateLayers();

  // Update map theme
  $: if (map && mounted) {
    const newStyle = theme === 'dark' 
      ? 'mapbox://styles/mapbox/dark-v11' 
      : 'mapbox://styles/mapbox/light-v11';
    map.setStyle(newStyle);
  }
</script>

<div class="relative w-full" style="height: {height}">
  <!-- Map container -->
  <div bind:this={mapContainer} class="absolute inset-0 rounded-lg overflow-hidden">
    <canvas id="deck-canvas" class="absolute inset-0"></canvas>
  </div>

  {#if showControls}
    <!-- Map controls -->
    <div class="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-3 max-w-xs">
      <h3 class="font-semibold text-sm">Map Controls</h3>
      
      <!-- Layer toggles -->
      <div class="space-y-2">
        <label class="flex items-center space-x-2">
          <input type="checkbox" bind:checked={showAirports} class="rounded">
          <span class="text-sm">Show Airports</span>
        </label>
        <label class="flex items-center space-x-2">
          <input type="checkbox" bind:checked={showRoutes} class="rounded">
          <span class="text-sm">Show Routes</span>
        </label>
      </div>

      <!-- Filters -->
      <div class="space-y-2">
        <select bind:value={selectedAirline} class="w-full text-sm p-1 border rounded">
          <option value="">All Airlines</option>
          {#each airlines as airline}
            <option value={airline}>{airline}</option>
          {/each}
        </select>

        <select bind:value={selectedYear} class="w-full text-sm p-1 border rounded">
          <option value="">All Years</option>
          {#each years as year}
            <option value={year.toString()}>{year}</option>
          {/each}
        </select>

        <select bind:value={selectedStatus} class="w-full text-sm p-1 border rounded">
          <option value="">All Status</option>
          {#each statuses as status}
            <option value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
          {/each}
        </select>
      </div>

      <!-- Action buttons -->
      <div class="flex space-x-2">
        <button 
          on:click={resetFilters}
          class="flex-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 px-2 py-1 rounded"
        >
          Reset
        </button>
        <button 
          on:click={fitToFlights}
          class="flex-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 px-2 py-1 rounded"
        >
          Fit View
        </button>
      </div>
    </div>

    <!-- Flight statistics -->
    <div class="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-2">
      <h3 class="font-semibold text-sm">Statistics</h3>
      <div class="text-sm space-y-1">
        <div>Flights: <span class="font-medium">{filteredFlights.length}</span></div>
        <div>Airports: <span class="font-medium">{visitedAirports.length}</span></div>
        <div>Distance: <span class="font-medium">{filteredFlights.reduce((sum, f) => sum + (f.distance_km || 0), 0).toLocaleString()} km</span></div>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.mapboxgl-popup-content) {
    @apply rounded-lg shadow-xl border-0;
  }
  
  :global(.mapboxgl-popup-tip) {
    @apply border-t-white dark:border-t-gray-800;
  }
</style>
```

### Step 3: Flight API Endpoints (60 minutes)

**Flight API Routes** (src/pages/api/flights/index.ts):
```typescript
import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const db = new DatabaseQueries();
    const searchParams = new URL(request.url).searchParams;
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    // Filter parameters
    const airline = searchParams.get('airline');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    // Get flights with filters
    const flights = await db.getFlightsWithFilters({
      page,
      limit,
      airline,
      year: year ? parseInt(year) : undefined,
      status,
      search
    });

    return new Response(JSON.stringify({
      success: true,
      data: flights
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      }
    });
  } catch (error) {
    console.error('Error fetching flights:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch flights'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const db = new DatabaseQueries();
    const flightData = await request.json();

    // Validate required fields
    const requiredFields = ['flight_number', 'departure_airport_id', 'arrival_airport_id', 'departure_date'];
    for (const field of requiredFields) {
      if (!flightData[field]) {
        return new Response(JSON.stringify({
          success: false,
          error: `Missing required field: ${field}`
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Calculate distance if coordinates are available
    if (flightData.origin && flightData.destination) {
      flightData.distance_km = calculateDistance(
        flightData.origin[1], flightData.origin[0],
        flightData.destination[1], flightData.destination[0]
      );
    }

    const flight = await db.createFlight(flightData);
    
    // Update airport visit counts
    await Promise.all([
      db.updateAirportVisits(flightData.departure_airport_id, flightData.departure_date),
      db.updateAirportVisits(flightData.arrival_airport_id, flightData.arrival_date || flightData.departure_date)
    ]);

    return new Response(JSON.stringify({
      success: true,
      data: flight
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating flight:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to create flight'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}
```

**Flight Statistics API** (src/pages/api/flights/statistics.ts):
```typescript
import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

export const GET: APIRoute = async () => {
  try {
    const db = new DatabaseQueries();
    const statistics = await db.getFlightStatistics();

    return new Response(JSON.stringify({
      success: true,
      data: statistics
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    });
  } catch (error) {
    console.error('Error fetching flight statistics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch flight statistics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

## Testing & Validation

### Final Checklist
- [ ] Flight map loads and displays correctly with all flights and airports
- [ ] Interactive features work (clicking, hovering, popups)
- [ ] Flight statistics calculate accurately
- [ ] All API endpoints return correct data with proper error handling
- [ ] Map performance is smooth with large datasets
- [ ] Responsive design works on mobile devices
- [ ] Flight filtering and search functionality works
- [ ] Airport data imports and displays correctly
- [ ] Admin flight management interface functions properly

## Success Criteria
✅ Interactive flight map is fully functional with smooth performance  
✅ All flight data is properly stored and retrieved from database  
✅ Flight statistics and analytics are accurate and comprehensive  
✅ Travel visualization provides meaningful insights  
✅ API endpoints handle all flight operations correctly  
✅ Map controls and filtering work intuitively  
✅ System integrates seamlessly with existing blog content  
✅ Performance remains optimal with large flight datasets  

## Next Session
Plan 6 will focus on implementing the portfolio and credentials system with project showcases and professional achievements tracking.