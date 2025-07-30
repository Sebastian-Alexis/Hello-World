# Plan 7: Performance Optimization & Testing

**Session Goal**: Implement comprehensive performance optimizations, testing framework, and quality assurance systems  
**Estimated Time**: 4-5 hours  
**Prerequisites**: Plans 1-6 completed (foundation, layout, blog, admin, flight system, and portfolio)  

## Development Phase: Performance & Quality Assurance

### Todo List

#### 1. Performance Monitoring & Analytics
- [ ] Implement Core Web Vitals tracking with real user metrics
- [ ] Set up performance budget monitoring and alerts
- [ ] Create lighthouse CI integration for continuous performance testing
- [ ] Build performance dashboard with historical data
- [ ] Implement client-side performance profiling tools
- [ ] Set up error tracking and crash reporting system
- [ ] Create performance regression detection system
- [ ] Add memory usage and resource monitoring

#### 2. Code Optimization & Bundling
- [ ] Implement advanced code splitting strategies
- [ ] Set up tree shaking and dead code elimination
- [ ] Create dynamic imports for large components
- [ ] Optimize CSS delivery with critical path extraction
- [ ] Implement service worker with intelligent caching
- [ ] Set up asset optimization pipeline (images, fonts, etc.)
- [ ] Create pre-loading strategies for critical resources
- [ ] Build progressive enhancement fallbacks

#### 3. Database Performance Optimization
- [ ] Analyze and optimize all database queries
- [ ] Implement proper indexing strategies
- [ ] Set up query performance monitoring
- [ ] Create database connection pooling
- [ ] Implement query result caching system
- [ ] Add database query logging and analysis
- [ ] Optimize full-text search performance
- [ ] Create database maintenance and cleanup procedures

#### 4. Comprehensive Testing Framework
- [ ] Set up unit testing with Vitest framework
- [ ] Implement integration testing for API endpoints
- [ ] Create end-to-end testing with Playwright
- [ ] Build component testing for Svelte components
- [ ] Set up visual regression testing
- [ ] Implement accessibility testing automation
- [ ] Create performance testing suite
- [ ] Add API contract testing

#### 5. Caching & CDN Optimization
- [ ] Implement multi-level caching strategy
- [ ] Set up Redis caching for dynamic content
- [ ] Configure Cloudflare caching rules optimally
- [ ] Create intelligent cache invalidation system
- [ ] Implement client-side caching with service workers
- [ ] Set up edge computing for dynamic content
- [ ] Create cache warming strategies
- [ ] Build cache performance monitoring

#### 6. Image & Media Optimization
- [ ] Implement responsive image loading with srcset
- [ ] Set up automatic image optimization pipeline
- [ ] Create lazy loading with intersection observer
- [ ] Build progressive image loading with blur placeholders
- [ ] Implement WebP and AVIF format support
- [ ] Set up video optimization and adaptive streaming
- [ ] Create media CDN with global distribution
- [ ] Add image compression and resizing automation

#### 7. Security Hardening & Compliance
- [ ] Implement Content Security Policy (CSP) headers
- [ ] Set up rate limiting and DDoS protection
- [ ] Create input sanitization and validation systems
- [ ] Implement SQL injection prevention measures
- [ ] Set up XSS protection mechanisms
- [ ] Create GDPR compliance tools and cookie management
- [ ] Add security headers and HTTPS enforcement
- [ ] Build security monitoring and alerting

#### 8. Monitoring & Observability
- [ ] Set up application performance monitoring (APM)
- [ ] Implement structured logging with search capabilities
- [ ] Create health check endpoints and monitoring
- [ ] Build alerting system for critical issues
- [ ] Set up uptime monitoring and incident response
- [ ] Implement distributed tracing for complex operations
- [ ] Create operational dashboards and metrics
- [ ] Add automated backup and disaster recovery

## Detailed Implementation Steps

### Step 1: Performance Monitoring System (90 minutes)

