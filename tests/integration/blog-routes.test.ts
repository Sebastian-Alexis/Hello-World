import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseQueries } from '../utils/test-database';
import { BlogTestHelper, createMockAstroGlobal, mockContentProcessor, TEST_SLUGS } from '../utils/blog-test-helpers';
import type { BlogPost } from '../../src/lib/db/types';

//mock the content processor
vi.mock('../../src/lib/content/processor', () => ({
  ContentProcessor: mockContentProcessor
}));

//mock the database connection to use test database
vi.mock('../../src/lib/db/queries', async () => {
  const { DatabaseQueries } = await import('../utils/test-database');
  return {
    DatabaseQueries,
    db: null, //will be set in beforeEach
    getBlogPostBySlug: vi.fn(),
    getNextBlogPost: vi.fn(),
    getPreviousBlogPost: vi.fn(),
    incrementBlogPostViewCount: vi.fn()
  };
});

describe('Blog Post Route Integration Tests', () => {
  let db: DatabaseQueries;
  let testHelper: BlogTestHelper;
  let createdPosts: { [key: string]: BlogPost } = {};

  beforeEach(async () => {
    //initialize test database
    db = new DatabaseQueries(':memory:');
    await db.initializeSchema();
    await db.initializeTestData();
    
    testHelper = new BlogTestHelper(db);

    //create test posts with predictable slugs
    createdPosts.published = await testHelper.createPublishedPost(TEST_SLUGS.PUBLISHED);
    createdPosts.draft = await testHelper.createDraftPost(TEST_SLUGS.DRAFT);
    createdPosts.archived = await testHelper.createArchivedPost(TEST_SLUGS.ARCHIVED);
    createdPosts.featured = await testHelper.createFeaturedPost(TEST_SLUGS.FEATURED);
    createdPosts.minimal = await testHelper.createMinimalPost(TEST_SLUGS.MINIMAL);
    createdPosts.tagged = await testHelper.createPostWithTags(TEST_SLUGS.TAGGED);

    //mock the db export functions to use our test database
    const dbModule = await import('../../src/lib/db/queries');
    (dbModule as any).db = db;
    (dbModule.getBlogPostBySlug as any).mockImplementation((slug: string) => db.getBlogPostBySlug(slug));
    (dbModule.getNextBlogPost as any).mockImplementation((publishedAt: string, id: number) => db.getNextBlogPost(publishedAt, id));
    (dbModule.getPreviousBlogPost as any).mockImplementation((publishedAt: string, id: number) => db.getPreviousBlogPost(publishedAt, id));
    (dbModule.incrementBlogPostViewCount as any).mockImplementation((id: number) => db.incrementBlogPostViewCount(id));
  });

  afterEach(async () => {
    await testHelper.cleanup();
    if (db) {
      await db.close();
    }
    vi.clearAllMocks();
  });

  describe('Published Blog Post Access', () => {
    it('should successfully retrieve published blog post data', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.PUBLISHED);

      expect(post).toBeDefined();
      expect(post?.title).toBe('Published Test Post');
      expect(post?.slug).toBe(TEST_SLUGS.PUBLISHED);
      expect(post?.status).toBe('published');
      expect(post?.content).toContain('published blog post');
      expect(post?.author_name).toBeDefined();
      expect(post?.published_at).toBeDefined();
    });

    it('should process blog post content correctly', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.PUBLISHED);

      expect(post).toBeDefined();
      
      //test content processing
      const processed = mockContentProcessor.processContent(post!.content, post!.title);
      
      expect(processed.html).toContain('<p>');
      expect(processed.wordCount).toBeGreaterThan(0);
      expect(processed.readingTime).toBeGreaterThan(0);
    });

    it('should handle featured blog posts correctly', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.FEATURED);

      expect(post).toBeDefined();
      expect(post?.featured).toBe(true);
      expect(post?.title).toBe('Featured Test Post');
      expect(post?.featured_image_url).toBeDefined();
    });

    it('should handle minimal blog posts without optional fields', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.MINIMAL);

      expect(post).toBeDefined();
      expect(post?.title).toBe('Minimal Test Post');
      expect(post?.excerpt).toBeFalsy();
      expect(post?.featured_image_url).toBeFalsy();
      expect(post?.meta_title).toBeFalsy();
      expect(post?.reading_time).toBeFalsy();
    });

    it('should handle blog posts with tags and categories', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.TAGGED);

      expect(post).toBeDefined();
      expect(post?.category).toBe('Technology');
      expect(post?.tags).toContain('javascript');
      expect(post?.tags).toContain('testing');
      expect(post?.tags).toContain('astro');
    });

    it('should increment view count when blog post is accessed', async () => {
      const { getBlogPostBySlug, incrementBlogPostViewCount } = await import('../../src/lib/db/queries');
      
      //get initial view count
      const initialPost = await getBlogPostBySlug(TEST_SLUGS.PUBLISHED);
      const initialViewCount = initialPost?.view_count || 0;

      //simulate view count increment (as done in the actual route)
      await incrementBlogPostViewCount(createdPosts.published.id);

      //verify view count increased
      const updatedPost = await getBlogPostBySlug(TEST_SLUGS.PUBLISHED);
      expect(updatedPost?.view_count).toBe(initialViewCount + 1);
    });
  });

  describe('Unpublished Blog Post Handling', () => {
    it('should return null for draft blog posts', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.DRAFT);

      expect(post).toBeNull();
    });

    it('should return null for archived blog posts', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.ARCHIVED);

      expect(post).toBeNull();
    });

    it('should simulate redirect behavior for unpublished posts', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.DRAFT);

      //simulate the Astro route logic
      if (!post) {
        const mockAstro = createMockAstroGlobal(`http://localhost:4321/blog/${TEST_SLUGS.DRAFT}`);
        const redirectResult = mockAstro.redirect('/blog');
        
        expect(redirectResult.status).toBe(302);
        expect(redirectResult.headers.Location).toBe('/blog');
      }
    });
  });

  describe('Non-existent Blog Post Handling', () => {
    it('should return null for non-existent blog post slug', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.NON_EXISTENT);

      expect(post).toBeNull();
    });

    it('should simulate redirect behavior for non-existent posts', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.NON_EXISTENT);

      //simulate the Astro route logic
      if (!post) {
        const mockAstro = createMockAstroGlobal(`http://localhost:4321/blog/${TEST_SLUGS.NON_EXISTENT}`);
        const redirectResult = mockAstro.redirect('/blog');
        
        expect(redirectResult.status).toBe(302);
        expect(redirectResult.headers.Location).toBe('/blog');
      }
    });

    it('should handle empty slug parameter', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug('');

      expect(post).toBeNull();

      //simulate the Astro route logic for empty slug
      const mockAstro = createMockAstroGlobal('http://localhost:4321/blog/');
      if (!mockAstro.params.slug) {
        const redirectResult = mockAstro.redirect('/blog');
        expect(redirectResult.status).toBe(302);
        expect(redirectResult.headers.Location).toBe('/blog');
      }
    });
  });

  describe('Blog Post Navigation', () => {
    let sequencePosts: BlogPost[];

    beforeEach(async () => {
      sequencePosts = await testHelper.createPostSequence(3);
    });

    it('should get next and previous posts correctly', async () => {
      const { getNextBlogPost, getPreviousBlogPost } = await import('../../src/lib/db/queries');
      
      const middlePost = sequencePosts[1];
      
      const nextPost = await getNextBlogPost(middlePost.published_at!, middlePost.id);
      const prevPost = await getPreviousBlogPost(middlePost.published_at!, middlePost.id);

      expect(nextPost).toBeDefined();
      expect(nextPost?.title).toBe('Sequence Post 3');
      
      expect(prevPost).toBeDefined();
      expect(prevPost?.title).toBe('Sequence Post 1');
    });

    it('should handle navigation at sequence boundaries', async () => {
      const { getNextBlogPost, getPreviousBlogPost } = await import('../../src/lib/db/queries');
      
      const firstPost = sequencePosts[0];
      const lastPost = sequencePosts[2];
      
      //first post should have no previous in the sequence (but may have other posts before it)
      const prevOfFirst = await getPreviousBlogPost(firstPost.published_at!, firstPost.id);
      // Since there are other posts created before, we check if it's not from our sequence
      if (prevOfFirst) {
        expect(sequencePosts.map(p => p.id)).not.toContain(prevOfFirst.id);
      }

      //last post should have no next in the sequence (but may have other posts after it)
      const nextOfLast = await getNextBlogPost(lastPost.published_at!, lastPost.id);
      // Since there might be other posts created after, we just verify it's not from our sequence
      if (nextOfLast) {
        expect(sequencePosts.map(p => p.id)).not.toContain(nextOfLast.id);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      
      //Mock the function to throw an error
      (getBlogPostBySlug as any).mockImplementation(async () => {
        throw new Error('Database connection error');
      });
      
      //should throw error which would be caught in the actual route
      await expect(getBlogPostBySlug(TEST_SLUGS.PUBLISHED)).rejects.toThrow('Database connection error');
    });

    it('should handle malformed slug inputs', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      
      const malformedSlugs = [
        'slug with spaces',
        'slug/with/slashes',
        'slug?with=query',
        'slug#with-hash',
        'UPPERCASE-SLUG'
      ];

      for (const slug of malformedSlugs) {
        const post = await getBlogPostBySlug(slug);
        expect(post).toBeNull();
      }
    });

    it('should handle view count increment errors gracefully', async () => {
      const { incrementBlogPostViewCount } = await import('../../src/lib/db/queries');
      
      //attempting to increment view count for non-existent post should throw
      await expect(incrementBlogPostViewCount(999999)).rejects.toThrow();
    });

    it('should handle extremely long slug inputs', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      
      const longSlug = 'a'.repeat(1000);
      const post = await getBlogPostBySlug(longSlug);
      
      expect(post).toBeNull();
    });
  });

  describe('SEO and Meta Data', () => {
    it('should provide proper SEO data for published posts', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.PUBLISHED);

      expect(post).toBeDefined();
      expect(post?.meta_title).toBeDefined();
      expect(post?.meta_description).toBeDefined();
      expect(post?.excerpt).toBeDefined();
      
      //simulate structured data generation
      const shareUrl = `http://localhost:4321/blog/${post?.slug}`;
      const structuredData = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "headline": post?.title,
        "description": post?.excerpt,
        "url": shareUrl,
        "datePublished": post?.published_at,
        "author": {
          "@type": "Person",
          "name": post?.author_name
        }
      };

      expect(structuredData.headline).toBe(post?.title);
      expect(structuredData.url).toContain(post?.slug);
      expect(structuredData["@type"]).toBe("BlogPosting");
    });

    it('should handle posts without optional SEO fields', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      const post = await getBlogPostBySlug(TEST_SLUGS.MINIMAL);

      expect(post).toBeDefined();
      
      //should gracefully handle missing meta fields
      const metaTitle = post?.meta_title || post?.title;
      const metaDescription = post?.meta_description || post?.excerpt || `Read about ${post?.title} on our blog.`;

      expect(metaTitle).toBe(post?.title);
      expect(metaDescription).toContain(post?.title);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle concurrent blog post requests', async () => {
      const { getBlogPostBySlug } = await import('../../src/lib/db/queries');
      
      //simulate concurrent requests to the same post
      const promises = Array(5).fill(null).map(() => 
        getBlogPostBySlug(TEST_SLUGS.PUBLISHED)
      );

      const results = await Promise.all(promises);
      
      //all requests should succeed
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.slug).toBe(TEST_SLUGS.PUBLISHED);
      });
    });

    it('should handle concurrent view count increments', async () => {
      const { incrementBlogPostViewCount, getBlogPostBySlug } = await import('../../src/lib/db/queries');
      
      const postId = createdPosts.published.id;
      
      //simulate concurrent view count increments
      const incrementPromises = Array(5).fill(null).map(() => 
        incrementBlogPostViewCount(postId)
      );

      await Promise.all(incrementPromises);
      
      //verify final view count
      const updatedPost = await getBlogPostBySlug(TEST_SLUGS.PUBLISHED);
      expect(updatedPost?.view_count).toBe(5);
    });
  });
});