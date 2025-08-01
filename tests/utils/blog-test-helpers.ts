import { vi } from 'vitest';
import type { BlogPost, BlogCategory, BlogTag } from '../../src/lib/db/types';

export interface TestBlogPost {
  id: number;
  title: string;
  slug: string;
  content: string;
  status: 'draft' | 'published' | 'archived';
  featured: boolean;
  author_id: number;
  excerpt?: string;
  published_at?: string;
  reading_time?: number;
  meta_title?: string;
  meta_description?: string;
  featured_image_url?: string;
  view_count?: number;
}

export class BlogTestHelper {
  private db: any;
  private createdPosts: number[] = [];

  constructor(db: any) {
    this.db = db;
  }

  async createTestPost(overrides: Partial<TestBlogPost> = {}): Promise<BlogPost> {
    const defaultPost = {
      title: 'Test Blog Post',
      slug: `test-post-${Date.now()}`,
      content: 'This is a comprehensive test blog post content. It includes multiple paragraphs and covers various topics to ensure proper rendering and functionality testing.',
      excerpt: 'This is a test excerpt for the blog post.',
      status: 'published' as const,
      featured: false,
      allow_comments: true,
      author_id: 1,
      published_at: new Date().toISOString(),
      reading_time: 5,
      meta_title: 'Test Blog Post - SEO Title',
      meta_description: 'This is the meta description for testing purposes.',
      featured_image_url: 'https://example.com/test-image.jpg',
      view_count: 0,
      ...overrides
    };

    const post = await this.db.createBlogPost(defaultPost);
    this.createdPosts.push(post.id);
    return post;
  }

  async createPublishedPost(slug?: string): Promise<BlogPost> {
    return this.createTestPost({
      title: 'Published Test Post',
      slug: slug || `published-${Date.now()}`,
      status: 'published',
      content: 'This is a published blog post with rich content. It includes detailed information about various topics and serves as a comprehensive example for testing the blog functionality.',
      excerpt: 'A comprehensive published post for testing.',
      featured_image_url: 'https://example.com/published-image.jpg',
      reading_time: 8,
      published_at: new Date().toISOString()
    });
  }

  async createDraftPost(slug?: string): Promise<BlogPost> {
    return this.createTestPost({
      title: 'Draft Test Post',
      slug: slug || `draft-${Date.now()}`,
      status: 'draft',
      content: 'This is a draft blog post that should not be accessible publicly.',
      excerpt: 'A draft post for testing.',
      published_at: undefined //drafts don't have published dates
    });
  }

  async createArchivedPost(slug?: string): Promise<BlogPost> {
    return this.createTestPost({
      title: 'Archived Test Post',
      slug: slug || `archived-${Date.now()}`,
      status: 'archived',
      content: 'This is an archived blog post that should not be accessible.',
      excerpt: 'An archived post for testing.'
    });
  }

  async createFeaturedPost(slug?: string): Promise<BlogPost> {
    return this.createTestPost({
      title: 'Featured Test Post',
      slug: slug || `featured-${Date.now()}`,
      status: 'published',
      featured: true,
      content: 'This is a featured blog post with special prominence.',
      excerpt: 'A featured post for testing.',
      featured_image_url: 'https://example.com/featured-image.jpg',
      published_at: new Date().toISOString()
    });
  }

  async createPostWithTags(slug?: string): Promise<BlogPost> {
    const post = await this.createTestPost({
      title: 'Post with Tags',
      slug: slug || `tagged-${Date.now()}`,
      status: 'published',
      content: 'This post has multiple tags and categories for testing.',
      excerpt: 'A post with comprehensive tagging.',
      published_at: new Date().toISOString()
    });
    // Add category and tags as properties on the returned post
    (post as any).category = 'Technology';
    (post as any).tags = ['javascript', 'testing', 'astro', 'web-development'];
    return post;
  }

  async createMinimalPost(slug?: string): Promise<BlogPost> {
    return this.createTestPost({
      title: 'Minimal Test Post',
      slug: slug || `minimal-${Date.now()}`,
      status: 'published',
      content: 'Minimal content.',
      excerpt: undefined,
      featured_image_url: undefined,
      meta_title: undefined,
      meta_description: undefined,
      reading_time: undefined,
      published_at: new Date().toISOString()
    });
  }