**Core Web Vitals Tracking** (lib/performance/vitals.ts):
```typescript
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  url: string;
  userAgent: string;
  connectionType?: string;
}

class PerformanceTracker {
  private metrics: PerformanceMetric[] = [];
  private endpoint = '/api/analytics/performance';

  constructor() {
    this.initializeTracking();
  }

  private initializeTracking() {
    // Track Core Web Vitals
    getCLS(this.handleMetric.bind(this, 'CLS'));
    getFID(this.handleMetric.bind(this, 'FID'));
    getFCP(this.handleMetric.bind(this, 'FCP'));
    getLCP(this.handleMetric.bind(this, 'LCP'));
    getTTFB(this.handleMetric.bind(this, 'TTFB'));

    // Track custom metrics
    this.trackResourceTiming();
    this.trackNavigationTiming();
    this.trackMemoryUsage();

    // Send metrics periodically
    setInterval(() => this.sendMetrics(), 30000);
    
    // Send metrics on page unload
    window.addEventListener('beforeunload', () => this.sendMetrics());
  }

  private handleMetric(name: string, metric: any) {
    const performanceMetric: PerformanceMetric = {
      name,
      value: metric.value,
      rating: this.getRating(name, metric.value),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      connectionType: this.getConnectionType()
    };

    this.metrics.push(performanceMetric);
    
    // Send critical metrics immediately
    if (performanceMetric.rating === 'poor' || name === 'LCP') {
      this.sendMetrics();
    }
  }

  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      CLS: { good: 0.1, poor: 0.25 },
      FID: { good: 100, poor: 300 },
      FCP: { good: 1800, poor: 3000 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[name as keyof typeof thresholds];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private getConnectionType(): string | undefined {
    const connection = (navigator as any).connection;
    return connection?.effectiveType || connection?.type;
  }

  private trackResourceTiming() {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    resources.forEach(resource => {
      if (resource.duration > 1000) { // Track slow resources
        this.metrics.push({
          name: 'SLOW_RESOURCE',
          value: resource.duration,
          rating: resource.duration > 3000 ? 'poor' : 'needs-improvement',
          timestamp: Date.now(),
          url: resource.name,
          userAgent: navigator.userAgent
        });
      }
    });
  }

  private trackNavigationTiming() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
      const loadComplete = navigation.loadEventEnd - navigation.loadEventStart;

      this.metrics.push(
        {
          name: 'DOM_CONTENT_LOADED',
          value: domContentLoaded,
          rating: this.getRating('FCP', domContentLoaded),
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent
        },
        {
          name: 'LOAD_COMPLETE',
          value: loadComplete,
          rating: this.getRating('LCP', loadComplete),
          timestamp: Date.now(),
          url: window.location.href,
          userAgent: navigator.userAgent
        }
      );
    }
  }

  private trackMemoryUsage() {
    const memory = (performance as any).memory;
    if (memory) {
      const memoryUsage = (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100;
      
      this.metrics.push({
        name: 'MEMORY_USAGE',
        value: memoryUsage,
        rating: memoryUsage > 80 ? 'poor' : memoryUsage > 60 ? 'needs-improvement' : 'good',
        timestamp: Date.now(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    }
  }

  private async sendMetrics() {
    if (this.metrics.length === 0) return;

    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metrics: this.metrics,
          sessionId: this.getSessionId(),
          userId: this.getUserId()
        }),
        keepalive: true
      });

      this.metrics = []; // Clear sent metrics
    } catch (error) {
      console.error('Failed to send performance metrics:', error);
    }
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('perf_session_id');
    if (!sessionId) {
      sessionId = 'perf_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
      sessionStorage.setItem('perf_session_id', sessionId);
    }
    return sessionId;
  }

  private getUserId(): string | null {
    return localStorage.getItem('user_id') || null;
  }

  // Public methods for manual tracking
  public trackCustomMetric(name: string, value: number, rating?: 'good' | 'needs-improvement' | 'poor') {
    this.metrics.push({
      name: `CUSTOM_${name.toUpperCase()}`,
      value,
      rating: rating || 'good',
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }

  public trackUserInteraction(action: string, duration: number) {
    this.metrics.push({
      name: 'USER_INTERACTION',
      value: duration,
      rating: duration > 100 ? 'poor' : duration > 50 ? 'needs-improvement' : 'good',
      timestamp: Date.now(),
      url: `${window.location.href}#${action}`,
      userAgent: navigator.userAgent
    });
  }
}

