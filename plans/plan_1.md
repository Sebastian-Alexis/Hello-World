# Plan 1: Project Foundation & Database Setup

**Session Goal**: Set up the complete project foundation, database schema, and core infrastructure  
**Estimated Time**: 3-4 hours  
**Prerequisites**: All accounts created (Turso, Cloudflare, Mapbox, GitHub)  

## Development Phase: Foundation Setup

### Todo List

#### 1. Project Initialization
- [ ] Initialize new Astro project with TypeScript
- [ ] Configure astro.config.mjs with all integrations (Svelte, Tailwind, Sitemap, Compress)
- [ ] Set up package.json with all dependencies and scripts
- [ ] Configure TypeScript with strict settings
- [ ] Set up ESLint and Prettier for code quality
- [ ] Create .gitignore with appropriate exclusions
- [ ] Initialize git repository and connect to GitHub

#### 2. Environment Configuration
- [ ] Create .env.example template with all required variables
- [ ] Create .env.local for development with placeholder values
- [ ] Set up environment variable validation using Zod
- [ ] Configure different environments (development, staging, production)
- [ ] Test environment variable loading

#### 3. Database Schema Implementation
- [ ] Install Turso client and database dependencies
- [ ] Create database/schema.sql with complete schema (15+ tables)
- [ ] Implement database connection utility (lib/db/connection.ts)
- [ ] Create migration system for schema updates
- [ ] Set up database seeding for development data
- [ ] Test local SQLite database creation
- [ ] Verify all foreign key constraints and indexes

#### 4. TypeScript Type Definitions
- [ ] Create comprehensive interfaces in lib/db/types.ts
- [ ] Define all database model types (User, BlogPost, Flight, etc.)
- [ ] Create API response and form types
- [ ] Set up utility types for pagination and filtering
- [ ] Add JSDoc comments for all type definitions
- [ ] Validate types compile without errors

#### 5. Core Database Utilities
- [ ] Implement DatabaseQueries class with all methods
- [ ] Create optimized blog post queries with pagination
- [ ] Implement full-text search functionality
- [ ] Set up flight data queries with coordinate calculations
- [ ] Create portfolio project queries with filtering
- [ ] Implement analytics data aggregation methods
- [ ] Add credentials data retrieval methods
- [ ] Test all database query methods

#### 6. Project Structure Setup
- [ ] Create complete directory structure (50+ directories)
- [ ] Set up components hierarchy (ui/, layout/, blog/, portfolio/, etc.)
- [ ] Create layouts directory with base templates
- [ ] Set up pages directory with file-based routing structure
- [ ] Create lib directory with all utility modules
- [ ] Set up styles directory with CSS organization
- [ ] Create assets directory for static files

#### 7. Development Tooling
- [ ] Configure build scripts for development and production
- [ ] Set up hot reload and dev server configuration
- [ ] Create database management scripts
- [ ] Set up linting and formatting scripts
- [ ] Configure type checking in CI/CD pipeline
- [ ] Create development documentation

#### 8. Basic Security Setup
- [ ] Implement JWT utility functions for authentication
- [ ] Set up password hashing utilities
- [ ] Create input validation schemas using Zod
- [ ] Implement CORS configuration
- [ ] Set up rate limiting utilities
- [ ] Configure security headers

## Detailed Implementation Steps

### Step 1: Project Initialization (45 minutes)

```bash
# Initialize Astro project
npm create astro@latest personal-website -- --template minimal --typescript
cd personal-website

# Install all required dependencies
npm install @astrojs/svelte @astrojs/tailwind @astrojs/sitemap astro-compress
npm install svelte @tailwindcss/typography
npm install @libsql/client @types/node zod
npm install @deck.gl/core @deck.gl/layers @deck.gl/mapbox mapbox-gl
npm install lucide-svelte date-fns clsx
npm install -D @types/mapbox-gl eslint prettier
```

**Astro Configuration** (astro.config.mjs):
```javascript
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';

export default defineConfig({
  site: 'https://yoursite.com',
  output: 'static',
  integrations: [
    svelte(),
    tailwind({
      applyBaseStyles: false
    }),
    sitemap(),
    compress({
      CSS: true,
      HTML: {
        removeAttributeQuotes: false,
        collapseWhitespace: true,
        removeComments: true
      },
      JavaScript: true,
      SVG: true
    })
  ],
  build: {
    inlineStylesheets: 'auto',
    splitting: true,
    assets: 'assets'
  },
  vite: {
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'flight-map': ['@deck.gl/core', '@deck.gl/layers'],
            'admin': ['@libsql/client']
          }
        }
      }
    }
  }
});
```

