-- =============================================================================
-- ULTRA-FAST PERSONAL WEBSITE DATABASE SCHEMA
-- Optimized for SQLite with Turso edge deployment
-- =============================================================================

-- SQLite optimization pragmas for ultra-fast performance
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
PRAGMA mmap_size = 268435456; -- 256mb
PRAGMA optimize;
PRAGMA foreign_keys = ON;
PRAGMA auto_vacuum = INCREMENTAL;

-- =============================================================================
-- USER MANAGEMENT & AUTHENTICATION
-- =============================================================================

-- users table for admin authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'editor', 'viewer')),
    avatar_url TEXT,
    bio TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- user sessions for authentication state
CREATE TABLE user_sessions (
    id TEXT PRIMARY KEY, -- session token
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================================================
-- BLOG SYSTEM
-- =============================================================================

-- blog categories
CREATE TABLE blog_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT, -- hex color for UI
    icon TEXT, -- icon name/class
    post_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- blog tags
CREATE TABLE blog_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    post_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- main blog posts table
CREATE TABLE blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    content_html TEXT NOT NULL, -- rendered HTML
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    featured_image_url TEXT,
    meta_title TEXT,
    meta_description TEXT,
    meta_keywords TEXT,
    og_title TEXT,
    og_description TEXT,
    og_image_url TEXT,
    canonical_url TEXT,
    reading_time INTEGER, -- estimated reading time in minutes
    word_count INTEGER,
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    comment_count INTEGER NOT NULL DEFAULT 0,
    author_id INTEGER NOT NULL,
    published_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- many-to-many: blog posts and categories
CREATE TABLE blog_post_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE CASCADE,
    UNIQUE(post_id, category_id)
);

-- many-to-many: blog posts and tags
CREATE TABLE blog_post_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE,
    UNIQUE(post_id, tag_id)
);

-- =============================================================================
-- PORTFOLIO SYSTEM
-- =============================================================================

-- portfolio project categories
CREATE TABLE project_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    color TEXT,
    icon TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- technology stack items
CREATE TABLE project_technologies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    color TEXT,
    category TEXT, -- frontend, backend, database, devops, etc.
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- main portfolio projects
CREATE TABLE portfolio_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    short_description TEXT NOT NULL,
    full_description TEXT,
    content TEXT, -- detailed case study content
    content_html TEXT, -- rendered HTML
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'private')),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    project_type TEXT NOT NULL CHECK (project_type IN ('web', 'mobile', 'desktop', 'api', 'library', 'other')),
    
    -- project details
    client_name TEXT,
    client_industry TEXT,
    project_duration TEXT,
    team_size INTEGER,
    my_role TEXT,
    
    -- urls and media
    live_url TEXT,
    github_url TEXT,
    demo_url TEXT,
    featured_image_url TEXT,
    gallery_images TEXT, -- JSON array of image URLs
    
    -- seo
    meta_title TEXT,
    meta_description TEXT,
    og_image_url TEXT,
    
    -- stats
    view_count INTEGER NOT NULL DEFAULT 0,
    like_count INTEGER NOT NULL DEFAULT 0,
    
    -- dates
    start_date DATE,
    end_date DATE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- many-to-many: projects and categories
CREATE TABLE project_project_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES project_categories(id) ON DELETE CASCADE,
    UNIQUE(project_id, category_id)
);

-- many-to-many: projects and technologies
CREATE TABLE project_project_technologies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    technology_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (technology_id) REFERENCES project_technologies(id) ON DELETE CASCADE,
    UNIQUE(project_id, technology_id)
);

-- =============================================================================
-- FLIGHT TRACKING SYSTEM
-- =============================================================================

