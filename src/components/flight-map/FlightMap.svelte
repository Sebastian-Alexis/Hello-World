<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { writable, derived } from 'svelte/store';
	import mapboxgl from 'mapbox-gl';
	import { Deck } from '@deck.gl/core';
	import { MapboxOverlay } from '@deck.gl/mapbox';
	import { ScatterplotLayer, ArcLayer } from '@deck.gl/layers';
	import type { 
		Flight, 
		Airport, 
		FlightMapProps, 
		FilterOptions, 
		MapViewState 
	} from './types';
	import { 
		filterFlights, 
		getUniqueAirlines, 
		getUniqueYears,
		calculateBounds,
		formatDate,
		formatTime,
		getStatusColor,
		getArcHeight,
		getAirportRadius,
		debounce,
		throttle,
		validateMapboxToken
	} from './utils';

	//props
	export let flights: Flight[] = [];
	export let airports: Airport[] = [];
	export let selectedFlight: Flight | null = null;
	export let height = '600px';
	export let showControls = true;
	export let theme: 'light' | 'dark' = 'light';
	export let onFlightSelect: ((flight: Flight | null) => void) | undefined = undefined;
	export let onAirportSelect: ((airport: Airport | null) => void) | undefined = undefined;

	//event dispatcher
	const dispatch = createEventDispatcher<{
		flightSelect: Flight | null;
		airportSelect: Airport | null;
		mapReady: mapboxgl.Map;
		error: string;
	}>();

	//stores for filters
	const selectedAirlines = writable<Set<string>>(new Set());
	const selectedYears = writable<Set<number>>(new Set());
	const selectedStatuses = writable<Set<string>>(new Set(['booked', 'completed', 'cancelled', 'delayed']));
	const showAnimations = writable(true);
	const isLoading = writable(true);

	//reactive unique values for filter options
	$: uniqueAirlines = getUniqueAirlines(flights);
	$: uniqueYears = getUniqueYears(flights);

	//filtered data derived from stores with performance optimization
	const filteredFlights = derived(
		[selectedAirlines, selectedYears, selectedStatuses],
		([$airlines, $years, $statuses]) => {
			return filterFlights(flights, {
				airlines: $airlines,
				years: $years,
				statuses: $statuses
			});
		}
	);

	//map container and instances
	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	let deckOverlay: MapboxOverlay | null = null;
	let mounted = false;

	//popup handling
	let popup: mapboxgl.Popup | null = null;
	let hoveredObject: any = null;

	//animation time for arcs
	let animationTime = 0;
	let animationId: number;

	//mapbox token validation
	const MAPBOX_TOKEN = import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN;
	console.log('Mapbox token loaded:', MAPBOX_TOKEN ? 'Present' : 'Missing');
	console.log('Token validation result:', validateMapboxToken(MAPBOX_TOKEN));
	const isValidToken = validateMapboxToken(MAPBOX_TOKEN);

	//theme styles
	const mapStyles = {
		light: 'mapbox://styles/mapbox/light-v11',
		dark: 'mapbox://styles/mapbox/dark-v11'
	};

	onMount(() => {
		if (!isValidToken) {
			const errorMsg = 'Invalid or missing Mapbox access token. Please set PUBLIC_MAPBOX_ACCESS_TOKEN environment variable.';
			console.error(errorMsg);
			dispatch('error', errorMsg);
			isLoading.set(false);
			return;
		}

		mounted = true;
		initializeMap();
		startAnimation();
	});

	onDestroy(() => {
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
		cleanup();
	});

	function initializeMap() {
		console.log('initializeMap called:', { mounted, mapContainer: !!mapContainer, isValidToken });
		if (!mounted || !mapContainer || !isValidToken) return;

		try {
			console.log('Setting Mapbox access token...');
			mapboxgl.accessToken = MAPBOX_TOKEN!;

			//calculate optimal initial bounds
			const bounds = calculateBounds(airports, flights);
			let mapOptions: mapboxgl.MapboxOptions = {
				container: mapContainer,
				style: mapStyles[theme],
				attributionControl: false,
				maxZoom: 18,
				minZoom: 1
			};

			if (bounds) {
				mapOptions.bounds = bounds;
				mapOptions.fitBoundsOptions = { padding: 50 };
			} else {
				mapOptions.center = [0, 30];
				mapOptions.zoom = 2;
			}

			//create map
			map = new mapboxgl.Map(mapOptions);

			map.addControl(new mapboxgl.AttributionControl({ compact: true }));
			map.addControl(new mapboxgl.NavigationControl(), 'top-right');

			//create deck overlay with performance optimizations
			deckOverlay = new MapboxOverlay({
				interleaved: true,
				pickable: true,
				onHover: throttle(handleHover, 50), //throttle hover events
				onClick: handleClick
			});

			map.addControl(deckOverlay);

			//update layers when filters change (debounced for performance)
			const debouncedUpdateLayers = debounce(updateLayers, 100);
			filteredFlights.subscribe(debouncedUpdateLayers);

			map.on('load', () => {
				updateLayers();
				isLoading.set(false);
				dispatch('mapReady', map!);
			});

			map.on('error', (e) => {
				console.error('Map error:', e);
				dispatch('error', 'Map failed to load');
				isLoading.set(false);
			});

		} catch (error) {
			console.error('Error initializing map:', error);
			dispatch('error', 'Failed to initialize map');
			isLoading.set(false);
		}
	}

	function updateLayers() {
		if (!deckOverlay || !mounted) return;

		const currentFlights = $filteredFlights;
		
		//airport scatter layer with enhanced styling
		const airportLayer = new ScatterplotLayer({
			id: 'airports',
			data: airports,
			pickable: true,
			getPosition: (d: Airport) => d.coordinates,
			getRadius: (d: Airport) => getAirportRadius(d.visit_count),
			getFillColor: (d: Airport) => d.has_visited ? [34, 197, 94, 200] : [59, 130, 246, 200],
			getLineColor: (d: Airport) => d.has_visited ? [22, 163, 74, 255] : [37, 99, 235, 255],
			getLineWidth: 2000,
			radiusScale: 1,
			radiusMinPixels: 4,
			radiusMaxPixels: 25,
			stroked: true,
			filled: true,
			updateTriggers: {
				getRadius: [airports],
				getFillColor: [airports],
				getLineColor: [airports]
			}
		});

		//flight arc layer with dynamic styling
		const flightLayer = new ArcLayer({
			id: 'flights',
			data: currentFlights,
			pickable: true,
			getSourcePosition: (d: Flight) => d.origin,
			getTargetPosition: (d: Flight) => d.destination,
			getSourceColor: (d: Flight) => {
				const baseColor = getStatusColor(d.flight_status);
				if ($showAnimations) {
					const progress = (animationTime % 3000) / 3000;
					const alpha = Math.sin(progress * Math.PI * 2) * 60 + 140;
					return [baseColor[0], baseColor[1], baseColor[2], alpha];
				}
				return baseColor;
			},
			getTargetColor: (d: Flight) => {
				const progress = (animationTime % 3000) / 3000;
				const alpha = $showAnimations 
					? Math.sin((progress + 0.5) * Math.PI * 2) * 60 + 140
					: 180;
				return [239, 68, 68, alpha]; //red destination
			},
			getWidth: (d: Flight) => Math.max(1, Math.min(8, (d.distance_km || 1000) / 1500)),
			getTilt: (d: Flight) => Math.min(30, (d.distance_km || 1000) / 500),
			getHeight: (d: Flight) => getArcHeight(d.distance_km || 1000),
			updateTriggers: {
				getSourceColor: [$showAnimations, animationTime, currentFlights],
				getTargetColor: [$showAnimations, animationTime],
				getWidth: [currentFlights],
				getHeight: [currentFlights],
				getTilt: [currentFlights]
			}
		});

		deckOverlay.setProps({
			layers: [flightLayer, airportLayer]
		});
	}

	function handleHover(info: any) {
		if (!map) return;

		hoveredObject = info.object;

		if (info.object) {
			map.getCanvas().style.cursor = 'pointer';
			
			//create enhanced popup content
			let content = '';
			if (info.layer?.id === 'airports') {
				const airport = info.object as Airport;
				content = `
					<div class="flight-popup airport-popup">
						<div class="popup-header">
							<h3>${airport.name}</h3>
							<span class="iata-code">${airport.iata_code}</span>
						</div>
						<div class="popup-content">
							<p class="location">${airport.city}, ${airport.country}</p>
							<div class="airport-stats">
								<div class="stat-item">
									<span class="stat-label">Visits:</span>
									<span class="stat-value">${airport.visit_count}</span>
								</div>
								<div class="stat-item">
									<span class="stat-label">Status:</span>
									<span class="stat-value ${airport.has_visited ? 'visited' : 'unvisited'}">
										${airport.has_visited ? 'Visited' : 'Not visited'}
									</span>
								</div>
							</div>
						</div>
					</div>
				`;
			} else if (info.layer?.id === 'flights') {
				const flight = info.object as Flight;
				content = `
					<div class="flight-popup flight-popup">
						<div class="popup-header">
							<h3>${flight.airline_name || 'Unknown Airline'}</h3>
							<span class="flight-number">${flight.flight_number || ''}</span>
						</div>
						<div class="popup-content">
							<p class="route">${flight.departure_airport_name} → ${flight.arrival_airport_name}</p>
							<div class="flight-details">
								<div class="detail-item">
									<span class="detail-label">Date:</span>
									<span class="detail-value">${formatDate(flight.departure_time)}</span>
								</div>
								<div class="detail-item">
									<span class="detail-label">Status:</span>
									<span class="detail-value status-${flight.flight_status}">${flight.flight_status}</span>
								</div>
								${flight.distance_km ? `
									<div class="detail-item">
										<span class="detail-label">Distance:</span>
										<span class="detail-value">${flight.distance_km.toLocaleString()} km</span>
									</div>
								` : ''}
							</div>
						</div>
					</div>
				`;
			}

			if (content) {
				if (popup) popup.remove();
				popup = new mapboxgl.Popup({ 
					closeButton: false, 
					closeOnClick: false,
					className: 'flight-map-popup'
				})
					.setLngLat(info.coordinate)
					.setHTML(content)
					.addTo(map);
			}
		} else {
			map.getCanvas().style.cursor = '';
			if (popup) {
				popup.remove();
				popup = null;
			}
		}
	}

	function handleClick(info: any) {
		if (info.object) {
			if (info.layer?.id === 'flights') {
				selectedFlight = info.object;
				dispatch('flightSelect', info.object);
				if (onFlightSelect) onFlightSelect(info.object);
			} else if (info.layer?.id === 'airports') {
				dispatch('airportSelect', info.object);
				if (onAirportSelect) onAirportSelect(info.object);
			}
		}
	}

	function startAnimation() {
		function animate() {
			animationTime += 16; //roughly 60fps
			if ($showAnimations && mounted) {
				updateLayers();
			}
			animationId = requestAnimationFrame(animate);
		}
		animate();
	}

	function cleanup() {
		if (popup) {
			popup.remove();
			popup = null;
		}
		if (deckOverlay && map) {
			map.removeControl(deckOverlay);
		}
		if (map) {
			map.remove();
			map = null;
		}
		mounted = false;
	}

	//reactive updates for theme
	$: if (map && mounted) {
		map.setStyle(mapStyles[theme]);
	}

	//toggle functions for filters
	function toggleAirline(airline: string) {
		selectedAirlines.update(set => {
			const newSet = new Set(set);
			if (newSet.has(airline)) {
				newSet.delete(airline);
			} else {
				newSet.add(airline);
			}
			return newSet;
		});
	}

	function toggleYear(year: number) {
		selectedYears.update(set => {
			const newSet = new Set(set);
			if (newSet.has(year)) {
				newSet.delete(year);
			} else {
				newSet.add(year);
			}
			return newSet;
		});
	}

	function toggleStatus(status: string) {
		selectedStatuses.update(set => {
			const newSet = new Set(set);
			if (newSet.has(status)) {
				newSet.delete(status);
			} else {
				newSet.add(status);
			}
			return newSet;
		});
	}

	function clearAllFilters() {
		selectedAirlines.set(new Set());
		selectedYears.set(new Set());
		selectedStatuses.set(new Set(['booked', 'completed', 'cancelled', 'delayed']));
	}
