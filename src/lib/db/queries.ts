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
  // FLIGHT TRACKING SYSTEM
  // =============================================================================

  //creates a new flight record
  async createFlight(flightData: FlightForm): Promise<Flight> {
    // Calculate flight duration and distance
    const duration = this.calculateFlightDuration(flightData.departure_time, flightData.arrival_time);
    const distance = await this.calculateFlightDistance(flightData.departure_airport_id, flightData.arrival_airport_id);
    
    const query = `
      INSERT INTO flights (
        flight_number, airline_code, airline_name, aircraft_type,
        departure_airport_id, arrival_airport_id, departure_time, arrival_time,
        flight_duration, distance_km, seat_number, class, booking_reference,
        ticket_price, currency, notes, photos, trip_purpose, is_favorite
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    ];

    const result = await executeQuery<Flight>(query, params);
    return result.rows[0];
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

  //gets flight statistics
  async getFlightStatistics(): Promise<{
    totalFlights: number;
    totalDistance: number;
    totalDuration: number;
    uniqueAirports: number;
    uniqueCountries: number;
    favoriteAirline: string | null;
    mostVisitedAirport: string | null;
  }> {
    const queries = await Promise.all([
      executeQuery<{ count: number }>('SELECT COUNT(*) as count FROM flights'),
      executeQuery<{ total: number }>('SELECT COALESCE(SUM(distance_km), 0) as total FROM flights WHERE distance_km IS NOT NULL'),
      executeQuery<{ total: number }>('SELECT COALESCE(SUM(flight_duration), 0) as total FROM flights WHERE flight_duration IS NOT NULL'),
      executeQuery<{ count: number }>(`
        SELECT COUNT(DISTINCT airport_id) as count FROM (
          SELECT departure_airport_id as airport_id FROM flights
          UNION
          SELECT arrival_airport_id as airport_id FROM flights
        )
      `),
      executeQuery<{ count: number }>(`
        SELECT COUNT(DISTINCT a.country) as count FROM airports a
        WHERE a.id IN (
          SELECT departure_airport_id FROM flights
          UNION
          SELECT arrival_airport_id FROM flights
        )
      `),
      executeQuery<{ airline: string }>(`
        SELECT airline_name as airline FROM flights
        WHERE airline_name IS NOT NULL
        GROUP BY airline_name
        ORDER BY COUNT(*) DESC
        LIMIT 1
      `),
      executeQuery<{ airport: string }>(`
        SELECT a.name as airport FROM airports a
        WHERE a.id IN (
          SELECT airport_id FROM (
            SELECT departure_airport_id as airport_id FROM flights
            UNION ALL
            SELECT arrival_airport_id as airport_id FROM flights
          ) GROUP BY airport_id
          ORDER BY COUNT(*) DESC
          LIMIT 1
        )
      `),
    ]);
    
    return {
      totalFlights: Number(queries[0].rows[0]?.count || 0),
      totalDistance: Number(queries[1].rows[0]?.total || 0),
      totalDuration: Number(queries[2].rows[0]?.total || 0),
      uniqueAirports: Number(queries[3].rows[0]?.count || 0),
      uniqueCountries: Number(queries[4].rows[0]?.count || 0),
      favoriteAirline: queries[5].rows[0]?.airline || null,
      mostVisitedAirport: queries[6].rows[0]?.airport || null,
    };
  }

  //gets all airports
  async getAirports(query?: string, limit = 100): Promise<Airport[]> {
    let sql = 'SELECT * FROM airports WHERE is_active = TRUE';
    const params: unknown[] = [];
    
    if (query) {
      sql += ' AND (name LIKE ? OR city LIKE ? OR iata_code LIKE ? OR country LIKE ?)';
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    sql += ' ORDER BY name ASC LIMIT ?';
    params.push(limit);
    
    const result = await executeQuery<Airport>(sql, params);
    return result.rows;
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
}

// Export singleton instance
export const db = new DatabaseQueries();
export default db;