import type { Flight, Airport, FilterOptions } from './types';

//calculate great circle distance between two coordinates
export function calculateDistance(
	coord1: [number, number],
	coord2: [number, number]
): number {
	const [lng1, lat1] = coord1;
	const [lng2, lat2] = coord2;
	
	const R = 6371; //earth's radius in km
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	
	const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
		Math.sin(dLng/2) * Math.sin(dLng/2);
	
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
	return R * c;
}

//filter flights based on current filter options
export function filterFlights(
	flights: Flight[],
	filters: FilterOptions
): Flight[] {
	return flights.filter(flight => {
		const airlineMatch = filters.airlines.size === 0 || 
			(flight.airline_name && filters.airlines.has(flight.airline_name));
		
		const yearMatch = filters.years.size === 0 || 
			filters.years.has(new Date(flight.departure_time).getFullYear());
		
		const statusMatch = filters.statuses.has(flight.flight_status);
		
		return airlineMatch && yearMatch && statusMatch;
	});
}

//get unique values from flights for filter options
export function getUniqueAirlines(flights: Flight[]): string[] {
	return [...new Set(flights.map(f => f.airline_name).filter(Boolean))] as string[];
}

export function getUniqueYears(flights: Flight[]): number[] {
	return [...new Set(flights.map(f => new Date(f.departure_time).getFullYear()))]
		.sort((a, b) => b - a);
}

//enhanced coordinate validation
export function isValidCoordinate(lng: any, lat: any): boolean {
	return typeof lng === 'number' && 
		   typeof lat === 'number' && 
		   !isNaN(lng) && 
		   !isNaN(lat) && 
		   lng >= -180 && lng <= 180 && 
		   lat >= -90 && lat <= 90;
}

//check if coordinates are at Null Island (0,0) - likely missing data
export function isNullIsland(lng: number, lat: number): boolean {
	return lng === 0 && lat === 0;
}

//check if flight crosses international date line
export function crossesDateLine(originLng: number, destLng: number): boolean {
	return Math.abs(destLng - originLng) > 180;
}

//check if coordinates are in polar regions (may need special handling)
export function isPolarRegion(lat: number): boolean {
	return Math.abs(lat) > 80;
}

//helper function to extract coordinates from proxy objects
function extractFromProxy(value: any): any {
	if (value === null || value === undefined) return null;
	
	// If it's a Proxy object, try to extract the actual values
	if (typeof value === 'object') {
		// Special handling for Svelte stores and reactive objects
		if (value && typeof value.subscribe === 'function') {
			// It's a Svelte store, try to get current value
			let storeValue: any = null;
			try {
				value.subscribe((val: any) => {
					storeValue = val;
				})();
				return storeValue;
			} catch (e) {
				// Silent fail
			}
		}
		
		// Try to access the proxy directly by converting to string and parsing
		try {
			const str = JSON.stringify(value);
			if (str && str !== '{}' && str !== 'null') {
				return JSON.parse(str);
			}
		} catch (e) {
			// If JSON approach fails, try direct property access
		}
		
		// Try to iterate through proxy properties
		try {
			const keys = Object.keys(value);
			if (keys.length > 0) {
				const extracted: any = {};
				for (const key of keys) {
					try {
						const val = value[key];
						if (val !== undefined) {
							extracted[key] = val;
						}
					} catch (e) {
						// Skip this property
					}
				}
				if (Object.keys(extracted).length > 0) {
					return extracted;
				}
			}
		} catch (e) {
			// Silent fail - proxy access blocked
		}
		
		// Try Reflect.ownKeys for better proxy detection
		try {
			const keys = Reflect.ownKeys(value);
			if (keys.length > 0) {
				const extracted: any = {};
				for (const key of keys) {
					try {
						const val = Reflect.get(value, key);
						if (val !== undefined) {
							extracted[key as string] = val;
						}
					} catch (e) {
						// Skip this property
					}
				}
				if (Object.keys(extracted).length > 0) {
					return extracted;
				}
			}
		} catch (e) {
			// Silent fail
		}
	}
	
	return value;
}