</script>

<div class="flight-map-container" style="height: {height};">
	{#if !isValidToken}
		<div class="error-container">
			<div class="error-message">
				<h3>Map Configuration Error</h3>
				<p>Invalid or missing Mapbox access token. Please configure PUBLIC_MAPBOX_ACCESS_TOKEN in your environment variables with a valid token starting with 'pk.'</p>
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
		<!-- Controls Panel -->
		{#if showControls}
			<div class="controls-panel">
				<div class="controls-header">
					<h3>Flight Filters</h3>
					<button class="clear-btn" on:click={clearAllFilters}>Clear All</button>
				</div>

				<!-- Airlines Filter -->
				<div class="filter-group">
					<h4>Airlines</h4>
					<div class="filter-items">
						{#each uniqueAirlines as airline}
							<button 
								class="filter-item"
								class:active={$selectedAirlines.has(airline)}
								on:click={() => toggleAirline(airline)}
							>
								{airline}
							</button>
						{/each}
					</div>
				</div>

				<!-- Years Filter -->
				<div class="filter-group">
					<h4>Years</h4>
					<div class="filter-items">
						{#each uniqueYears as year}
							<button 
								class="filter-item"
								class:active={$selectedYears.has(year)}
								on:click={() => toggleYear(year)}
							>
								{year}
							</button>
						{/each}
					</div>
				</div>

				<!-- Status Filter -->
				<div class="filter-group">
					<h4>Status</h4>
					<div class="filter-items">
						{#each ['booked', 'completed', 'cancelled', 'delayed'] as status}
							<button 
								class="filter-item"
								class:active={$selectedStatuses.has(status)}
								on:click={() => toggleStatus(status)}
							>
								<span class="capitalize">{status}</span>
							</button>
						{/each}
					</div>
				</div>

				<!-- Animation Toggle -->
				<div class="filter-group">
					<label class="animation-toggle">
						<input 
							type="checkbox" 
							bind:checked={$showAnimations}
						/>
						<span>Enable Animations</span>
					</label>
				</div>

				<!-- Stats -->
				<div class="stats">
					<div class="stat">
						<span class="stat-value">{$filteredFlights.length}</span>
						<span class="stat-label">Flights Shown</span>
					</div>
					<div class="stat">
						<span class="stat-value">{airports.length}</span>
						<span class="stat-label">Airports</span>
					</div>
				</div>
			</div>
		{/if}

		<!-- Map Container -->
		<div class="map-container" bind:this={mapContainer}></div>

		<!-- Selected Flight Details -->
		{#if selectedFlight}
			<div class="flight-details">
				<div class="flight-details-header">
					<h3>Flight Details</h3>
					<button class="close-btn" on:click={() => selectedFlight = null}>×</button>
				</div>
				<div class="flight-details-content">
					<div class="detail-row">
						<span class="label">Flight:</span>
						<span class="value">{selectedFlight.airline_name} {selectedFlight.flight_number}</span>
					</div>
					<div class="detail-row">
						<span class="label">Route:</span>
						<span class="value">{selectedFlight.departure_airport_name} → {selectedFlight.arrival_airport_name}</span>
					</div>
					<div class="detail-row">
						<span class="label">Date:</span>
						<span class="value">{new Date(selectedFlight.departure_time).toLocaleDateString()}</span>
					</div>
					<div class="detail-row">
						<span class="label">Status:</span>
						<span class="value capitalize status-{selectedFlight.flight_status}">{selectedFlight.flight_status}</span>
					</div>
					{#if selectedFlight.distance_km}
						<div class="detail-row">
							<span class="label">Distance:</span>
							<span class="value">{selectedFlight.distance_km.toLocaleString()} km</span>
						</div>
					{/if}
				</div>
			</div>
		{/if}
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

	.controls-panel {
		position: absolute;
		top: 1rem;
		left: 1rem;
		z-index: 1000;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-radius: 8px;
		padding: 1rem;
		max-width: 280px;
		max-height: calc(100% - 2rem);
		overflow-y: auto;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}

	.controls-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.controls-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	.clear-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.clear-btn:hover {
		background: #e5e7eb;
	}

	.filter-group {
		margin-bottom: 1rem;
	}

	.filter-group h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.filter-items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.filter-item {
		padding: 0.25rem 0.5rem;
		font-size: 0.75rem;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		white-space: nowrap;
	}

	.filter-item:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
	}

	.filter-item.active {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
	}

	.animation-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	}

	.animation-toggle input {
		margin: 0;
	}

	.stats {
		display: flex;
		gap: 1rem;
		padding-top: 0.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1f2937;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
	}

	.flight-details {
		position: absolute;
		bottom: 1rem;
		right: 1rem;
		z-index: 1000;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-radius: 8px;
		padding: 1rem;
		min-width: 300px;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
	}

	.flight-details-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.flight-details-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: #6b7280;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.close-btn:hover {
		color: #374151;
	}

	.flight-details-content {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.label {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.value {
		font-size: 0.875rem;
		color: #1f2937;
		font-weight: 400;
		text-align: right;
	}

	.capitalize {
		text-transform: capitalize;
	}

	.status-completed {
		color: #059669;
	}

	.status-booked {
		color: #3b82f6;
	}

	.status-cancelled {
		color: #dc2626;
	}

	.status-delayed {
		color: #d97706;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.controls-panel {
			max-width: calc(100% - 2rem);
			max-height: 40%;
		}

		.flight-details {
			bottom: 1rem;
			right: 1rem;
			left: 1rem;
			min-width: auto;
		}
	}

	@media (max-width: 480px) {
		.controls-panel {
			top: 0.5rem;
			left: 0.5rem;
			right: 0.5rem;
			max-width: none;
			max-height: 35%;
		}

		.flight-details {
			bottom: 0.5rem;
			right: 0.5rem;
			left: 0.5rem;
		}
	}

	/* Dark theme support */
	:global(.dark) .controls-panel,
	:global(.dark) .flight-details {
		background: rgba(31, 41, 55, 0.95);
		color: #f9fafb;
	}

	:global(.dark) .controls-header h3,
	:global(.dark) .flight-details-header h3 {
		color: #f9fafb;
	}

	:global(.dark) .filter-group h4 {
		color: #d1d5db;
	}

	:global(.dark) .filter-item {
		background: #374151;
		border-color: #4b5563;
		color: #f9fafb;
	}

	:global(.dark) .filter-item:hover {
		background: #4b5563;
	}

	:global(.dark) .clear-btn {
		background: #374151;
		border-color: #4b5563;
		color: #f9fafb;
	}

	:global(.dark) .clear-btn:hover {
		background: #4b5563;
	}

	:global(.dark) .stat-value {
		color: #f9fafb;
	}

	:global(.dark) .stat-label {
		color: #9ca3af;
	}

	:global(.dark) .label {
		color: #9ca3af;
	}

	:global(.dark) .value {
		color: #f9fafb;
	}

	/* Enhanced popup styles */
	:global(.flight-map-popup .mapboxgl-popup-content) {
		padding: 0;
		border-radius: 8px;
		box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.1), 0 4px 6px -2px rgb(0 0 0 / 0.05);
		min-width: 250px;
	}

	:global(.flight-map-popup .mapboxgl-popup-tip) {
		border-top-color: white;
	}

	:global(.flight-popup) {
		font-family: system-ui, -apple-system, sans-serif;
	}

	:global(.flight-popup .popup-header) {
		padding: 12px 16px 8px;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	:global(.flight-popup .popup-header h3) {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: #1f2937;
	}

	:global(.flight-popup .iata-code,
	.flight-popup .flight-number) {
		background: #3b82f6;
		color: white;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.5px;
	}

	:global(.flight-popup .popup-content) {
		padding: 12px 16px;
	}

	:global(.flight-popup .location,
	.flight-popup .route) {
		margin: 0 0 8px 0;
		font-size: 12px;
		color: #6b7280;
		font-weight: 500;
	}

	:global(.flight-popup .airport-stats,
	.flight-popup .flight-details) {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	:global(.flight-popup .stat-item,
	.flight-popup .detail-item) {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
	}

	:global(.flight-popup .stat-label,
	.flight-popup .detail-label) {
		color: #6b7280;
		font-weight: 500;
	}

	:global(.flight-popup .stat-value,
	.flight-popup .detail-value) {
		color: #1f2937;
		font-weight: 600;
	}

	:global(.flight-popup .visited) {
		color: #059669;
	}

	:global(.flight-popup .unvisited) {
		color: #6b7280;
	}

	:global(.flight-popup .status-completed) {
		color: #059669;
		text-transform: capitalize;
	}

	:global(.flight-popup .status-booked) {
		color: #3b82f6;
		text-transform: capitalize;
	}

	:global(.flight-popup .status-cancelled) {
		color: #dc2626;
		text-transform: capitalize;
	}

	:global(.flight-popup .status-delayed) {
		color: #d97706;
		text-transform: capitalize;
	}

	/* Dark theme popup styles */
	:global(.dark .flight-map-popup .mapboxgl-popup-content) {
		background: #1f2937;
		color: #f9fafb;
	}

	:global(.dark .flight-map-popup .mapboxgl-popup-tip) {
		border-top-color: #1f2937;
	}

	:global(.dark .flight-popup .popup-header h3) {
		color: #f9fafb;
	}

	:global(.dark .flight-popup .popup-header) {
		border-bottom-color: #374151;
	}

	:global(.dark .flight-popup .stat-value,
	.dark .flight-popup .detail-value) {
		color: #f9fafb;
	}
</style>