// =============================================================================
// DATABASE TYPES - Generated from schema.sql
// Ultra-fast personal website database types
// =============================================================================

// Base entity interface with common fields
interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// USER MANAGEMENT & AUTHENTICATION
// =============================================================================

export interface User extends BaseEntity {
  email: string;
  username: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'editor' | 'viewer';
  avatar_url?: string;
  bio?: string;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: string;
}

export interface UserSession {
  id: string; // session token
  user_id: number;
  expires_at: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// =============================================================================
// BLOG SYSTEM
// =============================================================================

export interface BlogPost extends BaseEntity {
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
  gallery_images?: string[]; // JSON array
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  og_image?: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  allow_comments: boolean;
  view_count: number;
  reading_time?: number;
  author_id: number;
  published_at?: string;
  // Computed fields from joins
  author_name?: string;
  author_avatar?: string;
  categories?: BlogCategory[];
  tags?: BlogTag[];
}

export interface BlogCategory extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  post_count: number;
  is_active: boolean;
  sort_order: number;
}

export interface BlogTag extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  color?: string;
  post_count: number;
  is_active: boolean;
}

export interface BlogPostCategory {
  id: number;
  blog_post_id: number;
  category_id: number;
  created_at: string;
}

export interface BlogPostTag {
  id: number;
  blog_post_id: number;
  tag_id: number;
  created_at: string;
}

// =============================================================================
// PORTFOLIO SYSTEM
// =============================================================================

export interface PortfolioProject extends BaseEntity {
  slug: string;
  title: string;
  short_description: string;
  full_description?: string;
  content?: string; // markdown content
  featured_image?: string;
  gallery_images?: string[]; // JSON array
  demo_url?: string;
  source_url?: string;
  case_study_url?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'archived';
  featured: boolean;
  view_count: number;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_hours?: number;
  client_name?: string;
  team_size?: number;
  start_date?: string;
  end_date?: string;
  // Computed fields from joins
  categories?: ProjectCategory[];
  technologies?: ProjectTechnology[];
}

export interface ProjectCategory extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  color: string;
  icon?: string;
  project_count: number;
  is_active: boolean;
  sort_order: number;
}

export interface ProjectTechnology extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  category: 'language' | 'framework' | 'library' | 'tool' | 'platform' | 'database';
  project_count: number;
  is_active: boolean;
  sort_order: number;
}

export interface ProjectProjectCategory {
  id: number;
  project_id: number;
  category_id: number;
  created_at: string;
}

export interface ProjectProjectTechnology {
  id: number;
  project_id: number;
  technology_id: number;
  created_at: string;
}

// =============================================================================
// FLIGHT TRACKING SYSTEM
// =============================================================================

export interface Airport extends BaseEntity {
  iata_code: string; // 3-letter code
  icao_code?: string; // 4-letter code  
  name: string;
  city: string;
  country: string;
  country_code: string; // ISO 2-letter
  region?: string;
  latitude: number;
  longitude: number;
  altitude?: number; // feet above sea level
  timezone?: string;
  dst_timezone?: string;
  type: 'airport' | 'heliport' | 'seaplane_base' | 'balloonport';
  is_active: boolean;
  // Computed fields for deck.gl
  coordinates?: [number, number]; // [lng, lat]
}

export interface Flight extends BaseEntity {
  flight_number?: string;
  airline_code?: string;
  airline_name?: string;
  aircraft_type?: string;
  departure_airport_id: number;
  arrival_airport_id: number;
  departure_time: string;
  arrival_time: string;
  flight_duration?: number; // minutes
  distance_km?: number;
  seat_number?: string;
  class?: 'economy' | 'premium_economy' | 'business' | 'first';
  booking_reference?: string;
  ticket_price?: number;
  currency: string;
  notes?: string;
  photos?: string[]; // JSON array
  trip_purpose?: 'business' | 'vacation' | 'personal' | 'other';
  is_favorite: boolean;
  // Computed fields from joins
  departure_airport?: Airport;
  arrival_airport?: Airport;
  route?: FlightRoute;
}

export interface FlightRoute extends BaseEntity {
  name: string;
  description?: string;
  departure_airport_id: number;
  arrival_airport_id: number;
  flight_count: number;
  total_distance_km?: number;
  average_duration?: number; // minutes
  route_color?: string; // hex color
  is_active: boolean;
  // Computed fields from joins
  departure_airport?: Airport;
  arrival_airport?: Airport;
}

// =============================================================================
// CREDENTIALS & EXPERIENCE
// =============================================================================

export interface Education extends BaseEntity {
  institution: string;
  degree: string;
  field_of_study?: string;
  grade?: string;
  description?: string;
  logo_url?: string;
  is_current: boolean;
  start_date?: string;
  end_date?: string;
}

export interface Certification extends BaseEntity {
  name: string;
  issuing_organization: string;
  credential_id?: string;
  credential_url?: string;
  description?: string;
  logo_url?: string;
  skills?: string[]; // JSON array
  is_active: boolean;
  does_not_expire: boolean;
  issue_date?: string;
  expiration_date?: string;
}