  async createPostSequence(count: number = 3): Promise<BlogPost[]> {
    const posts: BlogPost[] = [];
    const baseDate = new Date('2024-01-15T10:00:00Z');

    for (let i = 0; i < count; i++) {
      const publishedAt = new Date(baseDate.getTime() + (i * 86400000)).toISOString(); //1 day apart
      const post = await this.createTestPost({
        title: `Sequence Post ${i + 1}`,
        slug: `sequence-post-${i + 1}-${Date.now()}`,
        status: 'published',
        content: `This is post ${i + 1} in a sequence for testing navigation.`,
        published_at: publishedAt
      });
      posts.push(post);
    }

    return posts;
  }

  async incrementViewCount(postId: number, count: number = 1): Promise<void> {
    for (let i = 0; i < count; i++) {
      await this.db.incrementBlogPostViewCount(postId);
    }
  }

  async cleanup(): Promise<void> {
    //clean up created posts
    for (const postId of this.createdPosts) {
      try {
        await this.db.deleteBlogPost(postId);
      } catch (error) {
        //ignore deletion errors during cleanup
        console.warn(`Failed to delete test post ${postId}:`, error);
      }
    }
    this.createdPosts = [];
  }

  getCreatedPostIds(): number[] {
    return [...this.createdPosts];
  }
}

export const createMockAstroGlobal = (url: string = 'http://localhost:4321/blog/test-post') => ({
  url: new URL(url),
  params: {
    slug: url.split('/').pop() || 'test-post'
  },
  redirect: vi.fn((path: string) => ({
    status: 302,
    headers: { Location: path }
  }))
});

export const mockContentProcessor = {
  processContent: vi.fn((content: string, title: string) => ({
    html: `<p>${content}</p>`,
    toc: [],
    readingTime: Math.ceil(content.split(' ').length / 200),
    wordCount: content.split(' ').length
  }))
};

//common test data constants
export const TEST_SLUGS = {
  PUBLISHED: 'test-published-post',
  DRAFT: 'test-draft-post',
  ARCHIVED: 'test-archived-post',
  FEATURED: 'test-featured-post',
  NON_EXISTENT: 'non-existent-post-slug',
  MINIMAL: 'test-minimal-post',
  TAGGED: 'test-tagged-post',
  VALID: 'test-published-post',
  INVALID: 'non-existent-post-slug'
} as const;

export const TEST_CONTENT = {
  SHORT: 'Short test content.',
  MEDIUM: 'This is a medium-length test content that provides enough text to test various features and ensure proper rendering across different scenarios.',
  LONG: 'This is a comprehensive long-form test content that includes multiple paragraphs, detailed information, and extensive text to thoroughly test the blog post rendering, performance, and functionality. It covers various aspects of content management and ensures that the system can handle substantial amounts of text effectively. This content is designed to simulate real-world blog posts with rich, detailed information that would be typical in a production environment.'
} as const;

export const TEST_IMAGES = {
  FEATURED: 'https://example.com/featured-test-image.jpg',
  GALLERY: ['https://example.com/gallery1.jpg', 'https://example.com/gallery2.jpg'],
  AUTHOR_AVATAR: 'https://example.com/author-avatar.jpg'
} as const;

export const TEST_TAGS = {
  TECH: ['javascript', 'typescript', 'web-development'],
  DESIGN: ['ui', 'ux', 'design-systems'],
  MIXED: ['javascript', 'design', 'performance', 'testing']
} as const;

export const TEST_CATEGORIES = {
  TECHNOLOGY: 'Technology',
  DESIGN: 'Design',
  TUTORIALS: 'Tutorials'
} as const;

