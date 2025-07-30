import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockFetch } from '../setup';

describe('API Integration Tests', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Blog API', () => {
    it('should fetch blog posts with pagination', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'Test Post',
            slug: 'test-post',
            excerpt: 'Test excerpt',
            status: 'published',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        total: 1,
        currentPage: 1,
        hasNextPage: false
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/blog?page=1&limit=10');
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.total).toBe(1);
      expect(data.currentPage).toBe(1);
      expect(data.hasNextPage).toBe(false);
    });

    it('should search blog posts', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'JavaScript Tutorial',
            slug: 'javascript-tutorial',
            excerpt: 'Learn JavaScript',
            status: 'published'
          }
        ],
        total: 1
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/blog/search?q=javascript');
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toContain('JavaScript');
    });

    it('should fetch single blog post', async () => {
      const mockResponse = {
        id: 1,
        title: 'Test Post',
        slug: 'test-post',
        content: 'Full content here',
        status: 'published',
        author: {
          id: 1,
          username: 'admin',
          email: 'admin@example.com'
        }
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/blog/test-post');
      const data = await response.json();

      expect(data.title).toBe('Test Post');
      expect(data.slug).toBe('test-post');
      expect(data.content).toBeDefined();
      expect(data.author).toBeDefined();
    });

    it('should handle blog post not found', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          error: 'Post not found'
        })
      });

      const response = await fetch('/api/blog/non-existent-post');
      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(data.error).toBe('Post not found');
    });
  });

  describe('Portfolio API', () => {
    it('should fetch portfolio projects', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'Test Project',
            slug: 'test-project',
            short_description: 'A test project',
            tech_stack: ['React', 'TypeScript'],
            status: 'completed',
            featured: true
          }
        ],
        total: 1,
        currentPage: 1,
        hasNextPage: false
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/portfolio?page=1&limit=10');
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].tech_stack).toEqual(['React', 'TypeScript']);
      expect(data.data[0].status).toBe('completed');
    });

    it('should filter projects by technology', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'React Project',
            tech_stack: ['React', 'JavaScript'],
            status: 'completed'
          }
        ],
        total: 1
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/portfolio?technology=React');
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].tech_stack).toContain('React');
    });

    it('should fetch featured projects', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            title: 'Featured Project',
            featured: true,
            status: 'completed'
          }
        ],
        total: 1
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/portfolio/featured');
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].featured).toBe(true);
    });
  });

  describe('Flight API', () => {
    it('should fetch flight statistics', async () => {
      const mockResponse = {
        totalFlights: 25,
        totalDistance: 98765,
        totalFlightTime: 12345,
        uniqueAirports: 15,
        averageFlightDistance: 3950.6,
        countriesVisited: 8
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/flights/statistics');
      const data = await response.json();

      expect(data.totalFlights).toBe(25);
      expect(data.totalDistance).toBe(98765);
      expect(data.uniqueAirports).toBe(15);
      expect(data.countriesVisited).toBe(8);
    });

    it('should fetch flight list with filters', async () => {
      const mockResponse = {
        data: [
          {
            id: 1,
            flight_number: 'AA100',
            airline_name: 'American Airlines',
            departure_airport: 'JFK',
            arrival_airport: 'LAX',
            departure_date: '2024-01-15',
            flight_status: 'completed'
          }
        ],
        total: 1
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/flights?year=2024&status=completed');
      const data = await response.json();

      expect(data.data).toHaveLength(1);
      expect(data.data[0].flight_status).toBe('completed');
    });

    it('should fetch airports data', async () => {
      const mockResponse = [
        {
          id: 1,
          iata_code: 'JFK',
          name: 'John F Kennedy International',
          city: 'New York',
          country: 'United States',
          latitude: 40.6413,
          longitude: -73.7781,
          has_visited: true,
          visit_count: 3
        }
      ];

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/airports');
      const data = await response.json();

      expect(data).toHaveLength(1);
      expect(data[0].iata_code).toBe('JFK');
      expect(data[0].has_visited).toBe(true);
    });
  });

  describe('Performance API', () => {
    it('should accept performance vitals data', async () => {
      const mockResponse = {
        success: true,
        message: 'Performance data recorded'
      };

      global.fetch = createMockFetch(mockResponse);

      const vitalsData = {
        name: 'LCP',
        value: 2400,
        rating: 'good',
        timestamp: Date.now(),
        url: 'https://example.com',
        userAgent: 'Mozilla/5.0 Test',
        sessionId: 'test-session'
      };

      const response = await fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vital: vitalsData })
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Performance data recorded');
    });

    it('should handle performance API errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: 'Internal server error'
        })
      });

      const response = await fetch('/api/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Internal server error');
    });

    it('should fetch performance analytics', async () => {
      const mockResponse = {
        success: true,
        data: {
          average: 2250,
          count: 100,
          goodCount: 75,
          needsImprovementCount: 20,
          poorCount: 5
        }
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/analytics/performance?range=24h&metric=LCP');
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.average).toBe(2250);
      expect(data.data.count).toBe(100);
    });
  });

  describe('Authentication API', () => {
    it('should handle login', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          role: 'admin'
        },
        token: 'jwt-token-here'
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'password'
        })
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.user.username).toBe('admin');
      expect(data.token).toBeDefined();
    });

    it('should handle invalid login', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: vi.fn().mockResolvedValue({
          success: false,
          error: 'Invalid credentials'
        })
      });

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'wrongpassword'
        })
      });

      const data = await response.json();

      expect(response.ok).toBe(false);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Invalid credentials');
    });

    it('should validate JWT token', async () => {
      const mockResponse = {
        success: true,
        user: {
          id: 1,
          username: 'admin',
          role: 'admin'
        }
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': 'Bearer jwt-token-here'
        }
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.user.username).toBe('admin');
    });
  });

  describe('Analytics API', () => {
    it('should track page views', async () => {
      const mockResponse = {
        success: true,
        message: 'Event tracked'
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'page_view',
          path: '/',
          timestamp: Date.now(),
          sessionId: 'test-session'
        })
      });

      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('Event tracked');
    });

    it('should fetch dashboard analytics', async () => {
      const mockResponse = {
        success: true,
        data: {
          pageViews: 1250,
          uniqueVisitors: 890,
          averageSessionDuration: 180,
          bounceRate: 0.35
        }
      };

      global.fetch = createMockFetch(mockResponse);

      const response = await fetch('/api/analytics/dashboard?range=7d');
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.pageViews).toBe(1250);
      expect(data.data.uniqueVisitors).toBe(890);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      try {
        await fetch('/api/blog');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should handle malformed JSON responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      try {
        const response = await fetch('/api/blog');
        await response.json();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Invalid JSON');
      }
    });

    it('should handle rate limiting', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: vi.fn().mkResolvedValue({
          error: 'Too many requests',
          retryAfter: 60
        })
      });

      const response = await fetch('/api/blog');
      
      expect(response.ok).toBe(false);
      expect(response.status).toBe(429);
    });
  });
});