//helper function to extract array from coordinates proxy
function extractCoordinatesArray(coordinates: any): [number, number] | null {
	if (!coordinates) return null;
	
	// Direct array check
	if (Array.isArray(coordinates) && coordinates.length === 2) {
		const [lng, lat] = coordinates;
		if (isValidCoordinate(lng, lat) && !isNullIsland(lng, lat)) {
			return [lng, lat];
		}
	}
	
	// Handle proxy objects
	const extracted = extractFromProxy(coordinates);
	if (extracted && Array.isArray(extracted) && extracted.length === 2) {
		const [lng, lat] = extracted;
		if (isValidCoordinate(lng, lat) && !isNullIsland(lng, lat)) {
			return [lng, lat];
		}
	}
	
	// Try accessing as object with numeric indices
	if (typeof coordinates === 'object') {
		try {
			// Try multiple ways to access array-like object
			let lng = coordinates[0] || coordinates['0'];
			let lat = coordinates[1] || coordinates['1'];
			
			// Try Reflect.get for proxies
			if (lng === undefined) lng = Reflect.get(coordinates, 0);
			if (lat === undefined) lat = Reflect.get(coordinates, 1);
			
			// Try direct property descriptor access
			if (lng === undefined) {
				const desc0 = Object.getOwnPropertyDescriptor(coordinates, '0') || Object.getOwnPropertyDescriptor(coordinates, 0);
				lng = desc0?.value;
			}
			if (lat === undefined) {
				const desc1 = Object.getOwnPropertyDescriptor(coordinates, '1') || Object.getOwnPropertyDescriptor(coordinates, 1);
				lat = desc1?.value;
			}
			
			if (isValidCoordinate(lng, lat) && !isNullIsland(lng, lat)) {
				return [lng, lat];
			}
		} catch (e) {
			// Silent fail
		}
	}
	
	return null;
}

//sanitize and validate airport coordinates with fallback options
export function getValidAirportCoordinates(airport: Airport): [number, number] | null {
	// Enhanced debugging for proxy issues (only log problematic cases)
	const isProblematic = (
		(airport.coordinates !== null && airport.coordinates !== undefined) ||
		(airport.latitude === 0 && airport.longitude === 0) ||
		(airport.latitude === null || airport.longitude === null)
	);
	
	const shouldLog = isProblematic && Math.random() < 0.2; // Log 20% of problematic airports
	if (shouldLog) {
		console.log(`🔍 Processing airport ${airport.name || airport.iata_code}:`, {
			coordinates: airport.coordinates,
			coordinatesType: typeof airport.coordinates,
			coordinatesConstructor: airport.coordinates?.constructor?.name,
			isArray: Array.isArray(airport.coordinates),
			latitude: airport.latitude,
			longitude: airport.longitude,
			latitudeType: typeof airport.latitude,
			longitudeType: typeof airport.longitude,
			isNullIsland: isNullIsland(airport.longitude || 0, airport.latitude || 0)
		});
	}
	
	// Helper to get coordinates from airport object with multiple fallback options
	const attempts = [
		// Try coordinates field first - with proxy handling
		() => {
			const coords = extractCoordinatesArray(airport.coordinates);
			if (coords) {
				if (shouldLog) console.log(`✅ Extracted coordinates from coordinates field: [${coords[0]}, ${coords[1]}]`);
				return coords;
			}
			return null;
		},
		// Try lat/lng fields
		() => {
			// Handle both null/undefined and 0 values
			const lng = airport.longitude;
			const lat = airport.latitude;
			
			if (lng !== null && lng !== undefined && 
				lat !== null && lat !== undefined &&
				isValidCoordinate(lng, lat) && 
				!isNullIsland(lng, lat)) {
				if (shouldLog) console.log(`✅ Extracted coordinates from lat/lng fields: [${lng}, ${lat}]`);
				return [lng, lat];
			}
			return null;
		},
		// Try alternative field names
		() => {
			const extracted = extractFromProxy(airport as any);
			const altLng = extracted?.lng || extracted?.lon || (airport as any).lng || (airport as any).lon;
			const altLat = extracted?.lat || (airport as any).lat;
			if (isValidCoordinate(altLng, altLat) && !isNullIsland(altLng, altLat)) {
				if (shouldLog) console.log(`✅ Extracted coordinates from alternative fields: [${altLng}, ${altLat}]`);
				return [altLng, altLat];
			}
			return null;
		},
		// Try extracting from the entire airport object if it's a proxy
		() => {
			const extracted = extractFromProxy(airport);
			if (extracted && extracted !== airport) {
				if (isValidCoordinate(extracted.longitude, extracted.latitude) && 
					!isNullIsland(extracted.longitude, extracted.latitude)) {
					if (shouldLog) console.log(`✅ Extracted coordinates from proxy airport: [${extracted.longitude}, ${extracted.latitude}]`);
					return [extracted.longitude, extracted.latitude];
				}
			}
			return null;
		}
	];

	// Try each method in order
	for (const attempt of attempts) {
		const result = attempt();
		if (result) return result as [number, number];
	}

	// Enhanced warning for problematic airport with proxy debugging
	console.warn(`⚠️ Invalid coordinates for airport ${airport.name || airport.iata_code}:`, {
		coordinates: airport.coordinates,
		coordinatesStringified: (() => {
			try {
				return JSON.stringify(airport.coordinates);
			} catch (e) {
				return 'Unable to stringify coordinates';
			}
		})(),
		coordinatesKeys: (() => {
			try {
				return Object.keys(airport.coordinates || {});
			} catch (e) {
				return 'Unable to get keys';
			}
		})(),
		latitude: airport.latitude,
		longitude: airport.longitude,
		lng: (airport as any).lng,
		lat: (airport as any).lat,
		lon: (airport as any).lon,
		extractedAirport: extractFromProxy(airport),
		extractedCoordinates: extractFromProxy(airport.coordinates)
	});

	return null;
}

