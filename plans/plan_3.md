# Plan 3: Blog System Implementation

**Session Goal**: Implement complete blog system with content management, search, and categorization  
**Estimated Time**: 4-5 hours  
**Prerequisites**: Plan 1 & 2 completed (foundation and layout system)  

## Development Phase: Content Management System

### Todo List

#### 1. Blog Database Operations
- [ ] Implement all blog-related database queries in DatabaseQueries class
- [ ] Create blog post CRUD operations with transaction support
- [ ] Implement category and tag management systems  
- [ ] Set up full-text search with ranking and highlighting
- [ ] Create view counting and analytics integration
- [ ] Implement slug generation and validation
- [ ] Add reading time calculation utility
- [ ] Test all database operations thoroughly

#### 2. Blog Content Models & Validation
- [ ] Create Zod schemas for blog post validation
- [ ] Implement form validation for create/edit operations
- [ ] Set up image upload and optimization utilities
- [ ] Create markdown processing with syntax highlighting
- [ ] Implement content sanitization and security
- [ ] Add meta tag generation from content
- [ ] Create content preview/excerpt generation
- [ ] Test all validation scenarios

#### 3. Blog API Endpoints
- [ ] Create GET /api/blog for paginated blog listing
- [ ] Implement GET /api/blog/[slug] for individual posts
- [ ] Build POST/PUT/DELETE endpoints for admin operations
- [ ] Create GET /api/blog/search for full-text search
- [ ] Implement category and tag filtering endpoints
- [ ] Add related posts recommendation API
- [ ] Create RSS feed generation endpoint
- [ ] Test all API endpoints with various scenarios

#### 4. Blog Frontend Pages
- [ ] Build blog listing page with pagination
- [ ] Create individual blog post page with full content
- [ ] Implement category and tag listing pages
- [ ] Build search results page with highlighting
- [ ] Create blog archive page by date
- [ ] Add RSS feed link and metadata
- [ ] Implement social sharing functionality
- [ ] Test all pages across devices and browsers

#### 5. Blog Components
- [ ] Create BlogCard component for post previews
- [ ] Build BlogPost component for full article display
- [ ] Implement SearchBox component with live search
- [ ] Create CategoryTag component with color coding
- [ ] Build Pagination component with proper navigation
- [ ] Create RelatedPosts component with recommendations
- [ ] Implement ShareButtons component for social media
- [ ] Build CommentSection placeholder for future integration

#### 6. Content Management Features
- [ ] Implement markdown editor with live preview
- [ ] Create image upload with drag-and-drop
- [ ] Build category and tag management interface
- [ ] Add bulk operations for content management
- [ ] Implement content scheduling and publishing
- [ ] Create SEO optimization tools and previews
- [ ] Add content analytics dashboard
- [ ] Build import/export functionality for content

#### 7. Search & Discovery
- [ ] Implement client-side search with instant results
- [ ] Create search suggestions and autocomplete
- [ ] Add search filters (category, tag, date, author)
- [ ] Implement search result highlighting
- [ ] Create trending/popular posts section
- [ ] Add recent posts sidebar component
- [ ] Implement tag cloud visualization
- [ ] Build content recommendation system

#### 8. Performance Optimization
- [ ] Implement content caching strategies
- [ ] Set up image lazy loading and optimization
- [ ] Create pagination prefetching
- [ ] Implement search result caching
- [ ] Add compression for content delivery
- [ ] Set up CDN integration for images
- [ ] Implement code splitting for blog features
- [ ] Test and optimize Core Web Vitals

## Detailed Implementation Steps

### Step 1: Enhanced Database Queries (75 minutes)

