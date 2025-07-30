# FlightMap Component

A sophisticated Svelte component that integrates Mapbox GL JS with deck.gl for interactive flight visualization. This component is designed for ultra-fast personal website flight tracking systems with support for real-time filtering, animations, and responsive design.

## Features

- **Interactive Map**: Mapbox GL JS base map with light/dark theme support
- **Flight Visualization**: deck.gl ArcLayer for animated flight routes
- **Airport Markers**: ScatterplotLayer with visit status and count indicators
- **Real-time Filtering**: Filter by airline, year, and flight status
- **Performance Optimized**: Debounced updates and throttled events for large datasets
- **Responsive Design**: Mobile-friendly with adaptive controls
- **Accessibility**: Proper ARIA attributes and keyboard navigation
- **Error Handling**: Comprehensive error states and loading indicators

## Installation

The component requires the following dependencies (already included in package.json):

```bash
npm install mapbox-gl @deck.gl/core @deck.gl/layers @deck.gl/mapbox
npm install --save-dev @types/mapbox-gl
```

## Environment Setup

Add your Mapbox access token to your environment variables:

```env
PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token_here
```

## Usage

### Basic Usage

```svelte
<script>
  import FlightMap from '../components/flight-map/FlightMap.svelte';
  import type { Flight, Airport } from '../components/flight-map/types';

  let flights: Flight[] = [
    {
      id: 1,
      flight_number: 'AA123',
      airline_name: 'American Airlines',
      departure_airport_name: 'Los Angeles International',
      arrival_airport_name: 'John F. Kennedy International',
      departure_time: '2024-01-15T10:00:00Z',
      flight_status: 'completed',
      distance_km: 3944,
      origin: [-118.4085, 33.9425],
      destination: [-73.7781, 40.6413]
    }
  ];

  let airports: Airport[] = [
    {
      id: 1,
      name: 'Los Angeles International Airport',
      iata_code: 'LAX',
      city: 'Los Angeles',
      country: 'United States',
      country_code: 'US',
      latitude: 33.9425,
      longitude: -118.4085,
      has_visited: true,
      visit_count: 5,
      coordinates: [-118.4085, 33.9425]
    }
  ];
</script>

<FlightMap {flights} {airports} height="600px" />
```

### Advanced Usage with Event Handlers

```svelte
<script>
  import FlightMap from '../components/flight-map/FlightMap.svelte';
  
  let selectedFlight = null;

  function handleFlightSelect(event) {
    selectedFlight = event.detail;
    console.log('Flight selected:', selectedFlight);
  }

  function handleAirportSelect(event) {
    console.log('Airport selected:', event.detail);
  }

  function handleMapReady(event) {
    const map = event.detail;
    console.log('Map is ready:', map);
  }

  function handleError(event) {
    console.error('Map error:', event.detail);
  }
</script>

<FlightMap 
  {flights} 
  {airports}
  bind:selectedFlight
  height="700px"
  showControls={true}
  theme="dark"
  on:flightSelect={handleFlightSelect}
  on:airportSelect={handleAirportSelect}
  on:mapReady={handleMapReady}
  on:error={handleError}
/>
```

### Integration with Astro