//check if airport needs geocoding (has coordinates at Null Island or invalid)
export function airportNeedsGeocoding(airport: Airport): boolean {
	const coords = getValidAirportCoordinates(airport);
	
	// No valid coordinates found
	if (!coords) return true;
	
	// Coordinates are at Null Island (0, 0)
	const [lng, lat] = coords;
	if (isNullIsland(lng, lat)) return true;
	
	return false;
}

//identify airports that need geocoding
export function identifyAirportsNeedingGeocoding(airports: Airport[]): {
	needsGeocoding: Airport[];
	hasValidCoordinates: Airport[];
	summary: {
		total: number;
		needsGeocoding: number;
		hasValid: number;
		percentageNeedsGeocoding: number;
	};
} {
	const needsGeocoding: Airport[] = [];
	const hasValidCoordinates: Airport[] = [];
	
	airports.forEach(airport => {
		if (airportNeedsGeocoding(airport)) {
			needsGeocoding.push(airport);
		} else {
			hasValidCoordinates.push(airport);
		}
	});
	
	const total = airports.length;
	const needsGeocodingCount = needsGeocoding.length;
	const hasValidCount = hasValidCoordinates.length;
	const percentageNeedsGeocoding = total > 0 ? (needsGeocodingCount / total) * 100 : 0;
	
	return {
		needsGeocoding,
		hasValidCoordinates,
		summary: {
			total,
			needsGeocoding: needsGeocodingCount,
			hasValid: hasValidCount,
			percentageNeedsGeocoding
		}
	};
}