export interface WorkExperience extends BaseEntity {
  company: string;
  position: string;
  employment_type: 'full_time' | 'part_time' | 'contract' | 'freelance' | 'internship';
  location?: string;
  description?: string;
  achievements?: string[]; // JSON array
  technologies_used?: string[]; // JSON array
  company_logo_url?: string;
  is_current: boolean;
  start_date?: string;
  end_date?: string;
}

// =============================================================================
// MEDIA & FILES
// =============================================================================

export interface MediaFile extends BaseEntity {
  filename: string;
  original_filename: string;
  file_type: 'image' | 'video' | 'audio' | 'document' | 'other';
  mime_type: string;
  file_size: number; // bytes
  width?: number;
  height?: number;
  duration?: number; // seconds for audio/video
  url: string;
  cdn_url?: string;
  thumbnail_url?: string;
  alt_text?: string;
  caption?: string;
  metadata?: Record<string, unknown>; // JSON
  is_public: boolean;
  uploaded_by: number;
}

// =============================================================================  
// ANALYTICS & TRACKING
// =============================================================================

export interface AnalyticsEvent {
  id: number;
  event_type: string;
  page_path: string;
  page_title?: string;
  referrer?: string;
  user_agent?: string;
  ip_address?: string;
  country?: string;
  city?: string;
  browser?: string;
  os?: string;
  device_type?: string;
  session_id?: string;
  user_id?: number;
  metadata?: Record<string, unknown>; // JSON
  created_at: string;
}

export interface PageView extends BaseEntity {
  page_path: string;
  view_date: string;
  view_count: number;
  unique_visitors: number;
}

// =============================================================================
// SITE CONFIGURATION
// =============================================================================

export interface SiteSetting extends BaseEntity {
  key: string;
  value?: string;
  data_type: 'string' | 'integer' | 'float' | 'boolean' | 'json';
  category: string;
  description?: string;
  is_public: boolean; // can be exposed to frontend
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// =============================================================================
// FORM & VALIDATION TYPES
// =============================================================================

export interface BlogPostForm {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
  gallery_images?: string[];
  meta_title?: string;
  meta_description?: string;
  canonical_url?: string;
  og_image?: string;
  status: 'draft' | 'published';
  featured: boolean;
  allow_comments: boolean;
  category_ids: number[];
  tag_ids: number[];
  published_at?: string;
}

export interface ProjectForm {
  title: string;
  slug: string;
  short_description: string;
  full_description?: string;
  content?: string;
  featured_image?: string;
  gallery_images?: string[];
  demo_url?: string;
  source_url?: string;
  case_study_url?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'archived';
  featured: boolean;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_hours?: number;
  client_name?: string;
  team_size?: number;
  start_date?: string;
  end_date?: string;
  category_ids: number[];
  technology_ids: number[];
}

export interface FlightForm {
  flight_number?: string;
  airline_code?: string;
  airline_name?: string;
  aircraft_type?: string;
  departure_airport_id: number;
  arrival_airport_id: number;
  departure_time: string;
  arrival_time: string;
  seat_number?: string;
  class?: 'economy' | 'premium_economy' | 'business' | 'first';
  booking_reference?: string;
  ticket_price?: number;
  currency: string;
  notes?: string;
  photos?: string[];
  trip_purpose?: 'business' | 'vacation' | 'personal' | 'other';
  is_favorite: boolean;
}

// =============================================================================
// SEARCH & FILTERING TYPES
// =============================================================================

export interface SearchFilters {
  query?: string;
  category?: string;
  tag?: string;
  status?: string;
  featured?: boolean;
  author?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface BlogSearchFilters extends SearchFilters {
  categories?: number[];
  tags?: number[];
}

export interface ProjectSearchFilters extends SearchFilters {
  categories?: number[];
  technologies?: number[];
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  status?: 'planning' | 'in_progress' | 'completed' | 'archived';
}

export interface FlightSearchFilters {
  airline?: string;
  airport?: string;
  year?: number;
  month?: number;
  class?: string;
  trip_purpose?: string;
}

// =============================================================================
// DATABASE QUERY TYPES  
// =============================================================================

export interface QueryOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: Record<string, unknown>;
}

export interface BlogPostQueryOptions extends QueryOptions {
  includeAuthor?: boolean;
  includeCategories?: boolean;
  includeTags?: boolean;
  status?: 'draft' | 'published' | 'archived';
  featured?: boolean;
}

export interface ProjectQueryOptions extends QueryOptions {
  includeCategories?: boolean;
  includeTechnologies?: boolean;
  status?: 'planning' | 'in_progress' | 'completed' | 'archived';
  featured?: boolean;
}

export interface FlightQueryOptions extends QueryOptions {
  includeAirports?: boolean;
  includeRoute?: boolean;
  year?: number;
  month?: number;
}