### Step 2: Database Schema Creation (60 minutes)

**Complete Schema** (database/schema.sql):
```sql
-- Enable SQLite optimizations
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;

-- Users table for admin authentication
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'editor')),
    avatar_url TEXT,
    last_login_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Blog posts table with full content management
CREATE TABLE blog_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image TEXT,
    meta_description TEXT,
    meta_keywords TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    reading_time INTEGER,
    author_id INTEGER NOT NULL,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Blog categories with color coding
CREATE TABLE blog_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#2563eb',
    post_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Blog tags for content organization
CREATE TABLE blog_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    post_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Many-to-many relationship tables
CREATE TABLE blog_post_categories (
    blog_post_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (blog_post_id, category_id),
    FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES blog_categories(id) ON DELETE CASCADE
);

CREATE TABLE blog_post_tags (
    blog_post_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (blog_post_id, tag_id),
    FOREIGN KEY (blog_post_id) REFERENCES blog_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES blog_tags(id) ON DELETE CASCADE
);

-- Portfolio projects with comprehensive metadata
CREATE TABLE portfolio_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    short_description TEXT NOT NULL,
    long_description TEXT,
    featured_image TEXT,
    gallery_images TEXT, -- JSON array
    tech_stack TEXT, -- JSON array
    project_url TEXT,
    github_url TEXT,
    demo_video_url TEXT,
    case_study_url TEXT,
    status TEXT DEFAULT 'completed' CHECK (status IN ('planning', 'in-progress', 'completed', 'archived')),
    featured BOOLEAN DEFAULT FALSE,
    view_count INTEGER DEFAULT 0,
    project_type TEXT,
    start_date DATE,
    end_date DATE,
    client_name TEXT,
    collaboration TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- [Continue with remaining tables: airports, flights, education, certifications, etc.]

-- Performance indexes
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_featured ON blog_posts(featured);
CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);

-- Full-text search setup
CREATE VIRTUAL TABLE blog_posts_fts USING fts5(
    title, excerpt, content, meta_keywords,
    content=blog_posts,
    content_rowid=id
);

-- Triggers for FTS synchronization
CREATE TRIGGER blog_posts_ai AFTER INSERT ON blog_posts BEGIN
    INSERT INTO blog_posts_fts(rowid, title, excerpt, content, meta_keywords)
    VALUES (new.id, new.title, new.excerpt, new.content, new.meta_keywords);
END;

-- [Additional triggers for update/delete]
```

### Step 3: Database Connection Setup (30 minutes)

**Connection Utility** (lib/db/connection.ts):
```typescript
import { createClient } from '@libsql/client';

const isDev = import.meta.env.DEV;

export const db = createClient({
  url: isDev 
    ? 'file:local.db' 
    : import.meta.env.TURSO_DATABASE_URL!,
  authToken: isDev 
    ? undefined 
    : import.meta.env.TURSO_AUTH_TOKEN!,
  syncUrl: isDev 
    ? undefined 
    : import.meta.env.TURSO_SYNC_URL,
  syncInterval: 60,
});

// Database initialization
export async function initDatabase() {
  if (isDev) {
    // Read and execute schema.sql for local development
    const schemaPath = './database/schema.sql';
    const schema = await Deno.readTextFile(schemaPath);
    const statements = schema.split(';').filter(s => s.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        await db.execute(statement);
      }
    }
  }
}

// Connection health check
export async function healthCheck(): Promise<boolean> {
  try {
    await db.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

// Migration runner
export async function runMigrations() {
  // Implementation for running database migrations
  console.log('Running database migrations...');
  // Add migration logic here
}
```

### Step 4: Core Type Definitions (45 minutes)

