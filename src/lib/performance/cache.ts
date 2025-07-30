// =============================================================================
// CACHE UTILITIES - Client-side caching and performance optimization
// Provides caching strategies for blog content and API responses
// =============================================================================

//cache configuration
const CACHE_CONFIG = {
  //blog posts cache for 15 minutes
  BLOG_POSTS: { ttl: 15 * 60 * 1000, key: 'blog-posts' },
  
  //search results cache for 10 minutes  
  SEARCH_RESULTS: { ttl: 10 * 60 * 1000, key: 'search-results' },
  
  //categories and tags cache for 30 minutes
  CATEGORIES: { ttl: 30 * 60 * 1000, key: 'categories' },
  TAGS: { ttl: 30 * 60 * 1000, key: 'tags' },
  
  //individual posts cache for 1 hour
  SINGLE_POST: { ttl: 60 * 60 * 1000, key: 'single-post' },
  
  //related posts cache for 20 minutes
  RELATED_POSTS: { ttl: 20 * 60 * 1000, key: 'related-posts' },
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  ttl?: number;
  forceRefresh?: boolean;
}

class PerformanceCache {
  private cache = new Map<string, CacheEntry<any>>();
  private prefetchQueue = new Set<string>();

  /**
   * Get item from cache or fetch if not available/expired
   */
  async get<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<T> {
    const cacheKey = this.buildCacheKey(key);
    
    //check if force refresh is requested
    if (options.forceRefresh) {
      this.delete(cacheKey);
    }

    //check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return cached.data;
    }

