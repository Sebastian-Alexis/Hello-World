import { vi } from 'vitest';
import type { BlogPost, BlogCategory, BlogTag } from '../../src/lib/db/types';

// Mock database queries class for testing
export class MockDatabaseQueries {
  private posts = new Map<number, BlogPost>();
  private categories = new Map<number, BlogCategory>();
  private tags = new Map<number, BlogTag>();
  private nextId = 1;

  constructor(connectionString?: string) {
    // Mock constructor - doesn't actually connect to database
  }

  async initializeSchema(): Promise<void> {
    // Mock schema initialization
    return Promise.resolve();
  }

  async initializeTestData(): Promise<void> {
    // Add some test data
    const testCategories = [
      { id: 1, name: 'Technology', slug: 'technology', description: 'Tech posts', post_count: 0 },
      { id: 2, name: 'Design', slug: 'design', description: 'Design posts', post_count: 0 }
    ];
    
    testCategories.forEach(cat => this.categories.set(cat.id, cat as BlogCategory));
    
    const testTags = [
      { id: 1, name: 'javascript', slug: 'javascript', post_count: 0 },
      { id: 2, name: 'typescript', slug: 'typescript', post_count: 0 },
      { id: 3, name: 'astro', slug: 'astro', post_count: 0 }
    ];
    
    testTags.forEach(tag => this.tags.set(tag.id, tag as BlogTag));
  }

  async createBlogPost(postData: any): Promise<BlogPost> {
    const id = this.nextId++;
    const post: BlogPost = {
      id,
      title: postData.title,
      slug: postData.slug,
      content: postData.content,
      excerpt: postData.excerpt,
      status: postData.status || 'published',
      featured: postData.featured || false,
      author_id: postData.author_id || 1,
      author_name: 'Test Author',
      author_avatar_url: 'https://example.com/avatar.jpg',
      category_id: postData.category_id || 1,
      published_at: postData.published_at || new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      view_count: postData.view_count || 0,
      allow_comments: postData.allow_comments ?? true,
      reading_time: postData.reading_time,
      meta_title: postData.meta_title,
      meta_description: postData.meta_description,
      featured_image_url: postData.featured_image_url
    };
    
    this.posts.set(id, post);
    return post;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
    if (!slug || typeof slug !== 'string') return null;
    
    for (const post of this.posts.values()) {
      if (post.slug === slug && post.status === 'published') {
        return post;
      }
    }
    return null;
  }

  async getBlogPosts(options?: any): Promise<{ data: BlogPost[], total: number }> {
    const publishedPosts = Array.from(this.posts.values())
      .filter(p => p.status === 'published')
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
    
    return {
      data: publishedPosts,
      total: publishedPosts.length
    };
  }

  async getNextBlogPost(publishedAt: string | number, currentId: number): Promise<BlogPost | null> {
    const currentTime = typeof publishedAt === 'string' ? new Date(publishedAt).getTime() : publishedAt;
    const publishedPosts = Array.from(this.posts.values())
      .filter(p => p.status === 'published' && p.id !== currentId)
      .sort((a, b) => new Date(a.published_at!).getTime() - new Date(b.published_at!).getTime());
    
    for (const post of publishedPosts) {
      const postTime = new Date(post.published_at!).getTime();
      if (postTime > currentTime) {
        return post;
      }
    }
    
    return null;
  }

  async getPreviousBlogPost(publishedAt: string | number, currentId: number): Promise<BlogPost | null> {
    const currentTime = typeof publishedAt === 'string' ? new Date(publishedAt).getTime() : publishedAt;
    const publishedPosts = Array.from(this.posts.values())
      .filter(p => p.status === 'published' && p.id !== currentId)
      .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());
    
    for (const post of publishedPosts) {
      const postTime = new Date(post.published_at!).getTime();
      if (postTime < currentTime) {
        return post;
      }
    }
    
    return null;
  }

  async incrementBlogPostViewCount(id: number): Promise<void> {
    const post = this.posts.get(id);
    if (post) {
      post.view_count = (post.view_count || 0) + 1;
    } else {
      throw new Error(`Post with id ${id} not found`);
    }
  }

  async deleteBlogPost(id: number): Promise<void> {
    this.posts.delete(id);
  }

  async close(): Promise<void> {
    // Mock close - clear data
    this.posts.clear();
    this.categories.clear();
    this.tags.clear();
  }
}

// Export both named and as DatabaseQueries for compatibility
export { MockDatabaseQueries as DatabaseQueries };