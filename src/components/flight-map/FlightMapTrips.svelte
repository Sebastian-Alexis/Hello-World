<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { writable } from 'svelte/store';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import { validateMapboxToken } from './utils';
	
	// Types
	interface Airport {
		id: number;
		iata_code: string;
		name: string;
		city: string;
		country: string;
		coordinates: [number, number];
		trip_count: number;
		trips: Trip[];
	}
	
	interface Trip {
		id: number;
		name: string;
		start_date: string;
		end_date: string;
		blog_post: BlogPost | null;
		flights: Flight[];
	}
	
	interface BlogPost {
		id: number;
		title: string;
		slug: string;
		thumbnail: string;
		excerpt: string;
	}
	
	interface Flight {
		id: number;
		flight_number: string;
		departure_time: string;
		arrival_time: string;
		flight_type: 'departure' | 'arrival';
		next_airport: {
			iata: string;
			name: string;
			latitude: number;
			longitude: number;
		};
	}

	// Props
	export let height = '600px';
	export let theme: 'light' | 'dark' = 'light';
	export let onTripSelect: ((trip: Trip | null) => void) | undefined = undefined;
	export let onAirportSelect: ((airport: Airport | null) => void) | undefined = undefined;

	// Event dispatcher
	const dispatch = createEventDispatcher<{
		tripSelect: Trip | null;
		airportSelect: Airport | null;
		mapReady: mapboxgl.Map;
		error: string;
	}>();

	// Stores
	const isLoading = writable(true);
	const hasError = writable(false);
	const errorMessage = writable('');
	const airports = writable<Airport[]>([]);
	const selectedAirport = writable<Airport | null>(null);
	const selectedTrip = writable<Trip | null>(null);

	// Map instance and elements
	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let mapboxToken: string | undefined;
	let mounted = false;
	
	// Markers and popups
	let airportMarkers: Map<number, mapboxgl.Marker> = new Map();
	let currentDropdown: mapboxgl.Popup | null = null;
	let currentDetailPopup: mapboxgl.Popup | null = null;

	// Theme styles
	const mapStyles = {
		light: 'mapbox://styles/mapbox/light-v11',
		dark: 'mapbox://styles/mapbox/dark-v11'
	};

	onMount(async () => {
		// Access token inside onMount to avoid SSR issues
		mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN;
		
		if (!validateMapboxToken(mapboxToken)) {
			const errorMsg = 'Invalid or missing Mapbox access token. Please set VITE_MAPBOX_ACCESS_TOKEN or PUBLIC_MAPBOX_ACCESS_TOKEN environment variable.';
			console.error(errorMsg);
			errorMessage.set(errorMsg);
			hasError.set(true);
			isLoading.set(false);
			dispatch('error', errorMsg);
			return;
		}

		mounted = true;
		await loadAirportsData();
		initializeMap();
	});

	onDestroy(() => {
		cleanup();
	});

	async function loadAirportsData() {
		try {
			const response = await fetch('/api/airports/with-trips');
			if (!response.ok) throw new Error('Failed to fetch airports data');
			
			const result = await response.json();
			if (result.success && result.data) {
				airports.set(result.data);
			} else {
				throw new Error(result.error || 'Failed to load airports');
			}
		} catch (error) {
			console.error('Error loading airports:', error);
			errorMessage.set('Failed to load flight data. Please try again later.');
			hasError.set(true);
			isLoading.set(false);
		}
	}

	function initializeMap() {
		if (!mounted || !mapContainer || !mapboxToken) return;

		try {
			mapboxgl.accessToken = mapboxToken;

			map = new mapboxgl.Map({
				container: mapContainer,
				style: mapStyles[theme],
				center: [0, 30],
				zoom: 2,
				maxZoom: 18,
				minZoom: 1
			});

			map.addControl(new mapboxgl.NavigationControl(), 'top-right');

			map.on('load', () => {
				addAirportMarkers();
				isLoading.set(false);
				dispatch('mapReady', map!);
			});

			map.on('error', (e) => {
				console.error('Map error:', e);
				const errorMsg = `Map failed to load: ${e.error?.message || 'Unknown error'}`;
				errorMessage.set(errorMsg);
				hasError.set(true);
				isLoading.set(false);
				dispatch('error', errorMsg);
			});

		} catch (error) {
			console.error('Error initializing map:', error);
			const errorMsg = `Failed to initialize map: ${error instanceof Error ? error.message : 'Unknown error'}`;
			errorMessage.set(errorMsg);
			hasError.set(true);
			isLoading.set(false);
			dispatch('error', errorMsg);
		}
	}

	function addAirportMarkers() {
		if (!map) return;

		$airports.forEach(airport => {
			// Create custom marker element
			const el = document.createElement('div');
			el.className = 'airport-marker';
			el.style.width = '30px';
			el.style.height = '30px';
			el.style.borderRadius = '50%';
			el.style.backgroundColor = '#3b82f6';
			el.style.border = '3px solid white';
			el.style.cursor = 'pointer';
			el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
			
			// Add trip count badge
			if (airport.trip_count > 1) {
				const badge = document.createElement('div');
				badge.className = 'trip-count-badge';
				badge.textContent = airport.trip_count.toString();
				badge.style.position = 'absolute';
				badge.style.top = '-8px';
				badge.style.right = '-8px';
				badge.style.backgroundColor = '#ef4444';
				badge.style.color = 'white';
				badge.style.borderRadius = '50%';
				badge.style.width = '20px';
				badge.style.height = '20px';
				badge.style.display = 'flex';
				badge.style.alignItems = 'center';
				badge.style.justifyContent = 'center';
				badge.style.fontSize = '12px';
				badge.style.fontWeight = 'bold';
				badge.style.border = '2px solid white';
				el.appendChild(badge);
			}

			const marker = new mapboxgl.Marker({
				element: el
			})
			.setLngLat(airport.coordinates)
			.addTo(map!);

			// Add click handler
			el.addEventListener('click', () => handleAirportClick(airport));
			
			airportMarkers.set(airport.id, marker);
		});
	}

	function handleAirportClick(airport: Airport) {
		selectedAirport.set(airport);
		dispatch('airportSelect', airport);
		if (onAirportSelect) onAirportSelect(airport);
		
		// Close existing popups
		if (currentDropdown) currentDropdown.remove();
		if (currentDetailPopup) currentDetailPopup.remove();
		
		if (airport.trip_count === 1) {
			// Single trip - show details directly
			showTripDetails(airport.trips[0], airport);
		} else {
			// Multiple trips - show dropdown
			showTripDropdown(airport);
		}
	}

	function showTripDropdown(airport: Airport) {
		if (!map) return;

		const dropdownHtml = `
			<div class="trip-dropdown">
				<h3>${airport.name} (${airport.iata_code})</h3>
				<p class="airport-location">${airport.city}, ${airport.country}</p>
				<div class="trip-list">
					${airport.trips.map(trip => `
						<div class="trip-item" data-trip-id="${trip.id}">
							<div class="trip-name">${trip.name}</div>
							<div class="trip-dates">${formatDateRange(trip.start_date, trip.end_date)}</div>
						</div>
					`).join('')}
				</div>
			</div>
		`;

		currentDropdown = new mapboxgl.Popup({
			closeButton: true,
			closeOnClick: false,
			maxWidth: '300px',
			className: 'trip-dropdown-popup'
		})
		.setLngLat(airport.coordinates)
		.setHTML(dropdownHtml)
		.addTo(map);

		// Add click handlers for trip items
		setTimeout(() => {
			const tripItems = document.querySelectorAll('.trip-item');
			tripItems.forEach(item => {
				item.addEventListener('click', () => {
					const tripId = parseInt(item.getAttribute('data-trip-id')!);
					const trip = airport.trips.find(t => t.id === tripId);
					if (trip) {
						if (currentDropdown) currentDropdown.remove();
						showTripDetails(trip, airport);
					}
				});
			});
		}, 0);
	}

	function showTripDetails(trip: Trip, airport: Airport) {
		if (!map) return;

		selectedTrip.set(trip);
		dispatch('tripSelect', trip);
		if (onTripSelect) onTripSelect(trip);

		// Find the relevant flights for this airport
		const relevantFlights = trip.flights.filter(f => 
			(f.flight_type === 'departure' && airport) || 
			(f.flight_type === 'arrival' && airport)
		);

		const detailHtml = `
			<div class="trip-detail">
				<h3>${trip.name}</h3>
				<p class="trip-dates">${formatDateRange(trip.start_date, trip.end_date)}</p>
				
				<div class="flight-info">
					${relevantFlights.map(flight => `
						<div class="flight-item">
							<div class="flight-number">${flight.flight_number}</div>
							<div class="flight-time">
								${flight.flight_type === 'departure' 
									? `Departure: ${formatDateTime(flight.departure_time)}` 
									: `Arrival: ${formatDateTime(flight.arrival_time)}`}
							</div>
						</div>
					`).join('')}
				</div>
				
				${trip.blog_post ? `
					<div class="blog-preview">
						${trip.blog_post.thumbnail ? `
							<img src="${trip.blog_post.thumbnail}" alt="${trip.blog_post.title}" />
						` : ''}
						<div class="blog-content">
							<h4>${trip.blog_post.title}</h4>
							${trip.blog_post.excerpt ? `<p>${trip.blog_post.excerpt}</p>` : ''}
							<a href="/blog/${trip.blog_post.slug}" target="_blank">Read more →</a>
						</div>
					</div>
				` : ''}
				
				${relevantFlights.length > 0 && relevantFlights[0].next_airport ? `
					<button class="jump-button" data-lat="${relevantFlights[0].next_airport.latitude}" 
						data-lng="${relevantFlights[0].next_airport.longitude}"
						data-name="${relevantFlights[0].next_airport.name}">
						Jump to ${relevantFlights[0].flight_type === 'departure' ? 'Destination' : 'Origin'} 
						(${relevantFlights[0].next_airport.iata})
					</button>
				` : ''}
			</div>
		`;

		currentDetailPopup = new mapboxgl.Popup({
			closeButton: true,
			closeOnClick: false,
			maxWidth: '400px',
			className: 'trip-detail-popup'
		})
		.setLngLat(airport.coordinates)
		.setHTML(detailHtml)
		.addTo(map);

		// Add click handler for jump button
		setTimeout(() => {
			const jumpButton = document.querySelector('.jump-button');
			if (jumpButton) {
				jumpButton.addEventListener('click', (e) => {
					const lat = parseFloat((e.target as HTMLElement).getAttribute('data-lat')!);
					const lng = parseFloat((e.target as HTMLElement).getAttribute('data-lng')!);
					const name = (e.target as HTMLElement).getAttribute('data-name')!;
					
					if (map) {
						map.flyTo({
							center: [lng, lat],
							zoom: 8,
							duration: 3000,
							essential: true
						});
					}
				});
			}
		}, 0);
	}

	function formatDateRange(start: string, end: string): string {
		const startDate = new Date(start);
		const endDate = new Date(end);
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
		
		if (startDate.getFullYear() === endDate.getFullYear()) {
			if (startDate.getMonth() === endDate.getMonth()) {
				return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })}`;
			}
			return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', options)}`;
		}
		
		return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
	}

	function formatDateTime(dateTime: string): string {
		const date = new Date(dateTime);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function cleanup() {
		mounted = false;
		
		if (currentDropdown) {
			currentDropdown.remove();
			currentDropdown = null;
		}
		
		if (currentDetailPopup) {
			currentDetailPopup.remove();
			currentDetailPopup = null;
		}
		
		airportMarkers.forEach(marker => marker.remove());
		airportMarkers.clear();
		
		if (map) {
			map.remove();
			map = null;
		}
	}

	// Reactive updates for theme
	$: if (map && mounted) {
		map.setStyle(mapStyles[theme]);
	}
</script>

<div class="flight-map-container" style="height: {height};">
	{#if $hasError}
		<div class="error-container">
			<div class="error-message">
				<h3>Map Configuration Error</h3>
				<p>{$errorMessage}</p>
			</div>
		</div>
	{:else if $isLoading}
		<div class="loading-container">
			<div class="loading-spinner">
				<div class="spinner"></div>
				<p>Loading flight map...</p>
			</div>
		</div>
	{:else}
		<div class="map-container" bind:this={mapContainer}></div>
	{/if}
</div>

<style>
	.flight-map-container {
		position: relative;
		width: 100%;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}

	.map-container {
		width: 100%;
		height: 100%;
	}

	.error-container,
	.loading-container {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		background: #f3f4f6;
	}

	.error-message {
		text-align: center;
		padding: 2rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
		max-width: 500px;
	}

	.error-message h3 {
		color: #dc2626;
		margin: 0 0 0.5rem 0;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.error-message p {
		color: #6b7280;
		margin: 0;
		font-size: 0.875rem;
	}

	.loading-spinner {
		text-align: center;
		padding: 2rem;
		background: white;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.spinner {
		width: 40px;
		height: 40px;
		margin: 0 auto 1rem;
		border: 3px solid #e5e7eb;
		border-top: 3px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.loading-spinner p {
		color: #6b7280;
		margin: 0;
		font-size: 0.875rem;
	}

	/* Popup styles */
	:global(.trip-dropdown-popup .mapboxgl-popup-content),
	:global(.trip-detail-popup .mapboxgl-popup-content) {
		padding: 0;
		border-radius: 8px;
		box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05);
	}

	:global(.trip-dropdown) {
		padding: 1rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	:global(.trip-dropdown h3) {
		margin: 0 0 0.25rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	:global(.trip-dropdown .airport-location) {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	:global(.trip-list) {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	:global(.trip-item) {
		padding: 0.75rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s;
	}

	:global(.trip-item:hover) {
		background: #e5e7eb;
		border-color: #d1d5db;
	}

	:global(.trip-name) {
		font-weight: 500;
		color: #1f2937;
		margin-bottom: 0.25rem;
	}

	:global(.trip-dates) {
		font-size: 0.75rem;
		color: #6b7280;
	}

	:global(.trip-detail) {
		padding: 1.25rem;
		font-family: system-ui, -apple-system, sans-serif;
	}

	:global(.trip-detail h3) {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	:global(.trip-detail > .trip-dates) {
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	:global(.flight-info) {
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: #f9fafb;
		border-radius: 6px;
	}

	:global(.flight-item) {
		padding: 0.5rem 0;
		border-bottom: 1px solid #e5e7eb;
	}

	:global(.flight-item:last-child) {
		border-bottom: none;
	}

	:global(.flight-number) {
		font-weight: 600;
		color: #1f2937;
		margin-bottom: 0.25rem;
	}

	:global(.flight-time) {
		font-size: 0.875rem;
		color: #6b7280;
	}

	:global(.blog-preview) {
		margin: 1rem 0;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 6px;
	}

	:global(.blog-preview img) {
		width: 100%;
		height: 120px;
		object-fit: cover;
		border-radius: 4px;
		margin-bottom: 0.75rem;
	}

	:global(.blog-content h4) {
		margin: 0 0 0.5rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	:global(.blog-content p) {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	:global(.blog-content a) {
		color: #3b82f6;
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
	}

	:global(.blog-content a:hover) {
		text-decoration: underline;
	}

	:global(.jump-button) {
		width: 100%;
		padding: 0.75rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 6px;
		font-weight: 500;
		cursor: pointer;
		transition: background 0.2s;
	}

	:global(.jump-button:hover) {
		background: #2563eb;
	}

	/* Dark theme support */
	:global(.dark .trip-dropdown h3),
	:global(.dark .trip-detail h3) {
		color: #f9fafb;
	}

	:global(.dark .trip-dropdown),
	:global(.dark .trip-detail) {
		background: #1f2937;
		color: #f9fafb;
	}

	:global(.dark .trip-item),
	:global(.dark .flight-info),
	:global(.dark .blog-preview) {
		background: #374151;
		border-color: #4b5563;
	}

	:global(.dark .trip-item:hover) {
		background: #4b5563;
	}

	:global(.dark .trip-name),
	:global(.dark .flight-number),
	:global(.dark .blog-content h4) {
		color: #f9fafb;
	}

	:global(.dark .airport-location),
	:global(.dark .trip-dates),
	:global(.dark .flight-time),
	:global(.dark .blog-content p) {
		color: #d1d5db;
	}
</style>