**Extended Database Queries** (lib/db/queries.ts - Blog Section):
```typescript
// Add to existing DatabaseQueries class

// Get blog posts with advanced filtering and sorting
static async getBlogPosts(options: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  tag?: string;
  author?: number;
  featured?: boolean;
  sortBy?: 'date' | 'views' | 'title';
  sortOrder?: 'asc' | 'desc';
}): Promise<PaginatedResponse<BlogPost>> {
  const {
    page = 1,
    limit = 10,
    status = 'published',
    category,
    tag,
    author,
    featured,
    sortBy = 'date',
    sortOrder = 'desc'
  } = options;
  
  const offset = (page - 1) * limit;
  let whereClauses = ['bp.status = ?'];
  let params: any[] = [status];
  let joins = '';
  
  // Category filtering
  if (category) {
    joins += `
      JOIN blog_post_categories bpc ON bp.id = bpc.blog_post_id
      JOIN blog_categories bc ON bpc.category_id = bc.id
    `;
    whereClauses.push('bc.slug = ?');
    params.push(category);
  }
  
  // Tag filtering
  if (tag) {
    joins += `
      JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
      JOIN blog_tags bt ON bpt.tag_id = bt.id
    `;
    whereClauses.push('bt.slug = ?');
    params.push(tag);
  }
  
  // Author filtering
  if (author) {
    whereClauses.push('bp.author_id = ?');
    params.push(author);
  }
  
  // Featured filtering
  if (featured !== undefined) {
    whereClauses.push('bp.featured = ?');
    params.push(featured ? 1 : 0);
  }
  
  const whereClause = whereClauses.join(' AND ');
  
  // Sorting
  let orderClause = '';
  switch (sortBy) {
    case 'date':
      orderClause = `bp.published_at ${sortOrder.toUpperCase()}`;
      break;
    case 'views':
      orderClause = `bp.view_count ${sortOrder.toUpperCase()}`;
      break;
    case 'title':
      orderClause = `bp.title ${sortOrder.toUpperCase()}`;
      break;
    default:
      orderClause = `bp.published_at DESC`;
  }
  
  // Count query
  const countQuery = `
    SELECT COUNT(DISTINCT bp.id) as total
    FROM blog_posts bp
    ${joins}
    WHERE ${whereClause}
  `;
  
  const countResult = await db.execute({
    sql: countQuery,
    args: params
  });
  
  const total = countResult.rows[0]?.total as number || 0;
  const totalPages = Math.ceil(total / limit);
  
  // Data query with all related information
  const dataQuery = `
    SELECT DISTINCT
      bp.*,
      u.name as author_name,
      u.avatar_url as author_avatar,
      GROUP_CONCAT(DISTINCT bc.name) as categories,
      GROUP_CONCAT(DISTINCT bc.slug) as category_slugs,
      GROUP_CONCAT(DISTINCT bc.color) as category_colors,
      GROUP_CONCAT(DISTINCT bt.name) as tags,
      GROUP_CONCAT(DISTINCT bt.slug) as tag_slugs
    FROM blog_posts bp
    JOIN users u ON bp.author_id = u.id
    LEFT JOIN blog_post_categories bpc ON bp.id = bpc.blog_post_id
    LEFT JOIN blog_categories bc ON bpc.category_id = bc.id
    LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
    LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id
    ${joins}
    WHERE ${whereClause}
    GROUP BY bp.id
    ORDER BY 
      CASE WHEN bp.featured = 1 THEN 0 ELSE 1 END,
      ${orderClause}
    LIMIT ? OFFSET ?
  `;
  
  params.push(limit, offset);
  
  const dataResult = await db.execute({
    sql: dataQuery,
    args: params
  });
  
  const posts = dataResult.rows.map(row => ({
    ...row,
    categories: row.categories ? (row.categories as string).split(',') : [],
    category_slugs: row.category_slugs ? (row.category_slugs as string).split(',') : [],
    category_colors: row.category_colors ? (row.category_colors as string).split(',') : [],
    tags: row.tags ? (row.tags as string).split(',') : [],
    tag_slugs: row.tag_slugs ? (row.tag_slugs as string).split(',') : []
  })) as BlogPost[];
  
  return {
    data: posts,
    total,
    totalPages,
    currentPage: page,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

// Get single blog post by slug with related data
static async getBlogPostBySlug(slug: string, incrementViews = false): Promise<BlogPost | null> {
  // Increment view count if requested
  if (incrementViews) {
    await db.execute({
      sql: 'UPDATE blog_posts SET view_count = view_count + 1 WHERE slug = ? AND status = "published"',
      args: [slug]
    });
  }
  
  const query = `
    SELECT 
      bp.*,
      u.name as author_name,
      u.avatar_url as author_avatar,
      u.email as author_email,
      GROUP_CONCAT(DISTINCT bc.name) as categories,
      GROUP_CONCAT(DISTINCT bc.slug) as category_slugs,
      GROUP_CONCAT(DISTINCT bc.color) as category_colors,
      GROUP_CONCAT(DISTINCT bt.name) as tags,
      GROUP_CONCAT(DISTINCT bt.slug) as tag_slugs
    FROM blog_posts bp
    JOIN users u ON bp.author_id = u.id
    LEFT JOIN blog_post_categories bpc ON bp.id = bpc.blog_post_id
    LEFT JOIN blog_categories bc ON bpc.category_id = bc.id
    LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
    LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id
    WHERE bp.slug = ? AND bp.status = 'published'
    GROUP BY bp.id
  `;
  
  const result = await db.execute({
    sql: query,
    args: [slug]
  });
  
  if (result.rows.length === 0) return null;
  
  const row = result.rows[0];
  return {
    ...row,
    categories: row.categories ? (row.categories as string).split(',') : [],
    category_slugs: row.category_slugs ? (row.category_slugs as string).split(',') : [],
    category_colors: row.category_colors ? (row.category_colors as string).split(',') : [],
    tags: row.tags ? (row.tags as string).split(',') : [],
    tag_slugs: row.tag_slugs ? (row.tag_slugs as string).split(',') : []
  } as BlogPost;
}

// Advanced search with ranking and filters
static async searchBlogPosts(
  query: string,
  filters: {
    category?: string;
    tag?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  } = {}
): Promise<PaginatedResponse<BlogPost & { rank: number; snippet: string }>> {
  const { category, tag, dateFrom, dateTo, page = 1, limit = 10 } = filters;
  const offset = (page - 1) * limit;
  
  // Sanitize search query for FTS5
  const sanitizedQuery = query
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 2)
    .map(term => `"${term}"*`)
    .join(' OR ');
  
  if (!sanitizedQuery) {
    return { data: [], total: 0, totalPages: 0, currentPage: page, hasNextPage: false, hasPreviousPage: false };
  }
  
  let additionalJoins = '';
  let additionalWhere = [];
  let params = [sanitizedQuery];
  
  // Category filter
  if (category) {
    additionalJoins += `
      JOIN blog_post_categories bpc ON bp.id = bpc.blog_post_id
      JOIN blog_categories bc ON bpc.category_id = bc.id
    `;
    additionalWhere.push('bc.slug = ?');
    params.push(category);
  }
  
  // Tag filter
  if (tag) {
    additionalJoins += `
      JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
      JOIN blog_tags bt ON bpt.tag_id = bt.id
    `;
    additionalWhere.push('bt.slug = ?');
    params.push(tag);
  }
  
  // Date filters
  if (dateFrom) {
    additionalWhere.push('bp.published_at >= ?');
    params.push(dateFrom);
  }
  
  if (dateTo) {
    additionalWhere.push('bp.published_at <= ?');
    params.push(dateTo);
  }
  
  const whereClause = additionalWhere.length > 0 ? 'AND ' + additionalWhere.join(' AND ') : '';
  
  // Count query
  const countQuery = `
    SELECT COUNT(DISTINCT bp.id) as total
    FROM blog_posts_fts bm
    JOIN blog_posts bp ON bp.id = bm.rowid
    ${additionalJoins}
    WHERE bp.status = 'published' AND bm MATCH ? ${whereClause}
  `;
  
  const countResult = await db.execute({
    sql: countQuery,
    args: params
  });
  
  const total = countResult.rows[0]?.total as number || 0;
  const totalPages = Math.ceil(total / limit);
  
  // Search query with ranking and snippets
  const searchQuery = `
    SELECT DISTINCT
      bp.*,
      u.name as author_name,
      u.avatar_url as author_avatar,
      bm.rank,
      snippet(blog_posts_fts, 2, '<mark>', '</mark>', '...', 32) as snippet,
      GROUP_CONCAT(DISTINCT bc.name) as categories,
      GROUP_CONCAT(DISTINCT bt.name) as tags
    FROM blog_posts_fts bm
    JOIN blog_posts bp ON bp.id = bm.rowid
    JOIN users u ON bp.author_id = u.id
    LEFT JOIN blog_post_categories bpc ON bp.id = bpc.blog_post_id
    LEFT JOIN blog_categories bc ON bpc.category_id = bc.id
    LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id
    LEFT JOIN blog_tags bt ON bpt.tag_id = bt.id
    ${additionalJoins}
    WHERE bp.status = 'published' AND bm MATCH ? ${whereClause}
    GROUP BY bp.id
    ORDER BY bm.rank
    LIMIT ? OFFSET ?
  `;
  
  params.push(limit, offset);
  
  const searchResult = await db.execute({
    sql: searchQuery,
    args: params
  });
  
  const posts = searchResult.rows.map(row => ({
    ...row,
    categories: row.categories ? (row.categories as string).split(',') : [],
    tags: row.tags ? (row.tags as string).split(',') : []
  })) as (BlogPost & { rank: number; snippet: string })[];
  
  return {
    data: posts,
    total,
    totalPages,
    currentPage: page,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1
  };
}

// Get related posts based on categories and tags
static async getRelatedPosts(postId: number, limit = 5): Promise<BlogPost[]> {
  const query = `
    WITH post_categories AS (
      SELECT category_id FROM blog_post_categories WHERE blog_post_id = ?
    ),
    post_tags AS (
      SELECT tag_id FROM blog_post_tags WHERE blog_post_id = ?
    ),
    related_scores AS (
      SELECT 
        bp.id,
        COUNT(DISTINCT bpc.category_id) * 2 as category_score,
        COUNT(DISTINCT bpt.tag_id) as tag_score,
        (COUNT(DISTINCT bpc.category_id) * 2 + COUNT(DISTINCT bpt.tag_id)) as total_score
      FROM blog_posts bp
      LEFT JOIN blog_post_categories bpc ON bp.id = bpc.blog_post_id 
        AND bpc.category_id IN (SELECT category_id FROM post_categories)
      LEFT JOIN blog_post_tags bpt ON bp.id = bpt.blog_post_id 
        AND bpt.tag_id IN (SELECT tag_id FROM post_tags)
      WHERE bp.id != ? AND bp.status = 'published'
      GROUP BY bp.id
      HAVING total_score > 0
    )
    SELECT 
      bp.*,
      u.name as author_name,
      rs.total_score,
      GROUP_CONCAT(DISTINCT bc.name) as categories
    FROM related_scores rs
    JOIN blog_posts bp ON rs.id = bp.id
    JOIN users u ON bp.author_id = u.id
    LEFT JOIN blog_post_categories bpc ON bp.id = bpc.blog_post_id
    LEFT JOIN blog_categories bc ON bpc.category_id = bc.id
    GROUP BY bp.id
    ORDER BY rs.total_score DESC, bp.published_at DESC
    LIMIT ?
  `;
  
  const result = await db.execute({
    sql: query,
    args: [postId, postId, postId, limit]
  });
  
  return result.rows.map(row => ({
    ...row,
    categories: row.categories ? (row.categories as string).split(',') : []
  })) as BlogPost[];
}

// Get all categories with post counts
static async getBlogCategories(): Promise<BlogCategory[]> {
  const query = `
    SELECT 
      bc.*,
      COUNT(bpc.blog_post_id) as post_count
    FROM blog_categories bc
    LEFT JOIN blog_post_categories bpc ON bc.id = bpc.category_id
    LEFT JOIN blog_posts bp ON bpc.blog_post_id = bp.id AND bp.status = 'published'
    GROUP BY bc.id
    ORDER BY post_count DESC, bc.name ASC
  `;
  
  const result = await db.execute({ sql: query, args: [] });
  return result.rows as BlogCategory[];
}

// Get all tags with post counts
static async getBlogTags(): Promise<BlogTag[]> {
  const query = `
    SELECT 
      bt.*,
      COUNT(bpt.blog_post_id) as post_count
    FROM blog_tags bt
    LEFT JOIN blog_post_tags bpt ON bt.id = bpt.tag_id
    LEFT JOIN blog_posts bp ON bpt.blog_post_id = bp.id AND bp.status = 'published'
    GROUP BY bt.id
    HAVING post_count > 0
    ORDER BY post_count DESC, bt.name ASC
  `;
  
  const result = await db.execute({ sql: query, args: [] });
  return result.rows as BlogTag[];
}

// Get blog archive data (posts grouped by month/year)
static async getBlogArchive(): Promise<Array<{
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
  
  const result = await db.execute({ sql: query, args: [] });
  return result.rows.map(row => ({
    year: parseInt(row.year as string),
    month: parseInt(row.month as string),
    month_name: row.month_name as string,
    post_count: row.post_count as number
  }));
}

// Create new blog post
static async createBlogPost(data: BlogPostForm, authorId: number): Promise<{ id: number; slug: string }> {
  return await db.transaction(async (tx) => {
    // Generate unique slug
    let slug = data.slug || data.title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    
    // Ensure slug uniqueness
    let slugCounter = 0;
    let finalSlug = slug;
    
    while (true) {
      const existing = await tx.execute({
        sql: 'SELECT id FROM blog_posts WHERE slug = ?',
        args: [finalSlug]
      });
      
      if (existing.rows.length === 0) break;
      
      slugCounter++;
      finalSlug = `${slug}-${slugCounter}`;
    }
    
    // Calculate reading time (approximate)
    const readingTime = Math.ceil(data.content.split(' ').length / 200);
    
    // Insert blog post
    const postResult = await tx.execute({
      sql: `
        INSERT INTO blog_posts (
          slug, title, excerpt, content, featured_image, meta_description, 
          meta_keywords, status, featured, reading_time, author_id, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        finalSlug,
        data.title,
        data.excerpt,
        data.content,
        data.featured_image,
        data.meta_description,
        data.meta_keywords,
        data.status,
        data.featured ? 1 : 0,
        readingTime,
        authorId,
        data.status === 'published' ? (data.published_at || new Date().toISOString()) : null
      ]
    });
    
    const postId = postResult.lastInsertRowid as number;
    
    // Insert categories
    for (const categoryId of data.categories) {
      await tx.execute({
        sql: 'INSERT INTO blog_post_categories (blog_post_id, category_id) VALUES (?, ?)',
        args: [postId, categoryId]
      });
    }
    
    // Insert tags
    for (const tagId of data.tags) {
      await tx.execute({
        sql: 'INSERT INTO blog_post_tags (blog_post_id, tag_id) VALUES (?, ?)',
        args: [postId, tagId]
      });
    }
    
    return { id: postId, slug: finalSlug };
  });
}