-- airports database for flight tracking
CREATE TABLE airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    iata_code TEXT NOT NULL UNIQUE, -- 3-letter code (LAX, JFK)
    icao_code TEXT UNIQUE, -- 4-letter code (KLAX, KJFK)
    name TEXT NOT NULL,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    country_code TEXT NOT NULL, -- ISO 2-letter code
    region TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude INTEGER, -- feet above sea level
    timezone TEXT,
    dst_timezone TEXT,
    type TEXT NOT NULL DEFAULT 'airport' CHECK (type IN ('airport', 'heliport', 'seaplane_base', 'balloonport')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    -- Visit tracking for flight system
    has_visited BOOLEAN NOT NULL DEFAULT FALSE,
    visit_count INTEGER NOT NULL DEFAULT 0,
    first_visit_date DATETIME,
    last_visit_date DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- flight records
CREATE TABLE flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    flight_number TEXT,
    airline_code TEXT,
    airline_name TEXT,
    aircraft_type TEXT,
    departure_airport_id INTEGER NOT NULL,
    arrival_airport_id INTEGER NOT NULL,
    departure_time DATETIME NOT NULL,
    arrival_time DATETIME NOT NULL,
    flight_duration INTEGER, -- minutes
    distance_km REAL,
    seat_number TEXT,
    class TEXT CHECK (class IN ('economy', 'premium_economy', 'business', 'first')),
    booking_reference TEXT,
    ticket_price REAL,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    photos TEXT, -- JSON array of photo URLs
    trip_purpose TEXT CHECK (trip_purpose IN ('business', 'vacation', 'personal', 'other')),
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    -- Flight status and integration
    flight_status TEXT NOT NULL DEFAULT 'completed' CHECK (flight_status IN ('booked', 'completed', 'cancelled', 'delayed')),
    blog_post_id INTEGER,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (departure_airport_id) REFERENCES airports(id) ON DELETE CASCADE,
    FOREIGN KEY (arrival_airport_id) REFERENCES airports(id) ON DELETE CASCADE,
    FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE SET NULL
);

-- flight routes for deck.gl visualization
CREATE TABLE flight_routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    departure_airport_id INTEGER NOT NULL,
    arrival_airport_id INTEGER NOT NULL,
    flight_count INTEGER NOT NULL DEFAULT 0,
    total_distance_km REAL,
    average_duration INTEGER, -- minutes
    route_color TEXT, -- hex color for visualization
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (departure_airport_id) REFERENCES airports(id) ON DELETE CASCADE,
    FOREIGN KEY (arrival_airport_id) REFERENCES airports(id) ON DELETE CASCADE,
    UNIQUE(departure_airport_id, arrival_airport_id)
);

-- =============================================================================
-- CREDENTIALS & EXPERIENCE
-- =============================================================================

-- education records
CREATE TABLE education (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    institution_name TEXT NOT NULL,
    degree_type TEXT NOT NULL, -- Bachelor's, Master's, PhD, Certificate, etc.
    degree_name TEXT NOT NULL,
    field_of_study TEXT,
    location TEXT,
    gpa TEXT,
    honors TEXT,
    description TEXT,
    logo_url TEXT,
    website_url TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- certifications
CREATE TABLE certifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    issuing_organization TEXT NOT NULL,
    credential_id TEXT,
    credential_url TEXT,
    description TEXT,
    skills TEXT, -- JSON array of skills
    logo_url TEXT,
    issue_date DATE NOT NULL,
    expiration_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- work experience
CREATE TABLE work_experience (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT NOT NULL,
    job_title TEXT NOT NULL,
    employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'contract', 'internship', 'freelance')),
    location TEXT,
    is_remote BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    responsibilities TEXT, -- JSON array of key responsibilities
    achievements TEXT, -- JSON array of achievements
    technologies_used TEXT, -- JSON array of technologies
    company_logo_url TEXT,
    company_website_url TEXT,
    start_date DATE NOT NULL,
    end_date DATE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- skills and proficiency tracking
CREATE TABLE skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL, -- 'programming', 'framework', 'database', 'tool', 'soft-skill', 'language'
    proficiency_level INTEGER CHECK (proficiency_level BETWEEN 1 AND 5), -- 1=Beginner, 5=Expert
    years_experience DECIMAL(3,1),
    last_used_date DATE,
    certification_level TEXT,
    projects_count INTEGER DEFAULT 0,
    description TEXT,
    learning_resources TEXT, -- JSON array
    endorsements_count INTEGER DEFAULT 0,
    priority_level TEXT DEFAULT 'medium', -- 'high', 'medium', 'low'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- project skills relationship