//sanitize and validate flight coordinates
export function getValidFlightCoordinates(flight: Flight): { 
	origin: [number, number] | null; 
	destination: [number, number] | null;
	issues: string[];
} {
	const issues: string[] = [];
	let origin: [number, number] | null = null;
	let destination: [number, number] | null = null;

	// Validate origin
	if (Array.isArray(flight.origin) && flight.origin.length === 2) {
		const [lng, lat] = flight.origin;
		if (isValidCoordinate(lng, lat)) {
			if (isNullIsland(lng, lat)) {
				issues.push('Origin at Null Island (likely missing data)');
			} else if (isPolarRegion(lat)) {
				issues.push(`Origin in polar region (lat: ${lat})`);
			}
			origin = [lng, lat];
		} else {
			issues.push(`Invalid origin coordinates: [${lng}, ${lat}]`);
		}
	} else {
		issues.push('Missing or malformed origin coordinates');
	}

	// Validate destination
	if (Array.isArray(flight.destination) && flight.destination.length === 2) {
		const [lng, lat] = flight.destination;
		if (isValidCoordinate(lng, lat)) {
			if (isNullIsland(lng, lat)) {
				issues.push('Destination at Null Island (likely missing data)');
			} else if (isPolarRegion(lat)) {
				issues.push(`Destination in polar region (lat: ${lat})`);
			}
			destination = [lng, lat];
		} else {
			issues.push(`Invalid destination coordinates: [${lng}, ${lat}]`);
		}
	} else {
		issues.push('Missing or malformed destination coordinates');
	}

	// Check for same origin/destination
	if (origin && destination) {
		const [originLng, originLat] = origin;
		const [destLng, destLat] = destination;
		
		if (originLng === destLng && originLat === destLat) {
			issues.push('Origin and destination are identical');
		} else {
			const distance = calculateDistance(origin, destination);
			if (distance < 1) {
				issues.push(`Very short flight distance: ${distance.toFixed(2)} km`);
			}
			if (crossesDateLine(originLng, destLng)) {
				issues.push('Flight crosses international date line');
			}
		}
	}

	return { origin, destination, issues };
}

//calculate optimal map bounds with enhanced validation
export function calculateBounds(
	airports: Airport[],
	flights: Flight[]
): [[number, number], [number, number]] | null {
	if (airports.length === 0 && flights.length === 0) {
		return null;
	}

	const validCoordinates: [number, number][] = [];

	// Include valid airport coordinates only
	airports.forEach(airport => {
		const coords = getValidAirportCoordinates(airport);
		if (coords) {
			validCoordinates.push(coords);
		}
	});

	// Include valid flight coordinates only
	flights.forEach(flight => {
		const { origin, destination } = getValidFlightCoordinates(flight);
		if (origin) validCoordinates.push(origin);
		if (destination) validCoordinates.push(destination);
	});

	// If no valid coordinates found, return null
	if (validCoordinates.length === 0) {
		console.warn('No valid coordinates found for calculating bounds');
		return null;
	}

	let minLng = Infinity;
	let maxLng = -Infinity;
	let minLat = Infinity;
	let maxLat = -Infinity;

	validCoordinates.forEach(([lng, lat]) => {
		minLng = Math.min(minLng, lng);
		maxLng = Math.max(maxLng, lng);
		minLat = Math.min(minLat, lat);
		maxLat = Math.max(maxLat, lat);
	});

	// Handle special case where all coordinates are the same
	if (minLng === maxLng && minLat === maxLat) {
		return [
			[minLng - 1, minLat - 1],
			[maxLng + 1, maxLat + 1]
		];
	}

	// Add padding
	const lngPadding = Math.max(0.1, (maxLng - minLng) * 0.1);
	const latPadding = Math.max(0.1, (maxLat - minLat) * 0.1);

	return [
		[minLng - lngPadding, minLat - latPadding],
		[maxLng + lngPadding, maxLat + latPadding]
	];
}

//format flight duration
export function formatDuration(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	
	if (hours === 0) {
		return `${mins}m`;
	}
	return `${hours}h ${mins}m`;
}

//format date for display
export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

//format time for display
export function formatTime(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit'
	});
}

//get color for flight status
export function getStatusColor(status: string): [number, number, number, number] {
	switch (status) {
		case 'completed':
			return [34, 197, 94, 200]; //green
		case 'booked':
			return [59, 130, 246, 200]; //blue
		case 'cancelled':
			return [239, 68, 68, 200]; //red
		case 'delayed':
			return [245, 158, 11, 200]; //orange
		default:
			return [107, 114, 128, 200]; //gray
	}
}

//generate arc height based on distance
export function getArcHeight(distance: number): number {
	//scale height based on distance - longer flights have higher arcs
	return Math.min(0.8, Math.max(0.1, distance / 10000));
}