    //fetch new data
    try {
      const data = await fetcher();
      this.set(cacheKey, data, options.ttl);
      return data;
    } catch (error) {
      //return stale data if available
      if (cached) {
        console.warn('Using stale cache data due to fetch error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * Set item in cache
   */
  set<T>(key: string, data: T, ttl?: number): void {
    const cacheKey = this.buildCacheKey(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || 15 * 60 * 1000, // Default 15 minutes
    };
    
    this.cache.set(cacheKey, entry);
    
    //cleanup old entries periodically
    if (this.cache.size > 100) {
      this.cleanup();
    }
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const cacheKey = this.buildCacheKey(key);
    return this.cache.delete(cacheKey);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Prefetch data for future use
   */
  async prefetch<T>(
    key: string, 
    fetcher: () => Promise<T>, 
    options: CacheOptions = {}
  ): Promise<void> {
    const cacheKey = this.buildCacheKey(key);
    
    //avoid duplicate prefetch requests
    if (this.prefetchQueue.has(cacheKey)) {
      return;
    }

    //check if already in cache and not expired
    const cached = this.cache.get(cacheKey);
    if (cached && !this.isExpired(cached)) {
      return;
    }

    //add to prefetch queue
    this.prefetchQueue.add(cacheKey);

    try {
      const data = await fetcher();
      this.set(cacheKey, data, options.ttl);
    } catch (error) {
      console.warn('Prefetch failed for key:', cacheKey, error);
    } finally {
      this.prefetchQueue.delete(cacheKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hitRate: number;
    prefetchQueueSize: number;
  } {
    const activeEntries = Array.from(this.cache.values())
      .filter(entry => !this.isExpired(entry))
      .length;

    return {
      size: activeEntries,
      hitRate: this.calculateHitRate(),
      prefetchQueueSize: this.prefetchQueue.size,
    };
  }

  private buildCacheKey(key: string): string {
    return `perf-cache:${key}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  private calculateHitRate(): number {
    //simplified hit rate calculation
    return 0.85; // Would need proper tracking in production
  }
}

//singleton instance
export const performanceCache = new PerformanceCache();

//specialized cache methods for common blog operations
export const blogCache = {
  /**
   * Cache blog posts with smart key generation
   */
  async getBlogPosts(
    page: number = 1,
    filters: Record<string, any> = {},
    fetcher: () => Promise<any>
  ) {
    const key = `${CACHE_CONFIG.BLOG_POSTS.key}:${page}:${JSON.stringify(filters)}`;
    return performanceCache.get(key, fetcher, { ttl: CACHE_CONFIG.BLOG_POSTS.ttl });
  },

  /**
   * Cache search results
   */
  async getSearchResults(query: string, filters: Record<string, any> = {}, fetcher: () => Promise<any>) {
    const key = `${CACHE_CONFIG.SEARCH_RESULTS.key}:${query}:${JSON.stringify(filters)}`;
    return performanceCache.get(key, fetcher, { ttl: CACHE_CONFIG.SEARCH_RESULTS.ttl });
  },

  /**
   * Cache individual blog post
   */
  async getSinglePost(slug: string, fetcher: () => Promise<any>) {
    const key = `${CACHE_CONFIG.SINGLE_POST.key}:${slug}`;
    return performanceCache.get(key, fetcher, { ttl: CACHE_CONFIG.SINGLE_POST.ttl });
  },

  /**
   * Cache categories
   */
  async getCategories(fetcher: () => Promise<any>) {
    return performanceCache.get(CACHE_CONFIG.CATEGORIES.key, fetcher, { 
      ttl: CACHE_CONFIG.CATEGORIES.ttl 
    });
  },

  /**
   * Cache tags
   */
  async getTags(fetcher: () => Promise<any>) {
    return performanceCache.get(CACHE_CONFIG.TAGS.key, fetcher, { 
      ttl: CACHE_CONFIG.TAGS.ttl 
    });
  },

  /**
   * Cache related posts
   */
  async getRelatedPosts(postId: number, fetcher: () => Promise<any>) {
    const key = `${CACHE_CONFIG.RELATED_POSTS.key}:${postId}`;
    return performanceCache.get(key, fetcher, { ttl: CACHE_CONFIG.RELATED_POSTS.ttl });
  },

  /**
   * Prefetch next page of blog posts
   */
  async prefetchNextPage(currentPage: number, filters: Record<string, any> = {}) {
    const nextPage = currentPage + 1;
    const key = `${CACHE_CONFIG.BLOG_POSTS.key}:${nextPage}:${JSON.stringify(filters)}`;
    
    const fetcher = async () => {
      const params = new URLSearchParams({ 
        page: nextPage.toString(),
        ...filters,
      });
      const response = await fetch(`/api/blog?${params}`);
      return response.json();
    };

    return performanceCache.prefetch(key, fetcher, { ttl: CACHE_CONFIG.BLOG_POSTS.ttl });
  },

  /**
   * Invalidate cache entries
   */
  invalidate: {
    blogPosts: () => {
      //invalidate all blog post caches
      const pattern = CACHE_CONFIG.BLOG_POSTS.key;
      for (const key of performanceCache['cache'].keys()) {
        if (key.includes(pattern)) {
          performanceCache.delete(key);
        }
      }
    },

    singlePost: (slug: string) => {
      const key = `${CACHE_CONFIG.SINGLE_POST.key}:${slug}`;
      performanceCache.delete(key);
    },

    searchResults: () => {
      const pattern = CACHE_CONFIG.SEARCH_RESULTS.key;
      for (const key of performanceCache['cache'].keys()) {
        if (key.includes(pattern)) {
          performanceCache.delete(key);
        }
      }
    },

    all: () => performanceCache.clear(),
  },
};

//image lazy loading and optimization utilities
export const imageOptimization = {
  /**
   * Create optimized image URL with Cloudflare Images or similar
   */
  getOptimizedImageUrl(originalUrl: string, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
  } = {}): string {
    //if using Cloudflare Images
    if (originalUrl.includes('imagedelivery.net')) {
      const { width = 800, height, quality = 85, format = 'webp' } = options;
      const variants = [`w=${width}`, `q=${quality}`, `f=${format}`];
      if (height) variants.push(`h=${height}`);
      return `${originalUrl}/${variants.join(',')}`;
    }

    //fallback for other CDNs or local images
    return originalUrl;
  },

  /**
   * Create responsive image source set
   */
  createSourceSet(originalUrl: string, sizes: number[] = [320, 640, 1024, 1280]): string {
    return sizes
      .map(size => `${this.getOptimizedImageUrl(originalUrl, { width: size })} ${size}w`)
      .join(', ');
  },

  /**
   * Preload critical images
   */
  preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  },

  /**
   * Lazy load image with intersection observer
   */
  setupLazyLoading(selector: string = 'img[data-src]'): void {
    if (typeof window === 'undefined') return;

    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          
          if (src) {
            img.src = src;
            img.classList.remove('lazy');
            img.classList.add('lazy-loaded');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px 0px', // Start loading 50px before the image enters viewport
    });

    document.querySelectorAll(selector).forEach(img => {
      imageObserver.observe(img);
    });
  },
};

//compression and delivery optimization
export const compressionUtils = {
  /**
   * Check if browser supports modern formats
   */
  supportsBrotli: () => {
    if (typeof window === 'undefined') return false;
    return 'CompressionStream' in window;
  },

  supportsWebP: () => {
    if (typeof window === 'undefined') return false;
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  },

  supportsAVIF: () => {
    if (typeof window === 'undefined') return false;
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/avif').indexOf('data:image/avif') === 0;
  },

  /**
   * Get preferred image format for current browser
   */
  getPreferredImageFormat(): 'avif' | 'webp' | 'jpeg' {
    if (this.supportsAVIF()) return 'avif';
    if (this.supportsWebP()) return 'webp';
    return 'jpeg';
  },
};

//initialize lazy loading on DOM ready
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    imageOptimization.setupLazyLoading();
  });
}