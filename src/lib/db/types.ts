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
  featured_image_url?: string;
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
  featured_image_url?: string;
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
  // Visit tracking fields
  has_visited: boolean;
  visit_count: number;
  first_visit_date?: string;
  last_visit_date?: string;
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
  // Flight status and integration
  flight_status: 'booked' | 'completed' | 'cancelled' | 'delayed';
  blog_post_id?: number;
  // Trip information
  trip_id?: number;
  // Computed fields from joins
  departure_airport?: Airport;
  arrival_airport?: Airport;
  departure_airport_name?: string;
  departure_city?: string;
  departure_country?: string;
  departure_iata?: string;
  arrival_airport_name?: string;
  arrival_city?: string;
  arrival_country?: string;
  arrival_iata?: string;
  dep_lat?: number;
  dep_lng?: number;
  arr_lat?: number;
  arr_lng?: number;
  origin?: [number, number]; // [lng, lat] for deck.gl
  destination?: [number, number]; // [lng, lat] for deck.gl
  route?: FlightRoute;
  trip?: Trip;
}

export interface Trip extends BaseEntity {
  name: string;
  start_date: string;
  end_date: string;
  blog_post_id?: number;
  is_active: boolean;
  // Computed fields from joins
  flights?: Flight[];
  blog_post?: BlogPost;
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

// Skills and proficiency tracking
export interface Skill extends BaseEntity {
  name: string;
  category: 'programming' | 'framework' | 'database' | 'tool' | 'soft-skill' | 'language';
  proficiency_level: number; // 1-5 scale
  years_experience?: number;
  last_used_date?: string;
  certification_level?: string;
  projects_count: number;
  description?: string;
  learning_resources?: string[]; // JSON array
  endorsements_count: number;
  priority_level: 'high' | 'medium' | 'low';
}

// Project skills relationship
export interface ProjectSkill {
  project_id: number;
  skill_id: number;
  usage_level: 'primary' | 'secondary' | 'minor';
}

// Client testimonials and recommendations
export interface Testimonial extends BaseEntity {
  client_name: string;
  client_position?: string;
  client_company?: string;
  client_email?: string;
  client_linkedin?: string;
  project_id?: number;
  testimonial_text: string;
  rating: number; // 1-5 scale
  date_given: string;
  permission_to_display: boolean;
  permission_to_contact: boolean;
  featured: boolean;
  testimonial_type: 'project' | 'general' | 'skill-specific';
  work_relationship?: string;
  // Computed fields
  project_title?: string;
  project_slug?: string;
}

// Project case study sections
export interface CaseStudySection extends BaseEntity {
  project_id: number;
  section_type: 'challenge' | 'solution' | 'process' | 'outcome' | 'lessons';
  section_title: string;
  section_content: string;
  section_order: number;
  media_items?: string[]; // JSON array
  code_examples?: string[]; // JSON array
  metrics?: Record<string, unknown>; // JSON object
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
  featured_image_url?: string;
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
  featured_image_url?: string;
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
  // Airport data - support both ID and IATA code approaches
  departure_airport_id?: number;
  arrival_airport_id?: number;
  departure_iata?: string;
  departure_airport_name?: string;
  departure_city?: string;
  departure_country?: string;
  arrival_iata?: string;
  arrival_airport_name?: string;
  arrival_city?: string;
  arrival_country?: string;
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
  flight_status: 'booked' | 'completed' | 'cancelled' | 'delayed';
  blog_post_id?: number;
  trip_id?: number;
}

export interface TripForm {
  name: string;
  start_date: string;
  end_date: string;
  blog_post_id?: number;
  flight_numbers: string[];
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

// =============================================================================
// LIGHTHOUSE CI PERFORMANCE MONITORING
// =============================================================================

export interface LighthouseResult extends BaseEntity {
  url: string;
  timestamp: number;
  config: 'desktop' | 'mobile';
  
