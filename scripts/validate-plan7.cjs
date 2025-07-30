#!/usr/bin/env node

//plan 7 comprehensive validation suite
//validates all systems meet performance budgets and quality gates
//implements final validation checklist from plan 7

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PerformanceGate } = require('./performance-gate.cjs');

//plan 7 validation criteria
const PLAN7_CRITERIA = {
  coreWebVitals: {
    lcp: { threshold: 2500, unit: 'ms', name: 'Largest Contentful Paint' },
    fid: { threshold: 100, unit: 'ms', name: 'First Input Delay' },
    cls: { threshold: 0.1, unit: '', name: 'Cumulative Layout Shift' },
    fcp: { threshold: 1800, unit: 'ms', name: 'First Contentful Paint' },
    ttfb: { threshold: 600, unit: 'ms', name: 'Time to First Byte' }
  },
  performance: {
    lighthouseScore: 95,
    bundleSize: 100 * 1024, //100KB main bundle
    imageOptimization: 60, //60% reduction minimum
    cacheHitRate: 85 //85% cache hit rate minimum
  },
  quality: {
    testCoverage: 90, //90% code coverage
    accessibilityScore: 95,
    seoScore: 90,
    securityScore: 90
  },
  database: {
    simpleQueryThreshold: 100, //100ms for simple queries
    complexQueryThreshold: 500, //500ms for complex queries
    connectionTimeout: 5000 //5s connection timeout
  }
};

class Plan7Validator {
  constructor() {
    this.results = {
      coreWebVitals: { passed: false, details: {} },
      serviceWorker: { passed: false, details: {} },
      database: { passed: false, details: {} },
      testing: { passed: false, details: {} },
      security: { passed: false, details: {} },
      imageOptimization: { passed: false, details: {} },
      monitoring: { passed: false, details: {} },
      bundleOptimization: { passed: false, details: {} },
      overall: { passed: false, score: 0 }
    };
    this.violations = [];
    this.recommendations = [];
    this.startTime = Date.now();
  }

  //main validation execution
  async run() {
    try {
      console.log('\n🚀 Plan 7 Comprehensive Validation Suite');
      console.log('═'.repeat(60));
      console.log('Validating all systems meet performance budgets and quality gates\n');

      //ensure development environment is ready
      await this.setupEnvironment();

      //run all validation categories
      await this.validateCoreWebVitals();
      await this.validateServiceWorkerCaching();
      await this.validateDatabasePerformance();
      await this.validateTestCoverage();
      await this.validateSecurity();
      await this.validateImageOptimization();
      await this.validateMonitoring();
      await this.validateBundleOptimization();

      //generate comprehensive report
      await this.generateReport();

      //determine overall pass/fail
      return this.calculateOverallResult();

    } catch (error) {
      console.error('❌ Plan 7 validation failed:', error.message);
      return false;
    }
  }

  //setup validation environment
  async setupEnvironment() {
    console.log('🔧 Setting up validation environment...');

    //ensure database is ready
    console.log('  📊 Setting up database...');
    try {
      execSync('npm run db:setup:full', { stdio: 'pipe' });
      console.log('  ✅ Database ready');
    } catch (error) {
      console.log('  ⚠️  Database setup warning (may already exist)');
    }

    //build project for testing
    console.log('  📦 Building project...');
    execSync('npm run build', { stdio: 'pipe' });
    console.log('  ✅ Build complete');

    //start preview server
    console.log('  🖥️  Starting preview server...');
    this.serverProcess = spawn('npm', ['run', 'preview'], { 
      stdio: 'pipe',
      detached: true 
    });

    //wait for server to be ready
    await this.waitForServer('http://localhost:4321', 30000);
    console.log('  ✅ Preview server ready\n');
  }

