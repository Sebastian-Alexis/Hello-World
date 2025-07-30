//flight map related types

export interface Flight {
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

export interface Airport {
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

export interface FlightMapProps {
	flights: Flight[];
	airports: Airport[];
	selectedFlight?: Flight | null;
	height?: string;
	showControls?: boolean;
	theme?: 'light' | 'dark';
	onFlightSelect?: (flight: Flight | null) => void;
	onAirportSelect?: (airport: Airport | null) => void;
}

export interface FilterOptions {
	airlines: Set<string>;
	years: Set<number>;
	statuses: Set<string>;
}

export interface MapViewState {
	longitude: number;
	latitude: number;
	zoom: number;
	bearing?: number;
	pitch?: number;
}

export interface LayerData {
	airports: Airport[];
	flights: Flight[];
}

export interface PopupData {
	type: 'flight' | 'airport';
	data: Flight | Airport;
	coordinates: [number, number];
}