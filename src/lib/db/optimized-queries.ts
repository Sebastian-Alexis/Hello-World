// =============================================================================
// OPTIMIZED DATABASE QUERIES - Plan 7 Implementation
// Ultra-fast query optimization for <100ms performance budget
// =============================================================================

import { executeOptimizedQuery, executeOptimizedTransaction, CacheManager } from './performance';
import type {
  // Core types
  User,
  UserSession,
  BlogPost,
  BlogCategory,
  BlogTag,
  PortfolioProject,
  ProjectCategory,
  ProjectTechnology,
  Flight,
  Airport,
  FlightRoute,
  Education,
  Certification,
  WorkExperience,
  MediaFile,
  AnalyticsEvent,
  PageView,
  SiteSetting,
  Skill,
  ProjectSkill,
  Testimonial,
  CaseStudySection,
  
  // Form types
  BlogPostForm,
  ProjectForm,
  FlightForm,
  
  // Query types
  QueryOptions,
  BlogPostQueryOptions,
  ProjectQueryOptions,
  FlightQueryOptions,
  PaginatedResponse,
  
  // Search types
  BlogSearchFilters,
  ProjectSearchFilters,
  FlightSearchFilters,
} from './types';

export class OptimizedDatabaseQueries {
  // =============================================================================
  // USER MANAGEMENT & AUTHENTICATION - OPTIMIZED
  // =============================================================================

  //creates a new user with optimized performance
  async createUser(userData: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User> {
    const query = `
      INSERT INTO users (
        email, username, password_hash, first_name, last_name, 
        role, avatar_url, bio, is_active, email_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      userData.email,
      userData.username,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.avatar_url || null,
      userData.bio || null,
      userData.is_active,
      userData.email_verified,
    ];

    const result = await executeOptimizedQuery<User>(query, params, {
      useCache: false, //don't cache user creation
    });
    
    //invalidate user cache after creation
    CacheManager.invalidatePattern('users');
    
    return result.rows[0];
  }

  //finds user by email with optimized caching
  async findUserByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE email = ? AND is_active = TRUE 
      LIMIT 1
    `;
    
    const result = await executeOptimizedQuery<User>(query, [email], {
      useCache: true,
      cacheTimeout: 10 * 60 * 1000, //10 minutes cache for user lookups
    });
    
    return result.rows[0] || null;
  }

  //finds user by username with optimized index usage
  async findUserByUsername(username: string): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE username = ? AND is_active = TRUE 
      LIMIT 1
    `;
    
    const result = await executeOptimizedQuery<User>(query, [username], {
      useCache: true,
      cacheTimeout: 10 * 60 * 1000,
    });
    
    return result.rows[0] || null;
  }

  //finds user by id with covering index
  async findUserById(id: number): Promise<User | null> {
    const query = `
      SELECT * FROM users 
      WHERE id = ? AND is_active = TRUE 
      LIMIT 1
    `;
    
    const result = await executeOptimizedQuery<User>(query, [id], {
      useCache: true,
      cacheTimeout: 15 * 60 * 1000, //longer cache for ID lookups
    });
    
    return result.rows[0] || null;
  }

  // =============================================================================
  // BLOG SYSTEM - ULTRA-OPTIMIZED QUERIES
  // =============================================================================

  //gets published blog posts with optimized pagination and caching
  async getBlogPosts(options: BlogPostQueryOptions = {}): Promise<PaginatedResponse<BlogPost>> {
    const {
      page = 1,
      limit = 10,
      status = 'published',
      featured = false,
      categorySlug,
      tagSlug,
      authorId,
      sortBy = 'published_at',
      sortOrder = 'DESC',
    } = options;

    const offset = (page - 1) * limit;
    
    //build optimized query with proper index usage
    let baseQuery = `
      FROM blog_posts p
      LEFT JOIN users u ON p.author_id = u.id
    `;
    
    let whereConditions = ['p.status = ?'];
    let params: any[] = [status];
    
    if (featured) {
      whereConditions.push('p.featured = TRUE');
    }
    
    if (authorId) {
      whereConditions.push('p.author_id = ?');
      params.push(authorId);
    }
    
    //category filter with optimized join
    if (categorySlug) {
      baseQuery += `
        INNER JOIN blog_post_categories pc ON p.id = pc.post_id
        INNER JOIN blog_categories c ON pc.category_id = c.id AND c.slug = ?
      `;
      params.push(categorySlug);
    }
    
    //tag filter with optimized join
    if (tagSlug) {
      baseQuery += `
        INNER JOIN blog_post_tags pt ON p.id = pt.post_id
        INNER JOIN blog_tags t ON pt.tag_id = t.id AND t.slug = ?
      `;
      params.push(tagSlug);
    }
    
    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
    
    //optimized count query
    const countQuery = `SELECT COUNT(DISTINCT p.id) as total ${baseQuery} ${whereClause}`;
    
    //optimized data query with covering index
    const dataQuery = `
      SELECT DISTINCT
        p.id, p.slug, p.title, p.excerpt, p.content, p.content_html,
        p.status, p.featured, p.featured_image_url, p.meta_title, p.meta_description,
        p.og_title, p.og_description, p.og_image_url, p.canonical_url,
        p.reading_time, p.word_count, p.view_count, p.like_count, p.comment_count,
        p.author_id, p.published_at, p.created_at, p.updated_at,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar
      ${baseQuery}
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    
    //execute queries with caching
    const [countResult, dataResult] = await Promise.all([
      executeOptimizedQuery<{ total: number }>(countQuery, params.slice(0, -2), {
        useCache: true,
        cacheTimeout: 5 * 60 * 1000, //5 minute cache for counts
      }),
      executeOptimizedQuery<BlogPost>(dataQuery, params, {
        useCache: true,
        cacheTimeout: 2 * 60 * 1000, //2 minute cache for blog lists
      }),
    ]);
    
    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  //gets single blog post with optimized related data loading
  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    const query = `
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar,
        GROUP_CONCAT(DISTINCT c.name) as categories,
        GROUP_CONCAT(DISTINCT c.slug) as category_slugs,
        GROUP_CONCAT(DISTINCT t.name) as tags,
        GROUP_CONCAT(DISTINCT t.slug) as tag_slugs
      FROM blog_posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN blog_post_categories pc ON p.id = pc.post_id
      LEFT JOIN blog_categories c ON pc.category_id = c.id
      LEFT JOIN blog_post_tags pt ON p.id = pt.post_id
      LEFT JOIN blog_tags t ON pt.tag_id = t.id
      WHERE p.slug = ? AND p.status = 'published'
      GROUP BY p.id
      LIMIT 1
    `;
    
    const result = await executeOptimizedQuery<BlogPost>(query, [slug], {
      useCache: true,
      cacheTimeout: 10 * 60 * 1000, //10 minute cache for individual posts
    });
    
    if (result.rows[0]) {
      //increment view count asynchronously
      this.incrementBlogPostViews(result.rows[0].id);
    }
    
    return result.rows[0] || null;
  }

