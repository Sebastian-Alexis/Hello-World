-- =============================================================================
-- ADVANCED PERFORMANCE INDEXES - Plan 7 Database Optimization
-- Ultra-fast indexing strategy for edge database performance
-- =============================================================================

--additional composite indexes for complex query patterns
CREATE INDEX IF NOT EXISTS idx_blog_posts_status_featured_view_count ON blog_posts(status, featured, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author_status_published ON blog_posts(author_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_view_count ON blog_posts(published_at DESC, view_count DESC) WHERE status = 'published';

--portfolio project performance indexes  
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_status_featured_created ON portfolio_projects(status, featured, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_type_status_view_count ON portfolio_projects(project_type, status, view_count DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_featured_dates ON portfolio_projects(featured, start_date DESC, end_date DESC);

--flight tracking performance indexes
CREATE INDEX IF NOT EXISTS idx_flights_departure_time_airport ON flights(departure_time DESC, departure_airport_id);
CREATE INDEX IF NOT EXISTS idx_flights_arrival_time_airport ON flights(arrival_time DESC, arrival_airport_id);
CREATE INDEX IF NOT EXISTS idx_flights_airline_departure_time ON flights(airline_code, departure_time DESC);
CREATE INDEX IF NOT EXISTS idx_flights_favorite_departure_time ON flights(is_favorite, departure_time DESC);
CREATE INDEX IF NOT EXISTS idx_flights_status_departure_time ON flights(flight_status, departure_time DESC);

--airport performance indexes
CREATE INDEX IF NOT EXISTS idx_airports_country_city ON airports(country_code, city);
CREATE INDEX IF NOT EXISTS idx_airports_visited_count ON airports(has_visited, visit_count DESC);
CREATE INDEX IF NOT EXISTS idx_airports_coordinates ON airports(latitude, longitude);

--analytics performance indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date_range ON analytics_events(event_type, created_at DESC, entity_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_entity_date ON analytics_events(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_time ON analytics_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_time_range ON analytics_events(page_path, created_at DESC);

--page views aggregation indexes
CREATE INDEX IF NOT EXISTS idx_page_views_path_date_visitors ON page_views(page_path, view_date DESC, unique_visitors DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_date_count ON page_views(view_date DESC, view_count DESC);

--media file performance indexes
CREATE INDEX IF NOT EXISTS idx_media_files_type_size ON media_files(file_type, file_size DESC);
CREATE INDEX IF NOT EXISTS idx_media_files_public_created ON media_files(is_public, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_files_user_type_created ON media_files(upload_user_id, file_type, created_at DESC);

--user session performance indexes
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_user ON user_sessions(expires_at, user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_created ON user_sessions(user_id, created_at DESC);

--skills and experience indexes
CREATE INDEX IF NOT EXISTS idx_skills_category_proficiency ON skills(category, proficiency_level DESC);
CREATE INDEX IF NOT EXISTS idx_skills_priority_projects ON skills(priority_level, projects_count DESC);
CREATE INDEX IF NOT EXISTS idx_work_experience_dates_current ON work_experience(start_date DESC, end_date DESC, is_current);
CREATE INDEX IF NOT EXISTS idx_education_dates_current ON education(start_date DESC, end_date DESC, is_current);
CREATE INDEX IF NOT EXISTS idx_certifications_active_issue_date ON certifications(is_active, issue_date DESC);

--testimonials performance indexes
CREATE INDEX IF NOT EXISTS idx_testimonials_featured_rating ON testimonials(featured, rating DESC);
CREATE INDEX IF NOT EXISTS idx_testimonials_display_project ON testimonials(permission_to_display, project_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_type_date ON testimonials(testimonial_type, date_given DESC);

--case study sections indexes
CREATE INDEX IF NOT EXISTS idx_case_study_sections_project_order ON case_study_sections(project_id, section_order);
CREATE INDEX IF NOT EXISTS idx_case_study_sections_type_project ON case_study_sections(section_type, project_id);

--junction table performance indexes
CREATE INDEX IF NOT EXISTS idx_blog_post_categories_category_post ON blog_post_categories(category_id, post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_tags_tag_post ON blog_post_tags(tag_id, post_id);
CREATE INDEX IF NOT EXISTS idx_project_project_categories_category_project ON project_project_categories(category_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_project_technologies_tech_project ON project_project_technologies(technology_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_skills_skill_project ON project_skills(skill_id, project_id);

--partial indexes for common filtered queries
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_only ON blog_posts(published_at DESC, view_count DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured_published ON blog_posts(published_at DESC) WHERE status = 'published' AND featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_active_only ON portfolio_projects(created_at DESC, view_count DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_featured_active ON portfolio_projects(created_at DESC) WHERE status = 'active' AND featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_flights_completed_only ON flights(departure_time DESC) WHERE flight_status = 'completed';
CREATE INDEX IF NOT EXISTS idx_airports_active_visited ON airports(visit_count DESC) WHERE is_active = TRUE AND has_visited = TRUE;

--covering indexes for frequently accessed data
CREATE INDEX IF NOT EXISTS idx_blog_posts_list_cover ON blog_posts(status, published_at DESC, id, title, slug, excerpt, featured_image_url, view_count, reading_time);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_list_cover ON portfolio_projects(status, created_at DESC, id, title, slug, short_description, featured_image_url, view_count, project_type);
CREATE INDEX IF NOT EXISTS idx_flights_list_cover ON flights(departure_time DESC, id, flight_number, airline_name, departure_airport_id, arrival_airport_id, flight_duration, distance_km);

--search optimization indexes
CREATE INDEX IF NOT EXISTS idx_blog_categories_search ON blog_categories(name, slug, is_active);
CREATE INDEX IF NOT EXISTS idx_blog_tags_search ON blog_tags(name, slug);
CREATE INDEX IF NOT EXISTS idx_project_categories_search ON project_categories(name, slug, is_active);
CREATE INDEX IF NOT EXISTS idx_project_technologies_search ON project_technologies(name, slug, category, is_active);
CREATE INDEX IF NOT EXISTS idx_airports_search ON airports(iata_code, icao_code, name, city, country);

--performance monitoring table
CREATE TABLE IF NOT EXISTS query_performance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_hash TEXT NOT NULL,
    query_type TEXT NOT NULL, --SELECT, INSERT, UPDATE, DELETE
    table_name TEXT,
    execution_time_ms REAL NOT NULL,
    rows_examined INTEGER,
    rows_returned INTEGER,
    cache_hit BOOLEAN DEFAULT FALSE,
    user_id INTEGER,
    session_id TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    query_plan TEXT --EXPLAIN QUERY PLAN output
);

CREATE INDEX IF NOT EXISTS idx_query_performance_log_hash_time ON query_performance_log(query_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_log_type_time ON query_performance_log(query_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_log_execution_time ON query_performance_log(execution_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_query_performance_log_table_time ON query_performance_log(table_name, created_at DESC);

--cache performance table
CREATE TABLE IF NOT EXISTS cache_performance_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cache_key TEXT NOT NULL,
    cache_type TEXT NOT NULL, --query, page, api
    hit_miss TEXT NOT NULL CHECK (hit_miss IN ('hit', 'miss')),
    execution_time_ms REAL,
    cache_size_bytes INTEGER,
    ttl_seconds INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cache_performance_log_key_time ON cache_performance_log(cache_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cache_performance_log_type_hit_miss ON cache_performance_log(cache_type, hit_miss, created_at DESC);

--connection pool monitoring table
CREATE TABLE IF NOT EXISTS connection_pool_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    active_connections INTEGER NOT NULL,
    idle_connections INTEGER NOT NULL,
    waiting_connections INTEGER NOT NULL,
    total_connections INTEGER NOT NULL,
    avg_wait_time_ms REAL,
    avg_query_time_ms REAL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_connection_pool_metrics_time ON connection_pool_metrics(created_at DESC);

-- =============================================================================
-- ANALYZE AND OPTIMIZE
-- =============================================================================

--update table statistics for query planner
ANALYZE;

--optimize database after index creation
PRAGMA optimize;