CREATE TABLE project_skills (
    project_id INTEGER NOT NULL,
    skill_id INTEGER NOT NULL,
    usage_level TEXT DEFAULT 'primary', -- 'primary', 'secondary', 'minor'
    PRIMARY KEY (project_id, skill_id),
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
);

-- client testimonials and recommendations
CREATE TABLE testimonials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_name TEXT NOT NULL,
    client_position TEXT,
    client_company TEXT,
    client_email TEXT,
    client_linkedin TEXT,
    project_id INTEGER,
    testimonial_text TEXT NOT NULL,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    date_given DATE NOT NULL,
    permission_to_display BOOLEAN DEFAULT TRUE,
    permission_to_contact BOOLEAN DEFAULT FALSE,
    featured BOOLEAN DEFAULT FALSE,
    testimonial_type TEXT DEFAULT 'project', -- 'project', 'general', 'skill-specific'
    work_relationship TEXT, -- 'client', 'colleague', 'supervisor', 'subordinate'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE SET NULL
);

-- project case study components
CREATE TABLE case_study_sections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    section_type TEXT NOT NULL, -- 'challenge', 'solution', 'process', 'outcome', 'lessons'
    section_title TEXT NOT NULL,
    section_content TEXT NOT NULL,
    section_order INTEGER NOT NULL,
    media_items TEXT, -- JSON array of images/videos
    code_examples TEXT, -- JSON array
    metrics TEXT, -- JSON object with performance metrics
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES portfolio_projects(id) ON DELETE CASCADE
);

-- =============================================================================
-- MEDIA & CONTENT MANAGEMENT
-- =============================================================================

-- media files management
CREATE TABLE media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_url TEXT NOT NULL UNIQUE,
    file_size INTEGER NOT NULL, -- bytes
    mime_type TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video', 'audio', 'document', 'other')),
    width INTEGER, -- for images/videos
    height INTEGER, -- for images/videos
    duration INTEGER, -- for videos/audio in seconds
    alt_text TEXT,
    caption TEXT,
    metadata TEXT, -- JSON metadata
    upload_user_id INTEGER,
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (upload_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- =============================================================================
-- ANALYTICS & TRACKING
-- =============================================================================

-- analytics events for tracking
CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- page_view, click, download, etc.
    page_path TEXT NOT NULL,
    page_title TEXT,
    referrer TEXT,
    user_agent TEXT,
    ip_address TEXT,
    country TEXT,
    city TEXT,
    browser TEXT,
    os TEXT,
    device_type TEXT,
    session_id TEXT,
    user_id INTEGER, -- for logged-in users
    metadata TEXT, -- JSON additional data
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- page views summary (for performance)
CREATE TABLE page_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_path TEXT NOT NULL,
    view_date DATE NOT NULL,
    view_count INTEGER NOT NULL DEFAULT 1,
    unique_visitors INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(page_path, view_date)
);

-- =============================================================================
-- SITE CONFIGURATION
-- =============================================================================

-- site settings and configuration
CREATE TABLE site_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT,
    data_type TEXT NOT NULL DEFAULT 'string' CHECK (data_type IN ('string', 'integer', 'float', 'boolean', 'json')),
    category TEXT NOT NULL DEFAULT 'general',
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT FALSE, -- can be exposed to frontend
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- FULL-TEXT SEARCH (FTS5)
-- =============================================================================

-- fts5 table for blog posts
CREATE VIRTUAL TABLE blog_posts_fts USING fts5(
    title,
    excerpt,
    content,
    content=blog_posts,
    content_rowid=id,
    tokenize='trigram'
);