// Mock database helper
export function mockDatabase() {
  const posts = new Map<number, BlogPost>();
  const categories = new Map<number, BlogCategory>();
  const tags = new Map<number, BlogTag>();
  let nextId = 1;

  return {
    addMockPost: (post: BlogPost) => {
      posts.set(post.id, post);
    },
    
    addMockCategory: (category: BlogCategory) => {
      categories.set(category.id, category);
    },
    
    addMockTag: (tag: BlogTag) => {
      tags.set(tag.id, tag);
    },
    
    getBlogPostBySlug: vi.fn(async (slug: string) => {
      if (!slug || typeof slug !== 'string') return null;
      
      for (const post of posts.values()) {
        if (post.slug === slug) {
          // Return the post regardless of status for testing
          // In real implementation, this would filter by status
          return post;
        }
      }
      return null;
    }),
    
    getBlogPosts: vi.fn(async () => {
      const publishedPosts = Array.from(posts.values())
        .filter(p => p.status === 'published')
        .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
      
      return {
        data: publishedPosts,
        total: publishedPosts.length
      };
    }),
    
    getBlogPostsByCategory: vi.fn(async (categorySlug: string) => {
      const categoryPosts = Array.from(posts.values())
        .filter(p => p.status === 'published' && p.categories?.some(c => c.slug === categorySlug));
      
      return {
        data: categoryPosts,
        total: categoryPosts.length
      };
    }),
    
    getBlogPostsByTag: vi.fn(async (tagSlug: string) => {
      const tagPosts = Array.from(posts.values())
        .filter(p => p.status === 'published' && p.tags?.some(t => t.slug === tagSlug));
      
      return {
        data: tagPosts,
        total: tagPosts.length
      };
    }),
    
    getNextBlogPost: vi.fn(async (publishedAt: string | number, currentId: number) => {
      const currentTime = typeof publishedAt === 'string' ? new Date(publishedAt).getTime() : publishedAt;
      const publishedPosts = Array.from(posts.values())
        .filter(p => p.status === 'published' && p.id !== currentId)
        .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime());
      
      for (const post of publishedPosts) {
        const postTime = new Date(post.published_at!).getTime();
        if (postTime > currentTime) {
          return post;
        }
      }
      
      return null;
    }),
    
    getPreviousBlogPost: vi.fn(async (publishedAt: string | number, currentId: number) => {
      const currentTime = typeof publishedAt === 'string' ? new Date(publishedAt).getTime() : publishedAt;
      const publishedPosts = Array.from(posts.values())
        .filter(p => p.status === 'published' && p.id !== currentId)
        .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
      
      for (const post of publishedPosts) {
        const postTime = new Date(post.published_at!).getTime();
        if (postTime < currentTime) {
          return post;
        }
      }
      
      return null;
    }),
    
    getBlogCategories: vi.fn(async () => {
      return Array.from(categories.values());
    }),
    
    getBlogTags: vi.fn(async () => {
      return Array.from(tags.values());
    }),
    
    incrementBlogPostViewCount: vi.fn(async (id: number) => {
      const post = posts.get(id);
      if (post) {
        post.view_count = (post.view_count || 0) + 1;
      }
    }),
    
    clearMocks: () => {
      posts.clear();
      categories.clear();
      tags.clear();
      nextId = 1;
    }
  };
}

export function createMockBlogPost(overrides: Partial<BlogPost> = {}): BlogPost {
  const id = Math.floor(Math.random() * 10000);
  return {
    id,
    title: `Test Post ${id}`,
    slug: `test-post-${id}`,
    content: 'Test content',
    excerpt: 'Test excerpt',
    status: 'published',
    featured: false,
    author_id: 1,
    author_name: 'Test Author',
    author_avatar_url: 'https://example.com/avatar.jpg',
    category_id: 1,
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    view_count: 0,
    allow_comments: true,
    ...overrides
  } as BlogPost;
}

export function createMockCategory(overrides: Partial<BlogCategory> = {}): BlogCategory {
  const id = Math.floor(Math.random() * 1000);
  return {
    id,
    name: `Category ${id}`,
    slug: `category-${id}`,
    description: 'Test category',
    post_count: 0,
    ...overrides
  } as BlogCategory;
}

export function createMockTag(overrides: Partial<BlogTag> = {}): BlogTag {
  const id = Math.floor(Math.random() * 1000);
  return {
    id,
    name: `tag-${id}`,
    slug: `tag-${id}`,
    post_count: 0,
    ...overrides
  } as BlogTag;
}