//generate airport marker size based on visit count
export function getAirportRadius(visitCount: number): number {
	return Math.max(50000, visitCount * 25000);
}

//debounce function for performance optimization
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout>;
	
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

//throttle function for animation performance
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number
): (...args: Parameters<T>) => void {
	let lastRun = 0;
	
	return (...args: Parameters<T>) => {
		if (Date.now() - lastRun >= limit) {
			func(...args);
			lastRun = Date.now();
		}
	};
}

//validate mapbox token format
export function validateMapboxToken(token: string | undefined): boolean {
	if (!token) return false;
	return token.startsWith('pk.') && token.length > 50;
}

//generate unique id for layers
export function generateLayerId(prefix: string): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

//validate dataset performance and provide warnings
export function validateDatasetPerformance(
	flights: Flight[],
	airports: Airport[]
): {
	performance: {
		flightsCount: number;
		airportsCount: number;
		isLargeDataset: boolean;
		estimatedRenderTime: number;
	};
	warnings: string[];
	recommendations: string[];
} {
	const warnings: string[] = [];
	const recommendations: string[] = [];
	
	const flightsCount = flights.length;
	const airportsCount = airports.length;
	const isLargeDataset = flightsCount > 1000 || airportsCount > 500;
	
	// Estimate render time based on data size (rough calculation)
	const estimatedRenderTime = Math.max(100, (flightsCount * 0.5) + (airportsCount * 1.2));
	
	if (isLargeDataset) {
		warnings.push(`Large dataset detected: ${flightsCount} flights, ${airportsCount} airports`);
		recommendations.push('Consider implementing data virtualization or clustering');
		recommendations.push('Use pagination or lazy loading for better performance');
	}
	
	if (flightsCount > 5000) {
		warnings.push('Very large flight dataset may cause performance issues');
		recommendations.push('Implement WebGL rendering for better performance');
	}
	
	if (estimatedRenderTime > 2000) {
		warnings.push(`Estimated render time: ${Math.round(estimatedRenderTime)}ms`);
		recommendations.push('Consider adding loading indicators and progressive rendering');
	}
	
	return {
		performance: {
			flightsCount,
			airportsCount,
			isLargeDataset,
			estimatedRenderTime
		},
		warnings,
		recommendations
	};
}

//detect and handle overlapping airports in same geographic area
export function detectOverlappingAirports(airports: Airport[]): {
	overlappingGroups: Array<{
		location: string;
		airports: Airport[];
		avgCoordinates: [number, number];
	}>;
	recommendations: string[];
} {
	const cityGroups = new Map<string, Airport[]>();
	const overlappingGroups: Array<{
		location: string;
		airports: Airport[];
		avgCoordinates: [number, number];
	}> = [];
	const recommendations: string[] = [];
	
	// Group airports by city/country
	airports.forEach(airport => {
		const validCoords = getValidAirportCoordinates(airport);
		if (validCoords) {
			const key = `${airport.city}, ${airport.country}`;
			if (!cityGroups.has(key)) {
				cityGroups.set(key, []);
			}
			cityGroups.get(key)!.push(airport);
		}
	});
	
	// Find groups with multiple airports
	cityGroups.forEach((cityAirports, location) => {
		if (cityAirports.length > 1) {
			// Calculate average coordinates for the group
			const validCoords = cityAirports
				.map(a => getValidAirportCoordinates(a))
				.filter(Boolean) as [number, number][];
			
			if (validCoords.length > 0) {
				const avgLng = validCoords.reduce((sum, [lng]) => sum + lng, 0) / validCoords.length;
				const avgLat = validCoords.reduce((sum, [, lat]) => sum + lat, 0) / validCoords.length;
				
				overlappingGroups.push({
					location,
					airports: cityAirports,
					avgCoordinates: [avgLng, avgLat]
				});
			}
		}
	});
	
	if (overlappingGroups.length > 0) {
		recommendations.push('Implement marker clustering for overlapping airports');
		recommendations.push('Consider showing airport selection dropdown for same-city airports');
		recommendations.push('Use different marker sizes or styles to distinguish airports');
	}
	
	return { overlappingGroups, recommendations };
}

