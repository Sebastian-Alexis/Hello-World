<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher, tick } from 'svelte';
	import { writable, derived } from 'svelte/store';
	import mapboxgl from 'mapbox-gl';
	import 'mapbox-gl/dist/mapbox-gl.css';
	import greatCircle from '@turf/great-circle';
	import { point } from '@turf/helpers';
	// Deck.GL imports removed - using native Mapbox layers only
	// import { Deck } from '@deck.gl/core';
	// import { MapboxOverlay } from '@deck.gl/mapbox';
	import type { 
		Flight, 
		Airport, 
		FlightMapProps, 
		FilterOptions, 
		MapViewState 
	} from './types';
	import { 
		filterFlights, 
		filterFlightsEnhanced,
		getUniqueAirlines, 
		getUniqueYears,
		calculateBounds,
		formatDate,
		formatTime,
		getStatusColor,
		getAirportRadius,
		debounce,
		validateMapboxToken,
		getValidAirportCoordinates,
		getValidFlightCoordinates,
		validateDatasetPerformance,
		detectOverlappingAirports,
		identifyAirportsNeedingGeocoding,
		airportNeedsGeocoding,
		isValidCoordinate,
		isNullIsland,
		crossesDateLine,
		isPolarRegion,
		generateGreatCirclePath,
		generateBezierPath,
		calculateDistance,
		splitPathAtAntimeridian
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
	export let mapboxToken: string | undefined = undefined;

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
	const hasError = writable(false);
	const errorMessage = writable('');
	
	// Data validation tracking
	const dataValidation = writable({
		validFlights: 0,
		invalidFlights: 0,
		validAirports: 0,
		invalidAirports: 0,
		issues: [] as Array<{ type: 'flight' | 'airport'; item: any; issues: string[] }>,
		performance: { isLargeDataset: false, estimatedRenderTime: 0 },
		overlappingGroups: [] as Array<{ location: string; airports: Airport[]; avgCoordinates: [number, number] }>
	});

	//reactive unique values for filter options
	$: uniqueAirlines = getUniqueAirlines(flights);
	$: uniqueYears = getUniqueYears(flights);

	// Debug logging for airports data structure
	$: {
		console.log('🛫 AIRPORTS DATA ANALYSIS:', {
			airportsCount: airports.length,
			firstAirport: airports[0],
			firstFewAirports: airports.slice(0, 3),
			coordinateFields: airports.length > 0 ? Object.keys(airports[0]).filter(key => 
				key.toLowerCase().includes('coord') || 
				key.toLowerCase().includes('lat') || 
				key.toLowerCase().includes('lng') || 
				key.toLowerCase().includes('lon')
			) : [],
			allFields: airports.length > 0 ? Object.keys(airports[0]) : [],
			hasCoordinatesField: airports.length > 0 && 'coordinates' in airports[0],
			coordinatesType: airports.length > 0 ? typeof airports[0].coordinates : 'N/A',
			coordinatesValue: airports.length > 0 ? airports[0].coordinates : 'N/A'
		});
	}

	//filtered data derived from stores with enhanced validation
	const filteredFlights = derived(
		[selectedAirlines, selectedYears, selectedStatuses],
		([$airlines, $years, $statuses]) => {
			const result = filterFlightsEnhanced(flights, {
				airlines: $airlines,
				years: $years,
				statuses: $statuses
			});
			
			// Update validation tracking
			dataValidation.update(prev => ({
				...prev,
				validFlights: result.validFlights.length,
				invalidFlights: result.invalidFlights.length,
				issues: [
					...prev.issues.filter(issue => issue.type !== 'flight'),
					...result.issues.map(issue => ({
						type: 'flight' as const,
						item: issue.flight,
						issues: issue.issues
					}))
				]
			}));
			
			// Log invalid flights for debugging
			if (result.invalidFlights.length > 0) {
				console.warn(`⚠️ ${result.invalidFlights.length} flights filtered out due to invalid coordinates:`, 
					result.issues.map(i => ({ id: i.flight.flight_id, issues: i.issues })));
			}
			
			return result.validFlights;
		}
	);

	//map container and instances
	let mapContainer: HTMLDivElement;
	let map: mapboxgl.Map | null = null;
	// Deck.GL overlay removed - using native Mapbox layers only
	// let deckOverlay: MapboxOverlay | null = null;
	let mounted = false;

	//popup handling
	let flightPopup: mapboxgl.Popup | null = null;
	let airportPopups: Map<string, mapboxgl.Popup> = new Map();
	let hoveredObject: any = null;

	//marker management
	let airportMarkers: mapboxgl.Marker[] = [];

	//theme styles
	const mapStyles = {
		light: 'mapbox://styles/mapbox/light-v11',
		dark: 'mapbox://styles/mapbox/dark-v11'
	};

	onMount(async () => {
		// Validate data on mount
		validateDataOnMount();
		
		// Use the token passed as prop, or try to get from environment as fallback
		if (!mapboxToken) {
			// Try multiple sources for the token
			mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || 
			              import.meta.env.PUBLIC_MAPBOX_ACCESS_TOKEN ||
			              (typeof window !== 'undefined' && window.MAPBOX_ACCESS_TOKEN) ||
			              '';
		}
		
		console.log('FlightMap onMount - Token check:', { 
			hasToken: !!mapboxToken,
			tokenLength: mapboxToken?.length || 0,
			environment: import.meta.env.MODE,
			isValid: validateMapboxToken(mapboxToken),
			tokenFromProp: !!mapboxToken
		});
		
		if (!validateMapboxToken(mapboxToken)) {
			const errorMsg = 'Invalid or missing Mapbox access token. Please ensure the mapboxToken prop is provided or set VITE_MAPBOX_ACCESS_TOKEN environment variable with a valid token starting with "pk."';
			console.error(errorMsg);
			errorMessage.set(errorMsg);
			hasError.set(true);
			isLoading.set(false);
			dispatch('error', errorMsg);
			return;
		}

		mounted = true;
		
		// First, set isLoading to false to render the map container
		isLoading.set(false);
		
		// Wait for the next tick to ensure DOM updates
		await tick();
		
		// Now wait a bit more to ensure the map container is bound
		setTimeout(() => {
			if (mapContainer && mounted) {
				console.log('Map container ready, initializing...');
				initializeMap();
			} else {
				console.error('Map container not available after waiting');
				console.error('Debug info:', {
					mounted,
					mapContainer,
					mapContainerExists: !!mapContainer,
					domElement: document.querySelector('.map-container'),
					hasError: $hasError,
					isLoading: $isLoading
				});
				errorMessage.set('Failed to initialize map container. Please refresh the page.');
				hasError.set(true);
			}
		}, 100); // Small delay to ensure binding is complete
	});

	onDestroy(() => {
		cleanup();
	});

	function initializeMap() {
		console.log('initializeMap called:', { mounted, mapContainer: !!mapContainer, hasToken: !!mapboxToken });
		if (!mounted || !mapContainer || !mapboxToken) {
			console.error('Cannot initialize map:', { mounted, hasMapContainer: !!mapContainer, hasToken: !!mapboxToken });
			return;
		}

		try {
			console.log('Setting Mapbox access token...');
			mapboxgl.accessToken = mapboxToken;

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
			console.log('Creating Mapbox map with options:', mapOptions);
			map = new mapboxgl.Map(mapOptions);
			console.log('Map instance created:', !!map);

			map.addControl(new mapboxgl.AttributionControl({ compact: true }));
			map.addControl(new mapboxgl.NavigationControl(), 'top-right');

			// Deck.GL overlay removed - using native Mapbox layers only
			// Previously used for flight arcs, now using native dotted lines

			//update layers when filters change (debounced for performance)
			const debouncedUpdateLayers = debounce(updateLayers, 100);
			filteredFlights.subscribe(debouncedUpdateLayers);
			
			//update markers when airports data changes
			const debouncedUpdateMarkers = debounce(updateMarkers, 100);

			map.on('load', () => {
				console.log('Map loaded successfully');
				
				// Add flight paths GeoJSON source
				if (!map) return;
				
				map.addSource('flight-paths', {
					type: 'geojson',
					data: flightsToGeoJSON($filteredFlights)
				});

				// Add smooth curved line layer for flight paths
				map.addLayer({
					id: 'flight-paths',
					type: 'line',
					source: 'flight-paths',
					layout: {
						'line-join': 'round',
						'line-cap': 'round'
					},
					paint: {
						'line-color': '#000000',  // Pure black for all paths
						'line-width': [
							'interpolate',
							['linear'],
							['zoom'],
							1, 1.5,
							5, 2.5,
							10, 3.5
						],
						'line-opacity': 0.8,
						'line-blur': 0.5 // Slight blur for smoother appearance
					}
				});

				// Add hover cursor for flight paths
				map.on('mouseenter', 'flight-paths', () => {
					if (map) map.getCanvas().style.cursor = 'pointer';
				});

				map.on('mouseleave', 'flight-paths', () => {
					if (map) map.getCanvas().style.cursor = '';
				});

				// Add click handler for flight paths
				map.on('click', 'flight-paths', (e) => {
					if (e.features && e.features.length > 0) {
						const feature = e.features[0];
						const flightId = feature.properties?.flightId || feature.properties?.id;
						
						// Find the corresponding flight object
						const flight = $filteredFlights.find(f => f.flight_id === flightId);
						if (flight) {
							selectedFlight = flight;
							dispatch('flightSelect', flight);
							if (onFlightSelect) onFlightSelect(flight);
						}
					}
				});

				// Add hover popup for flight paths with validation info
				map.on('mouseenter', 'flight-paths', (e) => {
					if (e.features && e.features.length > 0) {
						const feature = e.features[0];
						const props = feature.properties;
						
						// Add validation warnings
						const warnings = [];
						if (props?.crossesDateLine) warnings.push('⚠️ Crosses international date line');
						if (props?.isPolarOrigin) warnings.push('⚠️ Origin in polar region');
						if (props?.isPolarDestination) warnings.push('⚠️ Destination in polar region');
						if (props?.validationIssues?.length > 0) {
							warnings.push(...props.validationIssues.map(issue => `⚠️ ${issue}`));
						}
						
						const content = `
							<div class="flight-popup flight-popup">
								<div class="popup-header">
									<h3>${props?.airline || 'Unknown Airline'}</h3>
									<span class="flight-number">${props?.flightNumber || ''}</span>
								</div>
								<div class="popup-content">
									<p class="route">${props?.departureAirport} → ${props?.arrivalAirport}</p>
									${warnings.length > 0 ? `
										<div class="coordinate-warnings">
											${warnings.map(warning => `<p class="warning">${warning}</p>`).join('')}
										</div>
									` : ''}
									<div class="flight-details">
										<div class="detail-item">
											<span class="detail-label">Date:</span>
											<span class="detail-value">${formatDate(props?.departureTime)}</span>
										</div>
										<div class="detail-item">
											<span class="detail-label">Status:</span>
											<span class="detail-value status-${props?.status}">${props?.status}</span>
										</div>
										${props?.distance ? `
											<div class="detail-item">
												<span class="detail-label">Distance:</span>
												<span class="detail-value">${props.distance.toLocaleString()} km</span>
											</div>
										` : ''}
									</div>
								</div>
							</div>
						`;

						if (flightPopup) flightPopup.remove();
						flightPopup = new mapboxgl.Popup({ 
							closeButton: false, 
							closeOnClick: false,
							className: 'flight-map-popup'
						})
							.setLngLat(e.lngLat)
							.setHTML(content)
							.addTo(map);
					}
				});

				map.on('mouseleave', 'flight-paths', () => {
					if (flightPopup) {
						flightPopup.remove();
						flightPopup = null;
					}
				});
				
				updateLayers();
				updateMarkers();
				isLoading.set(false);
				dispatch('mapReady', map);
			});

			map.on('error', (e) => {
				console.error('Map error:', e);
				const errorMsg = `Map failed to load: ${e.error?.message || 'Unknown error'}`;
				errorMessage.set(errorMsg);
				hasError.set(true);
				isLoading.set(false);
				dispatch('error', errorMsg);
			});

			// Add timeout to catch if map never loads
			setTimeout(() => {
				if ($isLoading) {
					console.error('Map load timeout - map failed to load within 10 seconds');
					errorMessage.set('Map load timeout - please check your internet connection and Mapbox token');
					hasError.set(true);
					isLoading.set(false);
					dispatch('error', 'Map load timeout');
				}
			}, 10000);

		} catch (error) {
			console.error('Error initializing map:', error);
			const errorMsg = `Failed to initialize map: ${error instanceof Error ? error.message : 'Unknown error'}`;
			errorMessage.set(errorMsg);
			hasError.set(true);
			isLoading.set(false);
			dispatch('error', errorMsg);
		}
	}

	function flightsToGeoJSON(flights: Flight[]) {
		const allFeatures: any[] = [];
		
		flights.forEach(flight => {
			const { origin, destination, issues } = getValidFlightCoordinates(flight);
			
			// Only include flights with valid coordinates
			if (origin && destination) {
				// Calculate distance to determine path type
				const distance = calculateDistance(origin, destination);
				const crossesAntimeridian = crossesDateLine(origin[0], destination[0]);
				
				// For flights crossing the Pacific, we need to use a MultiLineString
				if (crossesAntimeridian && distance > 5000) {
					// Use Turf great circle which returns proper segments
					try {
						const gc = greatCircle(point(origin), point(destination), {
							npoints: 100
						});
						
						if (gc && gc.geometry) {
							allFeatures.push({
								type: 'Feature',
								geometry: gc.geometry, // Use Turf's geometry directly (MultiLineString)
								properties: {
									id: flight.flight_id,
									flightId: flight.flight_id,
									status: flight.flight_status,
									airline: flight.airline_name,
									flightNumber: flight.flight_number,
									departureAirport: flight.departure_airport_name,
									arrivalAirport: flight.arrival_airport_name,
									distance: distance,
									departureTime: flight.departure_time,
									validationIssues: issues.length > 0 ? issues : undefined,
									crossesDateLine: true,
									isPolarOrigin: isPolarRegion(origin[1]),
									isPolarDestination: isPolarRegion(destination[1])
								}
							});
							return; // Skip the regular path generation
						}
					} catch (error) {
						console.warn('Failed to generate great circle for crossing flight:', error);
					}
				}
				
				// Generate curved path for non-crossing or shorter flights
				let pathCoordinates: [number, number][];
				
				if (distance > 5000) {
					// Long distance flights: use great circle path
					pathCoordinates = generateGreatCirclePath(origin, destination, 100);
				} else if (distance > 500) {
					// Medium distance flights: use bezier curve with moderate height
					const curveHeight = Math.min(0.3, distance / 10000);
					pathCoordinates = generateBezierPath(origin, destination, curveHeight, 75);
				} else {
					// Short distance flights: use slight bezier curve
					pathCoordinates = generateBezierPath(origin, destination, 0.1, 50);
				}
				
				// Create a single feature for the flight path
				allFeatures.push({
					type: 'Feature',
					geometry: {
						type: 'LineString',
						coordinates: pathCoordinates
					},
					properties: {
						id: flight.flight_id,
						flightId: flight.flight_id,
						status: flight.flight_status,
						airline: flight.airline_name,
						flightNumber: flight.flight_number,
						departureAirport: flight.departure_airport_name,
						arrivalAirport: flight.arrival_airport_name,
						distance: distance,
						departureTime: flight.departure_time,
						// Add validation info for debugging
						validationIssues: issues.length > 0 ? issues : undefined,
						crossesDateLine: crossesAntimeridian,
						isPolarOrigin: isPolarRegion(origin[1]),
						isPolarDestination: isPolarRegion(destination[1])
					}
				});
			} else if (issues.length > 0) {
				// Log invalid flights for debugging
				console.warn(`⚠️ Skipping flight ${flight.flight_id} due to coordinate issues:`, issues);
			}
		});
		
		return {
			type: 'FeatureCollection',
			features: allFeatures
		};
	}

	function updateLayers() {
		if (!map || !mounted) return;

		const currentFlights = $filteredFlights;
		
		// Update flight paths source data
		if (map.getSource('flight-paths')) {
			const source = map.getSource('flight-paths') as mapboxgl.GeoJSONSource;
			source.setData(flightsToGeoJSON(currentFlights));
		}

		// Using native Mapbox layers only - no Deck.GL layers needed
		// Flight paths: native GeoJSON line layer with dotted pattern
		// Airport markers: native Mapbox markers with custom HTML elements
	}

	function createCustomMarker(airport: Airport): HTMLElement {
		const markerElement = document.createElement('div');
		markerElement.className = 'airport-marker';
		
		// Helper function to check if a flight is related to this airport
		const isFlightRelatedToAirport = (flight: Flight, airport: Airport): boolean => {
			// Check departure airport
			if (flight.departure_airport_name) {
				if (flight.departure_airport_name === airport.name ||
					flight.departure_airport_name.includes(airport.iata_code) ||
					flight.departure_airport_name.includes(`(${airport.iata_code})`) ||
					airport.name.includes(flight.departure_airport_name)) {
					return true;
				}
			}
			
			// Check arrival airport
			if (flight.arrival_airport_name) {
				if (flight.arrival_airport_name === airport.name ||
					flight.arrival_airport_name.includes(airport.iata_code) ||
					flight.arrival_airport_name.includes(`(${airport.iata_code})`) ||
					airport.name.includes(flight.arrival_airport_name)) {
					return true;
				}
			}
			
			// Also check by coordinates if available (within small tolerance)
			const tolerance = 0.01; // About 1km
			if (flight.origin && Math.abs(flight.origin[0] - airport.longitude) < tolerance && 
				Math.abs(flight.origin[1] - airport.latitude) < tolerance) {
				return true;
			}
			if (flight.destination && Math.abs(flight.destination[0] - airport.longitude) < tolerance && 
				Math.abs(flight.destination[1] - airport.latitude) < tolerance) {
				return true;
			}
			
			return false;
		};
		
		// Calculate visit count from actual flights data
		const visitCount = $filteredFlights.filter(flight => isFlightRelatedToAirport(flight, airport)).length;
		
		// Add visited class based on actual flight count
		if (visitCount > 0) {
			markerElement.classList.add('airport-marker--visited');
		} else {
			markerElement.classList.add('airport-marker--unvisited');
		}
		
		// Add size class based on flight count
		if (visitCount >= 5) {
			markerElement.classList.add('airport-marker--large');
		} else if (visitCount >= 2) {
			markerElement.classList.add('airport-marker--medium');
		} else {
			markerElement.classList.add('airport-marker--small');
		}
		
		return markerElement;
	}

	function getAirportPosition(airport: Airport): [number, number] | null {
		return getValidAirportCoordinates(airport);
	}

	function clearAirportMarkers() {
		// Remove all existing markers
		airportMarkers.forEach(marker => marker.remove());
		airportMarkers = [];
		
		// Clean up airport popups
		airportPopups.forEach(popup => popup.remove());
		airportPopups.clear();
	}

	function updateMarkers() {
		if (!map || !mounted) return;

		// Clear existing markers
		clearAirportMarkers();

		let validMarkers = 0;
		let invalidMarkers = 0;

		// Create new markers for each airport with valid coordinates
		airports.forEach(airport => {
			const position = getAirportPosition(airport);
			
			// Skip airports with invalid coordinates
			if (!position) {
				invalidMarkers++;
				console.warn(`⚠️ Skipping airport ${airport.name || airport.iata_code} - invalid coordinates`);
				return;
			}

			// Create custom marker element
			const markerElement = createCustomMarker(airport);

			// Create Mapbox marker - simplified configuration
			const marker = new mapboxgl.Marker({
				element: markerElement
			})
				.setLngLat(position)
				.addTo(map);

			// Add popup functionality with enhanced coordinate info
			const [lng, lat] = position;
			const isAtNullIsland = isNullIsland(lng, lat);
			const isInPolarRegion = isPolarRegion(lat);
			
			const coordinateWarnings = [];
			if (isAtNullIsland) coordinateWarnings.push('⚠️ Located at Null Island');
			if (isInPolarRegion) coordinateWarnings.push('⚠️ Polar region airport');
			
			// Check if airport has trip information
			const hasTripInfo = airport.trips && Array.isArray(airport.trips) && airport.trips.length > 0;
			
			// Helper function to check if a flight is related to this airport
			const isFlightRelatedToAirport = (flight: Flight, airport: Airport): boolean => {
				// Check departure airport
				if (flight.departure_airport_name) {
					if (flight.departure_airport_name === airport.name ||
						flight.departure_airport_name.includes(airport.iata_code) ||
						flight.departure_airport_name.includes(`(${airport.iata_code})`) ||
						airport.name.includes(flight.departure_airport_name)) {
						return true;
					}
				}
				
				// Check arrival airport
				if (flight.arrival_airport_name) {
					if (flight.arrival_airport_name === airport.name ||
						flight.arrival_airport_name.includes(airport.iata_code) ||
						flight.arrival_airport_name.includes(`(${airport.iata_code})`) ||
						airport.name.includes(flight.arrival_airport_name)) {
						return true;
					}
				}
				
				// Also check by coordinates if available (within small tolerance)
				const tolerance = 0.01; // About 1km
				if (flight.origin && Math.abs(flight.origin[0] - airport.longitude) < tolerance && 
					Math.abs(flight.origin[1] - airport.latitude) < tolerance) {
					return true;
				}
				if (flight.destination && Math.abs(flight.destination[0] - airport.longitude) < tolerance && 
					Math.abs(flight.destination[1] - airport.latitude) < tolerance) {
					return true;
				}
				
				return false;
			};
			
			// Calculate visit count from actual flights data
			const visitCount = $filteredFlights.filter(flight => isFlightRelatedToAirport(flight, airport)).length;
			
			// Airport is visited if there's at least one flight
			const hasBeenVisited = visitCount > 0;
			
			const popupContent = `
				<div class="flight-popup airport-popup">
					<div class="popup-header">
						<h3>${airport.name}</h3>
						<span class="iata-code">${airport.iata_code}</span>
					</div>
					<div class="popup-content">
						<p class="location">${airport.city}, ${airport.country}</p>
						${coordinateWarnings.length > 0 ? `
							<div class="coordinate-warnings">
								${coordinateWarnings.map(warning => `<p class="warning">${warning}</p>`).join('')}
							</div>
						` : ''}
						${hasTripInfo ? `
							<div class="trip-info">
								<div class="stat-item">
									<span class="stat-label">Trips:</span>
									<div class="trip-list">
										${airport.trips.slice(0, 3).map(trip => `
											<span class="trip-name">${trip.name || 'Unnamed Trip'}</span>
										`).join(', ')}
										${airport.trips.length > 3 ? `<span class="trip-more">+${airport.trips.length - 3} more</span>` : ''}
									</div>
								</div>
							</div>
						` : ''}
						<div class="airport-stats">
							<div class="stat-item">
								<span class="stat-label">Flights:</span>
								<span class="stat-value">${visitCount}</span>
							</div>
							<div class="stat-item">
								<span class="stat-label">Status:</span>
								<span class="stat-value ${hasBeenVisited ? 'visited' : 'unvisited'}">
									${hasBeenVisited ? 'Visited' : 'Unvisited'}
								</span>
							</div>
						</div>
					</div>
				</div>
			`;

			const airportPopup = new mapboxgl.Popup({
				closeButton: false,
				closeOnClick: false,
				className: 'flight-map-popup'
			}).setHTML(popupContent);

			// Add hover events
			markerElement.addEventListener('mouseenter', () => {
				airportPopup.setLngLat(position).addTo(map);
			});

			markerElement.addEventListener('mouseleave', () => {
				airportPopup.remove();
			});

			// Store popup for cleanup
			airportPopups.set(airport.iata_code, airportPopup);

			// Add click event
			markerElement.addEventListener('click', () => {
				dispatch('airportSelect', airport);
				if (onAirportSelect) onAirportSelect(airport);
			});

			// Store marker for cleanup
			airportMarkers.push(marker);
			validMarkers++;
		});

		// Update validation tracking
		dataValidation.update(prev => ({
			...prev,
			validAirports: validMarkers,
			invalidAirports: invalidMarkers
		}));

		console.log(`✅ Created ${validMarkers} airport markers, skipped ${invalidMarkers} invalid airports`);
	}

	function handleHover(info: any) {
		// This function is now unused since we're using native Mapbox events
		// for flight path interactions. Airport interactions are handled
		// directly in updateMarkers() function.
		return;
	}

	function handleClick(info: any) {
		// This function is now unused since we're using native Mapbox events
		// for flight path interactions. Airport interactions are handled
		// directly in updateMarkers() function.
		return;
	}

	function startAnimation() {
		// Animation is no longer needed since we're using static dotted lines
		// instead of animated arcs. The showAnimations toggle is preserved
		// for potential future animation features.
		return;
	}

	function validateDataOnMount() {
		console.log('🔍 Validating flight map data...');
		
		// Validate performance
		const perfValidation = validateDatasetPerformance(flights, airports);
		console.log('Performance validation:', perfValidation);
		
		// Detect overlapping airports
		const overlapValidation = detectOverlappingAirports(airports);
		console.log('Overlap validation:', overlapValidation);
		
		// Analyze geocoding status
		const geocodingAnalysis = identifyAirportsNeedingGeocoding(airports);
		console.log('🌍 Geocoding analysis:', geocodingAnalysis.summary);
		
		if (geocodingAnalysis.summary.needsGeocoding > 0) {
			console.warn(`⚠️ ${geocodingAnalysis.summary.needsGeocoding} airports (${geocodingAnalysis.summary.percentageNeedsGeocoding.toFixed(1)}%) need geocoding:`, 
				geocodingAnalysis.needsGeocoding.slice(0, 5).map(a => ({ 
					iata: a.iata_code, 
					name: a.name, 
					coords: [a.longitude, a.latitude],
					hasCoordinates: !!a.coordinates,
					coordinatesType: typeof a.coordinates
				}))
			);
			
			console.info('💡 To fix coordinate issues:', [
				'1. Check if geocoding API is working properly',
				'2. Verify database has valid latitude/longitude values', 
				'3. Ensure coordinates field is properly populated',
				'4. Consider running a geocoding batch job for missing airports'
			]);
		} else {
			console.log('✅ All airports have valid coordinates!');
		}
		
		// Update data validation store
		dataValidation.update(prev => ({
			...prev,
			performance: perfValidation.performance,
			overlappingGroups: overlapValidation.overlappingGroups,
			validAirports: geocodingAnalysis.summary.hasValid,
			invalidAirports: geocodingAnalysis.summary.needsGeocoding
		}));
		
		// Log warnings and recommendations
		if (perfValidation.warnings.length > 0) {
			console.warn('Performance warnings:', perfValidation.warnings);
		}
		if (perfValidation.recommendations.length > 0) {
			console.info('Performance recommendations:', perfValidation.recommendations);
		}
		if (overlapValidation.recommendations.length > 0) {
			console.info('Overlap recommendations:', overlapValidation.recommendations);
		}
	}

	function cleanup() {
		mounted = false;
		
		// Clean up flight popup
		if (flightPopup) {
			flightPopup.remove();
			flightPopup = null;
		}
		
		// Clean up airport markers and their popups
		clearAirportMarkers();
		
		// Deck.GL cleanup removed - not using Deck.GL overlay anymore
		// Cleanup handled by native Mapbox layers and markers
		
		if (map) {
			map.remove();
			map = null;
		}
	}

	//reactive updates for theme
	$: if (map && mounted) {
		map.setStyle(mapStyles[theme]);
	}

	//reactive updates for airports data
	$: if (airports && map && mounted) {
		updateMarkers();
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


	function clearAllFilters() {
		selectedAirlines.set(new Set());
		selectedYears.set(new Set());
		selectedStatuses.set(new Set(['booked', 'completed', 'cancelled', 'delayed']));
	}
</script>

<div class="flight-map-container" style="height: {height};">
	{#if $hasError}
		<div class="error-container">
			<div class="error-message">
				<h3>Map Configuration Error</h3>
				<p>{$errorMessage}</p>
				<div class="error-details">
					<p>Please ensure:</p>
					<ul>
						<li>Your Mapbox access token is set in the environment variables</li>
						<li>The token starts with 'pk.' and is valid</li>
						<li>You have internet connectivity</li>
					</ul>
				</div>
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


				<!-- Data Quality Info -->
				{#if $dataValidation.issues.length > 0 || $dataValidation.overlappingGroups.length > 0}
					<div class="data-quality-info">
						<h4>Data Quality</h4>
						{#if $dataValidation.performance.isLargeDataset}
							<div class="quality-item warning">
								<span class="quality-icon">⚠️</span>
								<span class="quality-text">Large dataset - performance may be affected</span>
							</div>
						{/if}
						{#if $dataValidation.overlappingGroups.length > 0}
							<div class="quality-item info">
								<span class="quality-icon">ℹ️</span>
								<span class="quality-text">{$dataValidation.overlappingGroups.length} cities with multiple airports</span>
							</div>
						{/if}
						{#if $dataValidation.issues.length > 0}
							<div class="quality-item warning">
								<span class="quality-icon">⚠️</span>
								<span class="quality-text">{$dataValidation.issues.length} data validation issues</span>
							</div>
						{/if}
					</div>
				{/if}
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
		margin: 0 0 1rem 0;
		font-size: 0.875rem;
	}

	.error-details {
		text-align: left;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.error-details ul {
		margin: 0.5rem 0 0 1.5rem;
		padding: 0;
		list-style-type: disc;
	}

	.error-details li {
		margin: 0.25rem 0;
		font-size: 0.875rem;
		color: #6b7280;
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
		color: #374151; /* Dark text for light mode */
	}

	.clear-btn:hover {
		background: #e5e7eb;
		color: #1f2937; /* Darker text on hover */
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
		color: #374151; /* Dark text for light mode */
	}

	.filter-item:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
		color: #1f2937; /* Darker text on hover */
	}

	.filter-item.active {
		background: #374151; /* Dark grey */
		border-color: #374151;
		color: white;
	}

	.animation-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
		color: #374151; /* Dark text for light mode */
	}

	.animation-toggle input {
		margin: 0;
	}

	.animation-toggle span {
		color: #374151; /* Dark text for light mode */
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

	.stat.warning {
		border-left: 3px solid #f59e0b;
		padding-left: 0.5rem;
	}

	.stat.warning .stat-value {
		color: #f59e0b;
	}

	.data-quality-info {
		margin-top: 1rem;
		padding-top: 0.5rem;
		border-top: 1px solid #e5e7eb;
	}

	.data-quality-info h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		font-weight: 500;
		color: #374151;
	}

	.quality-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		padding: 0.25rem;
		border-radius: 4px;
	}

	.quality-item.warning {
		background-color: #fef3c7;
		border: 1px solid #f59e0b;
	}

	.quality-item.info {
		background-color: #dbeafe;
		border: 1px solid #3b82f6;
	}

	.quality-icon {
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.quality-text {
		font-size: 0.75rem;
		color: #374151;
		line-height: 1.2;
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

	:global(.dark) .controls-header {
		border-bottom-color: #4b5563;
	}

	:global(.dark) .flight-details-header {
		border-bottom-color: #4b5563;
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
		border-color: #6b7280;
	}

	:global(.dark) .filter-item.active {
		background: #e5e7eb; /* Light grey for dark mode */
		border-color: #e5e7eb;
		color: #111827; /* Dark text */
	}

	:global(.dark) .clear-btn {
		background: #374151;
		border-color: #4b5563;
		color: #f9fafb;
	}

	:global(.dark) .clear-btn:hover {
		background: #4b5563;
	}

	:global(.dark) .close-btn {
		color: #9ca3af;
	}

	:global(.dark) .close-btn:hover {
		color: #f9fafb;
	}

	:global(.dark) .animation-toggle {
		color: #f9fafb;
	}

	:global(.dark) .animation-toggle span {
		color: #d1d5db;
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

	:global(.dark) .data-quality-info {
		border-top-color: #4b5563;
	}

	:global(.dark) .data-quality-info h4 {
		color: #d1d5db;
	}

	:global(.dark) .quality-item.warning {
		background-color: #7c2d12;
		border-color: #dc2626;
	}

	:global(.dark) .quality-item.info {
		background-color: #1e3a8a;
		border-color: #2563eb;
	}

	:global(.dark) .quality-text {
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
		color: #374151; /* Dark grey */
	}

	:global(.flight-popup .unvisited) {
		color: #6b7280; /* Medium grey */
	}

	:global(.flight-popup .status-completed) {
		color: #111827; /* Very dark grey/black */
		text-transform: capitalize;
		font-weight: 600;
	}

	:global(.flight-popup .status-booked) {
		color: #374151; /* Dark grey */
		text-transform: capitalize;
	}

	:global(.flight-popup .status-cancelled) {
		color: #9ca3af; /* Light grey */
		text-transform: capitalize;
	}

	:global(.flight-popup .status-delayed) {
		color: #6b7280; /* Medium grey */
		text-transform: capitalize;
	}

	/* Coordinate warnings in popups */
	:global(.flight-popup .coordinate-warnings) {
		margin: 8px 0;
		padding: 6px 8px;
		background-color: #fef3c7;
		border: 1px solid #f59e0b;
		border-radius: 4px;
	}

	:global(.flight-popup .coordinate-warnings .warning) {
		margin: 0 0 4px 0;
		font-size: 11px;
		color: #92400e;
		font-weight: 500;
	}

	:global(.flight-popup .coordinate-warnings .warning:last-child) {
		margin-bottom: 0;
	}

	/* Trip information styles */
	:global(.flight-popup .trip-info) {
		margin: 12px 0;
		padding: 8px 0;
		border-top: 1px solid #e5e7eb;
		border-bottom: 1px solid #e5e7eb;
	}

	:global(.flight-popup .trip-list) {
		margin-top: 4px;
		font-size: 12px;
		line-height: 1.5;
	}

	:global(.flight-popup .trip-name) {
		color: #3b82f6;
		font-weight: 500;
	}

	:global(.flight-popup .trip-more) {
		color: #6b7280;
		font-style: italic;
		font-size: 11px;
		margin-left: 4px;
	}

	/* Dark theme trip styles */
	:global(.dark .flight-popup .trip-info) {
		border-top-color: #374151;
		border-bottom-color: #374151;
	}

	:global(.dark .flight-popup .trip-name) {
		color: #60a5fa;
	}

	:global(.dark .flight-popup .trip-more) {
		color: #9ca3af;
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

	/* Airport marker styles - simple circular pin */
	:global(.airport-marker) {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		cursor: pointer;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		border: 3px solid #6b7280; /* Grey outline */
		background: white; /* White center */
		display: block;
	}

	/* Both visited and unvisited use same style now */
	:global(.airport-marker--visited),
	:global(.airport-marker--unvisited) {
		background: white;
		border-color: #6b7280;
	}

	/* Size variations */
	:global(.airport-marker--small) {
		width: 16px;
		height: 16px;
		border-width: 2px;
	}

	:global(.airport-marker--medium) {
		width: 20px;
		height: 20px;
		border-width: 3px;
	}

	:global(.airport-marker--large) {
		width: 24px;
		height: 24px;
		border-width: 3px;
	}

	/* Hover effects */
	:global(.airport-marker:hover) {
		transform: scale(1.2);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
		z-index: 1000;
		border-color: #374151; /* Darker grey on hover */
	}

	/* Dark theme support for markers */
	:global(.dark .airport-marker) {
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
	}

	:global(.dark .airport-marker::after) {
		border-color: #374151;
	}
</style>