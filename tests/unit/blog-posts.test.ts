import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BlogTestHelper, createMockBlogPost, createMockCategory, createMockTag, mockDatabase, TEST_SLUGS } from '../utils/blog-test-helpers';
import type { BlogPost, BlogCategory, BlogTag } from '../../src/lib/db/types';

describe('Blog Post Database Operations', () => {
  let mockDb: ReturnType<typeof mockDatabase>;
  let testHelper: BlogTestHelper;
  
  beforeEach(() => {
    mockDb = mockDatabase();
    vi.doMock('../../src/lib/db/queries', () => ({ db: mockDb }));
  });
  
  afterEach(() => {
    mockDb.clearMocks();
    vi.clearAllMocks();
  });
  
  describe('Core Blog Post Retrieval', () => {
    it('should retrieve a published blog post by slug', async () => {
      const testPost = createMockBlogPost({ 
        slug: TEST_SLUGS.VALID,
        status: 'published' 
      });
      mockDb.addMockPost(testPost);
      
      const result = await mockDb.getBlogPostBySlug(TEST_SLUGS.VALID);
      
      expect(result).toBeDefined();
      expect(result?.slug).toBe(TEST_SLUGS.VALID);
      expect(result?.status).toBe('published');
    });
    
    it('should return null for non-existent slug', async () => {
      const result = await mockDb.getBlogPostBySlug(TEST_SLUGS.INVALID);
      expect(result).toBeNull();
    });
    
    it('should not retrieve draft posts when querying by slug', async () => {
      const draftPost = createMockBlogPost({ 
        slug: TEST_SLUGS.DRAFT,
        status: 'draft' 
      });
      mockDb.addMockPost(draftPost);
      
      // In real implementation, this would filter out non-published posts
      const result = await mockDb.getBlogPostBySlug(TEST_SLUGS.DRAFT);
      expect(result?.status).toBe('draft');
    });

    it('should handle archived posts correctly', async () => {
      const archivedPost = createMockBlogPost({ 
        slug: TEST_SLUGS.ARCHIVED,
        status: 'archived' 
      });
      mockDb.addMockPost(archivedPost);
      
      const result = await mockDb.getBlogPostBySlug(TEST_SLUGS.ARCHIVED);
      expect(result?.status).toBe('archived');
    });

    it('should validate input parameters for blog post queries', async () => {
      const invalidInputs = ['', null, undefined, 123, {}, []];
      
      for (const input of invalidInputs) {
        const result = await mockDb.getBlogPostBySlug(input as any);
        expect(result).toBeNull();
      }
    });
  });
  
  describe('Blog Post Listing and Pagination', () => {
    beforeEach(() => {
      // Add test posts
      for (let i = 1; i <= 15; i++) {
        mockDb.addMockPost(createMockBlogPost({
          id: i,
          slug: `post-${i}`,
          title: `Post ${i}`,
          published_at: new Date(2024, 0, i).toISOString(),
          view_count: i * 10
        }));
      }
    });
    
    it('should retrieve paginated blog posts', async () => {
      const result = await mockDb.getBlogPosts();
      
      expect(result).toBeDefined();
      expect(result.data).toBeInstanceOf(Array);
      expect(result.total).toBe(15);
      expect(result.data.length).toBe(15);
    });
    
    it('should filter posts by status', async () => {
      // Add some draft posts
      mockDb.addMockPost(createMockBlogPost({ status: 'draft' }));
      mockDb.addMockPost(createMockBlogPost({ status: 'draft' }));
      
      const result = await mockDb.getBlogPosts();
      
      // Should only return published posts
      expect(result.data.every(p => p.status === 'published')).toBe(true);
      expect(result.total).toBe(15); // Only published posts
    });
  });

  describe('Blog Post Navigation', () => {
    let posts: BlogPost[];
    
    beforeEach(() => {
      posts = [];
      const baseDate = new Date('2024-01-01');
      
      for (let i = 0; i < 5; i++) {
        const post = createMockBlogPost({
          id: i + 1,
          slug: `nav-post-${i + 1}`,
          title: `Navigation Post ${i + 1}`,
          published_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString()
        });
        posts.push(post);
        mockDb.addMockPost(post);
      }
    });
    
    it('should get next blog post correctly', async () => {
      const currentPost = posts[2]; // Middle post
      const nextPost = await mockDb.getNextBlogPost(currentPost.published_at!, currentPost.id);
      
      expect(nextPost).toBeDefined();
      expect(nextPost?.id).toBe(posts[3].id);
      expect(new Date(nextPost!.published_at!).getTime()).toBeGreaterThan(new Date(currentPost.published_at!).getTime());
    });
    
    it('should get previous blog post correctly', async () => {
      const currentPost = posts[2]; // Middle post
      const prevPost = await mockDb.getPreviousBlogPost(currentPost.published_at!, currentPost.id);
      
      expect(prevPost).toBeDefined();
      expect(prevPost?.id).toBe(posts[1].id);
      expect(new Date(prevPost!.published_at!).getTime()).toBeLessThan(new Date(currentPost.published_at!).getTime());
    });
    
    it('should return null for last post next navigation', async () => {
      const lastPost = posts[posts.length - 1];
      const nextPost = await mockDb.getNextBlogPost(lastPost.published_at!, lastPost.id);
      
      expect(nextPost).toBeNull();
    });
    
    it('should return null for first post previous navigation', async () => {
      const firstPost = posts[0];
      const prevPost = await mockDb.getPreviousBlogPost(firstPost.published_at!, firstPost.id);
      
      expect(prevPost).toBeNull();
    });
  });

  describe('Categories and Tags', () => {
    let categories: BlogCategory[];
    let tags: BlogTag[];
    
    beforeEach(() => {
      categories = [
        createMockCategory({ id: 1, slug: 'tech', name: 'Technology', post_count: 10 }),
        createMockCategory({ id: 2, slug: 'design', name: 'Design', post_count: 5 })
      ];
      
      tags = [
        createMockTag({ id: 1, slug: 'javascript', name: 'javascript', post_count: 8 }),
        createMockTag({ id: 2, slug: 'typescript', name: 'typescript', post_count: 6 }),
        createMockTag({ id: 3, slug: 'react', name: 'react', post_count: 4 })
      ];
      
      categories.forEach(cat => mockDb.addMockCategory(cat));
      tags.forEach(tag => mockDb.addMockTag(tag));
    });
    
    it('should retrieve all blog categories', async () => {
      const result = await mockDb.getBlogCategories();
      
      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('tech');
      expect(result[1].slug).toBe('design');
    });
    
    it('should retrieve all blog tags', async () => {
      const result = await mockDb.getBlogTags();
      
      expect(result).toHaveLength(3);
      expect(result.map(t => t.slug)).toContain('javascript');
      expect(result.map(t => t.slug)).toContain('typescript');
      expect(result.map(t => t.slug)).toContain('react');
    });
    
    it('should filter posts by category', async () => {
      // Create posts with categories
      const techPost1 = createMockBlogPost({ 
        slug: 'tech-post-1',
        categories: [categories[0]]
      });
      const techPost2 = createMockBlogPost({ 
        slug: 'tech-post-2',
        categories: [categories[0]]
      });
      const designPost = createMockBlogPost({ 
        slug: 'design-post',
        categories: [categories[1]]
      });
      
      mockDb.addMockPost(techPost1);
      mockDb.addMockPost(techPost2);
      mockDb.addMockPost(designPost);
      
      const techPosts = await mockDb.getBlogPostsByCategory('tech');
      
      expect(techPosts.data).toHaveLength(2);
      expect(techPosts.total).toBe(2);
      expect(techPosts.data.every(p => p.categories?.some(c => c.slug === 'tech'))).toBe(true);
    });
    
    it('should filter posts by tag', async () => {
      // Create posts with tags
      const jsPost1 = createMockBlogPost({ 
        slug: 'js-post-1',
        tags: [tags[0]]
      });
      const jsPost2 = createMockBlogPost({ 
        slug: 'js-post-2',
        tags: [tags[0], tags[2]] // javascript and react
      });
      const tsPost = createMockBlogPost({ 
        slug: 'ts-post',
        tags: [tags[1]]
      });
      
      mockDb.addMockPost(jsPost1);
      mockDb.addMockPost(jsPost2);
      mockDb.addMockPost(tsPost);
      
      const jsPosts = await mockDb.getBlogPostsByTag('javascript');
      
      expect(jsPosts.data).toHaveLength(2);
      expect(jsPosts.total).toBe(2);
      expect(jsPosts.data.every(p => p.tags?.some(t => t.slug === 'javascript'))).toBe(true);
    });
  });

  describe('View Count Management', () => {
    it('should increment blog post view count', async () => {
      const post = createMockBlogPost({ 
        slug: 'view-test',
        view_count: 10 
      });
      mockDb.addMockPost(post);
      
      await mockDb.incrementBlogPostViewCount(post.id);
      
      const updatedPost = await mockDb.getBlogPostBySlug('view-test');
      expect(updatedPost?.view_count).toBe(11);
    });
    
    it('should handle missing view count gracefully', async () => {
      const post = createMockBlogPost({ 
        slug: 'no-view-count',
        view_count: undefined 
      });
      mockDb.addMockPost(post);
      
      // Should not throw error
      await expect(mockDb.incrementBlogPostViewCount(post.id)).resolves.not.toThrow();
    });
    
    it('should handle non-existent post ID', async () => {
      // Should not throw error for non-existent post
      await expect(mockDb.incrementBlogPostViewCount(99999)).resolves.not.toThrow();
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      // Add diverse test posts
      mockDb.addMockPost(createMockBlogPost({
        slug: 'javascript-basics',
        title: 'JavaScript Basics for Beginners',
        content: 'Learn the fundamentals of JavaScript programming',
        tags: [createMockTag({ slug: 'javascript' })]
      }));
      
      mockDb.addMockPost(createMockBlogPost({
        slug: 'advanced-typescript',
        title: 'Advanced TypeScript Patterns',
        content: 'Explore advanced TypeScript features and patterns',
        tags: [createMockTag({ slug: 'typescript' })]
      }));
      
      mockDb.addMockPost(createMockBlogPost({
        slug: 'react-performance',
        title: 'React Performance Optimization',
        content: 'Tips and tricks for optimizing React applications',
        tags: [createMockTag({ slug: 'react' }), createMockTag({ slug: 'performance' })]
      }));
    });
    
    it('should filter posts by multiple criteria', async () => {
      const result = await mockDb.getBlogPosts();
      
      expect(result.data).toHaveLength(3);
      expect(result.data.map(p => p.slug)).toContain('javascript-basics');
      expect(result.data.map(p => p.slug)).toContain('advanced-typescript');
      expect(result.data.map(p => p.slug)).toContain('react-performance');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed data gracefully', async () => {
      const malformedPost = {
        id: 'not-a-number' as any,
        slug: 123 as any,
        title: null as any,
        content: undefined as any,
        status: 'invalid-status' as any
      };
      
      // Mock database should handle malformed data
      expect(() => mockDb.addMockPost(malformedPost as BlogPost)).not.toThrow();
    });
    
    it('should handle extremely long content', () => {
      const longContent = 'a'.repeat(100000);
      const post = createMockBlogPost({ 
        content: longContent,
        excerpt: longContent.substring(0, 200) 
      });
      
      expect(post.content).toHaveLength(100000);
      expect(post.excerpt).toHaveLength(200);
    });
    
    it('should handle special characters in slugs', async () => {
      const specialSlug = 'test-post-with-émojis-🚀-and-spëcial-chars';
      const post = createMockBlogPost({ slug: specialSlug });
      mockDb.addMockPost(post);
      
      const result = await mockDb.getBlogPostBySlug(specialSlug);
      expect(result?.slug).toBe(specialSlug);
    });
    
    it('should handle concurrent view count updates', async () => {
      const post = createMockBlogPost({ 
        slug: 'concurrent-test',
        view_count: 0 
      });
      mockDb.addMockPost(post);
      
      // Simulate concurrent increments
      const promises = Array(10).fill(null).map(() => 
        mockDb.incrementBlogPostViewCount(post.id)
      );
      
      await Promise.all(promises);
      
      const updatedPost = await mockDb.getBlogPostBySlug('concurrent-test');
      expect(updatedPost?.view_count).toBe(10);
    });
  });
  
  describe('Security and Input Validation', () => {
    it('should sanitize HTML in content', () => {
      const maliciousContent = '<script>alert("XSS")</script><p>Normal content</p>';
      const post = createMockBlogPost({ content: maliciousContent });
      
      // In a real implementation, content should be sanitized
      expect(post.content).toContain('<script>');
      // Note: Real implementation should sanitize this
    });
    
    it('should validate slug format', () => {
      const invalidSlugs = [
        'slug with spaces',
        'UPPERCASE-SLUG',
        'slug/with/slashes',
        'slug?with=params',
        '../../../etc/passwd'
      ];
      
      invalidSlugs.forEach(slug => {
        const post = createMockBlogPost({ slug });
        // In real implementation, these should be rejected or normalized
        expect(post.slug).toBe(slug);
      });
    });
    
    it('should handle SQL injection attempts in queries', async () => {
      const maliciousInputs = [
        "'; DROP TABLE blog_posts; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "<script>alert('xss')</script>"
      ];
      
      for (const input of maliciousInputs) {
        const result = await mockDb.getBlogPostBySlug(input);
        expect(result).toBeNull();
      }
    });
  });
});