//geocode a single airport using external service
export async function geocodeAirportExternal(airport: Airport): Promise<{
	latitude: number;
	longitude: number;
	success: boolean;
	error?: string;
}> {
	try {
		const query = encodeURIComponent(`${airport.name} ${airport.city} airport`);
		const response = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&addressdetails=1`,
			{ 
				headers: { 'User-Agent': 'FlightTracker/1.0' }
			}
		);
		
		if (response.ok) {
			const data = await response.json();
			if (data && data.length > 0) {
				const result = data[0];
				const latitude = parseFloat(result.lat);
				const longitude = parseFloat(result.lon);
				
				if (isValidCoordinate(longitude, latitude) && !isNullIsland(longitude, latitude)) {
					return {
						latitude,
						longitude,
						success: true
					};
				}
			}
		}
	} catch (error) {
		return {
			latitude: 0,
			longitude: 0,
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
	
	return {
		latitude: 0,
		longitude: 0,
		success: false,
		error: 'No results found'
	};
}

//batch geocode airports (with rate limiting)
export async function batchGeocodeAirports(
	airports: Airport[], 
	options: {
		batchSize?: number;
		delayMs?: number;
		onProgress?: (completed: number, total: number) => void;
		onError?: (airport: Airport, error: string) => void;
	} = {}
): Promise<Array<{
	airport: Airport;
	result: { latitude: number; longitude: number; success: boolean; error?: string };
}>> {
	const { batchSize = 5, delayMs = 1000, onProgress, onError } = options;
	const results: Array<{
		airport: Airport;
		result: { latitude: number; longitude: number; success: boolean; error?: string };
	}> = [];
	
	console.log(`🌍 Starting batch geocoding of ${airports.length} airports...`);
	
	for (let i = 0; i < airports.length; i += batchSize) {
		const batch = airports.slice(i, i + batchSize);
		
		// Process batch in parallel
		const batchPromises = batch.map(async (airport) => {
			const result = await geocodeAirportExternal(airport);
			if (!result.success && onError) {
				onError(airport, result.error || 'Unknown error');
			}
			return { airport, result };
		});
		
		const batchResults = await Promise.all(batchPromises);
		results.push(...batchResults);
		
		// Report progress
		if (onProgress) {
			onProgress(Math.min(i + batchSize, airports.length), airports.length);
		}
		
		// Rate limiting delay (except for last batch)
		if (i + batchSize < airports.length) {
			await new Promise(resolve => setTimeout(resolve, delayMs));
		}
	}
	
	console.log(`✅ Batch geocoding completed. ${results.filter(r => r.result.success).length}/${airports.length} successful`);
	
	return results;
}

//enhanced filter function that handles edge cases in flight data
export function filterFlightsEnhanced(
	flights: Flight[],
	filters: FilterOptions
): {
	validFlights: Flight[];
	invalidFlights: Flight[];
	issues: Array<{ flight: Flight; issues: string[] }>;
} {
	const validFlights: Flight[] = [];
	const invalidFlights: Flight[] = [];
	const issues: Array<{ flight: Flight; issues: string[] }> = [];
	
	flights.forEach(flight => {
		// First apply user filters
		const airlineMatch = filters.airlines.size === 0 || 
			(flight.airline_name && filters.airlines.has(flight.airline_name));
		
		const yearMatch = filters.years.size === 0 || 
			filters.years.has(new Date(flight.departure_time).getFullYear());
		
		const statusMatch = filters.statuses.has(flight.flight_status);
		
		const passesFilters = airlineMatch && yearMatch && statusMatch;
		
		if (passesFilters) {
			// Validate coordinates for flights that pass filters
			const { origin, destination, issues: coordIssues } = getValidFlightCoordinates(flight);
			
			if (origin && destination) {
				validFlights.push(flight);
			} else {
				invalidFlights.push(flight);
				if (coordIssues.length > 0) {
					issues.push({ flight, issues: coordIssues });
				}
			}
		}
	});
	
	return { validFlights, invalidFlights, issues };
}