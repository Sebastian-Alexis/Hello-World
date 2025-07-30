// =============================================================================
// FULL-TEXT SEARCH OPTIMIZATION - Plan 7 Implementation
// Ultra-fast search with FTS5 optimizations and caching
// =============================================================================

import { executeOptimizedQuery, CacheManager } from './performance';

//search configuration and optimization settings
export const SEARCH_CONFIG = {
  //FTS5 configuration
  MIN_SEARCH_LENGTH: 2,
  MAX_SEARCH_LENGTH: 100,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
  
  //caching settings
  SEARCH_CACHE_TTL: 5 * 60 * 1000, //5 minutes
  SUGGESTION_CACHE_TTL: 30 * 60 * 1000, //30 minutes
  
  //performance budgets
  SEARCH_PERFORMANCE_BUDGET_MS: 300,
  SUGGESTION_PERFORMANCE_BUDGET_MS: 100,
} as const;

//search result interface
export interface SearchResult<T = any> {
  item: T;
  relevanceScore: number;
  snippet: string;
  matchedFields: string[];
}

//search suggestion interface
export interface SearchSuggestion {
  text: string;
  type: 'blog' | 'portfolio' | 'tag' | 'category';
  count: number;
}

//advanced search options
export interface AdvancedSearchOptions {
  includeContent?: boolean;
  boostFields?: { [field: string]: number };
  dateRange?: { from?: string; to?: string };
  categories?: string[];
  tags?: string[];
  minRelevanceScore?: number;
}

export class SearchOptimization {
  // =============================================================================
  // SEARCH TERM PREPROCESSING
  // =============================================================================