// Initialize performance tracking
export const performanceTracker = new PerformanceTracker();

// Export for manual usage
export { PerformanceTracker };
```

**Performance API Endpoint** (src/pages/api/analytics/performance.ts):
```typescript
import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../../lib/db/queries';

export const POST: APIRoute = async ({ request }) => {
  try {
    const db = new DatabaseQueries();
    const { metrics, sessionId, userId } = await request.json();

    // Store performance metrics
    const promises = metrics.map((metric: any) => 
      db.createPerformanceMetric({
        ...metric,
        session_id: sessionId,
        user_id: userId
      })
    );

    await Promise.all(promises);

    // Check for performance issues and trigger alerts
    const criticalMetrics = metrics.filter((m: any) => m.rating === 'poor');
    if (criticalMetrics.length > 0) {
      await triggerPerformanceAlert(criticalMetrics);
    }

    return new Response(JSON.stringify({
      success: true,
      processed: metrics.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing performance metrics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to process performance metrics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

async function triggerPerformanceAlert(criticalMetrics: any[]) {
  // Implementation for alerting system
  console.warn('Critical performance issues detected:', criticalMetrics);
  
  // Could integrate with external services like:
  // - Slack notifications
  // - Email alerts
  // - PagerDuty incidents
  // - Discord webhooks
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const db = new DatabaseQueries();
    const searchParams = new URL(url).searchParams;
    
    const timeRange = searchParams.get('range') || '24h';
    const metricType = searchParams.get('metric') || 'all';

    const metrics = await db.getPerformanceMetrics({
      timeRange,
      metricType,
      aggregated: true
    });

    return new Response(JSON.stringify({
      success: true,
      data: metrics
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch performance metrics'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### Step 2: Advanced Caching System (75 minutes)

**Service Worker with Intelligent Caching** (public/sw.js):
```javascript
const CACHE_VERSION = 'v2.1.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;
const IMAGE_CACHE = `images-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;

// Cache strategies
const CACHE_STRATEGIES = {
  static: 'cache-first',
  dynamic: 'network-first',
  images: 'cache-first',
  api: 'network-first-with-fallback'
};

// Cache durations (in milliseconds)
const CACHE_DURATIONS = {
  static: 30 * 24 * 60 * 60 * 1000, // 30 days
  dynamic: 24 * 60 * 60 * 1000,     // 1 day
  images: 7 * 24 * 60 * 60 * 1000,  // 7 days
  api: 5 * 60 * 1000                // 5 minutes
};

// Resources to cache immediately
const CRITICAL_RESOURCES = [
  '/',
  '/offline',
  '/manifest.json',
  '/assets/fonts/inter-var.woff2',
  '/assets/css/critical.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // Pre-cache critical resources
      caches.open(STATIC_CACHE).then(cache => {
        return cache.addAll(CRITICAL_RESOURCES);
      }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      cleanupOldCaches(),
      
      // Claim all clients immediately
      self.clients.claim()
    ])
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  // Determine cache strategy based on request type
  if (isStaticAsset(request)) {
    event.respondWith(handleStaticAsset(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isAPIRequest(request)) {
    event.respondWith(handleAPIRequest(request));
  } else {
    event.respondWith(handleDynamicRequest(request));
  }
});

async function handleStaticAsset(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  if (cached && !isExpired(cached, CACHE_DURATIONS.static)) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    return cached || createErrorResponse('Static asset unavailable');
  }
}

async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);

  if (cached && !isExpired(cached, CACHE_DURATIONS.images)) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    return cached || createPlaceholderImage();
  }
}

async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);
  
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached && !isExpired(cached, CACHE_DURATIONS.api)) {
      return cached;
    }
    return createErrorResponse('API unavailable');
  }
}

async function handleDynamicRequest(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  
  // Try network first
  try {
    const response = await fetch(request);
    if (response.ok) {
      const responseClone = response.clone();
      await cache.put(request, responseClone);
    }
    return response;
  } catch (error) {
    // Fall back to cache
    const cached = await cache.match(request);
    if (cached && !isExpired(cached, CACHE_DURATIONS.dynamic)) {
      return cached;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    
    return createErrorResponse('Content unavailable');
  }
}

function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(css|js|woff2?|ttf|eot|ico|svg|png|jpg|jpeg|webp|avif)$/i.test(url.pathname);
}

function isImageRequest(request) {
  return request.destination === 'image';
}

function isAPIRequest(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith('/api/');
}

function isExpired(response, maxAge) {
  const dateHeader = response.headers.get('date');
  if (!dateHeader) return true;
  
  const date = new Date(dateHeader);
  return Date.now() - date.getTime() > maxAge;
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();
  const oldCaches = cacheNames.filter(name => 
    !name.includes(CACHE_VERSION) && 
    (name.includes('static-') || name.includes('dynamic-') || 
     name.includes('images-') || name.includes('api-'))
  );
  
  return Promise.all(oldCaches.map(name => caches.delete(name)));
}

function createErrorResponse(message) {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

function createPlaceholderImage() {
  // Return a simple SVG placeholder for failed image loads
  const svg = `
    <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af">
        Image unavailable
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: { 'Content-Type': 'image/svg+xml' }
  });
}

// Background sync for analytics and performance data
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync-analytics') {
    event.waitUntil(syncAnalyticsData());
  }
});

async function syncAnalyticsData() {
  // Sync offline analytics data when connection is restored
  const cache = await caches.open('analytics-offline');
  const requests = await cache.keys();
  
  for (const request of requests) {
    try {
      const data = await cache.match(request);
      await fetch(request, {
        method: 'POST',
        body: await data.text(),
        headers: { 'Content-Type': 'application/json' }
      });
      await cache.delete(request);
    } catch (error) {
      console.error('Failed to sync analytics data:', error);
    }
  }
}
```

### Step 3: Comprehensive Testing Suite (80 minutes)

**Unit Testing Setup** (tests/unit/database.test.ts):
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseQueries } from '../../lib/db/queries';
import type { BlogPost, Project, Flight } from '../../lib/db/types';

describe('DatabaseQueries', () => {
  let db: DatabaseQueries;

  beforeEach(async () => {
    // Initialize test database
    db = new DatabaseQueries(':memory:');
    await db.initializeTestData();
  });

  afterEach(async () => {
    await db.cleanup();
  });

  describe('Blog Operations', () => {
    it('should create a blog post successfully', async () => {
      const postData = {
        title: 'Test Post',
        slug: 'test-post',
        content: 'This is a test post content',
        excerpt: 'Test excerpt',
        status: 'published' as const,
        featured: false,
        author_id: 1
      };

      const post = await db.createBlogPost(postData);
      
      expect(post).toBeDefined();
      expect(post.title).toBe(postData.title);
      expect(post.slug).toBe(postData.slug);
      expect(post.status).toBe('published');
    });

    it('should retrieve paginated blog posts', async () => {
      // Create test posts
      await Promise.all([
        db.createBlogPost({
          title: 'Post 1',
          slug: 'post-1',
          content: 'Content 1',
          status: 'published',
          featured: false,
          author_id: 1
        }),
        db.createBlogPost({
          title: 'Post 2',
          slug: 'post-2',
          content: 'Content 2',
          status: 'published',
          featured: true,
          author_id: 1
        })
      ]);

      const result = await db.getBlogPosts(1, 10);
      
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.currentPage).toBe(1);
      expect(result.hasNextPage).toBe(false);
    });

    it('should search blog posts correctly', async () => {
      await db.createBlogPost({
        title: 'JavaScript Tutorial',
        slug: 'javascript-tutorial',
        content: 'Learn JavaScript fundamentals',
        status: 'published',
        featured: false,
        author_id: 1
      });

      const results = await db.searchBlogPosts('JavaScript');
      
      expect(results.data).toHaveLength(1);
      expect(results.data[0].title).toContain('JavaScript');
    });
  });

  describe('Portfolio Operations', () => {
    it('should create a portfolio project', async () => {
      const projectData = {
        title: 'Test Project',
        slug: 'test-project',
        short_description: 'A test project',
        long_description: 'Detailed description',
        tech_stack: ['React', 'TypeScript', 'Node.js'],
        gallery_images: ['image1.jpg', 'image2.jpg'],
        status: 'completed' as const,
        featured: false,
        project_type: 'web-application'
      };

      const project = await db.createProject(projectData);
      
      expect(project).toBeDefined();
      expect(project.title).toBe(projectData.title);
      expect(project.tech_stack).toEqual(projectData.tech_stack);
      expect(project.gallery_images).toEqual(projectData.gallery_images);
    });

    it('should filter projects by technology', async () => {
      await Promise.all([
        db.createProject({
          title: 'React Project',
          slug: 'react-project',
          short_description: 'React app',
          tech_stack: ['React', 'JavaScript'],
          status: 'completed',
          featured: false
        }),
        db.createProject({
          title: 'Vue Project',
          slug: 'vue-project',
          short_description: 'Vue app',
          tech_stack: ['Vue', 'JavaScript'],
          status: 'completed',
          featured: false
        })
      ]);

      const reactProjects = await db.getPortfolioProjects(1, 10, {
        technology: 'React'
      });
      
      expect(reactProjects.data).toHaveLength(1);
      expect(reactProjects.data[0].title).toBe('React Project');
    });
  });

  describe('Flight Operations', () => {
    beforeEach(async () => {
      // Create test airports
      await Promise.all([
        db.createAirport({
          iata_code: 'JFK',
          name: 'John F Kennedy International',
          city: 'New York',
          country: 'United States',
          country_code: 'US',
          latitude: 40.6413,
          longitude: -73.7781,
          has_visited: false,
          visit_count: 0
        }),
        db.createAirport({
          iata_code: 'LAX',
          name: 'Los Angeles International',
          city: 'Los Angeles',
          country: 'United States',
          country_code: 'US',
          latitude: 33.9425,
          longitude: -118.4081,
          has_visited: false,
          visit_count: 0
        })
      ]);
    });

    it('should create a flight with distance calculation', async () => {
      const airports = await db.getAllAirports();
      const jfk = airports.find(a => a.iata_code === 'JFK');
      const lax = airports.find(a => a.iata_code === 'LAX');

      const flightData = {
        flight_number: 'AA100',
        airline_name: 'American Airlines',
        departure_airport_id: jfk!.id,
        arrival_airport_id: lax!.id,
        departure_date: '2024-01-15',
        flight_class: 'economy' as const,
        flight_status: 'completed' as const,
        currency: 'USD'
      };

      const flight = await db.createFlight(flightData);
      
      expect(flight).toBeDefined();
      expect(flight.flight_number).toBe('AA100');
      expect(flight.distance_km).toBeGreaterThan(3900); // Approximate distance JFK-LAX
    });

    it('should calculate flight statistics correctly', async () => {
      const airports = await db.getAllAirports();
      const jfk = airports.find(a => a.iata_code === 'JFK');
      const lax = airports.find(a => a.iata_code === 'LAX');

      await db.createFlight({
        flight_number: 'AA100',
        departure_airport_id: jfk!.id,
        arrival_airport_id: lax!.id,
        departure_date: '2024-01-15',
        distance_km: 3944,
        duration_minutes: 360,
        flight_class: 'economy',
        flight_status: 'completed',
        currency: 'USD'
      });

      const stats = await db.getFlightStatistics();
      
      expect(stats.totalFlights).toBe(1);
      expect(stats.totalDistance).toBe(3944);
      expect(stats.totalFlightTime).toBe(360);
      expect(stats.uniqueAirports).toBe(2);
    });
  });

  describe('Performance Operations', () => {
    it('should store performance metrics', async () => {
      const metricData = {
        name: 'LCP',
        value: 2400,
        rating: 'good' as const,
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0 Test',
        session_id: 'test-session'
      };

      const metric = await db.createPerformanceMetric(metricData);
      
      expect(metric).toBeDefined();
      expect(metric.name).toBe('LCP');
      expect(metric.value).toBe(2400);
      expect(metric.rating).toBe('good');
    });

    it('should aggregate performance metrics by time range', async () => {
      const now = Date.now();
      
      await Promise.all([
        db.createPerformanceMetric({
          name: 'LCP',
          value: 2000,
          rating: 'good',
          timestamp: now - 3600000, // 1 hour ago
          url: 'https://example.com',
          user_agent: 'Test',
          session_id: 'session1'
        }),
        db.createPerformanceMetric({
          name: 'LCP',
          value: 3000,
          rating: 'needs-improvement',
          timestamp: now - 1800000, // 30 minutes ago
          url: 'https://example.com',
          user_agent: 'Test',
          session_id: 'session2'
        })
      ]);

      const metrics = await db.getPerformanceMetrics({
        timeRange: '24h',
        metricType: 'LCP',
        aggregated: true
      });
      
      expect(metrics.average).toBe(2500);
      expect(metrics.count).toBe(2);
    });
  });
});
```

**End-to-End Testing** (tests/e2e/portfolio.spec.ts):
```typescript
import { test, expect } from '@playwright/test';

test.describe('Portfolio System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/portfolio');
  });

  test('should display portfolio projects correctly', async ({ page }) => {
    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"]');
    
    // Check that projects are displayed
    const projectCards = await page.locator('[data-testid="project-card"]');
    expect(await projectCards.count()).toBeGreaterThan(0);
    
    // Check project card content
    const firstProject = projectCards.first();
    await expect(firstProject.locator('h3')).toBeVisible();
    await expect(firstProject.locator('.project-description')).toBeVisible();
    await expect(firstProject.locator('.tech-stack')).toBeVisible();
  });

  test('should filter projects by technology', async ({ page }) => {
    // Wait for filter controls
    await page.waitForSelector('[data-testid="filter-controls"]');
    
    // Select React filter
    await page.selectOption('[data-testid="technology-filter"]', 'React');
    
    // Wait for filtered results
    await page.waitForTimeout(1000);
    
    // Check that all visible projects contain React
    const projectCards = await page.locator('[data-testid="project-card"]');
    const count = await projectCards.count();
    
    for (let i = 0; i < count; i++) {
      const techStack = await projectCards.nth(i).locator('.tech-stack').textContent();
      expect(techStack).toContain('React');
    }
  });

  test('should navigate to project detail page', async ({ page }) => {
    // Click on first project
    await page.click('[data-testid="project-card"]:first-child h3 a');
    
    // Wait for navigation
    await page.waitForURL(/\/portfolio\/[^/]+$/);
    
    // Check project detail page content
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.project-gallery')).toBeVisible();
    await expect(page.locator('.case-study')).toBeVisible();
  });

  test('should load more projects when scrolling', async ({ page }) => {
    // Get initial project count
    const initialCount = await page.locator('[data-testid="project-card"]').count();
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Wait for load more button or automatic loading
    await page.waitForTimeout(2000);
    
    // Check if more projects loaded
    const newCount = await page.locator('[data-testid="project-card"]').count();
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test('should display project images correctly', async ({ page }) => {
    const projectCard = page.locator('[data-testid="project-card"]').first();
    const image = projectCard.locator('img').first();
    
    // Check image attributes
    await expect(image).toHaveAttribute('loading', 'lazy');
    await expect(image).toHaveAttribute('alt');
    
    // Check image loads successfully
    await expect(image).toBeVisible();
  });
});