-- fts5 table for portfolio projects
CREATE VIRTUAL TABLE portfolio_projects_fts USING fts5(
    title,
    short_description,
    full_description,
    content,
    content=portfolio_projects,
    content_rowid=id,
    tokenize='trigram'
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================

-- user indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- session indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- blog indexes
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_featured ON blog_posts(featured);
CREATE INDEX idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_view_count ON blog_posts(view_count DESC);
CREATE INDEX idx_blog_posts_status_published ON blog_posts(status, published_at DESC);

CREATE INDEX idx_blog_categories_slug ON blog_categories(slug);
CREATE INDEX idx_blog_categories_active ON blog_categories(is_active);

CREATE INDEX idx_blog_tags_slug ON blog_tags(slug);

CREATE INDEX idx_blog_post_categories_post_id ON blog_post_categories(post_id);
CREATE INDEX idx_blog_post_categories_category_id ON blog_post_categories(category_id);

CREATE INDEX idx_blog_post_tags_post_id ON blog_post_tags(post_id);
CREATE INDEX idx_blog_post_tags_tag_id ON blog_post_tags(tag_id);

-- portfolio indexes
CREATE INDEX idx_portfolio_projects_status ON portfolio_projects(status);
CREATE INDEX idx_portfolio_projects_featured ON portfolio_projects(featured);
CREATE INDEX idx_portfolio_projects_slug ON portfolio_projects(slug);
CREATE INDEX idx_portfolio_projects_type ON portfolio_projects(project_type);
CREATE INDEX idx_portfolio_projects_view_count ON portfolio_projects(view_count DESC);

CREATE INDEX idx_project_categories_slug ON project_categories(slug);
CREATE INDEX idx_project_categories_active ON project_categories(is_active);
CREATE INDEX idx_project_categories_sort ON project_categories(sort_order);

CREATE INDEX idx_project_technologies_slug ON project_technologies(slug);
CREATE INDEX idx_project_technologies_category ON project_technologies(category);
CREATE INDEX idx_project_technologies_active ON project_technologies(is_active);

-- flight indexes
CREATE INDEX idx_airports_iata_code ON airports(iata_code);
CREATE INDEX idx_airports_icao_code ON airports(icao_code);
CREATE INDEX idx_airports_country_code ON airports(country_code);
CREATE INDEX idx_airports_active ON airports(is_active);

CREATE INDEX idx_flights_departure_time ON flights(departure_time DESC);
CREATE INDEX idx_flights_departure_airport ON flights(departure_airport_id);
CREATE INDEX idx_flights_arrival_airport ON flights(arrival_airport_id);
CREATE INDEX idx_flights_airline_code ON flights(airline_code);
CREATE INDEX idx_flights_favorite ON flights(is_favorite);

CREATE INDEX idx_flight_routes_departure ON flight_routes(departure_airport_id);
CREATE INDEX idx_flight_routes_arrival ON flight_routes(arrival_airport_id);
CREATE INDEX idx_flight_routes_active ON flight_routes(is_active);

-- credentials indexes
CREATE INDEX idx_education_current ON education(is_current);
CREATE INDEX idx_education_sort ON education(sort_order);
CREATE INDEX idx_education_dates ON education(start_date DESC, end_date DESC);

CREATE INDEX idx_certifications_active ON certifications(is_active);
CREATE INDEX idx_certifications_sort ON certifications(sort_order);
CREATE INDEX idx_certifications_issue_date ON certifications(issue_date DESC);

CREATE INDEX idx_work_experience_current ON work_experience(is_current);
CREATE INDEX idx_work_experience_sort ON work_experience(sort_order);
CREATE INDEX idx_work_experience_dates ON work_experience(start_date DESC, end_date DESC);

-- skills indexes
CREATE INDEX idx_skills_category ON skills(category);
CREATE INDEX idx_skills_proficiency ON skills(proficiency_level DESC);
CREATE INDEX idx_skills_priority ON skills(priority_level);
CREATE INDEX idx_skills_projects_count ON skills(projects_count DESC);

-- testimonials indexes
CREATE INDEX idx_testimonials_project_id ON testimonials(project_id);
CREATE INDEX idx_testimonials_featured ON testimonials(featured);
CREATE INDEX idx_testimonials_display ON testimonials(permission_to_display);
CREATE INDEX idx_testimonials_rating ON testimonials(rating DESC);

-- case study sections indexes
CREATE INDEX idx_case_study_sections_project_id ON case_study_sections(project_id);
CREATE INDEX idx_case_study_sections_type ON case_study_sections(section_type);
CREATE INDEX idx_case_study_sections_order ON case_study_sections(section_order);

-- media indexes
CREATE INDEX idx_media_files_type ON media_files(file_type);
CREATE INDEX idx_media_files_public ON media_files(is_public);
CREATE INDEX idx_media_files_user_id ON media_files(upload_user_id);
CREATE INDEX idx_media_files_created ON media_files(created_at DESC);

-- analytics indexes
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_page_path ON analytics_events(page_path);
CREATE INDEX idx_analytics_events_created ON analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_session ON analytics_events(session_id);

CREATE INDEX idx_page_views_path_date ON page_views(page_path, view_date DESC);
CREATE INDEX idx_page_views_date ON page_views(view_date DESC);

-- site settings indexes
CREATE INDEX idx_site_settings_key ON site_settings(key);
CREATE INDEX idx_site_settings_category ON site_settings(category);
CREATE INDEX idx_site_settings_public ON site_settings(is_public);

-- =============================================================================
-- TRIGGERS FOR AUDIT TRAILS & DATA CONSISTENCY
-- =============================================================================

-- update timestamps triggers
CREATE TRIGGER update_users_timestamp 
AFTER UPDATE ON users 
BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_blog_posts_timestamp 
AFTER UPDATE ON blog_posts 
BEGIN
    UPDATE blog_posts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_blog_categories_timestamp 
AFTER UPDATE ON blog_categories 
BEGIN
    UPDATE blog_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_blog_tags_timestamp 
AFTER UPDATE ON blog_tags 
BEGIN
    UPDATE blog_tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_portfolio_projects_timestamp 
AFTER UPDATE ON portfolio_projects 
BEGIN
    UPDATE portfolio_projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_media_files_timestamp 
AFTER UPDATE ON media_files 
BEGIN
    UPDATE media_files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- fts triggers for blog posts
CREATE TRIGGER blog_posts_fts_insert AFTER INSERT ON blog_posts 
BEGIN
    INSERT INTO blog_posts_fts(rowid, title, excerpt, content) 
    VALUES (NEW.id, NEW.title, NEW.excerpt, NEW.content);
END;

CREATE TRIGGER blog_posts_fts_update AFTER UPDATE ON blog_posts 
BEGIN
    UPDATE blog_posts_fts SET title = NEW.title, excerpt = NEW.excerpt, content = NEW.content 
    WHERE rowid = NEW.id;
END;

CREATE TRIGGER blog_posts_fts_delete AFTER DELETE ON blog_posts 
BEGIN
    DELETE FROM blog_posts_fts WHERE rowid = OLD.id;
END;

-- fts triggers for portfolio projects
CREATE TRIGGER portfolio_projects_fts_insert AFTER INSERT ON portfolio_projects 
BEGIN
    INSERT INTO portfolio_projects_fts(rowid, title, short_description, full_description, content) 
    VALUES (NEW.id, NEW.title, NEW.short_description, NEW.full_description, NEW.content);
END;

CREATE TRIGGER portfolio_projects_fts_update AFTER UPDATE ON portfolio_projects 
BEGIN
    UPDATE portfolio_projects_fts SET 
        title = NEW.title, 
        short_description = NEW.short_description, 
        full_description = NEW.full_description, 
        content = NEW.content 
    WHERE rowid = NEW.id;
END;

CREATE TRIGGER portfolio_projects_fts_delete AFTER DELETE ON portfolio_projects 
BEGIN
    DELETE FROM portfolio_projects_fts WHERE rowid = OLD.id;
END;

-- category/tag post count triggers
CREATE TRIGGER blog_post_categories_insert_count AFTER INSERT ON blog_post_categories
BEGIN
    UPDATE blog_categories SET post_count = post_count + 1 WHERE id = NEW.category_id;
END;

CREATE TRIGGER blog_post_categories_delete_count AFTER DELETE ON blog_post_categories
BEGIN
    UPDATE blog_categories SET post_count = post_count - 1 WHERE id = OLD.category_id;
END;

CREATE TRIGGER blog_post_tags_insert_count AFTER INSERT ON blog_post_tags
BEGIN
    UPDATE blog_tags SET post_count = post_count + 1 WHERE id = NEW.tag_id;
END;

CREATE TRIGGER blog_post_tags_delete_count AFTER DELETE ON blog_post_tags
BEGIN
    UPDATE blog_tags SET post_count = post_count - 1 WHERE id = OLD.tag_id;
END;

-- flight route count trigger
CREATE TRIGGER flights_insert_route_count AFTER INSERT ON flights
BEGIN
    INSERT OR REPLACE INTO flight_routes (
        departure_airport_id, 
        arrival_airport_id, 
        flight_count, 
        name,
        created_at,
        updated_at
    ) 
    VALUES (
        NEW.departure_airport_id,
        NEW.arrival_airport_id,
        COALESCE((SELECT flight_count FROM flight_routes 
                 WHERE departure_airport_id = NEW.departure_airport_id 
                 AND arrival_airport_id = NEW.arrival_airport_id), 0) + 1,
        (SELECT d.city || ' → ' || a.city 
         FROM airports d, airports a 
         WHERE d.id = NEW.departure_airport_id AND a.id = NEW.arrival_airport_id),
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );
END;

-- =============================================================================
-- INITIAL SEED DATA
-- =============================================================================

-- insert default admin user (password should be changed)
INSERT INTO users (email, username, password_hash, first_name, last_name, role, is_active, email_verified) 
VALUES ('admin@example.com', 'admin', '$2b$12$placeholder_hash_change_me', 'Admin', 'User', 'admin', TRUE, TRUE);

-- insert default blog categories
INSERT INTO blog_categories (name, slug, description, color, icon) VALUES 
('Technology', 'technology', 'Posts about software development, programming, and tech trends', '#3B82F6', 'code'),
('Travel', 'travel', 'Travel experiences, tips, and destination guides', '#10B981', 'airplane'),
('Personal', 'personal', 'Personal thoughts, experiences, and life updates', '#8B5CF6', 'user'),
('Tutorials', 'tutorials', 'Step-by-step guides and educational content', '#F59E0B', 'book-open');

-- insert default blog tags
INSERT INTO blog_tags (name, slug, description, color) VALUES 
('JavaScript', 'javascript', 'JavaScript programming language', '#F7DF1E'),
('TypeScript', 'typescript', 'TypeScript programming language', '#3178C6'),
('React', 'react', 'React framework', '#61DAFB'),
('Node.js', 'nodejs', 'Node.js runtime', '#339933'),
('SQLite', 'sqlite', 'SQLite database', '#003B57'),
('Web Development', 'web-development', 'General web development topics', '#FF6B6B');

-- insert default project categories
INSERT INTO project_categories (name, slug, description, color, icon, sort_order) VALUES 
('Web Applications', 'web-applications', 'Full-stack web applications and websites', '#3B82F6', 'globe', 1),
('Mobile Apps', 'mobile-apps', 'iOS and Android mobile applications', '#10B981', 'device-mobile', 2),
('APIs & Backend', 'apis-backend', 'Backend services, APIs, and server-side applications', '#8B5CF6', 'server', 3),
('Open Source', 'open-source', 'Open source projects and contributions', '#F59E0B', 'code-branch', 4);

-- insert common technologies
INSERT INTO project_technologies (name, slug, description, category, color) VALUES 
('JavaScript', 'javascript', 'JavaScript programming language', 'frontend', '#F7DF1E'),
('TypeScript', 'typescript', 'TypeScript programming language', 'frontend', '#3178C6'),
('React', 'react', 'React frontend framework', 'frontend', '#61DAFB'),
('Next.js', 'nextjs', 'Next.js React framework', 'frontend', '#000000'),
('Node.js', 'nodejs', 'Node.js runtime environment', 'backend', '#339933'),
('Express.js', 'expressjs', 'Express.js web framework', 'backend', '#000000'),
('SQLite', 'sqlite', 'SQLite database', 'database', '#003B57'),
('PostgreSQL', 'postgresql', 'PostgreSQL database', 'database', '#336791'),
('Tailwind CSS', 'tailwindcss', 'Tailwind CSS framework', 'frontend', '#06B6D4'),
('Docker', 'docker', 'Docker containerization', 'devops', '#2496ED');

-- insert sample site settings
INSERT INTO site_settings (key, value, data_type, category, description, is_public) VALUES 
('site_name', 'My Personal Website', 'string', 'general', 'The name of the website', TRUE),
('site_description', 'Personal website and blog', 'string', 'general', 'Site description for SEO', TRUE),
('contact_email', 'contact@example.com', 'string', 'contact', 'Primary contact email', TRUE),
('social_twitter', '@username', 'string', 'social', 'Twitter handle', TRUE),
('social_github', 'username', 'string', 'social', 'GitHub username', TRUE),
('social_linkedin', 'username', 'string', 'social', 'LinkedIn profile', TRUE),
('analytics_enabled', 'true', 'boolean', 'analytics', 'Enable analytics tracking', FALSE),
('comments_enabled', 'false', 'boolean', 'blog', 'Enable blog comments', FALSE),
('posts_per_page', '10', 'integer', 'blog', 'Number of posts per page', FALSE);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- blog posts with category and tag info
CREATE VIEW blog_posts_with_meta AS
SELECT 
    p.*,
    u.first_name || ' ' || u.last_name as author_name,
    u.avatar_url as author_avatar,
    GROUP_CONCAT(DISTINCT c.name) as categories,
    GROUP_CONCAT(DISTINCT t.name) as tags
FROM blog_posts p
LEFT JOIN users u ON p.author_id = u.id
LEFT JOIN blog_post_categories pc ON p.id = pc.post_id
LEFT JOIN blog_categories c ON pc.category_id = c.id
LEFT JOIN blog_post_tags pt ON p.id = pt.post_id
LEFT JOIN blog_tags t ON pt.tag_id = t.id
GROUP BY p.id;

-- portfolio projects with technology info
CREATE VIEW portfolio_projects_with_meta AS
SELECT 
    p.*,
    GROUP_CONCAT(DISTINCT c.name) as categories,
    GROUP_CONCAT(DISTINCT t.name) as technologies
FROM portfolio_projects p
LEFT JOIN project_project_categories pc ON p.id = pc.project_id
LEFT JOIN project_categories c ON pc.category_id = c.id
LEFT JOIN project_project_technologies pt ON p.id = pt.project_id
LEFT JOIN project_technologies t ON pt.technology_id = t.id
GROUP BY p.id;

-- flight summary view
CREATE VIEW flight_summary AS
SELECT 
    f.*,
    d.name as departure_airport_name,
    d.city as departure_city,
    d.country as departure_country,
    d.iata_code as departure_iata,
    a.name as arrival_airport_name,
    a.city as arrival_city,
    a.country as arrival_country,
    a.iata_code as arrival_iata
FROM flights f
JOIN airports d ON f.departure_airport_id = d.id
JOIN airports a ON f.arrival_airport_id = a.id;

-- =============================================================================
-- FINAL OPTIMIZATIONS
-- =============================================================================

-- analyze tables for query planner
ANALYZE;

-- create additional composite indexes for common query patterns
CREATE INDEX idx_blog_posts_status_featured_published ON blog_posts(status, featured, published_at DESC);
CREATE INDEX idx_portfolio_projects_status_featured ON portfolio_projects(status, featured, view_count DESC);
CREATE INDEX idx_analytics_events_page_created ON analytics_events(page_path, created_at DESC);

-- vacuum to reclaim space and optimize
VACUUM;

-- final pragma optimizations
PRAGMA optimize;