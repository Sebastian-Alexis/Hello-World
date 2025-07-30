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

//calculate optimal map bounds for given airports/flights
export function calculateBounds(
	airports: Airport[],
	flights: Flight[]
): [[number, number], [number, number]] | null {
	if (airports.length === 0 && flights.length === 0) {
		return null;
	}

	let minLng = Infinity;
	let maxLng = -Infinity;
	let minLat = Infinity;
	let maxLat = -Infinity;

	//include airport coordinates
	airports.forEach(airport => {
		const [lng, lat] = airport.coordinates;
		minLng = Math.min(minLng, lng);
		maxLng = Math.max(maxLng, lng);
		minLat = Math.min(minLat, lat);
		maxLat = Math.max(maxLat, lat);
	});

	//include flight coordinates
	flights.forEach(flight => {
		const [originLng, originLat] = flight.origin;
		const [destLng, destLat] = flight.destination;
		
		minLng = Math.min(minLng, originLng, destLng);
		maxLng = Math.max(maxLng, originLng, destLng);
		minLat = Math.min(minLat, originLat, destLat);
		maxLat = Math.max(maxLat, originLat, destLat);
	});

	//add padding
	const lngPadding = (maxLng - minLng) * 0.1;
	const latPadding = (maxLat - minLat) * 0.1;

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