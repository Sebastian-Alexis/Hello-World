import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DatabaseQueries } from '../../src/lib/db/queries';
import type { BlogPost, Project, Flight } from '../../src/lib/db/types';

describe('DatabaseQueries', () => {
  let db: DatabaseQueries;

  beforeEach(async () => {
    //initialize test database
    db = new DatabaseQueries(':memory:');
    await db.initializeSchema();
    await db.initializeTestData();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
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
      expect(post.created_at).toBeDefined();
      expect(post.updated_at).toBeDefined();
    });

    it('should retrieve paginated blog posts', async () => {
      //create test posts
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
      expect(result.data[0].title).toBeDefined();
    });

    it('should search blog posts correctly', async () => {
      await db.createBlogPost({
        title: 'JavaScript Tutorial',
        slug: 'javascript-tutorial',
        content: 'Learn JavaScript fundamentals and advanced concepts',
        status: 'published',
        featured: false,
        author_id: 1
      });

      const results = await db.searchBlogPosts('JavaScript');
      
      expect(results.data).toHaveLength(1);
      expect(results.data[0].title).toContain('JavaScript');
      expect(results.total).toBe(1);
    });

    it('should filter blog posts by status', async () => {
      await Promise.all([
        db.createBlogPost({
          title: 'Published Post',
          slug: 'published-post',
          content: 'Published content',
          status: 'published',
          featured: false,
          author_id: 1
        }),
        db.createBlogPost({
          title: 'Draft Post',
          slug: 'draft-post',
          content: 'Draft content',
          status: 'draft',
          featured: false,
          author_id: 1
        })
      ]);

      const publishedResults = await db.getBlogPosts(1, 10, { status: 'published' });
      const draftResults = await db.getBlogPosts(1, 10, { status: 'draft' });
      
      expect(publishedResults.data).toHaveLength(1);
      expect(publishedResults.data[0].status).toBe('published');
      expect(draftResults.data).toHaveLength(1);
      expect(draftResults.data[0].status).toBe('draft');
    });

    it('should handle blog post categories and tags', async () => {
      const post = await db.createBlogPost({
        title: 'Tagged Post',
        slug: 'tagged-post',
        content: 'Content with tags',
        status: 'published',
        featured: false,
        author_id: 1,
        category: 'Technology',
        tags: ['javascript', 'web-development', 'tutorial']
      });

      expect(post.category).toBe('Technology');
      expect(post.tags).toEqual(['javascript', 'web-development', 'tutorial']);
    });
  });

  describe('Portfolio Operations', () => {
    it('should create a portfolio project', async () => {
      const projectData = {
        title: 'Test Project',
        slug: 'test-project',
        short_description: 'A test project',
        long_description: 'Detailed description of the test project',
        tech_stack: ['React', 'TypeScript', 'Node.js'],
        gallery_images: ['image1.jpg', 'image2.jpg'],
        status: 'completed' as const,
        featured: false,
        project_type: 'web-application',
        github_url: 'https://github.com/test/project',
        live_url: 'https://testproject.com'
      };

      const project = await db.createProject(projectData);
      
      expect(project).toBeDefined();
      expect(project.title).toBe(projectData.title);
      expect(project.tech_stack).toEqual(projectData.tech_stack);
      expect(project.gallery_images).toEqual(projectData.gallery_images);
      expect(project.status).toBe('completed');
      expect(project.created_at).toBeDefined();
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
      expect(reactProjects.data[0].tech_stack).toContain('React');
    });

    it('should get featured projects', async () => {
      await Promise.all([
        db.createProject({
          title: 'Featured Project',
          slug: 'featured-project',
          short_description: 'Featured project',
          tech_stack: ['React'],
          status: 'completed',
          featured: true
        }),
        db.createProject({
          title: 'Regular Project',
          slug: 'regular-project',
          short_description: 'Regular project',
          tech_stack: ['Vue'],
          status: 'completed',
          featured: false
        })
      ]);

      const featuredProjects = await db.getPortfolioProjects(1, 10, {
        featured: true
      });
      
      expect(featuredProjects.data).toHaveLength(1);
      expect(featuredProjects.data[0].featured).toBe(true);
      expect(featuredProjects.data[0].title).toBe('Featured Project');
    });
  });

  describe('Flight Operations', () => {
    beforeEach(async () => {
      //create test airports
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

      expect(jfk).toBeDefined();
      expect(lax).toBeDefined();

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
      expect(flight.distance_km).toBeGreaterThan(3900); //approximate distance JFK-LAX
      expect(flight.distance_km).toBeLessThan(4000);
    });

    it('should calculate flight statistics correctly', async () => {
      const airports = await db.getAllAirports();
      const jfk = airports.find(a => a.iata_code === 'JFK');
      const lax = airports.find(a => a.iata_code === 'LAX');

      const flight = await db.createFlight({
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
      expect(stats.averageFlightDistance).toBe(3944);
    });

    it('should update airport visit counts', async () => {
      const airports = await db.getAllAirports();
      const jfk = airports.find(a => a.iata_code === 'JFK');
      const lax = airports.find(a => a.iata_code === 'LAX');

      await db.createFlight({
        flight_number: 'AA100',
        departure_airport_id: jfk!.id,
        arrival_airport_id: lax!.id,
        departure_date: '2024-01-15',
        flight_class: 'economy',
        flight_status: 'completed',
        currency: 'USD'
      });

      const updatedAirports = await db.getAllAirports();
      const updatedJfk = updatedAirports.find(a => a.iata_code === 'JFK');
      const updatedLax = updatedAirports.find(a => a.iata_code === 'LAX');

      expect(updatedJfk?.has_visited).toBe(true);
      expect(updatedJfk?.visit_count).toBe(1);
      expect(updatedLax?.has_visited).toBe(true);
      expect(updatedLax?.visit_count).toBe(1);
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
      expect(metric.session_id).toBe('test-session');
    });

    it('should aggregate performance metrics by time range', async () => {
      const now = Date.now();
      
      await Promise.all([
        db.createPerformanceMetric({
          name: 'LCP',
          value: 2000,
          rating: 'good',
          timestamp: now - 3600000, //1 hour ago
          url: 'https://example.com',
          user_agent: 'Test',
          session_id: 'session1'
        }),
        db.createPerformanceMetric({
          name: 'LCP',
          value: 3000,
          rating: 'needs-improvement',
          timestamp: now - 1800000, //30 minutes ago
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
      expect(metrics.goodCount).toBe(1);
      expect(metrics.poorCount).toBe(0);
      expect(metrics.needsImprovementCount).toBe(1);
    });

    it('should filter performance metrics by rating', async () => {
      await Promise.all([
        db.createPerformanceMetric({
          name: 'CLS',
          value: 0.05,
          rating: 'good',
          timestamp: Date.now(),
          url: 'https://example.com',
          user_agent: 'Test',
          session_id: 'session1'
        }),
        db.createPerformanceMetric({
          name: 'CLS',
          value: 0.3,
          rating: 'poor',
          timestamp: Date.now(),
          url: 'https://example.com',
          user_agent: 'Test',
          session_id: 'session2'
        })
      ]);

      const goodMetrics = await db.getPerformanceMetrics({
        rating: 'good',
        metricType: 'CLS'
      });

      const poorMetrics = await db.getPerformanceMetrics({
        rating: 'poor',
        metricType: 'CLS'
      });
      
      expect(goodMetrics.data).toHaveLength(1);
      expect(goodMetrics.data[0].rating).toBe('good');
      expect(poorMetrics.data).toHaveLength(1);
      expect(poorMetrics.data[0].rating).toBe('poor');
    });
  });

  describe('Authentication Operations', () => {
    it('should create and authenticate users', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'securepassword123',
        role: 'user' as const
      };

      const user = await db.createUser(userData);
      
      expect(user).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe('user');
      expect(user.password_hash).toBeDefined();
      expect(user.password_hash).not.toBe(userData.password);
    });

    it('should validate user credentials', async () => {
      const userData = {
        username: 'testuser2',
        email: 'test2@example.com',
        password: 'securepassword123',
        role: 'admin' as const
      };

      await db.createUser(userData);
      
      const validUser = await db.validateUser('testuser2', 'securepassword123');
      const invalidUser = await db.validateUser('testuser2', 'wrongpassword');
      
      expect(validUser).toBeDefined();
      expect(validUser?.username).toBe('testuser2');
      expect(invalidUser).toBeNull();
    });
  });

  describe('Database Error Handling', () => {
    it('should handle duplicate slug creation', async () => {
      await db.createBlogPost({
        title: 'First Post',
        slug: 'duplicate-slug',
        content: 'First content',
        status: 'published',
        featured: false,
        author_id: 1
      });

      await expect(db.createBlogPost({
        title: 'Second Post',
        slug: 'duplicate-slug',
        content: 'Second content',
        status: 'published',
        featured: false,
        author_id: 1
      })).rejects.toThrow();
    });

    it('should handle missing foreign key references', async () => {
      await expect(db.createBlogPost({
        title: 'Test Post',
        slug: 'test-post',
        content: 'Content',
        status: 'published',
        featured: false,
        author_id: 999 //non-existent user
      })).rejects.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      const closedDb = new DatabaseQueries(':memory:');
      await closedDb.close();

      await expect(closedDb.getBlogPosts(1, 10)).rejects.toThrow();
    });
  });
});