// Update blog post
static async updateBlogPost(id: number, data: Partial<BlogPostForm>): Promise<void> {
  return await db.transaction(async (tx) => {
    const updates = [];
    const values = [];
    
    // Build dynamic update query
    Object.entries(data).forEach(([key, value]) => {
      if (key === 'categories' || key === 'tags') return; // Handle separately
      
      if (key === 'featured') {
        updates.push('featured = ?');
        values.push(value ? 1 : 0);
      } else if (value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });
    
    if (updates.length > 0) {
      values.push(id);
      await tx.execute({
        sql: `UPDATE blog_posts SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: values
      });
    }
    
    // Update categories
    if (data.categories) {
      await tx.execute({
        sql: 'DELETE FROM blog_post_categories WHERE blog_post_id = ?',
        args: [id]
      });
      
      for (const categoryId of data.categories) {
        await tx.execute({
          sql: 'INSERT INTO blog_post_categories (blog_post_id, category_id) VALUES (?, ?)',
          args: [id, categoryId]
        });
      }
    }
    
    // Update tags
    if (data.tags) {
      await tx.execute({
        sql: 'DELETE FROM blog_post_tags WHERE blog_post_id = ?',
        args: [id]
      });
      
      for (const tagId of data.tags) {
        await tx.execute({
          sql: 'INSERT INTO blog_post_tags (blog_post_id, tag_id) VALUES (?, ?)',
          args: [id, tagId]
        });
      }
    }
  });
}

// Delete blog post
static async deleteBlogPost(id: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM blog_posts WHERE id = ?',
    args: [id]
  });
}
```

### Step 2: Content Processing Utilities (45 minutes)

**Content Utilities** (lib/content/processor.ts):
```typescript
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Configure marked with syntax highlighting
marked.setOptions({
  highlight: function(code: string, lang: string) {
    // You can integrate with Prism.js or highlight.js here
    return `<pre class="language-${lang}"><code>${code}</code></pre>`;
  },
  breaks: true,
  gfm: true
});

export class ContentProcessor {
  // Process markdown content
  static processMarkdown(content: string): string {
    // Convert markdown to HTML
    const html = marked.parse(content);
    
    // Sanitize HTML to prevent XSS
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'strong', 'em', 'u', 'strike',
        'blockquote', 'code', 'pre',
        'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span'
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src', 'class', 'id',
        'target', 'rel', 'width', 'height'
      ],
      ALLOW_DATA_ATTR: false
    });
    
    return sanitized;
  }
  
  // Generate excerpt from content
  static generateExcerpt(content: string, maxLength = 160): string {
    // Strip HTML tags
    const textOnly = content.replace(/<[^>]*>/g, '');
    
    // Clean up whitespace
    const cleaned = textOnly.replace(/\s+/g, ' ').trim();
    
    if (cleaned.length <= maxLength) {
      return cleaned;
    }
    
    // Find last complete sentence within limit
    const truncated = cleaned.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    } else if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    } else {
      return truncated + '...';
    }
  }
  
  // Calculate reading time
  static calculateReadingTime(content: string): number {
    const textOnly = content.replace(/<[^>]*>/g, '');
    const wordCount = textOnly.split(/\s+/).length;
    return Math.ceil(wordCount / 200); // 200 words per minute average
  }
  
  // Generate SEO meta description
  static generateMetaDescription(content: string, title: string): string {
    const excerpt = this.generateExcerpt(content, 140);
    
    if (excerpt.length < 100) {
      return `${title} - ${excerpt}`.substring(0, 160);
    }
    
    return excerpt;
  }
  
  // Extract keywords from content
  static extractKeywords(content: string, title: string): string[] {
    const text = `${title} ${content}`.toLowerCase();
    const words = text.match(/\b[a-z]{3,}\b/g) || [];
    
    // Count word frequency
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Filter out common stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
      'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy',
      'did', 'man', 'men', 'she', 'use', 'way', 'were', 'with', 'this',
      'that', 'have', 'from', 'they', 'know', 'want', 'been', 'good',
      'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just',
      'like', 'long', 'make', 'over', 'such', 'take', 'than', 'them',
      'well', 'will'
    ]);
    
    return Object.entries(wordCount)
      .filter(([word, count]) => !stopWords.has(word) && count > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }
  
  // Generate slug from title
  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  
  // Process and optimize images in content
  static processImages(content: string): string {
    return content.replace(
      /<img([^>]+)>/g,
      (match, attributes) => {
        // Add loading="lazy" and improve accessibility
        const hasLoading = /loading=/.test(attributes);
        const hasAlt = /alt=/.test(attributes);
        
        let processedAttributes = attributes;
        
        if (!hasLoading) {
          processedAttributes += ' loading="lazy"';
        }
        
        if (!hasAlt) {
          processedAttributes += ' alt=""';
        }
        
        return `<img${processedAttributes}>`;
      }
    );
  }
  
  // Add table of contents to content
  static addTableOfContents(content: string): { content: string; toc: Array<{ level: number; text: string; id: string }> } {
    const toc: Array<{ level: number; text: string; id: string }> = [];
    
    const processedContent = content.replace(
      /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/g,
      (match, level, attributes, text) => {
        const id = this.generateSlug(text);
        toc.push({
          level: parseInt(level),
          text: text.replace(/<[^>]*>/g, ''), // Strip HTML from text
          id
        });
        
        return `<h${level}${attributes} id="${id}">${text}</h${level}>`;
      }
    );
    
    return { content: processedContent, toc };
  }
}
```

### Step 3: Blog API Endpoints (60 minutes)

**Blog API Routes** (src/pages/api/blog/index.ts):
```typescript
import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    
    const options = {
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      status: searchParams.get('status') || 'published',
      category: searchParams.get('category') || undefined,
      tag: searchParams.get('tag') || undefined,
      featured: searchParams.get('featured') ? searchParams.get('featured') === 'true' : undefined,
      sortBy: (searchParams.get('sortBy') as 'date' | 'views' | 'title') || 'date',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
    };
    
    const result = await DatabaseQueries.getBlogPosts(options);
    
    return new Response(JSON.stringify({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      }
    });
    
  } catch (error) {
    console.error('Blog API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch blog posts'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

**Individual Blog Post API** (src/pages/api/blog/[slug].ts):
```typescript
import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { slug } = params;
    
    if (!slug) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Slug is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Check if this is a bot/crawler to skip view increment
    const userAgent = request.headers.get('user-agent') || '';
    const isBot = /bot|crawler|spider|crawling/i.test(userAgent);
    
    const post = await DatabaseQueries.getBlogPostBySlug(slug, !isBot);
    
    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Post not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get related posts
    const relatedPosts = await DatabaseQueries.getRelatedPosts(post.id, 3);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        post,
        relatedPosts
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600' // 10 minutes cache
      }
    });
    
  } catch (error) {
    console.error('Blog post API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch blog post'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

**Search API** (src/pages/api/blog/search.ts):
```typescript
import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

export const GET: APIRoute = async ({ request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get('q');
    
    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Search query must be at least 2 characters'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const filters = {
      category: searchParams.get('category') || undefined,
      tag: searchParams.get('tag') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10')
    };
    
    const result = await DatabaseQueries.searchBlogPosts(query.trim(), filters);
    
    return new Response(JSON.stringify({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        totalPages: result.totalPages,
        currentPage: result.currentPage,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage
      },
      query: query.trim()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 minutes cache
      }
    });
    
  } catch (error) {
    console.error('Search API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Search failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

## Testing & Validation

### Final Checklist
- [ ] All database queries execute without errors
- [ ] Blog post CRUD operations work correctly
- [ ] Full-text search returns relevant results with ranking
- [ ] API endpoints return proper JSON responses
- [ ] Content processing handles markdown correctly
- [ ] Image optimization and lazy loading work
- [ ] SEO meta tags are generated properly
- [ ] Related posts algorithm returns relevant content
- [ ] Category and tag filtering works correctly
- [ ] Pagination works across all endpoints
- [ ] Error handling provides useful feedback
- [ ] Performance optimization caching is active

## Success Criteria
✅ Complete blog system with content management  
✅ Full-text search with advanced filtering  
✅ SEO optimization and meta tag generation  
✅ Related posts and content discovery  
✅ API endpoints with proper caching  
✅ Content processing and security  
✅ Database operations with transactions  

## Next Session
Plan 4 will focus on implementing the admin panel with content management interface and user authentication.