  // lighthouse scores (0-1 scale)
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  
  // core web vitals (milliseconds, except CLS)
  lcp: number; // largest contentful paint
  fcp: number; // first contentful paint
  cls: number; // cumulative layout shift (0-1 scale)
  tbt: number; // total blocking time
  si: number;  // speed index
  tti: number; // time to interactive
  ttfb?: number; // time to first byte
  
  // additional metrics
  total_byte_weight?: number;
  unused_css_rules?: number;
  unused_javascript?: number;
  render_blocking_resources?: number;
  
  // environment data (JSON)
  environment_data?: string;
  
  // metadata
  commit_hash?: string;
  branch_name?: string;
  build_id?: string;
}

export interface LighthouseBaseline extends BaseEntity {
  url: string;
  config: 'desktop' | 'mobile';
  result_id: number;
  updated_at: number;
}

export interface PerformanceRegression extends BaseEntity {
  lighthouse_result_id: number;
  baseline_result_id: number;
  
  // regression details
  metric_name: string; // 'performance_score', 'lcp', 'fcp', etc.
  current_value: number;
  baseline_value: number;
  regression_percentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // metadata
  detected_at: number;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: number;
  resolution_notes?: string;
}

export interface PerformanceTrend {
  id?: number;
  url: string;
  config: 'desktop' | 'mobile';
  metric_name: string;
  
  // trend analysis
  trend_direction: 'improving' | 'stable' | 'degrading';
  trend_strength: number; // 0-1 scale
  
  // time period
  period_start: number;
  period_end: number;
  sample_count: number;
  
  // statistical data
  avg_value: number;
  min_value: number;
  max_value: number;
  std_deviation?: number;
  
  // data points for visualization
  dataPoints: Array<{
    timestamp: number;
    value: number;
    source: 'lighthouse' | 'rum' | 'synthetic';
  }>;
  
  // metadata
  calculated_at?: number;
}

export interface PerformanceAlert extends BaseEntity {
  alert_type: 'regression' | 'budget_exceeded' | 'threshold_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // alert details
  title: string;
  message: string;
  url: string;
  metric_name?: string;
  current_value?: number;
  threshold_value?: number;
  
  // related records
  lighthouse_result_id?: number;
  regression_id?: number;
  
  // alert status
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledged_by?: string;
  acknowledged_at?: number;
  resolved_at?: number;
  resolution_notes?: string;
}

export interface LighthouseConfig extends BaseEntity {
  name: string;
  config_data: string; // JSON configuration
  is_active: boolean;
}

// =============================================================================
// LIGHTHOUSE CI FORM TYPES
// =============================================================================

export interface LighthouseResultForm {
  url: string;
  config: 'desktop' | 'mobile';
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  lcp: number;
  fcp: number;
  cls: number;
  tbt: number;
  si: number;
  tti: number;
  ttfb?: number;
  total_byte_weight?: number;
  unused_css_rules?: number;
  unused_javascript?: number;
  render_blocking_resources?: number;
  environment_data?: any;
  commit_hash?: string;
  branch_name?: string;
  build_id?: string;
}

export interface PerformanceRegressionForm {
  lighthouse_result_id: number;
  baseline_result_id: number;
  metric_name: string;
  current_value: number;
  baseline_value: number;
  regression_percentage: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceAlertForm {
  alert_type: 'regression' | 'budget_exceeded' | 'threshold_violation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  url: string;
  metric_name?: string;
  current_value?: number;
  threshold_value?: number;
  lighthouse_result_id?: number;
  regression_id?: number;
}

// =============================================================================
// LIGHTHOUSE CI QUERY OPTIONS
// =============================================================================

export interface LighthouseQueryOptions extends QueryOptions {
  url?: string;
  config?: 'desktop' | 'mobile';
  timeRange?: string;
  includeEnvironment?: boolean;
}

export interface PerformanceRegressionQueryOptions extends QueryOptions {
  url?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  acknowledged?: boolean;
  timeRange?: string;
}

export interface PerformanceAlertQueryOptions extends QueryOptions {
  status?: 'active' | 'acknowledged' | 'resolved';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  alert_type?: 'regression' | 'budget_exceeded' | 'threshold_violation';
  timeRange?: string;
}