**Complete Types** (lib/db/types.ts):
```typescript
// Base entity interface
interface BaseEntity {
  id: number;
  created_at: string;
  updated_at: string;
}

// User management
export interface User extends BaseEntity {
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'editor';
  avatar_url?: string;
  last_login_at?: string;
}

// Blog system
export interface BlogPost extends BaseEntity {
  slug: string;
  title: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
  meta_description?: string;
  meta_keywords?: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  view_count: number;
  reading_time?: number;
  author_id: number;
  published_at?: string;
  // Computed fields
  author_name?: string;
  author_avatar?: string;
  categories?: string[];
  tags?: string[];
}

export interface BlogCategory extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  color: string;
  post_count: number;
}

export interface BlogTag extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  post_count: number;
}

// Portfolio system
export interface Project extends BaseEntity {
  slug: string;
  title: string;
  short_description: string;
  long_description?: string;
  featured_image?: string;
  gallery_images: string[];
  tech_stack: string[];
  project_url?: string;
  github_url?: string;
  demo_video_url?: string;
  case_study_url?: string;
  status: 'planning' | 'in-progress' | 'completed' | 'archived';
  featured: boolean;
  view_count: number;
  project_type?: string;
  start_date?: string;
  end_date?: string;
  client_name?: string;
  collaboration?: string;
  categories?: string[];
}

// Flight tracking
export interface Airport extends BaseEntity {
  iata_code: string;
  icao_code?: string;
  name: string;
  city: string;
  country: string;
  country_code: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  timezone?: string;
  has_visited: boolean;
  visit_count: number;
  first_visit_date?: string;
  last_visit_date?: string;
  coordinates: [number, number]; // [longitude, latitude] for deck.gl
}

export interface Flight extends BaseEntity {
  flight_number: string;
  airline_code?: string;
  airline_name?: string;
  aircraft_type?: string;
  departure_airport_id: number;
  arrival_airport_id: number;
  departure_date: string;
  departure_time?: string;
  arrival_date?: string;
  arrival_time?: string;
  duration_minutes?: number;
  distance_km?: number;
  seat_number?: string;
  flight_class: 'economy' | 'premium-economy' | 'business' | 'first';
  booking_reference?: string;
  price_paid?: number;
  currency: string;
  notes?: string;
  photos?: string[];
  blog_post_id?: number;
  flight_status: 'booked' | 'completed' | 'cancelled' | 'delayed';
  // Computed fields for map display
  origin: [number, number];
  destination: [number, number];
  blog_post_title?: string;
  blog_post_preview?: string;
  blog_post_slug?: string;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Form validation types
export interface BlogPostForm {
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  featured_image?: string;
  meta_description?: string;
  meta_keywords?: string;
  status: 'draft' | 'published';
  featured: boolean;
  categories: number[];
  tags: number[];
  published_at?: string;
}

// [Additional interfaces for all other entities]
```

### Step 5: Package.json Scripts (15 minutes)

```json
{
  "name": "personal-website",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "astro dev",
    "start": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "astro": "astro",
    "db:setup": "node scripts/setup-database.js",
    "db:migrate": "node scripts/migrate-database.js",
    "db:seed": "node scripts/seed-database.js",
    "db:reset": "rm -f local.db && npm run db:setup && npm run db:seed",
    "type-check": "astro check",
    "lint": "eslint . --ext .ts,.astro,.svelte",
    "lint:fix": "eslint . --ext .ts,.astro,.svelte --fix",
    "format": "prettier --write .",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "@astrojs/sitemap": "^3.0.0",
    "@astrojs/svelte": "^5.0.0",
    "@astrojs/tailwind": "^5.0.0",
    "@deck.gl/core": "^8.9.0",
    "@deck.gl/layers": "^8.9.0",
    "@deck.gl/mapbox": "^8.9.0",
    "@libsql/client": "^0.4.0",
    "@tailwindcss/typography": "^0.5.0",
    "astro": "^4.0.0",
    "astro-compress": "^2.0.0",
    "clsx": "^2.0.0",
    "date-fns": "^3.0.0",
    "lucide-svelte": "^0.300.0",
    "mapbox-gl": "^3.0.0",
    "svelte": "^4.0.0",
    "tailwindcss": "^3.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/mapbox-gl": "^3.0.0",
    "@types/node": "^20.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "eslint-plugin-astro": "^0.29.0",
    "eslint-plugin-svelte": "^2.35.0",
    "prettier": "^3.0.0",
    "prettier-plugin-astro": "^0.12.0",
    "prettier-plugin-svelte": "^3.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

## Testing & Validation

### Final Checklist
- [ ] Project builds without errors (`npm run build`)
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] Database schema creates successfully
- [ ] All environment variables load correctly
- [ ] Development server starts (`npm run dev`)
- [ ] Database connection health check passes
- [ ] All type definitions are properly exported
- [ ] Linting passes without errors
- [ ] Git repository is properly initialized and connected

## Success Criteria
✅ Complete project foundation is established  
✅ Database schema is implemented and tested  
✅ All TypeScript types are defined  
✅ Development environment is fully functional  
✅ Core utilities are implemented and tested  
✅ Project structure follows best practices  
✅ All tooling is configured and working  

## Next Session
Plan 2 will focus on implementing the core layout system, styling framework, and basic components.