test.describe('Flight Map System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/flights');
  });

  test('should display interactive map', async ({ page }) => {
    // Wait for map to initialize
    await page.waitForSelector('.mapboxgl-map', { timeout: 10000 });
    
    // Check map is visible
    await expect(page.locator('.mapboxgl-map')).toBeVisible();
    
    // Check map controls
    await expect(page.locator('.mapboxgl-ctrl-zoom-in')).toBeVisible();
    await expect(page.locator('.mapboxgl-ctrl-zoom-out')).toBeVisible();
  });

  test('should display flight statistics', async ({ page }) => {
    // Wait for statistics to load
    await page.waitForSelector('[data-testid="flight-stats"]');
    
    // Check statistics are displayed
    const stats = page.locator('[data-testid="flight-stats"]');
    await expect(stats.locator('[data-testid="total-flights"]')).toBeVisible();
    await expect(stats.locator('[data-testid="total-distance"]')).toBeVisible();
    await expect(stats.locator('[data-testid="unique-airports"]')).toBeVisible();
  });

  test('should filter flights by year', async ({ page }) => {
    // Select year filter
    await page.selectOption('[data-testid="year-filter"]', '2024');
    
    // Wait for map to update
    await page.waitForTimeout(2000);
    
    // Check that statistics updated
    const totalFlights = await page.locator('[data-testid="total-flights"]').textContent();
    expect(parseInt(totalFlights || '0')).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Performance Optimization', () => {
  test('should meet Core Web Vitals thresholds', async ({ page }) => {
    await page.goto('/');
    
    // Measure Largest Contentful Paint
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        }).observe({ entryTypes: ['largest-contentful-paint'] });
      });
    });
    
    expect(lcp).toBeLessThan(2500); // Good LCP threshold
  });

  test('should load critical resources quickly', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds
  });

  test('should implement proper image lazy loading', async ({ page }) => {
    await page.goto('/portfolio');
    
    const images = await page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < Math.min(count, 5); i++) {
      const image = images.nth(i);
      const loading = await image.getAttribute('loading');
      expect(loading).toBe('lazy');
    }
  });
});
```

## Testing & Validation

### Final Checklist
- [ ] All Core Web Vitals metrics meet "Good" thresholds (LCP <2.5s, FID <100ms, CLS <0.1)
- [ ] Service worker caches resources correctly and serves offline fallbacks
- [ ] Database queries execute within performance budgets (<100ms for simple queries)
- [ ] Unit tests achieve >90% code coverage across all modules
- [ ] End-to-end tests cover all critical user journeys
- [ ] Performance monitoring captures and reports metrics accurately
- [ ] Image optimization reduces file sizes by >60% without quality loss
- [ ] Bundle sizes stay within performance budgets (<100KB main bundle)
- [ ] Lighthouse CI integration prevents performance regressions
- [ ] Error tracking and monitoring systems capture issues correctly

## Success Criteria
✅ Comprehensive performance monitoring system tracks all key metrics  
✅ Advanced caching strategies provide excellent offline experience  
✅ Database optimization ensures fast query performance  
✅ Testing framework provides high confidence in code quality  
✅ Security hardening protects against common vulnerabilities  
✅ Image and media optimization maximizes loading performance  
✅ Monitoring and observability enable proactive issue resolution  
✅ System meets all performance budgets and quality gates  

## Next Session
Plan 8 will focus on deployment configuration, production setup, CI/CD pipeline, and final system integration to make the entire application production-ready.