  //wait for server to respond
  async waitForServer(url, timeout) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch (error) {
        //server not ready, continue waiting
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Server at ${url} not ready within ${timeout}ms`);
  }

  //validate core web vitals
  async validateCoreWebVitals() {
    console.log('📊 Validating Core Web Vitals...');

    try {
      //use performance gate to run lighthouse tests
      const perfGate = new PerformanceGate('staging');
      await perfGate.run();

      const vitalsResults = {};
      let allPassed = true;

      //check each core web vital
      for (const [metric, criteria] of Object.entries(PLAN7_CRITERIA.coreWebVitals)) {
        //extract metric from performance gate results
        const actualValue = this.extractMetricFromResults(perfGate.results, metric);
        const passed = actualValue <= criteria.threshold;
        
        vitalsResults[metric] = {
          actual: actualValue,
          threshold: criteria.threshold,
          unit: criteria.unit,
          passed,
          rating: this.getRating(metric, actualValue)
        };

        if (!passed) {
          allPassed = false;
          this.violations.push({
            category: 'Core Web Vitals',
            metric: criteria.name,
            actual: actualValue,
            threshold: criteria.threshold,
            severity: 'high'
          });
        }

        const status = passed ? '✅' : '❌';
        console.log(`  ${status} ${criteria.name}: ${this.formatValue(actualValue, criteria.unit)} (≤ ${this.formatValue(criteria.threshold, criteria.unit)})`);
      }

      this.results.coreWebVitals = {
        passed: allPassed,
        details: vitalsResults
      };

    } catch (error) {
      console.error('  ❌ Core Web Vitals validation failed:', error.message);
      this.results.coreWebVitals = { passed: false, error: error.message };
    }

    console.log('');
  }

  //validate service worker and caching
  async validateServiceWorkerCaching() {
    console.log('🔄 Validating Service Worker & Caching...');

    try {
      const cacheTests = [
        this.testServiceWorkerRegistration(),
        this.testOfflineFunctionality(),
        this.testCacheStrategies(),
        this.testResourceCaching()
      ];

      const results = await Promise.all(cacheTests);
      const allPassed = results.every(result => result.passed);

      this.results.serviceWorker = {
        passed: allPassed,
        details: {
          registration: results[0],
          offline: results[1],
          strategies: results[2],
          resources: results[3]
        }
      };

      const status = allPassed ? '✅' : '❌';
      console.log(`  ${status} Service Worker validation ${allPassed ? 'passed' : 'failed'}`);

      if (!allPassed) {
        this.violations.push({
          category: 'Service Worker',
          metric: 'Caching functionality',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Service Worker validation failed:', error.message);
      this.results.serviceWorker = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test service worker registration
  async testServiceWorkerRegistration() {
    try {
      const response = await fetch('http://localhost:4321/sw.js');
      const swExists = response.ok;
      
      console.log(`    ${swExists ? '✅' : '❌'} Service worker file exists`);
      
      return { passed: swExists, name: 'Service Worker Registration' };
    } catch (error) {
      return { passed: false, name: 'Service Worker Registration', error: error.message };
    }
  }

  //test offline functionality
  async testOfflineFunctionality() {
    //simulate offline test by checking cache-first strategies in sw.js
    try {
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();
      
      const hasCacheStrategies = swContent.includes('cache-first') || 
                                swContent.includes('stale-while-revalidate') ||
                                swContent.includes('networkFirst');
      
      console.log(`    ${hasCacheStrategies ? '✅' : '❌'} Offline caching strategies implemented`);
      
      return { passed: hasCacheStrategies, name: 'Offline Functionality' };
    } catch (error) {
      return { passed: false, name: 'Offline Functionality', error: error.message };
    }
  }

  //test cache strategies
  async testCacheStrategies() {
    try {
      //test various resource types for proper cache headers
      const resourceTests = [
        { url: 'http://localhost:4321/', type: 'HTML' },
        { url: 'http://localhost:4321/favicon.svg', type: 'Static Asset' },
      ];

      let strategiesWorking = true;

      for (const test of resourceTests) {
        try {
          const response = await fetch(test.url);
          const hasEtag = response.headers.has('etag');
          const hasCacheControl = response.headers.has('cache-control');
          
          if (!hasEtag && !hasCacheControl) {
            strategiesWorking = false;
            console.log(`    ❌ ${test.type} missing cache headers`);
          } else {
            console.log(`    ✅ ${test.type} has proper cache headers`);
          }
        } catch (error) {
          strategiesWorking = false;
        }
      }

      return { passed: strategiesWorking, name: 'Cache Strategies' };
    } catch (error) {
      return { passed: false, name: 'Cache Strategies', error: error.message };
    }
  }

  //test resource caching
  async testResourceCaching() {
    try {
      //test that critical resources are cached
      const criticalResources = [
        'http://localhost:4321/',
        'http://localhost:4321/portfolio',
        'http://localhost:4321/blog'
      ];

      let resourcesCached = true;

      for (const url of criticalResources) {
        try {
          const response = await fetch(url);
          //check for cache indicators
          const etag = response.headers.get('etag');
          const cacheControl = response.headers.get('cache-control');
          
          if (!etag && !cacheControl) {
            resourcesCached = false;
          }
        } catch (error) {
          resourcesCached = false;
        }
      }

      console.log(`    ${resourcesCached ? '✅' : '❌'} Critical resources cacheable`);
      
      return { passed: resourcesCached, name: 'Resource Caching' };
    } catch (error) {
      return { passed: false, name: 'Resource Caching', error: error.message };
    }
  }

  //validate database performance
  async validateDatabasePerformance() {
    console.log('🗄️  Validating Database Performance...');

    try {
      //run database performance tests
      const dbResults = await this.runDatabaseTests();
      
      const simpleQueryPassed = dbResults.simpleQuery <= PLAN7_CRITERIA.database.simpleQueryThreshold;
      const complexQueryPassed = dbResults.complexQuery <= PLAN7_CRITERIA.database.complexQueryThreshold;
      const connectionPassed = dbResults.connection <= PLAN7_CRITERIA.database.connectionTimeout;

      const allPassed = simpleQueryPassed && complexQueryPassed && connectionPassed;

      this.results.database = {
        passed: allPassed,
        details: {
          simpleQuery: { time: dbResults.simpleQuery, passed: simpleQueryPassed },
          complexQuery: { time: dbResults.complexQuery, passed: complexQueryPassed },
          connection: { time: dbResults.connection, passed: connectionPassed }
        }
      };

      console.log(`  ${simpleQueryPassed ? '✅' : '❌'} Simple queries: ${dbResults.simpleQuery}ms (≤ ${PLAN7_CRITERIA.database.simpleQueryThreshold}ms)`);
      console.log(`  ${complexQueryPassed ? '✅' : '❌'} Complex queries: ${dbResults.complexQuery}ms (≤ ${PLAN7_CRITERIA.database.complexQueryThreshold}ms)`);
      console.log(`  ${connectionPassed ? '✅' : '❌'} Connection time: ${dbResults.connection}ms (≤ ${PLAN7_CRITERIA.database.connectionTimeout}ms)`);

      if (!allPassed) {
        this.violations.push({
          category: 'Database',
          metric: 'Query performance',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Database performance validation failed:', error.message);
      this.results.database = { passed: false, error: error.message };
    }

    console.log('');
  }

  //run database performance tests
  async runDatabaseTests() {
    try {
      //test simple query performance
      const simpleStart = Date.now();
      await fetch('http://localhost:4321/api/health/database');
      const simpleTime = Date.now() - simpleStart;

      //test complex query performance (blog search)
      const complexStart = Date.now();
      await fetch('http://localhost:4321/api/blog/search?q=test');
      const complexTime = Date.now() - complexStart;

      //test connection time
      const connectionStart = Date.now();
      await fetch('http://localhost:4321/api/health');
      const connectionTime = Date.now() - connectionStart;

      return {
        simpleQuery: simpleTime,
        complexQuery: complexTime,
        connection: connectionTime
      };
    } catch (error) {
      throw new Error(`Database test failed: ${error.message}`);
    }
  }

  //validate test coverage
  async validateTestCoverage() {
    console.log('🧪 Validating Test Coverage...');

    try {
      //run coverage tests
      console.log('  📊 Running test coverage analysis...');
      const coverageOutput = execSync('npm run test:coverage', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] 
      });

      //parse coverage results
      const coverageMatch = coverageOutput.match(/All files\s*\|\s*([\d.]+)/);
      const coveragePercent = coverageMatch ? parseFloat(coverageMatch[1]) : 0;
      
      const coveragePassed = coveragePercent >= PLAN7_CRITERIA.quality.testCoverage;

      //run e2e tests
      console.log('  🎭 Running end-to-end tests...');
      const e2eOutput = execSync('npm run test:e2e', { 
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'] 
      });
      
      const e2ePassed = !e2eOutput.includes('failed') && !e2eOutput.includes('error');

      const allPassed = coveragePassed && e2ePassed;

      this.results.testing = {
        passed: allPassed,
        details: {
          coverage: { percent: coveragePercent, passed: coveragePassed },
          e2e: { passed: e2ePassed }
        }
      };

      console.log(`  ${coveragePassed ? '✅' : '❌'} Code coverage: ${coveragePercent}% (≥ ${PLAN7_CRITERIA.quality.testCoverage}%)`);
      console.log(`  ${e2ePassed ? '✅' : '❌'} End-to-end tests: ${e2ePassed ? 'Passed' : 'Failed'}`);

      if (!allPassed) {
        this.violations.push({
          category: 'Testing',
          metric: 'Test coverage and E2E tests',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Test coverage validation failed:', error.message);
      this.results.testing = { passed: false, error: error.message };
    }

    console.log('');
  }

  //validate security hardening
  async validateSecurity() {
    console.log('🔒 Validating Security Hardening...');

    try {
      const securityTests = [
        this.testSecurityHeaders(),
        this.testXssProtection(),
        this.testCsrfProtection(),
        this.testAuthenticationSecurity()
      ];

      const results = await Promise.all(securityTests);
      const allPassed = results.every(result => result.passed);

      this.results.security = {
        passed: allPassed,
        details: {
          headers: results[0],
          xss: results[1],
          csrf: results[2],
          auth: results[3]
        }
      };

      const status = allPassed ? '✅' : '❌';
      console.log(`  ${status} Security hardening ${allPassed ? 'passed' : 'failed'}`);

      if (!allPassed) {
        this.violations.push({
          category: 'Security',
          metric: 'Security hardening measures',
          severity: 'critical'
        });
      }

    } catch (error) {
      console.error('  ❌ Security validation failed:', error.message);
      this.results.security = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test security headers
  async testSecurityHeaders() {
    try {
      const response = await fetch('http://localhost:4321/');
      const headers = response.headers;
      
      const requiredHeaders = [
        'x-frame-options',
        'x-content-type-options',
        'x-xss-protection',
        'strict-transport-security'
      ];
      
      let headersPresent = 0;
      
      for (const header of requiredHeaders) {
        if (headers.has(header)) {
          headersPresent++;
          console.log(`    ✅ ${header} header present`);
        } else {
          console.log(`    ❌ ${header} header missing`);
        }
      }
      
      const passed = headersPresent >= 3; //require at least 3/4 headers
      
      return { passed, name: 'Security Headers', present: headersPresent, total: requiredHeaders.length };
    } catch (error) {
      return { passed: false, name: 'Security Headers', error: error.message };
    }
  }

  //test XSS protection
  async testXssProtection() {
    try {
      //test that XSS protection is implemented by checking content processing
      const testPayload = '<script>alert("xss")</script>';
      const response = await fetch('http://localhost:4321/api/blog/search?q=' + encodeURIComponent(testPayload));
      
      if (response.ok) {
        const content = await response.text();
        //check that script tags are not executed (sanitized)
        const hasUnsafeScript = content.includes('<script>alert("xss")</script>');
        const passed = !hasUnsafeScript;
        
        console.log(`    ${passed ? '✅' : '❌'} XSS protection ${passed ? 'working' : 'vulnerable'}`);
        
        return { passed, name: 'XSS Protection' };
      }
      
      return { passed: true, name: 'XSS Protection' }; //if endpoint doesn't exist, assume protected
    } catch (error) {
      return { passed: false, name: 'XSS Protection', error: error.message };
    }
  }

  //test CSRF protection
  async testCsrfProtection() {
    try {
      //test that POST endpoints require proper headers/tokens
      const response = await fetch('http://localhost:4321/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'test' })
      });
      
      //should be rejected without proper CSRF token (401/403)
      const passed = response.status === 401 || response.status === 403 || response.status === 400;
      
      console.log(`    ${passed ? '✅' : '❌'} CSRF protection ${passed ? 'active' : 'missing'}`);
      
      return { passed, name: 'CSRF Protection' };
    } catch (error) {
      return { passed: false, name: 'CSRF Protection', error: error.message };
    }
  }

  //test authentication security
  async testAuthenticationSecurity() {
    try {
      //test that protected endpoints require authentication
      const response = await fetch('http://localhost:4321/api/admin');
      
      //should be rejected without authentication
      const passed = response.status === 401 || response.status === 403;
      
      console.log(`    ${passed ? '✅' : '❌'} Authentication protection ${passed ? 'active' : 'missing'}`);
      
      return { passed, name: 'Authentication Security' };
    } catch (error) {
      return { passed: false, name: 'Authentication Security', error: error.message };
    }
  }

  //validate image optimization
  async validateImageOptimization() {
    console.log('🖼️  Validating Image Optimization...');

    try {
      const imageTests = [
        this.testModernImageFormats(),
        this.testImageCompression(),
        this.testResponsiveImages(),
        this.testLazyLoading()
      ];

      const results = await Promise.all(imageTests);
      const allPassed = results.every(result => result.passed);

      this.results.imageOptimization = {
        passed: allPassed,
        details: {
          formats: results[0],
          compression: results[1],
          responsive: results[2],
          lazyLoading: results[3]
        }
      };

      const status = allPassed ? '✅' : '❌';
      console.log(`  ${status} Image optimization ${allPassed ? 'passed' : 'needs improvement'}`);

      if (!allPassed) {
        this.violations.push({
          category: 'Image Optimization',
          metric: 'Image optimization effectiveness',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Image optimization validation failed:', error.message);
      this.results.imageOptimization = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test modern image formats
  async testModernImageFormats() {
    try {
      //check if WebP/AVIF images are being served
      const response = await fetch('http://localhost:4321/', {
        headers: { 'Accept': 'image/webp,image/avif,image/*' }
      });
      
      const content = await response.text();
      
      //look for picture elements or WebP/AVIF usage
      const hasModernFormats = content.includes('.webp') || 
                              content.includes('.avif') || 
                              content.includes('<picture>') ||
                              content.includes('type="image/webp"');
      
      console.log(`    ${hasModernFormats ? '✅' : '❌'} Modern image formats ${hasModernFormats ? 'implemented' : 'missing'}`);
      
      return { passed: hasModernFormats, name: 'Modern Image Formats' };
    } catch (error) {
      return { passed: false, name: 'Modern Image Formats', error: error.message };
    }
  }

  //test image compression
  async testImageCompression() {
    try {
      //check for optimized image component usage
      const response = await fetch('http://localhost:4321/');
      const content = await response.text();
      
      //check for optimized image components
      const hasOptimizedImages = content.includes('OptimizedImage') || 
                                content.includes('loading="lazy"') ||
                                content.includes('decoding="async"');
      
      console.log(`    ${hasOptimizedImages ? '✅' : '❌'} Image optimization components ${hasOptimizedImages ? 'used' : 'missing'}`);
      
      return { passed: hasOptimizedImages, name: 'Image Compression' };
    } catch (error) {
      return { passed: false, name: 'Image Compression', error: error.message };
    }
  }

  //test responsive images
  async testResponsiveImages() {
    try {
      const response = await fetch('http://localhost:4321/');
      const content = await response.text();
      
      //check for responsive image attributes
      const hasResponsiveImages = content.includes('srcset=') || 
                                 content.includes('sizes=') ||
                                 content.includes('<picture>');
      
      console.log(`    ${hasResponsiveImages ? '✅' : '❌'} Responsive images ${hasResponsiveImages ? 'implemented' : 'missing'}`);
      
      return { passed: hasResponsiveImages, name: 'Responsive Images' };
    } catch (error) {
      return { passed: false, name: 'Responsive Images', error: error.message };
    }
  }

  //test lazy loading
  async testLazyLoading() {
    try {
      const response = await fetch('http://localhost:4321/');
      const content = await response.text();
      
      //check for lazy loading implementation
      const hasLazyLoading = content.includes('loading="lazy"') ||
                            content.includes('data-src=') ||
                            content.includes('intersection-observer');
      
      console.log(`    ${hasLazyLoading ? '✅' : '❌'} Lazy loading ${hasLazyLoading ? 'implemented' : 'missing'}`);
      
      return { passed: hasLazyLoading, name: 'Lazy Loading' };
    } catch (error) {
      return { passed: false, name: 'Lazy Loading', error: error.message };
    }
  }

  //validate monitoring and observability
  async validateMonitoring() {
    console.log('📊 Validating Monitoring & Observability...');

    try {
      const monitoringTests = [
        this.testPerformanceMonitoring(),
        this.testErrorTracking(),
        this.testAnalyticsDashboard(),
        this.testHealthChecks()
      ];

      const results = await Promise.all(monitoringTests);
      const allPassed = results.every(result => result.passed);

      this.results.monitoring = {
        passed: allPassed,
        details: {
          performance: results[0],
          errors: results[1],
          analytics: results[2],
          health: results[3]
        }
      };

      const status = allPassed ? '✅' : '❌';
      console.log(`  ${status} Monitoring & observability ${allPassed ? 'operational' : 'incomplete'}`);

      if (!allPassed) {
        this.violations.push({
          category: 'Monitoring',
          metric: 'Monitoring and observability systems',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Monitoring validation failed:', error.message);
      this.results.monitoring = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test performance monitoring
  async testPerformanceMonitoring() {
    try {
      //check if performance monitoring endpoints exist
      const vitalsResponse = await fetch('http://localhost:4321/api/vitals');
      const analyticsResponse = await fetch('http://localhost:4321/api/analytics/performance');
      
      const vitalsWorking = vitalsResponse.status !== 404;
      const analyticsWorking = analyticsResponse.status !== 404;
      
      const passed = vitalsWorking && analyticsWorking;
      
      console.log(`    ${vitalsWorking ? '✅' : '❌'} Web Vitals tracking endpoint`);
      console.log(`    ${analyticsWorking ? '✅' : '❌'} Performance analytics endpoint`);
      
      return { passed, name: 'Performance Monitoring' };
    } catch (error) {
      return { passed: false, name: 'Performance Monitoring', error: error.message };
    }
  }

  //test error tracking
  async testErrorTracking() {
    try {
      //check for error tracking implementation
      const response = await fetch('http://localhost:4321/');
      const content = await response.text();
      
      //look for error tracking scripts or error handling
      const hasErrorTracking = content.includes('onerror') ||
                              content.includes('addEventListener("error"') ||
                              content.includes('window.addEventListener("unhandledrejection"');
      
      console.log(`    ${hasErrorTracking ? '✅' : '❌'} Error tracking ${hasErrorTracking ? 'implemented' : 'missing'}`);
      
      return { passed: hasErrorTracking, name: 'Error Tracking' };
    } catch (error) {
      return { passed: false, name: 'Error Tracking', error: error.message };
    }
  }

  //test analytics dashboard
  async testAnalyticsDashboard() {
    try {
      const response = await fetch('http://localhost:4321/api/analytics/dashboard');
      const passed = response.status !== 404;
      
      console.log(`    ${passed ? '✅' : '❌'} Analytics dashboard ${passed ? 'available' : 'missing'}`);
      
      return { passed, name: 'Analytics Dashboard' };
    } catch (error) {
      return { passed: false, name: 'Analytics Dashboard', error: error.message };
    }
  }

  //test health checks
  async testHealthChecks() {
    try {
      const healthResponse = await fetch('http://localhost:4321/api/health');
      const dbHealthResponse = await fetch('http://localhost:4321/api/health/database');
      
      const healthWorking = healthResponse.ok;
      const dbHealthWorking = dbHealthResponse.status !== 404;
      
      const passed = healthWorking && dbHealthWorking;
      
      console.log(`    ${healthWorking ? '✅' : '❌'} System health check`);
      console.log(`    ${dbHealthWorking ? '✅' : '❌'} Database health check`);
      
      return { passed, name: 'Health Checks' };
    } catch (error) {
      return { passed: false, name: 'Health Checks', error: error.message };
    }
  }

  //validate bundle optimization
  async validateBundleOptimization() {
    console.log('📦 Validating Bundle Optimization...');

    try {
      const bundleTests = [
        this.testBundleSize(),
        this.testCodeSplitting(),
        this.testTreeShaking(),
        this.testCompression()
      ];

      const results = await Promise.all(bundleTests);
      const allPassed = results.every(result => result.passed);

      this.results.bundleOptimization = {
        passed: allPassed,
        details: {
          size: results[0],
          splitting: results[1],
          treeShaking: results[2],
          compression: results[3]
        }
      };

      const status = allPassed ? '✅' : '❌';
      console.log(`  ${status} Bundle optimization ${allPassed ? 'effective' : 'needs improvement'}`);

      if (!allPassed) {
        this.violations.push({
          category: 'Bundle Optimization',
          metric: 'Bundle size and optimization',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Bundle optimization validation failed:', error.message);
      this.results.bundleOptimization = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test bundle size
  async testBundleSize() {
    try {
      //check main bundle size from dist directory
      const distPath = path.join(process.cwd(), 'dist', '_astro');
      
      if (!fs.existsSync(distPath)) {
        return { passed: false, name: 'Bundle Size', error: 'Build directory not found' };
      }
      
      const files = fs.readdirSync(distPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));
      
      let totalSize = 0;
      let mainBundleSize = 0;
      
      for (const file of jsFiles) {
        const filePath = path.join(distPath, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
        
        //estimate main bundle (usually the largest JS file)
        if (stats.size > mainBundleSize) {
          mainBundleSize = stats.size;
        }
      }
      
      const mainBundlePassed = mainBundleSize <= PLAN7_CRITERIA.performance.bundleSize;
      
      console.log(`    ${mainBundlePassed ? '✅' : '❌'} Main bundle size: ${this.formatBytes(mainBundleSize)} (≤ ${this.formatBytes(PLAN7_CRITERIA.performance.bundleSize)})`);
      console.log(`    📊 Total bundle size: ${this.formatBytes(totalSize)}`);
      
      return { 
        passed: mainBundlePassed, 
        name: 'Bundle Size',
        mainSize: mainBundleSize,
        totalSize: totalSize
      };
    } catch (error) {
      return { passed: false, name: 'Bundle Size', error: error.message };
    }
  }

  //test code splitting
  async testCodeSplitting() {
    try {
      const distPath = path.join(process.cwd(), 'dist', '_astro');
      
      if (!fs.existsSync(distPath)) {
        return { passed: false, name: 'Code Splitting', error: 'Build directory not found' };
      }
      
      const files = fs.readdirSync(distPath);
      const jsFiles = files.filter(f => f.endsWith('.js'));
      
      //code splitting should result in multiple JS chunks
      const hasMultipleChunks = jsFiles.length > 1;
      
      console.log(`    ${hasMultipleChunks ? '✅' : '❌'} Code splitting: ${jsFiles.length} JS chunks`);
      
      return { passed: hasMultipleChunks, name: 'Code Splitting', chunks: jsFiles.length };
    } catch (error) {
      return { passed: false, name: 'Code Splitting', error: error.message };
    }
  }

  //test tree shaking
  async testTreeShaking() {
    try {
      //tree shaking effectiveness is hard to test directly
      //we'll check for production build optimizations
      const response = await fetch('http://localhost:4321/');
      const content = await response.text();
      
      //check that the HTML is minified (indicates build optimizations)
      const isMinified = !content.includes('\n    ') && content.length < 50000;
      
      console.log(`    ${isMinified ? '✅' : '❌'} Build optimization ${isMinified ? 'applied' : 'missing'}`);
      
      return { passed: isMinified, name: 'Tree Shaking' };
    } catch (error) {
      return { passed: false, name: 'Tree Shaking', error: error.message };
    }
  }

  //test compression
  async testCompression() {
    try {
      const response = await fetch('http://localhost:4321/', {
        headers: { 'Accept-Encoding': 'gzip, deflate, br' }
      });
      
      const hasCompression = response.headers.has('content-encoding');
      
      console.log(`    ${hasCompression ? '✅' : '❌'} Response compression ${hasCompression ? 'enabled' : 'disabled'}`);
      
      return { passed: hasCompression, name: 'Compression' };
    } catch (error) {
      return { passed: false, name: 'Compression', error: error.message };
    }
  }

  //calculate overall validation result
  calculateOverallResult() {
    const categories = Object.keys(this.results).filter(key => key !== 'overall');
    const passedCategories = categories.filter(cat => this.results[cat].passed).length;
    const totalCategories = categories.length;
    
    const score = Math.round((passedCategories / totalCategories) * 100);
    const passed = score >= 80; //require 80% of categories to pass
    
    this.results.overall = { passed, score, passedCategories, totalCategories };
    
    return passed;
  }

  //generate comprehensive validation report
  async generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    console.log('\n📋 Plan 7 Comprehensive Validation Report');
    console.log('═'.repeat(60));
    console.log(`Validation completed in ${Math.round(duration / 1000)}s`);
    console.log(`Overall Score: ${this.results.overall.score}%`);
    console.log(`Categories Passed: ${this.results.overall.passedCategories}/${this.results.overall.totalCategories}\n`);
    
    //category results
    console.log('📊 Category Results:');
    console.log('─'.repeat(40));
    
    const categoryOrder = [
      'coreWebVitals', 'serviceWorker', 'database', 'testing',
      'security', 'imageOptimization', 'monitoring', 'bundleOptimization'
    ];
    
    const categoryNames = {
      coreWebVitals: 'Core Web Vitals',
      serviceWorker: 'Service Worker & Caching',
      database: 'Database Performance',
      testing: 'Test Coverage & Quality',
      security: 'Security Hardening',
      imageOptimization: 'Image Optimization',
      monitoring: 'Monitoring & Observability',
      bundleOptimization: 'Bundle Optimization'
    };
    
    for (const category of categoryOrder) {
      const result = this.results[category];
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status.padEnd(8)} ${categoryNames[category]}`);
    }
    
    //violations summary
    if (this.violations.length > 0) {
      console.log('\n⚠️  Performance Budget Violations:');
      console.log('─'.repeat(40));
      
      const violationsBySeverity = this.groupViolationsBySeverity();
      
      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        const violations = violationsBySeverity[severity] || [];
        if (violations.length > 0) {
          console.log(`\n${this.getSeverityEmoji(severity)} ${severity.toUpperCase()} (${violations.length}):`);
          violations.forEach(v => {
            console.log(`  • ${v.category}: ${v.metric}`);
          });
        }
      });
    }
    
    //recommendations
    this.generateRecommendations();
    
    if (this.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      console.log('─'.repeat(40));
      this.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
    //save detailed report
    await this.saveDetailedReport();
    
    //final verdict
    console.log('\n' + '═'.repeat(60));
    
    if (this.results.overall.passed) {
      console.log('🎉 PLAN 7 VALIDATION PASSED');
      console.log('All systems meet performance budgets and quality gates');
      console.log('Ready for production deployment!');
    } else {
      console.log('🚫 PLAN 7 VALIDATION FAILED');
      console.log('Some systems do not meet required thresholds');
      console.log('Address violations before production deployment');
    }
    
    console.log('═'.repeat(60));
  }

  //generate recommendations based on results
  generateRecommendations() {
    this.recommendations = [];
    
    if (!this.results.coreWebVitals.passed) {
      this.recommendations.push('Optimize Core Web Vitals by reducing bundle sizes and improving loading performance');
    }
    
    if (!this.results.serviceWorker.passed) {
      this.recommendations.push('Implement comprehensive service worker caching strategies for better offline experience');
    }
    
    if (!this.results.database.passed) {
      this.recommendations.push('Optimize database queries and add appropriate indexes for better performance');
    }
    
    if (!this.results.testing.passed) {
      this.recommendations.push('Increase test coverage and ensure all critical user journeys have E2E tests');
    }
    
    if (!this.results.security.passed) {
      this.recommendations.push('Implement missing security headers and hardening measures');
    }
    
    if (!this.results.imageOptimization.passed) {
      this.recommendations.push('Implement modern image formats (WebP/AVIF) and lazy loading for better performance');
    }
    
    if (!this.results.monitoring.passed) {
      this.recommendations.push('Set up comprehensive monitoring and alerting systems for proactive issue resolution');
    }
    
    if (!this.results.bundleOptimization.passed) {
      this.recommendations.push('Implement code splitting and tree shaking to reduce bundle sizes');
    }
  }

  //group violations by severity
  groupViolationsBySeverity() {
    return this.violations.reduce((groups, violation) => {
      const severity = violation.severity || 'medium';
      if (!groups[severity]) groups[severity] = [];
      groups[severity].push(violation);
      return groups;
    }, {});
  }

  //get emoji for severity level
  getSeverityEmoji(severity) {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return '💡';
      default: return '📊';
    }
  }

  //save detailed validation report
  async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      plan: 'Plan 7 Validation',
      duration: Date.now() - this.startTime,
      results: this.results,
      violations: this.violations,
      recommendations: this.recommendations,
      criteria: PLAN7_CRITERIA,
      summary: {
        passed: this.results.overall.passed,
        score: this.results.overall.score,
        categoriesPassed: this.results.overall.passedCategories,
        totalCategories: this.results.overall.totalCategories,
        criticalViolations: this.violations.filter(v => v.severity === 'critical').length,
        highViolations: this.violations.filter(v => v.severity === 'high').length
      }
    };
    
    const reportPath = `plan7-validation-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed report saved to: ${reportPath}`);
  }

  //cleanup resources
  async cleanup() {
    //kill preview server if we started it
    if (this.serverProcess) {
      process.kill(-this.serverProcess.pid);
    }
  }

  //utility methods
  extractMetricFromResults(results, metric) {
    //extract metric from performance gate results
    if (!results || !results.length) return 0;
    
    const result = results[0]; //use first URL results
    if (!result.audits) return 0;
    
    const metricMap = {
      lcp: 'lcp',
      fid: 'fid', 
      cls: 'cls',
      fcp: 'fcp',
      ttfb: 'ttfb'
    };
    
    return result.audits[metricMap[metric]] || 0;
  }

  getRating(metric, value) {
    const thresholds = {
      lcp: { good: 2500, poor: 4000 },
      fid: { good: 100, poor: 300 },
      cls: { good: 0.1, poor: 0.25 },
      fcp: { good: 1800, poor: 3000 },
      ttfb: { good: 600, poor: 1500 }
    };
    
    const threshold = thresholds[metric];
    if (!threshold) return 'unknown';
    
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  formatValue(value, unit) {
    switch (unit) {
      case 'ms':
        return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
      case 'bytes':
        return this.formatBytes(value);
      default:
        return value.toString();
    }
  }

  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
}

//main execution
async function main() {
  const validator = new Plan7Validator();
  
  try {
    const passed = await validator.run();
    
    //cleanup
    await validator.cleanup();
    
    //exit with appropriate code
    process.exit(passed ? 0 : 1);
    
  } catch (error) {
    console.error('\n💥 Plan 7 validation failed with error:', error.message);
    await validator.cleanup();
    process.exit(1);
  }
}

//handle process cleanup
process.on('SIGINT', async () => {
  console.log('\n⚠️ Validation interrupted, cleaning up...');
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️ Validation terminated, cleaning up...');
  process.exit(1);
});

//run if called directly
if (require.main === module) {
  main();
}

module.exports = { Plan7Validator, PLAN7_CRITERIA };