  //increments blog post view count optimized for performance
  private async incrementBlogPostViews(postId: number): Promise<void> {
    const query = `
      UPDATE blog_posts 
      SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    await executeOptimizedQuery(query, [postId], {
      useCache: false,
      skipLogging: true, //don't log simple increment operations
    });
    
    //invalidate cache for this post
    CacheManager.invalidatePattern(`blog_posts`);
  }

  //gets blog categories with post counts
  async getBlogCategories(): Promise<BlogCategory[]> {
    const query = `
      SELECT 
        c.*,
        COUNT(pc.post_id) as post_count
      FROM blog_categories c
      LEFT JOIN blog_post_categories pc ON c.id = pc.category_id
      LEFT JOIN blog_posts p ON pc.post_id = p.id AND p.status = 'published'
      WHERE c.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.sort_order, c.name
    `;
    
    const result = await executeOptimizedQuery<BlogCategory>(query, [], {
      useCache: true,
      cacheTimeout: 15 * 60 * 1000, //15 minute cache for categories
    });
    
    return result.rows;
  }

  //gets blog tags with post counts
  async getBlogTags(): Promise<BlogTag[]> {
    const query = `
      SELECT 
        t.*,
        COUNT(pt.post_id) as post_count
      FROM blog_tags t
      LEFT JOIN blog_post_tags pt ON t.id = pt.tag_id
      LEFT JOIN blog_posts p ON pt.post_id = p.id AND p.status = 'published'
      GROUP BY t.id
      HAVING post_count > 0
      ORDER BY post_count DESC, t.name
      LIMIT 20
    `;
    
    const result = await executeOptimizedQuery<BlogTag>(query, [], {
      useCache: true,
      cacheTimeout: 15 * 60 * 1000,
    });
    
    return result.rows;
  }

  // =============================================================================
  // PORTFOLIO SYSTEM - OPTIMIZED QUERIES
  // =============================================================================

  //gets portfolio projects with optimized filtering and caching
  async getPortfolioProjects(options: ProjectQueryOptions = {}): Promise<PaginatedResponse<PortfolioProject>> {
    const {
      page = 1,
      limit = 12,
      status = 'active',
      featured = false,
      categorySlug,
      technologySlug,
      projectType,
      sortBy = 'created_at',
      sortOrder = 'DESC',
    } = options;

    const offset = (page - 1) * limit;
    
    let baseQuery = `FROM portfolio_projects p`;
    let whereConditions = ['p.status = ?'];
    let params: any[] = [status];
    
    if (featured) {
      whereConditions.push('p.featured = TRUE');
    }
    
    if (projectType) {
      whereConditions.push('p.project_type = ?');
      params.push(projectType);
    }
    
    //optimized category filter
    if (categorySlug) {
      baseQuery += `
        INNER JOIN project_project_categories ppc ON p.id = ppc.project_id
        INNER JOIN project_categories pc ON ppc.category_id = pc.id AND pc.slug = ?
      `;
      params.push(categorySlug);
    }
    
    //optimized technology filter
    if (technologySlug) {
      baseQuery += `
        INNER JOIN project_project_technologies ppt ON p.id = ppt.project_id
        INNER JOIN project_technologies pt ON ppt.technology_id = pt.id AND pt.slug = ?
      `;
      params.push(technologySlug);
    }
    
    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    
    //optimized count query
    const countQuery = `SELECT COUNT(DISTINCT p.id) as total ${baseQuery} ${whereClause}`;
    
    //optimized data query with covering index
    const dataQuery = `
      SELECT DISTINCT
        p.id, p.slug, p.title, p.short_description, p.full_description,
        p.status, p.featured, p.project_type, p.client_name, p.client_industry,
        p.project_duration, p.team_size, p.my_role, p.live_url, p.github_url,
        p.demo_url, p.featured_image_url, p.gallery_images, p.meta_title,
        p.meta_description, p.og_image_url, p.view_count, p.like_count,
        p.start_date, p.end_date, p.created_at, p.updated_at
      ${baseQuery}
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    
    const [countResult, dataResult] = await Promise.all([
      executeOptimizedQuery<{ total: number }>(countQuery, params.slice(0, -2), {
        useCache: true,
        cacheTimeout: 5 * 60 * 1000,
      }),
      executeOptimizedQuery<PortfolioProject>(dataQuery, params, {
        useCache: true,
        cacheTimeout: 5 * 60 * 1000,
      }),
    ]);
    
    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  //gets single portfolio project with related data
  async getPortfolioProjectBySlug(slug: string): Promise<PortfolioProject | null> {
    const query = `
      SELECT 
        p.*,
        GROUP_CONCAT(DISTINCT c.name) as categories,
        GROUP_CONCAT(DISTINCT c.slug) as category_slugs,
        GROUP_CONCAT(DISTINCT t.name) as technologies,
        GROUP_CONCAT(DISTINCT t.slug) as technology_slugs
      FROM portfolio_projects p
      LEFT JOIN project_project_categories ppc ON p.id = ppc.project_id
      LEFT JOIN project_categories c ON ppc.category_id = c.id
      LEFT JOIN project_project_technologies ppt ON p.id = ppt.project_id
      LEFT JOIN project_technologies t ON ppt.technology_id = t.id
      WHERE p.slug = ? AND p.status = 'active'
      GROUP BY p.id
      LIMIT 1
    `;
    
    const result = await executeOptimizedQuery<PortfolioProject>(query, [slug], {
      useCache: true,
      cacheTimeout: 10 * 60 * 1000,
    });
    
    if (result.rows[0]) {
      //increment view count asynchronously
      this.incrementProjectViews(result.rows[0].id);
    }
    
    return result.rows[0] || null;
  }

  //increments project view count
  private async incrementProjectViews(projectId: number): Promise<void> {
    const query = `
      UPDATE portfolio_projects 
      SET view_count = view_count + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    await executeOptimizedQuery(query, [projectId], {
      useCache: false,
      skipLogging: true,
    });
    
    CacheManager.invalidatePattern('portfolio_projects');
  }

  // =============================================================================
  // FLIGHT TRACKING - OPTIMIZED QUERIES
  // =============================================================================

  //gets flights with optimized airport data loading
  async getFlights(options: FlightQueryOptions = {}): Promise<PaginatedResponse<Flight>> {
    const {
      page = 1,
      limit = 20,
      status = 'completed',
      airline,
      departureAirport,
      arrivalAirport,
      year,
      sortBy = 'departure_time',
      sortOrder = 'DESC',
    } = options;

    const offset = (page - 1) * limit;
    
    let whereConditions = ['f.flight_status = ?'];
    let params: any[] = [status];
    
    if (airline) {
      whereConditions.push('f.airline_code = ?');
      params.push(airline);
    }
    
    if (departureAirport) {
      whereConditions.push('da.iata_code = ?');
      params.push(departureAirport);
    }
    
    if (arrivalAirport) {
      whereConditions.push('aa.iata_code = ?');
      params.push(arrivalAirport);
    }
    
    if (year) {
      whereConditions.push('strftime("%Y", f.departure_time) = ?');
      params.push(year.toString());
    }
    
    const whereClause = 'WHERE ' + whereConditions.join(' AND ');
    
    //optimized count query
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM flights f
      LEFT JOIN airports da ON f.departure_airport_id = da.id
      LEFT JOIN airports aa ON f.arrival_airport_id = aa.id
      ${whereClause}
    `;
    
    //optimized data query with airport information
    const dataQuery = `
      SELECT 
        f.*,
        da.name as departure_airport_name,
        da.city as departure_city,
        da.country as departure_country,
        da.iata_code as departure_iata,
        aa.name as arrival_airport_name,
        aa.city as arrival_city,
        aa.country as arrival_country,
        aa.iata_code as arrival_iata
      FROM flights f
      INNER JOIN airports da ON f.departure_airport_id = da.id
      INNER JOIN airports aa ON f.arrival_airport_id = aa.id
      ${whereClause}
      ORDER BY f.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    
    const [countResult, dataResult] = await Promise.all([
      executeOptimizedQuery<{ total: number }>(countQuery, params.slice(0, -2), {
        useCache: true,
        cacheTimeout: 10 * 60 * 1000,
      }),
      executeOptimizedQuery<Flight>(dataQuery, params, {
        useCache: true,
        cacheTimeout: 5 * 60 * 1000,
      }),
    ]);
    
    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  //gets flight statistics with optimized aggregation
  async getFlightStats(): Promise<{
    totalFlights: number;
    totalDistance: number;
    totalDuration: number;
    uniqueAirports: number;
    countriesVisited: number;
    averageFlightDuration: number;
  }> {
    const query = `
      SELECT 
        COUNT(*) as total_flights,
        COALESCE(SUM(f.distance_km), 0) as total_distance,
        COALESCE(SUM(f.flight_duration), 0) as total_duration,
        COUNT(DISTINCT f.departure_airport_id) + COUNT(DISTINCT f.arrival_airport_id) as unique_airports,
        COUNT(DISTINCT da.country_code) + COUNT(DISTINCT aa.country_code) as countries_visited,
        COALESCE(AVG(f.flight_duration), 0) as avg_duration
      FROM flights f
      INNER JOIN airports da ON f.departure_airport_id = da.id
      INNER JOIN airports aa ON f.arrival_airport_id = aa.id
      WHERE f.flight_status = 'completed'
    `;
    
    const result = await executeOptimizedQuery<{
      total_flights: number;
      total_distance: number;
      total_duration: number;
      unique_airports: number;
      countries_visited: number;
      avg_duration: number;
    }>(query, [], {
      useCache: true,
      cacheTimeout: 30 * 60 * 1000, //30 minute cache for stats
    });
    
    const stats = result.rows[0];
    
    return {
      totalFlights: stats?.total_flights || 0,
      totalDistance: stats?.total_distance || 0,
      totalDuration: stats?.total_duration || 0,
      uniqueAirports: Math.floor((stats?.unique_airports || 0) / 2), //divide by 2 to avoid double counting
      countriesVisited: Math.floor((stats?.countries_visited || 0) / 2),
      averageFlightDuration: stats?.avg_duration || 0,
    };
  }

  // =============================================================================
  // SEARCH OPTIMIZATION
  // =============================================================================

  //optimized full-text search for blog posts
  async searchBlogPosts(
    searchTerm: string,
    filters: BlogSearchFilters = {},
    options: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<BlogPost>> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;
    
    //use FTS5 for optimized full-text search
    const query = `
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar,
        bm25(blog_posts_fts) as relevance_score
      FROM blog_posts_fts
      INNER JOIN blog_posts p ON blog_posts_fts.rowid = p.id
      LEFT JOIN users u ON p.author_id = u.id
      WHERE blog_posts_fts MATCH ? AND p.status = 'published'
      ORDER BY relevance_score DESC, p.published_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const result = await executeOptimizedQuery<BlogPost>(query, [searchTerm, limit, offset], {
      useCache: true,
      cacheTimeout: 5 * 60 * 1000, //5 minute cache for search results
    });
    
    //get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM blog_posts_fts
      INNER JOIN blog_posts p ON blog_posts_fts.rowid = p.id
      WHERE blog_posts_fts MATCH ? AND p.status = 'published'
    `;
    
    const countResult = await executeOptimizedQuery<{ total: number }>(countQuery, [searchTerm], {
      useCache: true,
      cacheTimeout: 5 * 60 * 1000,
    });
    
    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  //optimized full-text search for portfolio projects
  async searchPortfolioProjects(
    searchTerm: string,
    filters: ProjectSearchFilters = {},
    options: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<PortfolioProject>> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;
    
    const query = `
      SELECT 
        p.*,
        bm25(portfolio_projects_fts) as relevance_score
      FROM portfolio_projects_fts
      INNER JOIN portfolio_projects p ON portfolio_projects_fts.rowid = p.id
      WHERE portfolio_projects_fts MATCH ? AND p.status = 'active'
      ORDER BY relevance_score DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const result = await executeOptimizedQuery<PortfolioProject>(query, [searchTerm, limit, offset], {
      useCache: true,
      cacheTimeout: 5 * 60 * 1000,
    });
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM portfolio_projects_fts
      INNER JOIN portfolio_projects p ON portfolio_projects_fts.rowid = p.id
      WHERE portfolio_projects_fts MATCH ? AND p.status = 'active'
    `;
    
    const countResult = await executeOptimizedQuery<{ total: number }>(countQuery, [searchTerm], {
      useCache: true,
      cacheTimeout: 5 * 60 * 1000,
    });
    
    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // =============================================================================
  // ANALYTICS & PERFORMANCE
  // =============================================================================

  //logs analytics events with optimized batch processing
  async logAnalyticsEvent(event: Omit<AnalyticsEvent, 'id' | 'created_at'>): Promise<void> {
    const query = `
      INSERT INTO analytics_events (
        event_type, entity_type, entity_id, page_path, page_title,
        referrer, user_agent, ip_address, country, city, browser,
        os, device_type, session_id, user_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await executeOptimizedQuery(query, [
      event.event_type,
      event.entity_type,
      event.entity_id,
      event.page_path,
      event.page_title,
      event.referrer,
      event.user_agent,
      event.ip_address,
      event.country,
      event.city,
      event.browser,
      event.os,
      event.device_type,
      event.session_id,
      event.user_id,
      event.metadata,
    ], {
      useCache: false,
      skipLogging: true, //don't log analytics logging
    });
  }

  //gets page view statistics with optimized aggregation
  async getPageViewStats(days: number = 30): Promise<{
    totalViews: number;
    uniqueVisitors: number;
    topPages: Array<{ path: string; views: number }>;
  }> {
    const query = `
      SELECT 
        SUM(view_count) as total_views,
        SUM(unique_visitors) as unique_visitors
      FROM page_views 
      WHERE view_date >= date('now', '-${days} days')
    `;
    
    const topPagesQuery = `
      SELECT 
        page_path as path,
        SUM(view_count) as views
      FROM page_views 
      WHERE view_date >= date('now', '-${days} days')
      GROUP BY page_path
      ORDER BY views DESC
      LIMIT 10
    `;
    
    const [statsResult, topPagesResult] = await Promise.all([
      executeOptimizedQuery<{ total_views: number; unique_visitors: number }>(query, [], {
        useCache: true,
        cacheTimeout: 10 * 60 * 1000,
      }),
      executeOptimizedQuery<{ path: string; views: number }>(topPagesQuery, [], {
        useCache: true,
        cacheTimeout: 10 * 60 * 1000,
      }),
    ]);
    
    const stats = statsResult.rows[0];
    
    return {
      totalViews: stats?.total_views || 0,
      uniqueVisitors: stats?.unique_visitors || 0,
      topPages: topPagesResult.rows,
    };
  }
}

//singleton instance for optimized queries
export const optimizedQueries = new OptimizedDatabaseQueries();