```astro
---
// src/pages/flights.astro
import BaseLayout from '../layouts/BaseLayout.astro';
import FlightMap from '../components/flight-map/FlightMap.svelte';

// Fetch data from your API
const flights = await fetch('/api/flights').then(r => r.json());
const airports = await fetch('/api/airports').then(r => r.json());
---

<BaseLayout title="Flight Map">
  <FlightMap 
    flights={flights.data} 
    airports={airports.data}
    client:load
  />
</BaseLayout>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `flights` | `Flight[]` | `[]` | Array of flight data |
| `airports` | `Airport[]` | `[]` | Array of airport data |
| `selectedFlight` | `Flight \| null` | `null` | Currently selected flight (bindable) |
| `height` | `string` | `'600px'` | Container height |
| `showControls` | `boolean` | `true` | Show filter controls panel |
| `theme` | `'light' \| 'dark'` | `'light'` | Map theme |
| `onFlightSelect` | `function` | `undefined` | Flight selection callback |
| `onAirportSelect` | `function` | `undefined` | Airport selection callback |

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `flightSelect` | `Flight \| null` | Fired when a flight is selected |
| `airportSelect` | `Airport \| null` | Fired when an airport is selected |
| `mapReady` | `mapboxgl.Map` | Fired when map is fully loaded |
| `error` | `string` | Fired when an error occurs |

## Data Types

### Flight Interface

```typescript
interface Flight {
  id: number;
  flight_number?: string;
  airline_name?: string;
  departure_airport_name?: string;
  arrival_airport_name?: string;
  departure_time: string;
  arrival_time?: string;
  flight_status: 'booked' | 'completed' | 'cancelled' | 'delayed';
  distance_km?: number;
  currency?: string;
  price?: number;
  is_favorite?: boolean;
  notes?: string;
  origin: [number, number]; // [lng, lat]
  destination: [number, number]; // [lng, lat]
}
```

### Airport Interface

```typescript
interface Airport {
  id: number;
  name: string;
  iata_code: string;
  icao_code?: string;
  city: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  timezone?: string;
  type?: string;
  is_active?: boolean;
  has_visited: boolean;
  visit_count: number;
  coordinates: [number, number]; // [lng, lat]
}
```

## Styling

The component supports extensive customization through CSS custom properties and class overrides:

### Theme Support

The component automatically adapts to light/dark themes using CSS custom properties:

```css
/* Light theme (default) */
.flight-map-container {
  --primary-color: #3b82f6;
  --success-color: #22c55e;
  --error-color: #ef4444;
  --warning-color: #f59e0b;
}

/* Dark theme */
:global(.dark) .flight-map-container {
  --primary-color: #60a5fa;
  --success-color: #4ade80;
  --error-color: #f87171;
  --warning-color: #fbbf24;
}
```

### Custom Styling

```css
/* Custom control panel styling */
.flight-map-container :global(.controls-panel) {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 12px;
}

/* Custom popup styling */
:global(.flight-map-popup .mapboxgl-popup-content) {
  border-radius: 8px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}
```

## Performance Optimization

The component includes several performance optimizations:

- **Debounced Updates**: Filter changes are debounced to prevent excessive re-renders
- **Throttled Events**: Hover events are throttled to maintain smooth interactions
- **Efficient Reactivity**: Uses Svelte stores for optimal reactive updates
- **Layer Optimization**: deck.gl layers use proper update triggers
- **Memory Management**: Proper cleanup of map instances and event listeners

## Accessibility

- Keyboard navigation support
- ARIA labels for interactive elements
- Screen reader compatible
- High contrast mode support
- Focus management

## Error Handling

The component handles various error scenarios:

- Invalid or missing Mapbox token
- Map initialization failures
- Network errors
- Malformed data

## Browser Support

- Modern browsers with WebGL support
- iOS Safari 12+
- Chrome 60+
- Firefox 60+
- Safari 12+

## Performance Guidelines

For optimal performance with large datasets:

1. **Limit concurrent flights**: Consider pagination or virtualization for >1000 flights
2. **Optimize coordinates**: Ensure coordinate arrays are properly formatted
3. **Use efficient filtering**: Implement server-side filtering for very large datasets
4. **Monitor memory usage**: The component cleans up resources automatically

## Troubleshooting

### Common Issues

1. **Map not loading**: Check Mapbox token validity and network connectivity
2. **Performance issues**: Reduce dataset size or disable animations
3. **Styling conflicts**: Use CSS custom properties for theming
4. **TypeScript errors**: Ensure proper type imports

### Debug Mode

Enable debug logging:

```javascript
// In browser console
localStorage.setItem('mapbox-gl:debug', 'true');
```

## Examples

See `/src/pages/flights/index.astro` for a complete implementation example with mock data and statistics display.

## Contributing

When contributing to the FlightMap component:

1. Follow the existing code style
2. Add TypeScript types for new features
3. Include comprehensive error handling
4. Update documentation for API changes
5. Test with various dataset sizes