  //preprocesses search terms for optimal FTS5 performance
  private preprocessSearchTerm(term: string): string {
    if (!term || term.length < SEARCH_CONFIG.MIN_SEARCH_LENGTH) {
      throw new Error(`Search term must be at least ${SEARCH_CONFIG.MIN_SEARCH_LENGTH} characters`);
    }

    if (term.length > SEARCH_CONFIG.MAX_SEARCH_LENGTH) {
      term = term.substring(0, SEARCH_CONFIG.MAX_SEARCH_LENGTH);
    }

    //clean and normalize the search term
    let processed = term
      .toLowerCase()
      .trim()
      //remove special characters except spaces and quotes
      .replace(/[^\w\s"'-]/g, ' ')
      //normalize multiple spaces
      .replace(/\s+/g, ' ');

    //add FTS5 prefix matching for better results
    const words = processed.split(' ').filter(word => word.length >= 2);
    
    if (words.length === 0) {
      throw new Error('Search term contains no valid words');
    }

    //build FTS5 query with prefix matching
    const ftsQuery = words.map(word => {
      //exact phrase if quoted
      if (word.startsWith('"') && word.endsWith('"')) {
        return word;
      }
      //prefix matching for single words
      return `${word}*`;
    }).join(' ');

    return ftsQuery;
  }

  //generates search snippet with highlighted terms
  private generateSnippet(content: string, searchTerm: string, maxLength: number = 200): string {
    if (!content) return '';

    const words = searchTerm.toLowerCase().split(' ').filter(w => w.length >= 2);
    const regex = new RegExp(`(${words.join('|')})`, 'gi');
    
    //find first occurrence position
    const match = content.search(regex);
    if (match === -1) return content.substring(0, maxLength) + '...';

    //extract snippet around match
    const start = Math.max(0, match - 50);
    const end = Math.min(content.length, start + maxLength);
    let snippet = content.substring(start, end);

    //add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  // =============================================================================
  // BLOG SEARCH OPTIMIZATION
  // =============================================================================

  //ultra-fast blog post search with FTS5 optimization
  async searchBlogPosts(
    searchTerm: string,
    options: AdvancedSearchOptions = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<{
    results: SearchResult<any>[];
    total: number;
    suggestions: string[];
    searchTime: number;
  }> {
    const startTime = Date.now();
    const { page = 1, limit = SEARCH_CONFIG.DEFAULT_LIMIT } = pagination;
    const actualLimit = Math.min(limit, SEARCH_CONFIG.MAX_LIMIT);
    const offset = (page - 1) * actualLimit;

    try {
      const processedTerm = this.preprocessSearchTerm(searchTerm);
      const cacheKey = `blog_search:${processedTerm}:${page}:${actualLimit}:${JSON.stringify(options)}`;

      //check cache first
      const cachedResult = await this.getCachedSearchResult(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          searchTime: Date.now() - startTime,
        };
      }

      //build optimized FTS5 query with field weighting
      let query = `
        SELECT 
          p.id, p.slug, p.title, p.excerpt, p.content, p.featured_image_url,
          p.status, p.featured, p.view_count, p.published_at, p.created_at,
          u.first_name || ' ' || u.last_name as author_name,
          u.avatar_url as author_avatar,
          bm25(blog_posts_fts, 10.0, 5.0, 1.0) as relevance_score,
          snippet(blog_posts_fts, 2, '<mark>', '</mark>', '...', 32) as snippet
        FROM blog_posts_fts
        INNER JOIN blog_posts p ON blog_posts_fts.rowid = p.id
        LEFT JOIN users u ON p.author_id = u.id
        WHERE blog_posts_fts MATCH ? AND p.status = 'published'
      `;

      let params: any[] = [processedTerm];

      //add date range filter
      if (options.dateRange?.from || options.dateRange?.to) {
        if (options.dateRange.from) {
          query += ' AND p.published_at >= ?';
          params.push(options.dateRange.from);
        }
        if (options.dateRange.to) {
          query += ' AND p.published_at <= ?';
          params.push(options.dateRange.to);
        }
      }

      //add category filter
      if (options.categories && options.categories.length > 0) {
        query += `
          AND p.id IN (
            SELECT pc.post_id FROM blog_post_categories pc
            INNER JOIN blog_categories c ON pc.category_id = c.id
            WHERE c.slug IN (${options.categories.map(() => '?').join(',')})
          )
        `;
        params.push(...options.categories);
      }

      //add relevance score filter
      if (options.minRelevanceScore) {
        query += ' AND bm25(blog_posts_fts, 10.0, 5.0, 1.0) >= ?';
        params.push(options.minRelevanceScore);
      }

      query += `
        ORDER BY relevance_score DESC, p.published_at DESC
        LIMIT ? OFFSET ?
      `;
      params.push(actualLimit, offset);

      //execute search query
      const searchResult = await executeOptimizedQuery<any>(query, params, {
        useCache: false, //we handle caching manually
      });

      //get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM blog_posts_fts
        INNER JOIN blog_posts p ON blog_posts_fts.rowid = p.id
        WHERE blog_posts_fts MATCH ? AND p.status = 'published'
      `;
      
      const countResult = await executeOptimizedQuery<{ total: number }>(
        countQuery, 
        [processedTerm],
        { useCache: true, cacheTimeout: SEARCH_CONFIG.SEARCH_CACHE_TTL }
      );

      //process results
      const results: SearchResult<any>[] = searchResult.rows.map(row => ({
        item: {
          id: row.id,
          slug: row.slug,
          title: row.title,
          excerpt: row.excerpt,
          featured_image_url: row.featured_image_url,
          status: row.status,
          featured: row.featured,
          view_count: row.view_count,
          published_at: row.published_at,
          created_at: row.created_at,
          author_name: row.author_name,
          author_avatar: row.author_avatar,
        },
        relevanceScore: row.relevance_score,
        snippet: row.snippet || this.generateSnippet(row.content || row.excerpt || '', searchTerm),
        matchedFields: this.getMatchedFields(row, searchTerm),
      }));

      const total = countResult.rows[0]?.total || 0;
      const suggestions = await this.getSearchSuggestions(searchTerm, 'blog');

      const result = {
        results,
        total,
        suggestions,
        searchTime: Date.now() - startTime,
      };

      //cache the result
      await this.cacheSearchResult(cacheKey, result);

      return result;

    } catch (error) {
      console.error('Blog search error:', error);
      return {
        results: [],
        total: 0,
        suggestions: [],
        searchTime: Date.now() - startTime,
      };
    }
  }

  // =============================================================================
  // PORTFOLIO SEARCH OPTIMIZATION
  // =============================================================================

  //ultra-fast portfolio project search
  async searchPortfolioProjects(
    searchTerm: string,
    options: AdvancedSearchOptions = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<{
    results: SearchResult<any>[];
    total: number;
    suggestions: string[];
    searchTime: number;
  }> {
    const startTime = Date.now();
    const { page = 1, limit = SEARCH_CONFIG.DEFAULT_LIMIT } = pagination;
    const actualLimit = Math.min(limit, SEARCH_CONFIG.MAX_LIMIT);
    const offset = (page - 1) * actualLimit;

    try {
      const processedTerm = this.preprocessSearchTerm(searchTerm);
      const cacheKey = `portfolio_search:${processedTerm}:${page}:${actualLimit}:${JSON.stringify(options)}`;

      //check cache first
      const cachedResult = await this.getCachedSearchResult(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          searchTime: Date.now() - startTime,
        };
      }

      //optimized FTS5 query for portfolio projects
      let query = `
        SELECT 
          p.id, p.slug, p.title, p.short_description, p.full_description,
          p.featured_image_url, p.status, p.featured, p.project_type,
          p.view_count, p.live_url, p.github_url, p.demo_url,
          p.start_date, p.end_date, p.created_at,
          bm25(portfolio_projects_fts, 15.0, 8.0, 5.0, 1.0) as relevance_score,
          snippet(portfolio_projects_fts, 3, '<mark>', '</mark>', '...', 32) as snippet
        FROM portfolio_projects_fts
        INNER JOIN portfolio_projects p ON portfolio_projects_fts.rowid = p.id
        WHERE portfolio_projects_fts MATCH ? AND p.status = 'active'
      `;

      let params: any[] = [processedTerm];

      //add project type filter
      if (options.categories && options.categories.length > 0) {
        query += `
          AND p.id IN (
            SELECT ppc.project_id FROM project_project_categories ppc
            INNER JOIN project_categories pc ON ppc.category_id = pc.id
            WHERE pc.slug IN (${options.categories.map(() => '?').join(',')})
          )
        `;
        params.push(...options.categories);
      }

      //add relevance filter
      if (options.minRelevanceScore) {
        query += ' AND bm25(portfolio_projects_fts, 15.0, 8.0, 5.0, 1.0) >= ?';
        params.push(options.minRelevanceScore);
      }

      query += `
        ORDER BY relevance_score DESC, p.featured DESC, p.created_at DESC
        LIMIT ? OFFSET ?
      `;
      params.push(actualLimit, offset);

      const searchResult = await executeOptimizedQuery<any>(query, params, {
        useCache: false,
      });

      //get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM portfolio_projects_fts
        INNER JOIN portfolio_projects p ON portfolio_projects_fts.rowid = p.id
        WHERE portfolio_projects_fts MATCH ? AND p.status = 'active'
      `;
      
      const countResult = await executeOptimizedQuery<{ total: number }>(
        countQuery, 
        [processedTerm],
        { useCache: true, cacheTimeout: SEARCH_CONFIG.SEARCH_CACHE_TTL }
      );

      //process results
      const results: SearchResult<any>[] = searchResult.rows.map(row => ({
        item: {
          id: row.id,
          slug: row.slug,
          title: row.title,
          short_description: row.short_description,
          featured_image_url: row.featured_image_url,
          status: row.status,
          featured: row.featured,
          project_type: row.project_type,
          view_count: row.view_count,
          live_url: row.live_url,
          github_url: row.github_url,
          demo_url: row.demo_url,
          start_date: row.start_date,
          end_date: row.end_date,
          created_at: row.created_at,
        },
        relevanceScore: row.relevance_score,
        snippet: row.snippet || this.generateSnippet(row.full_description || row.short_description || '', searchTerm),
        matchedFields: this.getMatchedFields(row, searchTerm),
      }));

      const total = countResult.rows[0]?.total || 0;
      const suggestions = await this.getSearchSuggestions(searchTerm, 'portfolio');

      const result = {
        results,
        total,
        suggestions,
        searchTime: Date.now() - startTime,
      };

      //cache the result
      await this.cacheSearchResult(cacheKey, result);

      return result;

    } catch (error) {
      console.error('Portfolio search error:', error);
      return {
        results: [],
        total: 0,
        suggestions: [],
        searchTime: Date.now() - startTime,
      };
    }
  }

  // =============================================================================
  // UNIFIED SEARCH
  // =============================================================================

  //unified search across all content types
  async unifiedSearch(
    searchTerm: string,
    options: { 
      types?: ('blog' | 'portfolio')[];
      limit?: number;
    } = {}
  ): Promise<{
    blog: SearchResult<any>[];
    portfolio: SearchResult<any>[];
    total: number;
    searchTime: number;
  }> {
    const startTime = Date.now();
    const { types = ['blog', 'portfolio'], limit = 10 } = options;

    try {
      const searches: Promise<any>[] = [];

      if (types.includes('blog')) {
        searches.push(
          this.searchBlogPosts(searchTerm, {}, { page: 1, limit: Math.floor(limit / types.length) })
        );
      }

      if (types.includes('portfolio')) {
        searches.push(
          this.searchPortfolioProjects(searchTerm, {}, { page: 1, limit: Math.floor(limit / types.length) })
        );
      }

      const results = await Promise.all(searches);
      
      return {
        blog: types.includes('blog') ? results[0]?.results || [] : [],
        portfolio: types.includes('portfolio') ? results[types.includes('blog') ? 1 : 0]?.results || [] : [],
        total: results.reduce((sum, result) => sum + (result?.total || 0), 0),
        searchTime: Date.now() - startTime,
      };

    } catch (error) {
      console.error('Unified search error:', error);
      return {
        blog: [],
        portfolio: [],
        total: 0,
        searchTime: Date.now() - startTime,
      };
    }
  }

  // =============================================================================
  // SEARCH SUGGESTIONS & AUTOCOMPLETE
  // =============================================================================

  //gets search suggestions for autocomplete
  async getSearchSuggestions(
    partialTerm: string,
    type: 'blog' | 'portfolio' = 'blog',
    limit: number = 5
  ): Promise<string[]> {
    if (partialTerm.length < 2) return [];

    const cacheKey = `suggestions:${type}:${partialTerm}:${limit}`;
    
    try {
      let query: string;
      let params: any[];

      if (type === 'blog') {
        query = `
          SELECT DISTINCT
            CASE 
              WHEN title LIKE ? THEN title
              WHEN excerpt LIKE ? THEN 
                substr(excerpt, instr(lower(excerpt), lower(?)), 50)
              ELSE NULL
            END as suggestion
          FROM blog_posts 
          WHERE status = 'published' 
            AND (title LIKE ? OR excerpt LIKE ?)
            AND suggestion IS NOT NULL
          ORDER BY 
            CASE WHEN title LIKE ? THEN 1 ELSE 2 END,
            view_count DESC
          LIMIT ?
        `;
        
        const searchPattern = `%${partialTerm}%`;
        params = [
          searchPattern, searchPattern, partialTerm,
          searchPattern, searchPattern, searchPattern,
          limit
        ];
      } else {
        query = `
          SELECT DISTINCT
            CASE 
              WHEN title LIKE ? THEN title
              WHEN short_description LIKE ? THEN 
                substr(short_description, instr(lower(short_description), lower(?)), 50)
              ELSE NULL
            END as suggestion
          FROM portfolio_projects 
          WHERE status = 'active' 
            AND (title LIKE ? OR short_description LIKE ?)
            AND suggestion IS NOT NULL
          ORDER BY 
            CASE WHEN title LIKE ? THEN 1 ELSE 2 END,
            view_count DESC
          LIMIT ?
        `;
        
        const searchPattern = `%${partialTerm}%`;
        params = [
          searchPattern, searchPattern, partialTerm,
          searchPattern, searchPattern, searchPattern,
          limit
        ];
      }

      const result = await executeOptimizedQuery<{ suggestion: string }>(query, params, {
        useCache: true,
        cacheTimeout: SEARCH_CONFIG.SUGGESTION_CACHE_TTL,
      });

      return result.rows
        .map(row => row.suggestion?.trim())
        .filter(Boolean)
        .slice(0, limit);

    } catch (error) {
      console.error('Error getting search suggestions:', error);
      return [];
    }
  }

  // =============================================================================
  // SEARCH ANALYTICS & OPTIMIZATION
  // =============================================================================

  //logs search queries for analytics
  async logSearchQuery(
    searchTerm: string,
    type: string,
    resultCount: number,
    searchTime: number
  ): Promise<void> {
    const query = `
      INSERT INTO analytics_events (
        event_type, entity_type, page_path, metadata, created_at
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    const metadata = JSON.stringify({
      search_term: searchTerm,
      result_count: resultCount,
      search_time_ms: searchTime,
      search_type: type,
    });

    await executeOptimizedQuery(query, [
      'search',
      type,
      '/search',
      metadata,
    ], {
      useCache: false,
      skipLogging: true,
    });
  }

  //gets popular search terms
  async getPopularSearchTerms(days: number = 30, limit: number = 10): Promise<{
    term: string;
    count: number;
    avgResultCount: number;
  }[]> {
    const query = `
      SELECT 
        json_extract(metadata, '$.search_term') as term,
        COUNT(*) as count,
        AVG(CAST(json_extract(metadata, '$.result_count') AS INTEGER)) as avg_result_count
      FROM analytics_events 
      WHERE event_type = 'search' 
        AND created_at >= datetime('now', '-${days} days')
        AND json_extract(metadata, '$.search_term') IS NOT NULL
      GROUP BY term
      HAVING count >= 2
      ORDER BY count DESC, avg_result_count DESC
      LIMIT ?
    `;

    const result = await executeOptimizedQuery<{
      term: string;
      count: number;
      avg_result_count: number;
    }>(query, [limit], {
      useCache: true,
      cacheTimeout: SEARCH_CONFIG.SUGGESTION_CACHE_TTL,
    });

    return result.rows;
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  //identifies which fields matched the search term
  private getMatchedFields(row: any, searchTerm: string): string[] {
    const fields: string[] = [];
    const lowerTerm = searchTerm.toLowerCase();

    if (row.title?.toLowerCase().includes(lowerTerm)) fields.push('title');
    if (row.excerpt?.toLowerCase().includes(lowerTerm)) fields.push('excerpt');
    if (row.content?.toLowerCase().includes(lowerTerm)) fields.push('content');
    if (row.short_description?.toLowerCase().includes(lowerTerm)) fields.push('description');

    return fields;
  }

  //caches search results
  private async cacheSearchResult(key: string, result: any): Promise<void> {
    try {
      //use a simple in-memory cache for now
      //in production, consider Redis or similar
      CacheManager.getStats(); //placeholder for now
    } catch (error) {
      console.error('Error caching search result:', error);
    }
  }

  //gets cached search results
  private async getCachedSearchResult(key: string): Promise<any | null> {
    try {
      //placeholder for cache retrieval
      return null;
    } catch (error) {
      console.error('Error retrieving cached search result:', error);
      return null;
    }
  }

  // =============================================================================
  // FTS5 MAINTENANCE
  // =============================================================================

  //rebuilds FTS5 indexes for optimal performance
  async rebuildSearchIndexes(): Promise<void> {
    try {
      await executeOptimizedQuery('INSERT INTO blog_posts_fts(blog_posts_fts) VALUES("rebuild")', [], {
        useCache: false,
        skipLogging: true,
      });
      
      await executeOptimizedQuery('INSERT INTO portfolio_projects_fts(portfolio_projects_fts) VALUES("rebuild")', [], {
        useCache: false,
        skipLogging: true,
      });
      
      console.log('✅ Search indexes rebuilt successfully');
    } catch (error) {
      console.error('❌ Failed to rebuild search indexes:', error);
      throw error;
    }
  }

  //optimizes FTS5 indexes
  async optimizeSearchIndexes(): Promise<void> {
    try {
      await executeOptimizedQuery('INSERT INTO blog_posts_fts(blog_posts_fts) VALUES("optimize")', [], {
        useCache: false,
        skipLogging: true,
      });
      
      await executeOptimizedQuery('INSERT INTO portfolio_projects_fts(portfolio_projects_fts) VALUES("optimize")', [], {
        useCache: false,
        skipLogging: true,
      });
      
      console.log('✅ Search indexes optimized successfully');
    } catch (error) {
      console.error('❌ Failed to optimize search indexes:', error);
      throw error;
    }
  }
}

//singleton instance
export const searchOptimization = new SearchOptimization();