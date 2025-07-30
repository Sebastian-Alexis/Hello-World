// =============================================================================
// DATABASE QUERIES - Comprehensive query class for ultra-fast personal website
// Optimized for SQLite with Turso edge deployment
// =============================================================================

import { executeQuery, executeTransaction } from './connection';
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

export class DatabaseQueries {
  // =============================================================================
  // USER MANAGEMENT & AUTHENTICATION
  // =============================================================================

  //creates a new user
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

    const result = await executeQuery<User>(query, params);
    return result.rows[0];
  }

  //finds user by email
  async findUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = ? AND is_active = TRUE LIMIT 1';
    const result = await executeQuery<User>(query, [email]);
    return result.rows[0] || null;
  }

  //finds user by username
  async findUserByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = ? AND is_active = TRUE LIMIT 1';
    const result = await executeQuery<User>(query, [username]);
    return result.rows[0] || null;
  }

  //finds user by id
  async findUserById(id: number): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = ? AND is_active = TRUE LIMIT 1';
    const result = await executeQuery<User>(query, [id]);
    return result.rows[0] || null;
  }

  //updates user login timestamp
  async updateUserLastLogin(userId: number): Promise<void> {
    const query = 'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?';
    await executeQuery(query, [userId]);
  }

  //creates user session
  async createUserSession(sessionData: Omit<UserSession, 'created_at'>): Promise<UserSession> {
    const query = `
      INSERT INTO user_sessions (id, user_id, expires_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      sessionData.id,
      sessionData.user_id,
      sessionData.expires_at,
      sessionData.ip_address || null,
      sessionData.user_agent || null,
    ];

    const result = await executeQuery<UserSession>(query, params);
    return result.rows[0];
  }

  //finds session by token
  async findSessionByToken(token: string): Promise<UserSession | null> {
    const query = `
      SELECT s.*, u.* 
      FROM user_sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.is_active = TRUE
      LIMIT 1
    `;
    const result = await executeQuery<UserSession & User>(query, [token]);
    return result.rows[0] || null;
  }

  //deletes expired sessions
  async deleteExpiredSessions(): Promise<number> {
    const query = 'DELETE FROM user_sessions WHERE expires_at <= CURRENT_TIMESTAMP';
    const result = await executeQuery(query);
    return result.rowsAffected;
  }

  //deletes session by token
  async deleteSession(token: string): Promise<void> {
    const query = 'DELETE FROM user_sessions WHERE id = ?';
    await executeQuery(query, [token]);
  }

  // =============================================================================
  // BLOG SYSTEM - Enhanced with full-text search, related posts, and more
  // =============================================================================

  //creates a new blog post with comprehensive content processing
  async createBlogPost(postData: BlogPostForm, authorId: number): Promise<BlogPost> {
    const { ContentProcessor } = await import('../content/processor');
    
    //process content for HTML, SEO, and metadata
    const processed = ContentProcessor.processContent(postData.content, postData.title);
    
    const queries = [
      {
        query: `
          INSERT INTO blog_posts (
            title, slug, excerpt, content, content_html, status, featured,
            featured_image_url, meta_title, meta_description, meta_keywords,
            og_title, og_description, og_image_url, canonical_url,
            reading_time, word_count, author_id, published_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        params: [
          postData.title,
          postData.slug,
          postData.excerpt || processed.excerpt,
          postData.content,
          processed.html,
          postData.status,
          postData.featured,
          postData.featured_image || null,
          postData.meta_title || postData.title,
          postData.meta_description || processed.metaDescription,
          processed.keywords.join(', ') || null,
          postData.title, // og_title
          processed.metaDescription, // og_description
          postData.og_image || postData.featured_image || null,
          postData.canonical_url || null,
          processed.readingTime,
          processed.wordCount,
          authorId,
          postData.status === 'published' ? (postData.published_at || new Date().toISOString()) : null,
        ],
      },
    ];

    await executeTransaction(queries);
    
    //get the inserted post
    const result = await executeQuery<BlogPost>(
      'SELECT * FROM blog_posts WHERE slug = ? LIMIT 1',
      [postData.slug]
    );
    
    const post = result.rows[0];
    
    //handle categories and tags
    if (postData.category_ids?.length) {
      await this.updatePostCategories(post.id, postData.category_ids);
    }
    
    if (postData.tag_ids?.length) {
      await this.updatePostTags(post.id, postData.tag_ids);
    }

    return post;
  }

  //gets paginated blog posts with filters
  async getBlogPosts(options: BlogPostQueryOptions = {}): Promise<PaginatedResponse<BlogPost>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'published_at',
      sortOrder = 'DESC',
      status = 'published',
      featured,
      includeAuthor = true,
      includeCategories = true,
      includeTags = true,
    } = options;

    const offset = (page - 1) * limit;
    
    let baseQuery = `
      FROM blog_posts p
      ${includeAuthor ? 'LEFT JOIN users u ON p.author_id = u.id' : ''}
    `;
    
    const conditions: string[] = [];
    const params: unknown[] = [];
    
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    
    if (featured !== undefined) {
      conditions.push('p.featured = ?');
      params.push(featured);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query
    const selectFields = [
      'p.*',
      includeAuthor ? "u.first_name || ' ' || u.last_name as author_name" : null,
      includeAuthor ? 'u.avatar_url as author_avatar' : null,
    ].filter(Boolean).join(', ');
    
    const dataQuery = `
      SELECT ${selectFields}
      ${baseQuery}
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, limit, offset];
    const dataResult = await executeQuery<BlogPost>(dataQuery, dataParams);
    
    // Enhance with categories and tags if requested
    let posts = dataResult.rows;
    if (includeCategories || includeTags) {
      posts = await Promise.all(
        posts.map(async (post) => {
          const enhanced = { ...post };
          
          if (includeCategories) {
            enhanced.categories = await this.getPostCategories(post.id);
          }
          
          if (includeTags) {
            enhanced.tags = await this.getPostTags(post.id);
          }
          
          return enhanced;
        })
      );
    }
    
    return {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //gets a single blog post by slug
  async getBlogPostBySlug(slug: string, includeRelated = true): Promise<BlogPost | null> {
    const query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as author_name, u.avatar_url as author_avatar
      FROM blog_posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.slug = ? AND p.status = 'published'
      LIMIT 1
    `;
    
    const result = await executeQuery<BlogPost>(query, [slug]);
    if (!result.rows[0]) return null;
    
    const post = result.rows[0];
    
    if (includeRelated) {
      post.categories = await this.getPostCategories(post.id);
      post.tags = await this.getPostTags(post.id);
    }
    
    return post;
  }

  //advanced search with FTS5, ranking, and highlighting
  async searchBlogPosts(filters: BlogSearchFilters & QueryOptions = {}): Promise<PaginatedResponse<BlogPost & { rank?: number; snippet?: string }>> {
    const { query, categories, tags, status = 'published', page = 1, limit = 10, dateFrom, dateTo } = filters;
    const offset = (page - 1) * limit;
    
    if (!query) {
      return this.getBlogPosts({ ...filters, status, page, limit });
    }
    
    //sanitize search query for FTS5
    const sanitizedQuery = query
      .replace(/[^\w\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => `"${term}"*`)
      .join(' OR ');
    
    if (!sanitizedQuery) {
      return { 
        data: [], 
        pagination: { page, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false } 
      };
    }
    
    let additionalJoins = '';
    let additionalWhere = [];
    let params = [sanitizedQuery];
    
    //category filter
    if (categories?.length) {
      additionalJoins += `
        JOIN blog_post_categories bpc ON p.id = bpc.post_id
        JOIN blog_categories bc ON bpc.category_id = bc.id
      `;
      additionalWhere.push(`bc.id IN (${categories.map(() => '?').join(',')})`);
      params.push(...categories);
    }
    
    //tag filter
    if (tags?.length) {
      additionalJoins += `
        JOIN blog_post_tags bpt ON p.id = bpt.post_id
        JOIN blog_tags bt ON bpt.tag_id = bt.id
      `;
      additionalWhere.push(`bt.id IN (${tags.map(() => '?').join(',')})`);
      params.push(...tags);
    }
    
    //date filters
    if (dateFrom) {
      additionalWhere.push('p.published_at >= ?');
      params.push(dateFrom);
    }
    
    if (dateTo) {
      additionalWhere.push('p.published_at <= ?');
      params.push(dateTo);
    }
    
    const whereClause = additionalWhere.length > 0 ? 'AND ' + additionalWhere.join(' AND ') : '';
    
    //count query
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM blog_posts_fts bts
      JOIN blog_posts p ON bts.rowid = p.id
      ${additionalJoins}
      WHERE p.status = ? AND bts MATCH ? ${whereClause}
    `;
    
    const countResult = await executeQuery<{ total: number }>(countQuery, [status, ...params]);
    const total = Number(countResult.rows[0]?.total || 0);
    
    //search query with ranking and snippets
    const searchQuery = `
      SELECT DISTINCT
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar,
        bts.rank,
        snippet(blog_posts_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
      FROM blog_posts_fts bts
      JOIN blog_posts p ON bts.rowid = p.id
      JOIN users u ON p.author_id = u.id
      ${additionalJoins}
      WHERE p.status = ? AND bts MATCH ? ${whereClause}
      GROUP BY p.id
      ORDER BY bts.rank DESC
      LIMIT ? OFFSET ?
    `;
    
    const searchResult = await executeQuery<BlogPost & { rank: number; snippet: string }>(
      searchQuery, 
      [status, ...params, limit, offset]
    );
    
    //enhance with categories and tags
    const posts = await Promise.all(
      searchResult.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
    
    return {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //gets featured blog posts
  async getFeaturedBlogPosts(limit = 5): Promise<BlogPost[]> {
    const query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as author_name, u.avatar_url as author_avatar
      FROM blog_posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published' AND p.featured = TRUE
      ORDER BY p.published_at DESC
      LIMIT ?
    `;
    
    const result = await executeQuery<BlogPost>(query, [limit]);
    
    return Promise.all(
      result.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
  }

  //gets recent blog posts
  async getRecentBlogPosts(limit = 10): Promise<BlogPost[]> {
    const query = `
      SELECT p.*, u.first_name || ' ' || u.last_name as author_name, u.avatar_url as author_avatar
      FROM blog_posts p
      LEFT JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.published_at DESC
      LIMIT ?
    `;
    
    const result = await executeQuery<BlogPost>(query, [limit]);
    
    return Promise.all(
      result.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
  }

  //increments blog post view count
  async incrementPostViewCount(postId: number): Promise<void> {
    const query = 'UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?';
    await executeQuery(query, [postId]);
  }

  //gets all blog categories
  async getBlogCategories(activeOnly = true): Promise<BlogCategory[]> {
    const query = `
      SELECT * FROM blog_categories 
      ${activeOnly ? 'WHERE is_active = TRUE' : ''}
      ORDER BY post_count DESC, name ASC
    `;
    
    const result = await executeQuery<BlogCategory>(query);
    return result.rows;
  }

  //gets all blog tags
  async getBlogTags(activeOnly = true): Promise<BlogTag[]> {
    const query = `
      SELECT * FROM blog_tags 
      ${activeOnly ? 'WHERE post_count > 0' : ''}
      ORDER BY post_count DESC, name ASC
    `;
    
    const result = await executeQuery<BlogTag>(query);
    return result.rows;
  }

  //gets categories for a specific post
  async getPostCategories(postId: number): Promise<BlogCategory[]> {
    const query = `
      SELECT c.* FROM blog_categories c
      JOIN blog_post_categories pc ON c.id = pc.category_id
      WHERE pc.post_id = ?
      ORDER BY c.name ASC
    `;
    
    const result = await executeQuery<BlogCategory>(query, [postId]);
    return result.rows;
  }

  //gets tags for a specific post
  async getPostTags(postId: number): Promise<BlogTag[]> {
    const query = `
      SELECT t.* FROM blog_tags t
      JOIN blog_post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
      ORDER BY t.name ASC
    `;
    
    const result = await executeQuery<BlogTag>(query, [postId]);
    return result.rows;
  }

  //gets related posts based on categories and tags with scoring
  async getRelatedPosts(postId: number, limit = 5): Promise<BlogPost[]> {
    const query = `
      WITH post_categories AS (
        SELECT category_id FROM blog_post_categories WHERE post_id = ?
      ),
      post_tags AS (
        SELECT tag_id FROM blog_post_tags WHERE post_id = ?
      ),
      related_scores AS (
        SELECT 
          p.id,
          COUNT(DISTINCT bpc.category_id) * 3 as category_score,
          COUNT(DISTINCT bpt.tag_id) * 2 as tag_score,
          (COUNT(DISTINCT bpc.category_id) * 3 + COUNT(DISTINCT bpt.tag_id) * 2) as total_score
        FROM blog_posts p
        LEFT JOIN blog_post_categories bpc ON p.id = bpc.post_id 
          AND bpc.category_id IN (SELECT category_id FROM post_categories)
        LEFT JOIN blog_post_tags bpt ON p.id = bpt.post_id 
          AND bpt.tag_id IN (SELECT tag_id FROM post_tags)
        WHERE p.id != ? AND p.status = 'published'
        GROUP BY p.id
        HAVING total_score > 0
      )
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar,
        rs.total_score
      FROM related_scores rs
      JOIN blog_posts p ON rs.id = p.id
      JOIN users u ON p.author_id = u.id
      ORDER BY rs.total_score DESC, p.published_at DESC
      LIMIT ?
    `;
    
    const result = await executeQuery<BlogPost>(query, [postId, postId, postId, limit]);
    
    return Promise.all(
      result.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
  }

  //gets blog archive data (posts grouped by month/year)
  async getBlogArchive(): Promise<Array<{
    year: number;
    month: number;
    month_name: string;
    post_count: number;
    posts?: BlogPost[];
  }>> {
    const query = `
      SELECT 
        strftime('%Y', published_at) as year,
        strftime('%m', published_at) as month,
        CASE strftime('%m', published_at)
          WHEN '01' THEN 'January'
          WHEN '02' THEN 'February'
          WHEN '03' THEN 'March'
          WHEN '04' THEN 'April'
          WHEN '05' THEN 'May'
          WHEN '06' THEN 'June'
          WHEN '07' THEN 'July'
          WHEN '08' THEN 'August'
          WHEN '09' THEN 'September'
          WHEN '10' THEN 'October'
          WHEN '11' THEN 'November'
          WHEN '12' THEN 'December'
        END as month_name,
        COUNT(*) as post_count
      FROM blog_posts
      WHERE status = 'published' AND published_at IS NOT NULL
      GROUP BY year, month
      ORDER BY year DESC, month DESC
    `;
    
    const result = await executeQuery<{
      year: string;
      month: string;
      month_name: string;
      post_count: number;
    }>(query);
    
    return result.rows.map(row => ({
      year: parseInt(row.year),
      month: parseInt(row.month),
      month_name: row.month_name,
      post_count: Number(row.post_count),
    }));
  }

  //gets posts for RSS feed
  async getRssFeedPosts(limit = 20): Promise<BlogPost[]> {
    const query = `
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.email as author_email
      FROM blog_posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.published_at DESC
      LIMIT ?
    `;
    
    const result = await executeQuery<BlogPost>(query, [limit]);
    
    return Promise.all(
      result.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
  }

  //gets popular posts based on view count
  async getPopularBlogPosts(limit = 10, days = 30): Promise<BlogPost[]> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    
    const query = `
      SELECT 
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar
      FROM blog_posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published' 
        AND p.published_at >= ?
      ORDER BY p.view_count DESC, p.published_at DESC
      LIMIT ?
    `;
    
    const result = await executeQuery<BlogPost>(query, [dateFrom.toISOString(), limit]);
    
    return Promise.all(
      result.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
  }

  //gets blog posts by category
  async getBlogPostsByCategory(categorySlug: string, options: QueryOptions = {}): Promise<PaginatedResponse<BlogPost>> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;
    
    //count query
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM blog_posts p
      JOIN blog_post_categories bpc ON p.id = bpc.post_id
      JOIN blog_categories bc ON bpc.category_id = bc.id
      WHERE p.status = 'published' AND bc.slug = ?
    `;
    
    const countResult = await executeQuery<{ total: number }>(countQuery, [categorySlug]);
    const total = Number(countResult.rows[0]?.total || 0);
    
    //data query
    const dataQuery = `
      SELECT DISTINCT
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar
      FROM blog_posts p
      JOIN blog_post_categories bpc ON p.id = bpc.post_id
      JOIN blog_categories bc ON bpc.category_id = bc.id
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published' AND bc.slug = ?
      ORDER BY p.published_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataResult = await executeQuery<BlogPost>(dataQuery, [categorySlug, limit, offset]);
    
    //enhance with categories and tags
    const posts = await Promise.all(
      dataResult.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
    
    return {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //gets blog posts by tag
  async getBlogPostsByTag(tagSlug: string, options: QueryOptions = {}): Promise<PaginatedResponse<BlogPost>> {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;
    
    //count query
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM blog_posts p
      JOIN blog_post_tags bpt ON p.id = bpt.post_id
      JOIN blog_tags bt ON bpt.tag_id = bt.id
      WHERE p.status = 'published' AND bt.slug = ?
    `;
    
    const countResult = await executeQuery<{ total: number }>(countQuery, [tagSlug]);
    const total = Number(countResult.rows[0]?.total || 0);
    
    //data query
    const dataQuery = `
      SELECT DISTINCT
        p.*,
        u.first_name || ' ' || u.last_name as author_name,
        u.avatar_url as author_avatar
      FROM blog_posts p
      JOIN blog_post_tags bpt ON p.id = bpt.post_id
      JOIN blog_tags bt ON bpt.tag_id = bt.id
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published' AND bt.slug = ?
      ORDER BY p.published_at DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataResult = await executeQuery<BlogPost>(dataQuery, [tagSlug, limit, offset]);
    
    //enhance with categories and tags
    const posts = await Promise.all(
      dataResult.rows.map(async (post) => ({
        ...post,
        categories: await this.getPostCategories(post.id),
        tags: await this.getPostTags(post.id),
      }))
    );
    
    return {
      data: posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //updates post categories
  async updatePostCategories(postId: number, categoryIds: number[]): Promise<void> {
    const queries = [
      { query: 'DELETE FROM blog_post_categories WHERE post_id = ?', params: [postId] },
      ...categoryIds.map(categoryId => ({
        query: 'INSERT INTO blog_post_categories (post_id, category_id) VALUES (?, ?)',
        params: [postId, categoryId],
      })),
    ];
    
    await executeTransaction(queries);
  }

  //updates post tags
  async updatePostTags(postId: number, tagIds: number[]): Promise<void> {
    const queries = [
      { query: 'DELETE FROM blog_post_tags WHERE post_id = ?', params: [postId] },
      ...tagIds.map(tagId => ({
        query: 'INSERT INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)',
        params: [postId, tagId],
      })),
    ];
    
    await executeTransaction(queries);
  }

  //updates blog post with content processing
  async updateBlogPost(id: number, postData: Partial<BlogPostForm>): Promise<void> {
    const { ContentProcessor } = await import('../content/processor');
    
    //process content if provided
    let processed;
    if (postData.content) {
      processed = ContentProcessor.processContent(postData.content, postData.title);
    }
    
    const updates = [];
    const values = [];
    
    //build dynamic update query
    Object.entries(postData).forEach(([key, value]) => {
      if (key === 'category_ids' || key === 'tag_ids') return; //handle separately
      
      if (key === 'featured') {
        updates.push('featured = ?');
        values.push(value ? 1 : 0);
      } else if (value !== undefined) {
        if (key === 'content' && processed) {
          updates.push('content = ?', 'content_html = ?', 'reading_time = ?', 'word_count = ?');
          values.push(value, processed.html, processed.readingTime, processed.wordCount);
          
          if (!postData.excerpt) {
            updates.push('excerpt = ?');
            values.push(processed.excerpt);
          }
          
          if (!postData.meta_description) {
            updates.push('meta_description = ?');
            values.push(processed.metaDescription);
          }
        } else {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
    });
    
    if (updates.length > 0) {
      values.push(id);
      await executeQuery(
        `UPDATE blog_posts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }
    
    //update categories
    if (postData.category_ids) {
      await this.updatePostCategories(id, postData.category_ids);
    }
    
    //update tags
    if (postData.tag_ids) {
      await this.updatePostTags(id, postData.tag_ids);
    }
  }

  //deletes blog post
  async deleteBlogPost(id: number): Promise<void> {
    await executeQuery('DELETE FROM blog_posts WHERE id = ?', [id]);
  }

  // =============================================================================
  // PORTFOLIO SYSTEM
  // =============================================================================

  //creates a new portfolio project
  async createPortfolioProject(projectData: ProjectForm): Promise<PortfolioProject> {
    const query = `
      INSERT INTO portfolio_projects (
        title, slug, short_description, full_description, content, content_html,
        status, featured, project_type, client_name, client_industry,
        project_duration, team_size, my_role, live_url, github_url, demo_url,
        featured_image_url, gallery_images, meta_title, meta_description,
        og_image_url, start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      projectData.title,
      projectData.slug,
      projectData.short_description,
      projectData.full_description || null,
      projectData.content || null,
      projectData.content || null, // TODO: Convert markdown to HTML
      projectData.status,
      projectData.featured,
      'web', // Default project type
      projectData.client_name || null,
      null, // client_industry
      null, // project_duration
      projectData.team_size || null,
      null, // my_role
      projectData.demo_url || null,
      projectData.source_url || null,
      null, // demo_url (different field)
      projectData.featured_image || null,
      projectData.gallery_images ? JSON.stringify(projectData.gallery_images) : null,
      null, // meta_title
      null, // meta_description
      null, // og_image_url
      projectData.start_date || null,
      projectData.end_date || null,
    ];

    const result = await executeQuery<PortfolioProject>(query, params);
    const project = result.rows[0];
    
    // Handle categories and technologies
    if (projectData.category_ids?.length) {
      await this.updateProjectCategories(project.id, projectData.category_ids);
    }
    
    if (projectData.technology_ids?.length) {
      await this.updateProjectTechnologies(project.id, projectData.technology_ids);
    }

    return project;
  }

  //gets paginated portfolio projects
  async getPortfolioProjects(options: ProjectQueryOptions = {}): Promise<PaginatedResponse<PortfolioProject>> {
    const {
      page = 1,
      limit = 12,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      status = 'active',
      featured,
      includeCategories = true,
      includeTechnologies = true,
    } = options;

    const offset = (page - 1) * limit;
    
    const baseQuery = 'FROM portfolio_projects p';
    const conditions: string[] = [];
    const params: unknown[] = [];
    
    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }
    
    if (featured !== undefined) {
      conditions.push('p.featured = ?');
      params.push(featured);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query
    const dataQuery = `
      SELECT p.*
      ${baseQuery}
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, limit, offset];
    const dataResult = await executeQuery<PortfolioProject>(dataQuery, dataParams);
    
    // Enhance with categories and technologies if requested
    let projects = dataResult.rows;
    if (includeCategories || includeTechnologies) {
      projects = await Promise.all(
        projects.map(async (project) => {
          const enhanced = { ...project };
          
          if (includeCategories) {
            enhanced.categories = await this.getProjectCategories(project.id);
          }
          
          if (includeTechnologies) {
            enhanced.technologies = await this.getProjectTechnologies(project.id);
          }
          
          return enhanced;
        })
      );
    }
    
    return {
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //gets a single portfolio project by slug
  async getPortfolioProjectBySlug(slug: string): Promise<PortfolioProject | null> {
    const query = 'SELECT * FROM portfolio_projects WHERE slug = ? AND status = "active" LIMIT 1';
    const result = await executeQuery<PortfolioProject>(query, [slug]);
    
    if (!result.rows[0]) return null;
    
    const project = result.rows[0];
    project.categories = await this.getProjectCategories(project.id);
    project.technologies = await this.getProjectTechnologies(project.id);
    
    return project;
  }

  //searches portfolio projects using FTS5
  async searchPortfolioProjects(filters: ProjectSearchFilters & QueryOptions = {}): Promise<PaginatedResponse<PortfolioProject>> {
    const { query, categories, technologies, status = 'active', page = 1, limit = 12 } = filters;
    const offset = (page - 1) * limit;
    
    if (!query) {
      return this.getPortfolioProjects({ ...filters, status, page, limit });
    }
    
    let searchQuery = `
      SELECT p.*, pts.rank
      FROM portfolio_projects_fts pts
      JOIN portfolio_projects p ON pts.rowid = p.id
      WHERE pts MATCH ? AND p.status = ?
    `;
    
    const params: unknown[] = [query, status];
    
    if (categories?.length) {
      searchQuery += ` AND p.id IN (
        SELECT pc.project_id FROM project_project_categories pc 
        WHERE pc.category_id IN (${categories.map(() => '?').join(',')})
      )`;
      params.push(...categories);
    }
    
    if (technologies?.length) {
      searchQuery += ` AND p.id IN (
        SELECT pt.project_id FROM project_project_technologies pt 
        WHERE pt.technology_id IN (${technologies.map(() => '?').join(',')})
      )`;
      params.push(...technologies);
    }
    
    // Count query
    const countQuery = searchQuery.replace('SELECT p.*, pts.rank', 'SELECT COUNT(*) as total');
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query with pagination
    searchQuery += ' ORDER BY pts.rank DESC LIMIT ? OFFSET ?';
    const dataResult = await executeQuery<PortfolioProject>(searchQuery, [...params, limit, offset]);
    
    // Enhance with categories and technologies
    const projects = await Promise.all(
      dataResult.rows.map(async (project) => ({
        ...project,
        categories: await this.getProjectCategories(project.id),
        technologies: await this.getProjectTechnologies(project.id),
      }))
    );
    
    return {
      data: projects,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //gets featured portfolio projects
  async getFeaturedPortfolioProjects(limit = 6): Promise<PortfolioProject[]> {
    const query = `
      SELECT * FROM portfolio_projects 
      WHERE status = 'active' AND featured = TRUE
      ORDER BY view_count DESC, created_at DESC
      LIMIT ?
    `;
    
    const result = await executeQuery<PortfolioProject>(query, [limit]);
    
    return Promise.all(
      result.rows.map(async (project) => ({
        ...project,
        categories: await this.getProjectCategories(project.id),
        technologies: await this.getProjectTechnologies(project.id),
      }))
    );
  }

  //increments project view count
  async incrementProjectViewCount(projectId: number): Promise<void> {
    const query = 'UPDATE portfolio_projects SET view_count = view_count + 1 WHERE id = ?';
    await executeQuery(query, [projectId]);
  }

  //gets all project categories
  async getProjectCategories(projectId?: number): Promise<ProjectCategory[]> {
    let query: string;
    let params: unknown[] = [];
    
    if (projectId) {
      query = `
        SELECT c.* FROM project_categories c
        JOIN project_project_categories pc ON c.id = pc.category_id
        WHERE pc.project_id = ? AND c.is_active = TRUE
        ORDER BY c.sort_order ASC, c.name ASC
      `;
      params = [projectId];
    } else {
      query = `
        SELECT * FROM project_categories 
        WHERE is_active = TRUE
        ORDER BY sort_order ASC, name ASC
      `;
    }
    
    const result = await executeQuery<ProjectCategory>(query, params);
    return result.rows;
  }

  //gets all project technologies
  async getProjectTechnologies(projectId?: number): Promise<ProjectTechnology[]> {
    let query: string;
    let params: unknown[] = [];
    
    if (projectId) {
      query = `
        SELECT t.* FROM project_technologies t
        JOIN project_project_technologies pt ON t.id = pt.technology_id
        WHERE pt.project_id = ? AND t.is_active = TRUE
        ORDER BY t.category ASC, t.name ASC
      `;
      params = [projectId];
    } else {
      query = `
        SELECT * FROM project_technologies 
        WHERE is_active = TRUE
        ORDER BY category ASC, name ASC
      `;
    }
    
    const result = await executeQuery<ProjectTechnology>(query, params);
    return result.rows;
  }

  //updates project categories
  async updateProjectCategories(projectId: number, categoryIds: number[]): Promise<void> {
    const queries = [
      { query: 'DELETE FROM project_project_categories WHERE project_id = ?', params: [projectId] },
      ...categoryIds.map(categoryId => ({
        query: 'INSERT INTO project_project_categories (project_id, category_id) VALUES (?, ?)',
        params: [projectId, categoryId],
      })),
    ];
    
    await executeTransaction(queries);
  }

  //updates project technologies
  async updateProjectTechnologies(projectId: number, technologyIds: number[]): Promise<void> {
    const queries = [
      { query: 'DELETE FROM project_project_technologies WHERE project_id = ?', params: [projectId] },
      ...technologyIds.map(technologyId => ({
        query: 'INSERT INTO project_project_technologies (project_id, technology_id) VALUES (?, ?)',
        params: [projectId, technologyId],
      })),
    ];
    
    await executeTransaction(queries);
  }

  // =============================================================================
  // ENHANCED PORTFOLIO SYSTEM - Plan 6 Extensions
  // =============================================================================

  //creates a new skill
  async createSkill(skillData: Omit<Skill, 'id' | 'created_at' | 'updated_at'>): Promise<Skill> {
    const query = `
      INSERT INTO skills (
        name, category, proficiency_level, years_experience, last_used_date,
        certification_level, description, priority_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      skillData.name,
      skillData.category,
      skillData.proficiency_level,
      skillData.years_experience || null,
      skillData.last_used_date || null,
      skillData.certification_level || null,
      skillData.description || null,
      skillData.priority_level,
    ];

    const result = await executeQuery<Skill>(query, params);
    return result.rows[0];
  }

  //gets all skills with optional category filter
  async getAllSkills(category?: string): Promise<Skill[]> {
    let query = 'SELECT * FROM skills';
    const params: unknown[] = [];
    
    if (category) {
      query += ' WHERE category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY priority_level DESC, proficiency_level DESC, name ASC';
    
    const result = await executeQuery<Skill>(query, params);
    
    return result.rows.map(skill => ({
      ...skill,
      learning_resources: skill.learning_resources ? JSON.parse(skill.learning_resources) : []
    }));
  }

  //gets skill categories with counts
  async getSkillCategories(): Promise<{category: string, count: number}[]> {
    const query = `
      SELECT category, COUNT(*) as count
      FROM skills
      GROUP BY category
      ORDER BY count DESC, category ASC
    `;
    
    const result = await executeQuery<{category: string, count: number}>(query);
    return result.rows;
  }

  //gets skill by ID
  async getSkillById(id: number): Promise<Skill | null> {
    const query = 'SELECT * FROM skills WHERE id = ? LIMIT 1';
    const result = await executeQuery<Skill>(query, [id]);
    
    if (!result.rows[0]) return null;
    
    const skill = result.rows[0];
    return {
      ...skill,
      learning_resources: skill.learning_resources ? JSON.parse(skill.learning_resources) : []
    };
  }

  //updates skill
  async updateSkill(id: number, skillData: Partial<Omit<Skill, 'id' | 'created_at' | 'updated_at'>>): Promise<void> {
    const updates = [];
    const values = [];
    
    Object.entries(skillData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'learning_resources') {
          updates.push(`${key} = ?`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
    });
    
    if (updates.length > 0) {
      values.push(id);
      await executeQuery(
        `UPDATE skills SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        values
      );
    }
  }

  //links project to skills
  async updateProjectSkills(projectId: number, skillsData: Array<{skill_id: number, usage_level: 'primary' | 'secondary' | 'minor'}>): Promise<void> {
    const queries = [
      { query: 'DELETE FROM project_skills WHERE project_id = ?', params: [projectId] },
      ...skillsData.map(skill => ({
        query: 'INSERT INTO project_skills (project_id, skill_id, usage_level) VALUES (?, ?, ?)',
        params: [projectId, skill.skill_id, skill.usage_level],
      })),
    ];
    
    await executeTransaction(queries);
  }

  //gets skills for a project
  async getProjectSkills(projectId: number): Promise<Array<Skill & {usage_level: string}>> {
    const query = `
      SELECT s.*, ps.usage_level
      FROM skills s
      JOIN project_skills ps ON s.id = ps.skill_id
      WHERE ps.project_id = ?
      ORDER BY 
        CASE ps.usage_level 
          WHEN 'primary' THEN 1 
          WHEN 'secondary' THEN 2 
          WHEN 'minor' THEN 3 
        END,
        s.name ASC
    `;
    
    const result = await executeQuery<Skill & {usage_level: string}>(query, [projectId]);
    
    return result.rows.map(skill => ({
      ...skill,
      learning_resources: skill.learning_resources ? JSON.parse(skill.learning_resources) : []
    }));
  }

  //creates a new testimonial
  async createTestimonial(testimonialData: Omit<Testimonial, 'id' | 'created_at'>): Promise<Testimonial> {
    const query = `
      INSERT INTO testimonials (
        client_name, client_position, client_company, client_email,
        project_id, testimonial_text, rating, date_given,
        permission_to_display, featured, testimonial_type, work_relationship
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      testimonialData.client_name,
      testimonialData.client_position || null,
      testimonialData.client_company || null,
      testimonialData.client_email || null,
      testimonialData.project_id || null,
      testimonialData.testimonial_text,
      testimonialData.rating,
      testimonialData.date_given,
      testimonialData.permission_to_display,
      testimonialData.featured,
      testimonialData.testimonial_type,
      testimonialData.work_relationship || null,
    ];

    const result = await executeQuery<Testimonial>(query, params);
    return result.rows[0];
  }

  //gets testimonial by ID
  async getTestimonialById(id: number): Promise<Testimonial | null> {
    const query = `
      SELECT t.*, p.title as project_title, p.slug as project_slug
      FROM testimonials t
      LEFT JOIN portfolio_projects p ON t.project_id = p.id
      WHERE t.id = ?
      LIMIT 1
    `;
    
    const result = await executeQuery<Testimonial>(query, [id]);
    return result.rows[0] || null;
  }

  //gets featured testimonials
  async getFeaturedTestimonials(limit = 5): Promise<Testimonial[]> {
    const query = `
      SELECT t.*, p.title as project_title, p.slug as project_slug
      FROM testimonials t
      LEFT JOIN portfolio_projects p ON t.project_id = p.id
      WHERE t.permission_to_display = TRUE AND t.featured = TRUE
      ORDER BY t.rating DESC, t.date_given DESC
      LIMIT ?
    `;
    
    const result = await executeQuery<Testimonial>(query, [limit]);
    return result.rows;
  }

  //gets all testimonials with pagination
  async getTestimonials(options: QueryOptions & {featured?: boolean, project_id?: number} = {}): Promise<PaginatedResponse<Testimonial>> {
    const { page = 1, limit = 10, featured, project_id } = options;
    const offset = (page - 1) * limit;
    
    let baseQuery = `
      FROM testimonials t
      LEFT JOIN portfolio_projects p ON t.project_id = p.id
    `;
    
    const conditions: string[] = ['t.permission_to_display = TRUE'];
    const params: unknown[] = [];
    
    if (featured !== undefined) {
      conditions.push('t.featured = ?');
      params.push(featured);
    }
    
    if (project_id) {
      conditions.push('t.project_id = ?');
      params.push(project_id);
    }
    
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query
    const dataQuery = `
      SELECT t.*, p.title as project_title, p.slug as project_slug
      ${baseQuery}
      ${whereClause}
      ORDER BY t.featured DESC, t.rating DESC, t.date_given DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataResult = await executeQuery<Testimonial>(dataQuery, [...params, limit, offset]);
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //creates case study section
  async createCaseStudySection(sectionData: Omit<CaseStudySection, 'id' | 'created_at'>): Promise<CaseStudySection> {
    const query = `
      INSERT INTO case_study_sections (
        project_id, section_type, section_title, section_content,
        section_order, media_items, code_examples, metrics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      sectionData.project_id,
      sectionData.section_type,
      sectionData.section_title,
      sectionData.section_content,
      sectionData.section_order,
      sectionData.media_items ? JSON.stringify(sectionData.media_items) : null,
      sectionData.code_examples ? JSON.stringify(sectionData.code_examples) : null,
      sectionData.metrics ? JSON.stringify(sectionData.metrics) : null,
    ];

    const result = await executeQuery<CaseStudySection>(query, params);
    const section = result.rows[0];
    
    return {
      ...section,
      media_items: section.media_items ? JSON.parse(section.media_items) : [],
      code_examples: section.code_examples ? JSON.parse(section.code_examples) : [],
      metrics: section.metrics ? JSON.parse(section.metrics) : {}
    };
  }

  //gets case study sections for a project
  async getProjectCaseStudySections(projectId: number): Promise<CaseStudySection[]> {
    const query = `
      SELECT * FROM case_study_sections
      WHERE project_id = ?
      ORDER BY section_order ASC, created_at ASC
    `;
    
    const result = await executeQuery<CaseStudySection>(query, [projectId]);
    
    return result.rows.map(section => ({
      ...section,
      media_items: section.media_items ? JSON.parse(section.media_items) : [],
      code_examples: section.code_examples ? JSON.parse(section.code_examples) : [],
      metrics: section.metrics ? JSON.parse(section.metrics) : {}
    }));
  }

  //gets comprehensive portfolio statistics for Plan 6
  async getPortfolioStatistics(): Promise<{
    totalProjects: number;
    completedProjects: number;
    totalSkills: number;
    yearsExperience: number;
    averageProjectRating: number;
    totalTestimonials: number;
    topSkills: string[];
    recentProjects: PortfolioProject[];
  }> {
    const [statsResult, skillsResult, projectsResult] = await Promise.all([
      executeQuery<{total_projects: number, completed_projects: number}>(`
        SELECT 
          COUNT(*) as total_projects,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_projects
        FROM portfolio_projects
      `),
      executeQuery<{name: string}>(`
        SELECT name FROM skills 
        WHERE priority_level = 'high' 
        ORDER BY proficiency_level DESC, years_experience DESC 
        LIMIT 8
      `),
      executeQuery<PortfolioProject>(`
        SELECT * FROM portfolio_projects 
        WHERE status IN ('completed', 'active')
        ORDER BY CASE WHEN status = 'completed' THEN end_date ELSE created_at END DESC
        LIMIT 6
      `)
    ]);

    const stats = statsResult.rows[0];
    const topSkills = skillsResult.rows.map(row => row.name);
    const recentProjects = projectsResult.rows.map(row => ({
      ...row,
      gallery_images: row.gallery_images ? JSON.parse(row.gallery_images) : []
    }));

    // Calculate years of experience from work experience
    const experienceResult = await executeQuery<{first_job: string}>(`
      SELECT MIN(start_date) as first_job FROM work_experience
    `);
    
    const firstJob = experienceResult.rows[0]?.first_job;
    const yearsExperience = firstJob ? 
      Math.floor((new Date().getTime() - new Date(firstJob).getTime()) / (1000 * 60 * 60 * 24 * 365)) : 0;

    // Get average testimonial rating
    const ratingResult = await executeQuery<{avg_rating: number, total_testimonials: number}>(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as total_testimonials
      FROM testimonials 
      WHERE permission_to_display = TRUE
    `);
    
    const ratings = ratingResult.rows[0];

    // Get total skills count
    const skillsCountResult = await executeQuery<{count: number}>('SELECT COUNT(*) as count FROM skills');

    return {
      totalProjects: Number(stats?.total_projects || 0),
      completedProjects: Number(stats?.completed_projects || 0),
      totalSkills: Number(skillsCountResult.rows[0]?.count || 0),
      yearsExperience,
      averageProjectRating: Math.round((ratings?.avg_rating || 0) * 10) / 10,
      totalTestimonials: Number(ratings?.total_testimonials || 0),
      topSkills,
      recentProjects
    };
  }

  //gets enhanced portfolio project by slug with all related data
  async getEnhancedPortfolioProjectBySlug(slug: string): Promise<(PortfolioProject & {
    skills_used?: Array<Skill & {usage_level: string}>;
    testimonials?: Testimonial[];
    case_study_sections?: CaseStudySection[];
    testimonial_count?: number;
  }) | null> {
    const project = await this.getPortfolioProjectBySlug(slug);
    if (!project) return null;

    // Get related data in parallel
    const [skills, testimonials, caseSections] = await Promise.all([
      this.getProjectSkills(project.id),
      this.getTestimonials({project_id: project.id, limit: 50}),
      this.getProjectCaseStudySections(project.id)
    ]);

    return {
      ...project,
      skills_used: skills,
      testimonials: testimonials.data,
      case_study_sections: caseSections,
      testimonial_count: testimonials.pagination.total
    };
  }

  //gets work experience with enhanced formatting
  async getAllWorkExperience(): Promise<WorkExperience[]> {
    const query = `
      SELECT * FROM work_experience
      ORDER BY is_current DESC, 
               CASE WHEN end_date IS NULL THEN '9999-12-31' ELSE end_date END DESC,
               start_date DESC
    `;
    
    const result = await executeQuery<WorkExperience>(query);
    
    return result.rows.map(exp => ({
      ...exp,
      achievements: exp.achievements ? JSON.parse(exp.achievements) : [],
      technologies_used: exp.technologies_used ? JSON.parse(exp.technologies_used) : []
    }));
  }

  //creates work experience
  async createWorkExperience(experienceData: Omit<WorkExperience, 'id' | 'created_at' | 'updated_at'>): Promise<WorkExperience> {
    const query = `
      INSERT INTO work_experience (
        company, position, employment_type, location, description,
        achievements, technologies_used, company_logo_url, is_current,
        start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      experienceData.company,
      experienceData.position,
      experienceData.employment_type,
      experienceData.location || null,
      experienceData.description || null,
      experienceData.achievements ? JSON.stringify(experienceData.achievements) : null,
      experienceData.technologies_used ? JSON.stringify(experienceData.technologies_used) : null,
      experienceData.company_logo_url || null,
      experienceData.is_current,
      experienceData.start_date || null,
      experienceData.end_date || null,
    ];

    const result = await executeQuery<WorkExperience>(query, params);
    const experience = result.rows[0];
    
    return {
      ...experience,
      achievements: experience.achievements ? JSON.parse(experience.achievements) : [],
      technologies_used: experience.technologies_used ? JSON.parse(experience.technologies_used) : []
    };
  }

  //gets work experience by ID
  async getWorkExperienceById(id: number): Promise<WorkExperience | null> {
    const query = 'SELECT * FROM work_experience WHERE id = ? LIMIT 1';
    const result = await executeQuery<WorkExperience>(query, [id]);
    
    if (!result.rows[0]) return null;
    
    const experience = result.rows[0];
    return {
      ...experience,
      achievements: experience.achievements ? JSON.parse(experience.achievements) : [],
      technologies_used: experience.technologies_used ? JSON.parse(experience.technologies_used) : []
    };
  }

  //creates education record
  async createEducation(educationData: Omit<Education, 'id' | 'created_at' | 'updated_at'>): Promise<Education> {
    const query = `
      INSERT INTO education (
        institution, degree, field_of_study, grade, description,
        logo_url, is_current, start_date, end_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      educationData.institution,
      educationData.degree,
      educationData.field_of_study || null,
      educationData.grade || null,
      educationData.description || null,
      educationData.logo_url || null,
      educationData.is_current,
      educationData.start_date || null,
      educationData.end_date || null,
    ];

    const result = await executeQuery<Education>(query, params);
    return result.rows[0];
  }

  //gets education by ID
  async getEducationById(id: number): Promise<Education | null> {
    const query = 'SELECT * FROM education WHERE id = ? LIMIT 1';
    const result = await executeQuery<Education>(query, [id]);
    return result.rows[0] || null;
  }

  //gets all education records
  async getAllEducation(): Promise<Education[]> {
    const query = `
      SELECT * FROM education
      ORDER BY is_current DESC,
               CASE WHEN end_date IS NULL THEN '9999-12-31' ELSE end_date END DESC,
               start_date DESC
    `;
    
    const result = await executeQuery<Education>(query);
    return result.rows;
  }

  // =============================================================================
  // FLIGHT TRACKING SYSTEM
  // =============================================================================

  //creates a new flight record with enhanced Plan 5 functionality
  async createFlight(flightData: FlightForm): Promise<Flight> {
    // Calculate flight duration and distance
    const duration = this.calculateFlightDuration(flightData.departure_time, flightData.arrival_time);
    const distance = await this.calculateFlightDistance(flightData.departure_airport_id, flightData.arrival_airport_id);
    
    const query = `
      INSERT INTO flights (
        flight_number, airline_code, airline_name, aircraft_type,
        departure_airport_id, arrival_airport_id, departure_time, arrival_time,
        flight_duration, distance_km, seat_number, class, booking_reference,
        ticket_price, currency, notes, photos, trip_purpose, is_favorite,
        flight_status, blog_post_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      flightData.flight_number || null,
      flightData.airline_code || null,
      flightData.airline_name || null,
      flightData.aircraft_type || null,
      flightData.departure_airport_id,
      flightData.arrival_airport_id,
      flightData.departure_time,
      flightData.arrival_time,
      duration,
      distance,
      flightData.seat_number || null,
      flightData.class || null,
      flightData.booking_reference || null,
      flightData.ticket_price || null,
      flightData.currency,
      flightData.notes || null,
      flightData.photos ? JSON.stringify(flightData.photos) : null,
      flightData.trip_purpose || null,
      flightData.is_favorite,
      flightData.flight_status,
      flightData.blog_post_id || null,
    ];

    const result = await executeQuery<Flight>(query, params);
    const flight = result.rows[0];
    
    // Update airport visit counts for completed flights
    if (flightData.flight_status === 'completed') {
      await Promise.all([
        this.updateAirportVisits(flightData.departure_airport_id, flightData.departure_time),
        this.updateAirportVisits(flightData.arrival_airport_id, flightData.arrival_time)
      ]);
    }
    
    return flight;
  }

  //gets paginated flights with airport details
  async getFlights(options: FlightQueryOptions = {}): Promise<PaginatedResponse<Flight>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'departure_time',
      sortOrder = 'DESC',
      includeAirports = true,
      year,
      month,
    } = options;

    const offset = (page - 1) * limit;
    
    let baseQuery = 'FROM flights f';
    if (includeAirports) {
      baseQuery += `
        LEFT JOIN airports da ON f.departure_airport_id = da.id
        LEFT JOIN airports aa ON f.arrival_airport_id = aa.id
      `;
    }
    
    const conditions: string[] = [];
    const params: unknown[] = [];
    
    if (year) {
      conditions.push('strftime("%Y", f.departure_time) = ?');
      params.push(year.toString());
    }
    
    if (month) {
      conditions.push('strftime("%m", f.departure_time) = ?');
      params.push(month.toString().padStart(2, '0'));
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query
    const selectFields = [
      'f.*',
      includeAirports ? 'da.name as departure_airport_name, da.city as departure_city, da.country as departure_country, da.iata_code as departure_iata' : null,
      includeAirports ? 'aa.name as arrival_airport_name, aa.city as arrival_city, aa.country as arrival_country, aa.iata_code as arrival_iata' : null,
    ].filter(Boolean).join(', ');
    
    const dataQuery = `
      SELECT ${selectFields}
      ${baseQuery}
      ${whereClause}
      ORDER BY f.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, limit, offset];
    const dataResult = await executeQuery<Flight>(dataQuery, dataParams);
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //searches flights with filters
  async searchFlights(filters: FlightSearchFilters & QueryOptions = {}): Promise<PaginatedResponse<Flight>> {
    const { airline, airport, year, month, class: flightClass, trip_purpose, page = 1, limit = 20 } = filters;
    const offset = (page - 1) * limit;
    
    let baseQuery = `
      FROM flights f
      LEFT JOIN airports da ON f.departure_airport_id = da.id
      LEFT JOIN airports aa ON f.arrival_airport_id = aa.id
    `;
    
    const conditions: string[] = [];
    const params: unknown[] = [];
    
    if (airline) {
      conditions.push('(f.airline_code LIKE ? OR f.airline_name LIKE ?)');
      params.push(`%${airline}%`, `%${airline}%`);
    }
    
    if (airport) {
      conditions.push('(da.iata_code LIKE ? OR da.name LIKE ? OR aa.iata_code LIKE ? OR aa.name LIKE ?)');
      params.push(`%${airport}%`, `%${airport}%`, `%${airport}%`, `%${airport}%`);
    }
    
    if (year) {
      conditions.push('strftime("%Y", f.departure_time) = ?');
      params.push(year.toString());
    }
    
    if (month) {
      conditions.push('strftime("%m", f.departure_time) = ?');
      params.push(month.toString().padStart(2, '0'));
    }
    
    if (flightClass) {
      conditions.push('f.class = ?');
      params.push(flightClass);
    }
    
    if (trip_purpose) {
      conditions.push('f.trip_purpose = ?');
      params.push(trip_purpose);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query
    const dataQuery = `
      SELECT f.*,
             da.name as departure_airport_name, da.city as departure_city, da.country as departure_country, da.iata_code as departure_iata,
             aa.name as arrival_airport_name, aa.city as arrival_city, aa.country as arrival_country, aa.iata_code as arrival_iata
      ${baseQuery}
      ${whereClause}
      ORDER BY f.departure_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, limit, offset];
    const dataResult = await executeQuery<Flight>(dataQuery, dataParams);
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  //gets enhanced flight statistics for Plan 5
  async getFlightStatistics(): Promise<{
    totalFlights: number;
    totalDistance: number;
    totalFlightTime: number;
    uniqueAirports: number;
    uniqueCountries: number;
    uniqueAirlines: number;
    favoriteAirline: string;
    longestFlight: Flight | null;
    mostVisitedAirport: string;
  }> {
    const [statsResult, longestFlightResult, favoriteAirlineResult, mostVisitedResult] = await Promise.all([
      executeQuery<{
        total_flights: number;
        total_distance: number;
        total_flight_time: number;
        unique_airports: number;
      }>(`
        SELECT 
          COUNT(*) as total_flights,
          COALESCE(SUM(distance_km), 0) as total_distance,
          COALESCE(SUM(flight_duration), 0) as total_flight_time,
          (SELECT COUNT(DISTINCT airport_id) FROM (
            SELECT departure_airport_id as airport_id FROM flights WHERE flight_status = 'completed'
            UNION
            SELECT arrival_airport_id as airport_id FROM flights WHERE flight_status = 'completed'
          )) as unique_airports
        FROM flights
        WHERE flight_status = 'completed'
      `),
      
      executeQuery<any>(`
        SELECT f.*, 
          da.name as departure_airport_name, da.iata_code as departure_iata,
          aa.name as arrival_airport_name, aa.iata_code as arrival_iata
        FROM flights f
        JOIN airports da ON f.departure_airport_id = da.id
        JOIN airports aa ON f.arrival_airport_id = aa.id
        WHERE f.flight_status = 'completed' AND f.distance_km IS NOT NULL
        ORDER BY f.distance_km DESC
        LIMIT 1
      `),
      
      executeQuery<{ airline_name: string }>(`
        SELECT airline_name, COUNT(*) as flight_count
        FROM flights
        WHERE flight_status = 'completed' AND airline_name IS NOT NULL
        GROUP BY airline_name
        ORDER BY flight_count DESC
        LIMIT 1
      `),
      
      executeQuery<{ name: string; iata_code: string }>(`
        SELECT a.name, a.iata_code, COUNT(*) as visit_count
        FROM (
          SELECT departure_airport_id as airport_id FROM flights WHERE flight_status = 'completed'
          UNION ALL
          SELECT arrival_airport_id as airport_id FROM flights WHERE flight_status = 'completed'
        ) f
        JOIN airports a ON f.airport_id = a.id
        GROUP BY a.id, a.name, a.iata_code
        ORDER BY visit_count DESC
        LIMIT 1
      `)
    ]);

    const stats = statsResult.rows[0];
    const longestFlight = longestFlightResult.rows[0] || null;
    const favoriteAirline = favoriteAirlineResult.rows[0];
    const mostVisited = mostVisitedResult.rows[0];

    // Get unique countries count
    const countriesResult = await executeQuery<{ unique_countries: number }>(`
      SELECT COUNT(DISTINCT country) as unique_countries
      FROM (
        SELECT da.country FROM flights f JOIN airports da ON f.departure_airport_id = da.id
        WHERE f.flight_status = 'completed'
        UNION
        SELECT aa.country FROM flights f JOIN airports aa ON f.arrival_airport_id = aa.id
        WHERE f.flight_status = 'completed'
      )
    `);

    const uniqueCountries = countriesResult.rows[0]?.unique_countries || 0;

    // Get unique airlines count
    const airlinesResult = await executeQuery<{ count: number }>(`
      SELECT COUNT(DISTINCT airline_name) as count
      FROM flights
      WHERE flight_status = 'completed' AND airline_name IS NOT NULL
    `);

    return {
      totalFlights: Number(stats?.total_flights || 0),
      totalDistance: Number(stats?.total_distance || 0),
      totalFlightTime: Number(stats?.total_flight_time || 0),
      uniqueAirports: Number(stats?.unique_airports || 0),
      uniqueCountries: Number(uniqueCountries),
      uniqueAirlines: Number(airlinesResult.rows[0]?.count || 0),
      favoriteAirline: favoriteAirline?.airline_name || 'N/A',
      longestFlight: longestFlight,
      mostVisitedAirport: mostVisited ? `${mostVisited.name} (${mostVisited.iata_code})` : 'N/A'
    };
  }

  //gets all airports (legacy method - redirects to enhanced searchAirports)
  async getAirports(query?: string, limit = 100): Promise<Airport[]> {
    return this.searchAirports(query, limit);
  }

  //gets flight routes for visualization
  async getFlightRoutes(): Promise<FlightRoute[]> {
    const query = `
      SELECT fr.*,
             da.name as departure_airport_name, da.latitude as departure_lat, da.longitude as departure_lng,
             aa.name as arrival_airport_name, aa.latitude as arrival_lat, aa.longitude as arrival_lng
      FROM flight_routes fr
      JOIN airports da ON fr.departure_airport_id = da.id
      JOIN airports aa ON fr.arrival_airport_id = aa.id
      WHERE fr.is_active = TRUE AND fr.flight_count > 0
      ORDER BY fr.flight_count DESC
    `;
    
    const result = await executeQuery<FlightRoute>(query);
    return result.rows;
  }

  //calculates flight duration in minutes
  private calculateFlightDuration(departureTime: string, arrivalTime: string): number {
    const departure = new Date(departureTime);
    const arrival = new Date(arrivalTime);
    return Math.round((arrival.getTime() - departure.getTime()) / (1000 * 60));
  }

  //calculates flight distance using airport coordinates
  private async calculateFlightDistance(departureAirportId: number, arrivalAirportId: number): Promise<number> {
    const query = `
      SELECT 
        da.latitude as dep_lat, da.longitude as dep_lng,
        aa.latitude as arr_lat, aa.longitude as arr_lng
      FROM airports da, airports aa
      WHERE da.id = ? AND aa.id = ?
    `;
    
    const result = await executeQuery<{
      dep_lat: number;
      dep_lng: number;
      arr_lat: number;
      arr_lng: number;
    }>(query, [departureAirportId, arrivalAirportId]);
    
    if (!result.rows[0]) return 0;
    
    const { dep_lat, dep_lng, arr_lat, arr_lng } = result.rows[0];
    return this.haversineDistance(dep_lat, dep_lng, arr_lat, arr_lng);
  }

  //calculates distance between two coordinates using haversine formula
  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // =============================================================================
  // ENHANCED AIRPORT MANAGEMENT - Plan 5 Extensions
  // =============================================================================

  //creates a new airport with visit tracking
  async createAirport(airportData: Omit<Airport, 'id' | 'created_at' | 'updated_at'>): Promise<Airport> {
    const query = `
      INSERT INTO airports (
        iata_code, icao_code, name, city, country, country_code,
        latitude, longitude, altitude, timezone, has_visited, visit_count,
        first_visit_date, last_visit_date, type, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      airportData.iata_code,
      airportData.icao_code || null,
      airportData.name,
      airportData.city,
      airportData.country,
      airportData.country_code,
      airportData.latitude,
      airportData.longitude,
      airportData.altitude || null,
      airportData.timezone || null,
      airportData.has_visited || false,
      airportData.visit_count || 0,
      airportData.first_visit_date || null,
      airportData.last_visit_date || null,
      airportData.type || 'airport',
      airportData.is_active !== undefined ? airportData.is_active : true,
    ];

    const result = await executeQuery<Airport>(query, params);
    const airport = result.rows[0];
    
    // Add coordinates for deck.gl
    return {
      ...airport,
      coordinates: [airport.longitude, airport.latitude]
    };
  }

  //gets airport by ID with coordinates
  async getAirportById(id: number): Promise<Airport | null> {
    const query = 'SELECT * FROM airports WHERE id = ?';
    const result = await executeQuery<Airport>(query, [id]);
    
    if (!result.rows[0]) return null;
    
    const airport = result.rows[0];
    return {
      ...airport,
      coordinates: [airport.longitude, airport.latitude]
    };
  }

  //searches airports with enhanced filtering
  async searchAirports(searchQuery?: string, limit = 100): Promise<Airport[]> {
    let query = `
      SELECT * FROM airports 
      WHERE is_active = TRUE
    `;
    const params: unknown[] = [];
    
    if (searchQuery) {
      query += ` AND (
        name LIKE ? OR 
        city LIKE ? OR 
        iata_code LIKE ? OR 
        country LIKE ?
      )`;
      const searchTerm = `%${searchQuery}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ` ORDER BY has_visited DESC, visit_count DESC, name ASC LIMIT ?`;
    params.push(limit);
    
    const result = await executeQuery<Airport>(query, params);
    
    return result.rows.map(airport => ({
      ...airport,
      coordinates: [airport.longitude, airport.latitude]
    }));
  }

  //updates airport visit information when flight is completed
  async updateAirportVisits(airportId: number, visitDate: string): Promise<void> {
    const query = `
      UPDATE airports SET 
        has_visited = TRUE,
        visit_count = visit_count + 1,
        first_visit_date = COALESCE(first_visit_date, ?),
        last_visit_date = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    
    await executeQuery(query, [visitDate, visitDate, airportId]);
  }

  //gets flight by ID with enhanced joins for Plan 5
  async getFlightById(id: number): Promise<Flight | null> {
    const query = `
      SELECT f.*, 
        da.name as departure_airport_name, da.city as departure_city,
        da.country as departure_country, da.iata_code as departure_iata,
        da.latitude as dep_lat, da.longitude as dep_lng,
        aa.name as arrival_airport_name, aa.city as arrival_city,
        aa.country as arrival_country, aa.iata_code as arrival_iata,
        aa.latitude as arr_lat, aa.longitude as arr_lng,
        bp.title as blog_post_title, bp.slug as blog_post_slug
      FROM flights f
      JOIN airports da ON f.departure_airport_id = da.id
      JOIN airports aa ON f.arrival_airport_id = aa.id
      LEFT JOIN blog_posts bp ON f.blog_post_id = bp.id
      WHERE f.id = ?
    `;
    
    const result = await executeQuery<any>(query, [id]);
    
    if (result.rows.length === 0) return null;
    
    const row = result.rows[0];
    return {
      ...row,
      photos: row.photos ? JSON.parse(row.photos) : [],
      origin: [row.dep_lng, row.dep_lat],
      destination: [row.arr_lng, row.arr_lat]
    };
  }

  //gets all flights with enhanced filtering for Plan 5
  async getAllFlights(page = 1, limit = 50, filters: {
    airline?: string;
    year?: number;
    status?: string;
    search?: string;
  } = {}): Promise<PaginatedResponse<Flight>> {
    const offset = (page - 1) * limit;
    
    let baseQuery = `
      FROM flights f
      JOIN airports da ON f.departure_airport_id = da.id
      JOIN airports aa ON f.arrival_airport_id = aa.id
    `;
    
    const conditions: string[] = [];
    const params: unknown[] = [];
    
    // Apply filters
    if (filters.airline) {
      conditions.push('(f.airline_code LIKE ? OR f.airline_name LIKE ?)');
      params.push(`%${filters.airline}%`, `%${filters.airline}%`);
    }
    
    if (filters.year) {
      conditions.push('strftime("%Y", f.departure_time) = ?');
      params.push(filters.year.toString());
    }
    
    if (filters.status) {
      conditions.push('f.flight_status = ?');
      params.push(filters.status);
    }
    
    if (filters.search) {
      conditions.push(`(
        f.flight_number LIKE ? OR
        f.airline_name LIKE ? OR
        da.name LIKE ? OR
        aa.name LIKE ? OR
        da.city LIKE ? OR
        aa.city LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query
    const dataQuery = `
      SELECT f.*,
        da.name as departure_airport_name, da.iata_code as departure_iata,
        da.city as departure_city, da.country as departure_country,
        da.latitude as dep_lat, da.longitude as dep_lng,
        aa.name as arrival_airport_name, aa.iata_code as arrival_iata,
        aa.city as arrival_city, aa.country as arrival_country,
        aa.latitude as arr_lat, aa.longitude as arr_lng
      ${baseQuery}
      ${whereClause}
      ORDER BY f.departure_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const dataResult = await executeQuery<any>(dataQuery, [...params, limit, offset]);
    
    const flights = dataResult.rows.map((row: any) => ({
      ...row,
      photos: row.photos ? JSON.parse(row.photos) : [],
      origin: [row.dep_lng, row.dep_lat],
      destination: [row.arr_lng, row.arr_lat]
    }));
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      data: flights,
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
  // ANALYTICS & TRACKING
  // =============================================================================

  //tracks analytics event
  async trackEvent(eventData: Omit<AnalyticsEvent, 'id' | 'created_at'>): Promise<void> {
    const query = `
      INSERT INTO analytics_events (
        event_type, page_path, page_title, referrer, user_agent,
        ip_address, country, city, browser, os, device_type,
        session_id, user_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      eventData.event_type,
      eventData.page_path,
      eventData.page_title || null,
      eventData.referrer || null,
      eventData.user_agent || null,
      eventData.ip_address || null,
      eventData.country || null,
      eventData.city || null,
      eventData.browser || null,
      eventData.os || null,
      eventData.device_type || null,
      eventData.session_id || null,
      eventData.user_id || null,
      eventData.metadata ? JSON.stringify(eventData.metadata) : null,
    ];

    await executeQuery(query, params);
  }

  //tracks page view
  async trackPageView(pagePath: string, sessionId?: string, userId?: number): Promise<void> {
    await this.trackEvent({
      event_type: 'page_view',
      page_path: pagePath,
      session_id: sessionId,
      user_id: userId,
    });
    
    // Update page views summary
    const today = new Date().toISOString().split('T')[0];
    const query = `
      INSERT INTO page_views (page_path, view_date, view_count, unique_visitors)
      VALUES (?, ?, 1, 1)
      ON CONFLICT(page_path, view_date) DO UPDATE SET
        view_count = view_count + 1,
        unique_visitors = unique_visitors + (CASE WHEN ? IS NULL THEN 1 ELSE 0 END),
        updated_at = CURRENT_TIMESTAMP
    `;
    
    // Note: This assumes session tracking for unique visitors
    await executeQuery(query, [pagePath, today, sessionId]);
  }

  //gets analytics summary
  async getAnalyticsSummary(days = 30): Promise<{
    totalPageViews: number;
    uniqueVisitors: number;
    topPages: Array<{ page_path: string; view_count: number }>;
    dailyViews: Array<{ date: string; views: number }>;
  }> {
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);
    const dateFromStr = dateFrom.toISOString().split('T')[0];
    
    const queries = await Promise.all([
      // Total page views
      executeQuery<{ total: number }>(
        'SELECT COALESCE(SUM(view_count), 0) as total FROM page_views WHERE view_date >= ?',
        [dateFromStr]
      ),
      
      // Unique visitors
      executeQuery<{ total: number }>(
        'SELECT COALESCE(SUM(unique_visitors), 0) as total FROM page_views WHERE view_date >= ?',
        [dateFromStr]
      ),
      
      // Top pages
      executeQuery<{ page_path: string; view_count: number }>(
        `SELECT page_path, SUM(view_count) as view_count
         FROM page_views 
         WHERE view_date >= ?
         GROUP BY page_path
         ORDER BY view_count DESC
         LIMIT 10`,
        [dateFromStr]
      ),
      
      // Daily views
      executeQuery<{ date: string; views: number }>(
        `SELECT view_date as date, SUM(view_count) as views
         FROM page_views 
         WHERE view_date >= ?
         GROUP BY view_date
         ORDER BY view_date ASC`,
        [dateFromStr]
      ),
    ]);
    
    return {
      totalPageViews: Number(queries[0].rows[0]?.total || 0),
      uniqueVisitors: Number(queries[1].rows[0]?.total || 0),
      topPages: queries[2].rows,
      dailyViews: queries[3].rows,
    };
  }

  // =============================================================================
  // MEDIA MANAGEMENT
  // =============================================================================

  //creates media file record
  async createMediaFile(mediaData: Omit<MediaFile, 'id' | 'created_at' | 'updated_at'>): Promise<MediaFile> {
    const query = `
      INSERT INTO media_files (
        filename, original_filename, file_path, file_url, file_size,
        mime_type, file_type, width, height, duration, alt_text,
        caption, metadata, upload_user_id, is_public
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `;
    
    const params = [
      mediaData.filename,
      mediaData.original_filename,
      mediaData.url, // Using url as file_path for now
      mediaData.url,
      mediaData.file_size,
      mediaData.mime_type,
      mediaData.file_type,
      mediaData.width || null,
      mediaData.height || null,
      mediaData.duration || null,
      mediaData.alt_text || null,
      mediaData.caption || null,
      mediaData.metadata ? JSON.stringify(mediaData.metadata) : null,
      mediaData.uploaded_by,
      mediaData.is_public,
    ];

    const result = await executeQuery<MediaFile>(query, params);
    return result.rows[0];
  }

  //gets media files with pagination
  async getMediaFiles(options: QueryOptions & { fileType?: string } = {}): Promise<PaginatedResponse<MediaFile>> {
    const { page = 1, limit = 20, fileType, sortBy = 'created_at', sortOrder = 'DESC' } = options;
    const offset = (page - 1) * limit;
    
    let baseQuery = 'FROM media_files m';
    const conditions: string[] = ['m.is_public = TRUE'];
    const params: unknown[] = [];
    
    if (fileType) {
      conditions.push('m.file_type = ?');
      params.push(fileType);
    }
    
    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    
    // Count query
    const countQuery = `SELECT COUNT(*) as total ${baseQuery} ${whereClause}`;
    const countResult = await executeQuery<{ total: number }>(countQuery, params);
    const total = Number(countResult.rows[0].total);
    
    // Data query
    const dataQuery = `
      SELECT m.*
      ${baseQuery}
      ${whereClause}
      ORDER BY m.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;
    
    const dataResult = await executeQuery<MediaFile>(dataQuery, [...params, limit, offset]);
    
    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  // =============================================================================
  // SITE CONFIGURATION
  // =============================================================================

  //gets site setting by key
  async getSiteSetting(key: string): Promise<SiteSetting | null> {
    const query = 'SELECT * FROM site_settings WHERE key = ? LIMIT 1';
    const result = await executeQuery<SiteSetting>(query, [key]);
    return result.rows[0] || null;
  }

  //gets all public site settings
  async getPublicSiteSettings(): Promise<Record<string, unknown>> {
    const query = 'SELECT key, value, data_type FROM site_settings WHERE is_public = TRUE';
    const result = await executeQuery<{ key: string; value: string; data_type: string }>(query);
    
    const settings: Record<string, unknown> = {};
    for (const row of result.rows) {
      settings[row.key] = this.parseSettingValue(row.value, row.data_type);
    }
    
    return settings;
  }

  //updates site setting
  async updateSiteSetting(key: string, value: unknown): Promise<void> {
    const query = `
      UPDATE site_settings 
      SET value = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE key = ?
    `;
    
    await executeQuery(query, [String(value), key]);
  }

  //parses setting value based on data type
  private parseSettingValue(value: string, dataType: string): unknown {
    if (!value) return null;
    
    switch (dataType) {
      case 'boolean':
        return value.toLowerCase() === 'true';
      case 'integer':
        return parseInt(value, 10);
      case 'float':
        return parseFloat(value);
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  // =============================================================================
  // ADMIN DASHBOARD QUERIES
  // =============================================================================

  //gets comprehensive dashboard statistics
  async getDashboardStats(): Promise<{
    blog: {
      totalPosts: number;
      publishedPosts: number;
      draftPosts: number;
      totalViews: number;
      categories: number;
      tags: number;
    };
    portfolio: {
      totalProjects: number;
      activeProjects: number;
      completedProjects: number;
      totalViews: number;
      categories: number;
      technologies: number;
    };
    flights: {
      totalFlights: number;
      totalDistance: number;
      totalDuration: number;
      uniqueAirports: number;
      thisYearFlights: number;
    };
    analytics: {
      totalPageViews: number;
      uniqueVisitors: number;
      thisWeekViews: number;
      topPageToday: string | null;
    };
    system: {
      totalUsers: number;
      activeSessions: number;
      mediaFiles: number;
      databaseSize: number;
    };
  }> {
    const queries = await Promise.all([
      // Blog stats
      executeQuery<{ total: number; published: number; draft: number; views: number }>(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
          SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
          COALESCE(SUM(view_count), 0) as views
         FROM blog_posts`
      ),
      executeQuery<{ categories: number; tags: number }>(
        `SELECT 
          (SELECT COUNT(*) FROM blog_categories WHERE is_active = TRUE) as categories,
          (SELECT COUNT(*) FROM blog_tags WHERE post_count > 0) as tags`
      ),
      
      // Portfolio stats
      executeQuery<{ total: number; active: number; completed: number; views: number }>(
        `SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          COALESCE(SUM(view_count), 0) as views
         FROM portfolio_projects`
      ),
      executeQuery<{ categories: number; technologies: number }>(
        `SELECT 
          (SELECT COUNT(*) FROM project_categories WHERE is_active = TRUE) as categories,
          (SELECT COUNT(*) FROM project_technologies WHERE is_active = TRUE) as technologies`
      ),
      
      // Flight stats
      executeQuery<{ total: number; distance: number; duration: number; airports: number; thisYear: number }>(
        `SELECT 
          COUNT(*) as total,
          COALESCE(SUM(distance_km), 0) as distance,
          COALESCE(SUM(flight_duration), 0) as duration,
          (SELECT COUNT(DISTINCT airport_id) FROM (
            SELECT departure_airport_id as airport_id FROM flights
            UNION SELECT arrival_airport_id as airport_id FROM flights
          )) as airports,
          SUM(CASE WHEN strftime('%Y', departure_time) = strftime('%Y', 'now') THEN 1 ELSE 0 END) as thisYear
         FROM flights`
      ),
      
      // Analytics stats
      executeQuery<{ totalViews: number; uniqueVisitors: number; weekViews: number }>(
        `SELECT 
          COALESCE(SUM(view_count), 0) as totalViews,
          COALESCE(SUM(unique_visitors), 0) as uniqueVisitors,
          COALESCE(SUM(CASE WHEN view_date >= date('now', '-7 days') THEN view_count ELSE 0 END), 0) as weekViews
         FROM page_views`
      ),
      executeQuery<{ page: string }>(
        `SELECT page_path as page FROM page_views 
         WHERE view_date = date('now')
         ORDER BY view_count DESC
         LIMIT 1`
      ),
      
      // System stats
      executeQuery<{ users: number; sessions: number; media: number }>(
        `SELECT 
          (SELECT COUNT(*) FROM users WHERE is_active = TRUE) as users,
          (SELECT COUNT(*) FROM user_sessions WHERE expires_at > datetime('now')) as sessions,
          (SELECT COUNT(*) FROM media_files) as media`
      ),
      executeQuery<{ size: number }>(
        'SELECT page_count * 4096 as size FROM pragma_page_count()'
      ),
    ]);
    
    return {
      blog: {
        totalPosts: Number(queries[0].rows[0]?.total || 0),
        publishedPosts: Number(queries[0].rows[0]?.published || 0),
        draftPosts: Number(queries[0].rows[0]?.draft || 0),
        totalViews: Number(queries[0].rows[0]?.views || 0),
        categories: Number(queries[1].rows[0]?.categories || 0),
        tags: Number(queries[1].rows[0]?.tags || 0),
      },
      portfolio: {
        totalProjects: Number(queries[2].rows[0]?.total || 0),
        activeProjects: Number(queries[2].rows[0]?.active || 0),
        completedProjects: Number(queries[2].rows[0]?.completed || 0),
        totalViews: Number(queries[2].rows[0]?.views || 0),
        categories: Number(queries[3].rows[0]?.categories || 0),
        technologies: Number(queries[3].rows[0]?.technologies || 0),
      },
      flights: {
        totalFlights: Number(queries[4].rows[0]?.total || 0),
        totalDistance: Number(queries[4].rows[0]?.distance || 0),
        totalDuration: Number(queries[4].rows[0]?.duration || 0),
        uniqueAirports: Number(queries[4].rows[0]?.airports || 0),
        thisYearFlights: Number(queries[4].rows[0]?.thisYear || 0),
      },
      analytics: {
        totalPageViews: Number(queries[5].rows[0]?.totalViews || 0),
        uniqueVisitors: Number(queries[5].rows[0]?.uniqueVisitors || 0),
        thisWeekViews: Number(queries[5].rows[0]?.weekViews || 0),
        topPageToday: queries[6].rows[0]?.page || null,
      },
      system: {
        totalUsers: Number(queries[7].rows[0]?.users || 0),
        activeSessions: Number(queries[7].rows[0]?.sessions || 0),
        mediaFiles: Number(queries[7].rows[0]?.media || 0),
        databaseSize: Number(queries[8].rows[0]?.size || 0),
      },
    };
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  //calculates reading time for blog posts
  private calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  //counts words in content
  private countWords(content: string): number {
    return content.trim().split(/\s+/).length;
  }

  //full-text search across blog and portfolio
  async globalSearch(query: string, limit = 20): Promise<{
    blogPosts: BlogPost[];
    portfolioProjects: PortfolioProject[];
  }> {
    const [blogResults, portfolioResults] = await Promise.all([
      this.searchBlogPosts({ query, limit: Math.ceil(limit / 2) }),
      this.searchPortfolioProjects({ query, limit: Math.ceil(limit / 2) }),
    ]);
    
    return {
      blogPosts: blogResults.data,
      portfolioProjects: portfolioResults.data,
    };
  }

  //gets content suggestions for autocomplete
  async getContentSuggestions(query: string, type: 'blog' | 'portfolio' | 'all' = 'all'): Promise<string[]> {
    const suggestions: Set<string> = new Set();
    
    if (type === 'blog' || type === 'all') {
      const blogQuery = `
        SELECT title FROM blog_posts 
        WHERE title LIKE ? AND status = 'published'
        LIMIT 10
      `;
      const blogResults = await executeQuery<{ title: string }>(blogQuery, [`%${query}%`]);
      blogResults.rows.forEach(row => suggestions.add(row.title));
    }
    
    if (type === 'portfolio' || type === 'all') {
      const portfolioQuery = `
        SELECT title FROM portfolio_projects 
        WHERE title LIKE ? AND status = 'active'
        LIMIT 10
      `;
      const portfolioResults = await executeQuery<{ title: string }>(portfolioQuery, [`%${query}%`]);
      portfolioResults.rows.forEach(row => suggestions.add(row.title));
    }
    
    return Array.from(suggestions).slice(0, 10);
  }

  // =============================================================================
  // ANALYTICS & TRACKING METHODS
  // =============================================================================

  //logs analytics events
  async logAnalyticsEvent(eventData: {
    event_type: string;
    entity_type?: string;
    entity_id?: number;
    page_path?: string;
    page_title?: string;
    referrer?: string;
    user_agent?: string;
    ip_address?: string;
    session_id?: string;
    user_id?: number;
    metadata?: any;
  }): Promise<void> {
    const query = `
      INSERT INTO analytics_events (
        event_type, entity_type, entity_id, page_path, page_title,
        referrer, user_agent, ip_address, session_id, user_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      eventData.event_type,
      eventData.entity_type || null,
      eventData.entity_id || null,
      eventData.page_path || null,
      eventData.page_title || null,
      eventData.referrer || null,
      eventData.user_agent || null,
      eventData.ip_address || null,
      eventData.session_id || null,
      eventData.user_id || null,
      eventData.metadata ? JSON.stringify(eventData.metadata) : null
    ];
    
    await executeQuery(query, params);
  }

  //increments project view count
  async incrementProjectViews(projectId: number): Promise<void> {
    const query = `
      UPDATE portfolio_projects 
      SET view_count = view_count + 1 
      WHERE id = ?
    `;
    await executeQuery(query, [projectId]);
  }

  //gets analytics dashboard data
  async getAnalyticsDashboard(
    startDate: string,
    endDate: string
  ): Promise<{
    overview: {
      totalProjectViews: number;
      uniqueProjectsViewed: number;
      totalPageViews: number;
      totalSkillInteractions: number;
    };
    topProjects: Array<{
      id: number;
      title: string;
      slug: string;
      total_views: number;
      period_views: number;
    }>;
    dailyViews: Record<string, { project_views: number; page_views: number; total: number }>;
  }> {
    const [
      totalProjectViews,
      uniqueProjects,
      totalPageViews,
      skillInteractions,
      topProjects,
      dailyViews
    ] = await Promise.all([
      // Total project views in period
      executeQuery<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM analytics_events 
        WHERE event_type = 'project_view' 
        AND created_at BETWEEN ? AND ?
      `, [startDate, endDate]),

      // Unique projects viewed
      executeQuery<{ count: number }>(`
        SELECT COUNT(DISTINCT entity_id) as count
        FROM analytics_events 
        WHERE event_type = 'project_view' 
        AND entity_id IS NOT NULL
        AND created_at BETWEEN ? AND ?
      `, [startDate, endDate]),

      // Total page views
      executeQuery<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM analytics_events 
        WHERE event_type = 'page_view'
        AND created_at BETWEEN ? AND ?
      `, [startDate, endDate]),

      // Skill interactions
      executeQuery<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM analytics_events 
        WHERE event_type = 'skill_interaction'
        AND created_at BETWEEN ? AND ?
      `, [startDate, endDate]),

      // Top projects by views
      executeQuery<{
        id: number;
        title: string;
        slug: string;
        total_views: number;
        period_views: number;
      }>(`
        SELECT 
          p.id,
          p.title,
          p.slug,
          p.view_count as total_views,
          COUNT(ae.id) as period_views
        FROM portfolio_projects p
        LEFT JOIN analytics_events ae ON ae.entity_id = p.id 
          AND ae.event_type = 'project_view'
          AND ae.created_at BETWEEN ? AND ?
        GROUP BY p.id, p.title, p.slug, p.view_count
        ORDER BY period_views DESC, total_views DESC
        LIMIT 10
      `, [startDate, endDate]),

      // Daily views breakdown
      executeQuery<{
        date: string;
        event_type: string;
        count: number;
      }>(`
        SELECT 
          DATE(created_at) as date,
          event_type,
          COUNT(*) as count
        FROM analytics_events
        WHERE created_at BETWEEN ? AND ?
        AND event_type IN ('project_view', 'page_view')
        GROUP BY DATE(created_at), event_type
        ORDER BY date DESC
      `, [startDate, endDate])
    ]);

    // Process daily views
    const processedDailyViews: Record<string, any> = {};
    dailyViews.rows.forEach(view => {
      if (!processedDailyViews[view.date]) {
        processedDailyViews[view.date] = {
          project_views: 0,
          page_views: 0,
          total: 0
        };
      }
      
      if (view.event_type === 'project_view') {
        processedDailyViews[view.date].project_views = view.count;
      } else if (view.event_type === 'page_view') {
        processedDailyViews[view.date].page_views = view.count;
      }
      
      processedDailyViews[view.date].total += view.count;
    });

    return {
      overview: {
        totalProjectViews: totalProjectViews.rows[0]?.count || 0,
        uniqueProjectsViewed: uniqueProjects.rows[0]?.count || 0,
        totalPageViews: totalPageViews.rows[0]?.count || 0,
        totalSkillInteractions: skillInteractions.rows[0]?.count || 0
      },
      topProjects: topProjects.rows,
      dailyViews: processedDailyViews
    };
  }

  //gets popular content analytics
  async getPopularContent(
    days = 30,
    limit = 10
  ): Promise<{
    projects: Array<{
      id: number;
      title: string;
      slug: string;
      views: number;
    }>;
    pages: Array<{
      path: string;
      views: number;
    }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [projects, pages] = await Promise.all([
      executeQuery<{
        id: number;
        title: string;
        slug: string;
        views: number;
      }>(`
        SELECT 
          p.id,
          p.title,
          p.slug,
          COUNT(ae.id) as views
        FROM portfolio_projects p
        LEFT JOIN analytics_events ae ON ae.entity_id = p.id 
          AND ae.event_type = 'project_view'
          AND ae.created_at >= ?
        GROUP BY p.id, p.title, p.slug
        HAVING views > 0
        ORDER BY views DESC
        LIMIT ?
      `, [startDate.toISOString(), limit]),

      executeQuery<{
        path: string;
        views: number;
      }>(`
        SELECT 
          page_path as path,
          COUNT(*) as views
        FROM analytics_events
        WHERE event_type = 'page_view'
        AND created_at >= ?
        AND page_path IS NOT NULL
        GROUP BY page_path
        ORDER BY views DESC
        LIMIT ?
      `, [startDate.toISOString(), limit])
    ]);

    return {
      projects: projects.rows,
      pages: pages.rows
    };
  }

  //gets traffic sources analytics
  async getTrafficSources(
    days = 30
  ): Promise<{
    direct: number;
    search: number;
    social: number;
    referral: number;
    details: Array<{ referrer: string; count: number }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const query = `
      SELECT 
        metadata,
        COUNT(*) as count
      FROM analytics_events
      WHERE event_type IN ('project_view', 'page_view')
      AND created_at >= ?
      AND metadata IS NOT NULL
      GROUP BY metadata
      ORDER BY count DESC
    `;

    const results = await executeQuery<{
      metadata: string;
      count: number;
    }>(query, [startDate.toISOString()]);

    const trafficSources = {
      direct: 0,
      search: 0,
      social: 0,
      referral: 0,
      details: [] as Array<{ referrer: string; count: number }>
    };

    results.rows.forEach(row => {
      let metadata;
      try {
        metadata = JSON.parse(row.metadata);
      } catch {
        return;
      }

      if (!metadata.referrer) {
        trafficSources.direct += row.count;
      } else if (metadata.referrer.includes('google') || metadata.referrer.includes('bing')) {
        trafficSources.search += row.count;
      } else if (metadata.referrer.includes('twitter') || metadata.referrer.includes('linkedin')) {
        trafficSources.social += row.count;
      } else {
        trafficSources.referral += row.count;
      }

      trafficSources.details.push({
        referrer: metadata.referrer || 'Direct',
        count: row.count
      });
    });

    return trafficSources;
  }
}

// Export singleton instance
export const db = new DatabaseQueries();
export default db;