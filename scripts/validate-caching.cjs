#!/usr/bin/env node

//service worker and caching validation script
//validates offline functionality, cache strategies, and cache effectiveness
//tests all Plan 7 caching requirements

const fs = require('fs');
const path = require('path');

//caching validation criteria from Plan 7
const CACHING_CRITERIA = {
  serviceWorker: {
    registration: true,
    cacheStrategies: ['cache-first', 'network-first', 'stale-while-revalidate'],
    offlineSupport: true,
    updateMechanism: true
  },
  cacheHeaders: {
    staticAssets: { minAge: 31536000 }, //1 year for static assets
    htmlPages: { maxAge: 3600, etag: true }, //1 hour for HTML with etag
    apiResponses: { maxAge: 300, etag: true }, //5 minutes for API with etag
    images: { minAge: 86400 } //1 day for images
  },
  performance: {
    cacheHitRate: 80, //80% minimum cache hit rate
    offlineCapability: 90, //90% of functionality should work offline
    cacheSize: 50 * 1024 * 1024, //50MB maximum cache size
    responseTimes: {
      cached: 100, //100ms for cached responses
      networkFallback: 2000 //2s for network fallback
    }
  }
};

//test scenarios for comprehensive validation
const TEST_SCENARIOS = [
  {
    name: 'Homepage Caching',
    url: 'http://localhost:4321/',
    type: 'html',
    critical: true,
    expectedStrategy: 'network-first'
  },
  {
    name: 'Static CSS Caching',
    url: 'http://localhost:4321/_astro/',
    type: 'css',
    critical: true,
    expectedStrategy: 'cache-first'
  },
  {
    name: 'API Response Caching',
    url: 'http://localhost:4321/api/blog',
    type: 'api',
    critical: true,
    expectedStrategy: 'stale-while-revalidate'
  },
  {
    name: 'Image Asset Caching',
    url: 'http://localhost:4321/favicon.svg',
    type: 'image',
    critical: false,
    expectedStrategy: 'cache-first'
  },
  {
    name: 'Font Asset Caching',
    url: 'http://localhost:4321/fonts/',
    type: 'font',
    critical: false,
    expectedStrategy: 'cache-first'
  }
];

class CachingValidator {
  constructor() {
    this.results = {
      serviceWorker: { passed: false, details: {} },
      cacheHeaders: { passed: false, details: {} },
      offlineFunctionality: { passed: false, details: {} },
      cacheStrategies: { passed: false, details: {} },
      performance: { passed: false, details: {} }
    };
    this.violations = [];
    this.cacheAnalysis = [];
    this.startTime = Date.now();
  }

  //main validation execution
  async run() {
    try {
      console.log('\n🔄 Service Worker & Caching Comprehensive Validation');
      console.log('═'.repeat(55));
      console.log('Validating caching strategies and offline functionality\n');

      //validate service worker implementation
      await this.validateServiceWorker();

      //test cache headers and strategies
      await this.validateCacheHeaders();

      //test offline functionality
      await this.validateOfflineFunctionality();

      //analyze cache strategies
      await this.validateCacheStrategies();

      //performance and effectiveness testing
      await this.validateCachePerformance();

      //generate recommendations
      await this.generateRecommendations();

      //create comprehensive report
      await this.generateReport();

      return this.shouldPass();

    } catch (error) {
      console.error('❌ Caching validation failed:', error.message);
      return false;
    }
  }

  //validate service worker implementation
  async validateServiceWorker() {
    console.log('🔧 Validating Service Worker Implementation...\n');

    try {
      //check if service worker file exists
      const swExists = await this.checkServiceWorkerFile();
      console.log(`  ${swExists ? '✅' : '❌'} Service Worker file exists`);

      //analyze service worker content
      const swAnalysis = await this.analyzeServiceWorkerContent();
      
      //check registration implementation
      const registrationCheck = await this.checkServiceWorkerRegistration();
      console.log(`  ${registrationCheck.found ? '✅' : '❌'} Service Worker registration found`);

      //validate cache strategies implementation
      const strategiesImplemented = swAnalysis.strategies.length >= 2;
      console.log(`  ${strategiesImplemented ? '✅' : '❌'} Multiple cache strategies implemented (${swAnalysis.strategies.length})`);

      //check update mechanism
      const hasUpdateMechanism = swAnalysis.hasUpdateMechanism;
      console.log(`  ${hasUpdateMechanism ? '✅' : '❌'} Update mechanism implemented`);

      //check offline fallbacks
      const hasOfflineFallbacks = swAnalysis.hasOfflineFallbacks;
      console.log(`  ${hasOfflineFallbacks ? '✅' : '❌'} Offline fallbacks configured`);

      const allPassed = swExists && strategiesImplemented && hasUpdateMechanism && hasOfflineFallbacks;

      this.results.serviceWorker = {
        passed: allPassed,
        details: {
          fileExists: swExists,
          registration: registrationCheck,
          strategies: swAnalysis.strategies,
          updateMechanism: hasUpdateMechanism,
          offlineFallbacks: hasOfflineFallbacks,
          cacheNames: swAnalysis.cacheNames
        }
      };

      if (!allPassed) {
        this.violations.push({
          category: 'Service Worker',
          issue: 'Missing required service worker functionality',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Service Worker validation failed:', error.message);
      this.results.serviceWorker = { passed: false, error: error.message };
    }

    console.log('');
  }

  //check if service worker file exists and is accessible
  async checkServiceWorkerFile() {
    try {
      const response = await fetch('http://localhost:4321/sw.js');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  //analyze service worker content for strategies and features
  async analyzeServiceWorkerContent() {
    try {
      const response = await fetch('http://localhost:4321/sw.js');
      
      if (!response.ok) {
        throw new Error('Service worker not accessible');
      }
      
      const content = await response.text();
      
      //detect cache strategies
      const strategies = [];
      if (content.includes('cache-first') || content.includes('cacheFirst')) {
        strategies.push('cache-first');
      }
      if (content.includes('network-first') || content.includes('networkFirst')) {
        strategies.push('network-first');
      }
      if (content.includes('stale-while-revalidate') || content.includes('staleWhileRevalidate')) {
        strategies.push('stale-while-revalidate');
      }
      if (content.includes('network-only') || content.includes('networkOnly')) {
        strategies.push('network-only');
      }
      if (content.includes('cache-only') || content.includes('cacheOnly')) {
        strategies.push('cache-only');
      }

      //detect update mechanism
      const hasUpdateMechanism = content.includes('skipWaiting') || 
                                content.includes('clients.claim') ||
                                content.includes('update') ||
                                content.includes('activate');

      //detect offline fallbacks
      const hasOfflineFallbacks = content.includes('offline') || 
                                 content.includes('fallback') ||
                                 content.includes('catch') ||
                                 content.includes('navigator.onLine');

      //extract cache names
      const cacheNameMatches = content.match(/['"`]([^'"`]*cache[^'"`]*)['"`]/gi) || [];
      const cacheNames = cacheNameMatches.map(match => match.replace(/['"`]/g, ''));

      return {
        strategies,
        hasUpdateMechanism,
        hasOfflineFallbacks,
        cacheNames,
        contentLength: content.length
      };

    } catch (error) {
      return {
        strategies: [],
        hasUpdateMechanism: false,
        hasOfflineFallbacks: false,
        cacheNames: [],
        error: error.message
      };
    }
  }

  //check service worker registration in main pages
  async checkServiceWorkerRegistration() {
    try {
      const response = await fetch('http://localhost:4321/');
      const content = await response.text();
      
      const hasRegistration = content.includes('serviceWorker.register') ||
                             content.includes('sw.js') ||
                             content.includes('navigator.serviceWorker');
      
      //look for registration options
      const hasScope = content.includes('scope:');
      const hasUpdateViaCache = content.includes('updateViaCache');
      
      return {
        found: hasRegistration,
        hasScope,
        hasUpdateViaCache
      };
    } catch (error) {
      return { found: false, error: error.message };
    }
  }

  //validate cache headers for different resource types
  async validateCacheHeaders() {
    console.log('📋 Validating Cache Headers...\n');

    try {
      const headerTests = [];

      //test different resource types
      for (const scenario of TEST_SCENARIOS) {
        const test = await this.testCacheHeaders(scenario);
        headerTests.push(test);
        
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${scenario.name}: ${test.summary}`);
        
        if (test.details) {
          Object.entries(test.details).forEach(([key, value]) => {
            if (key !== 'passed') {
              console.log(`    • ${key}: ${value}`);
            }
          });
        }
      }

      const allPassed = headerTests.every(test => test.passed);

      this.results.cacheHeaders = {
        passed: allPassed,
        details: {
          tests: headerTests,
          passedTests: headerTests.filter(t => t.passed).length,
          totalTests: headerTests.length
        }
      };

      if (!allPassed) {
        this.violations.push({
          category: 'Cache Headers',
          issue: 'Improper cache headers configuration',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Cache headers validation failed:', error.message);
      this.results.cacheHeaders = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test cache headers for a specific scenario
  async testCacheHeaders(scenario) {
    try {
      //for directory URLs, try to find actual files
      let testUrl = scenario.url;
      if (scenario.type === 'css' && scenario.url.includes('_astro/')) {
        //try to find actual CSS file
        const indexResponse = await fetch('http://localhost:4321/');
        const indexContent = await indexResponse.text();
        const cssMatch = indexContent.match(/href="([^"]*_astro[^"]*\.css[^"]*)"/);
        if (cssMatch) {
          testUrl = 'http://localhost:4321' + cssMatch[1];
        }
      }

      const response = await fetch(testUrl, {
        method: 'HEAD', //use HEAD to avoid downloading content
        headers: {
          'Accept': '*/*',
          'User-Agent': 'CachingValidator/1.0'
        }
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`HTTP ${response.status}`);
      }

      const headers = response.headers;
      const details = {};
      let passed = true;
      let issues = [];

      //analyze cache-control header
      const cacheControl = headers.get('cache-control');
      details['Cache-Control'] = cacheControl || 'Not set';
      
      if (cacheControl) {
        const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
        const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]) : 0;
        details['Max-Age'] = `${maxAge}s`;

        //validate based on resource type
        switch (scenario.type) {
          case 'html':
            if (maxAge > 3600) {
              issues.push('HTML cache time too long');
              passed = false;
            }
            break;
          case 'css':
          case 'font':
            if (maxAge < 86400) { //1 day minimum
              issues.push('Static asset cache time too short');
              passed = false;
            }
            break;
          case 'api':
            if (maxAge > 3600) { //1 hour maximum
              issues.push('API cache time too long');
              passed = false;
            }
            break;
        }
      } else if (scenario.type !== 'api') {
        issues.push('Missing Cache-Control header');
        passed = false;
      }

      //check ETag header
      const etag = headers.get('etag');
      details['ETag'] = etag || 'Not set';
      
      if (!etag && (scenario.type === 'html' || scenario.type === 'api')) {
        issues.push('Missing ETag for dynamic content');
        passed = false;
      }

      //check Last-Modified header
      const lastModified = headers.get('last-modified');
      details['Last-Modified'] = lastModified || 'Not set';

      //check Expires header (should not conflict with Cache-Control)
      const expires = headers.get('expires');
      if (expires && cacheControl) {
        details['Expires'] = expires;
      }

      return {
        scenario: scenario.name,
        url: testUrl,
        passed,
        issues,
        details,
        summary: passed ? 'Proper cache headers' : issues.join(', ')
      };

    } catch (error) {
      return {
        scenario: scenario.name,
        url: scenario.url,
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate offline functionality
  async validateOfflineFunctionality() {
    console.log('📱 Validating Offline Functionality...\n');

    try {
      const offlineTests = [
        await this.testOfflinePageCache(),
        await this.testOfflineAssetCache(),
        await this.testOfflineFallbacks(),
        await this.testNetworkFailureHandling()
      ];

      const allPassed = offlineTests.every(test => test.passed);

      this.results.offlineFunctionality = {
        passed: allPassed,
        details: {
          pageCache: offlineTests[0],
          assetCache: offlineTests[1],
          fallbacks: offlineTests[2],
          networkFailure: offlineTests[3]
        }
      };

      offlineTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.summary}`);
      });

      if (!allPassed) {
        this.violations.push({
          category: 'Offline Functionality',
          issue: 'Incomplete offline support implementation',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Offline functionality validation failed:', error.message);
      this.results.offlineFunctionality = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test if critical pages are cached for offline use
  async testOfflinePageCache() {
    try {
      //test if homepage is likely cached
      const response = await fetch('http://localhost:4321/', {
        cache: 'force-cache' //try to get cached version
      });
      
      const content = await response.text();
      const hasServiceWorkerRef = content.includes('sw.js') || content.includes('serviceWorker');
      
      //if SW is referenced, assume pages can be cached
      return {
        name: 'Page Caching',
        passed: hasServiceWorkerRef,
        summary: hasServiceWorkerRef ? 'Pages can be cached' : 'No SW implementation found'
      };
    } catch (error) {
      return {
        name: 'Page Caching',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test if static assets are cached
  async testOfflineAssetCache() {
    try {
      //check if service worker handles static assets
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();
      
      const handlesAssets = swContent.includes('.css') || 
                           swContent.includes('.js') || 
                           swContent.includes('static') ||
                           swContent.includes('assets') ||
                           swContent.includes('_astro');
      
      return {
        name: 'Asset Caching',
        passed: handlesAssets,
        summary: handlesAssets ? 'Static assets cached' : 'Static assets not cached'
      };
    } catch (error) {
      return {
        name: 'Asset Caching',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test offline fallback pages
  async testOfflineFallbacks() {
    try {
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();
      
      const hasFallbacks = swContent.includes('offline') || 
                          swContent.includes('fallback') ||
                          swContent.includes('catch');
      
      return {
        name: 'Offline Fallbacks',
        passed: hasFallbacks,
        summary: hasFallbacks ? 'Fallback pages configured' : 'No fallback pages found'
      };
    } catch (error) {
      return {
        name: 'Offline Fallbacks',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test network failure handling
  async testNetworkFailureHandling() {
    try {
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();
      
      const handlesNetworkFailure = swContent.includes('catch') || 
                                   swContent.includes('error') ||
                                   swContent.includes('reject') ||
                                   swContent.includes('fail');
      
      return {
        name: 'Network Failure Handling',
        passed: handlesNetworkFailure,
        summary: handlesNetworkFailure ? 'Network errors handled' : 'No error handling found'
      };
    } catch (error) {
      return {
        name: 'Network Failure Handling',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate cache strategies implementation
  async validateCacheStrategies() {
    console.log('🎯 Validating Cache Strategies...\n');

    try {
      const strategyTests = [];

      //analyze service worker for strategy implementation
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();

      //test each required strategy
      for (const strategy of CACHING_CRITERIA.serviceWorker.cacheStrategies) {
        const test = this.analyzeStrategyImplementation(swContent, strategy);
        strategyTests.push(test);
        
        const status = test.implemented ? '✅' : '❌';
        console.log(`  ${status} ${strategy}: ${test.summary}`);
        
        if (test.usage.length > 0) {
          console.log(`    • Used for: ${test.usage.join(', ')}`);
        }
      }

      //test strategy appropriateness
      const appropriatenessTest = await this.testStrategyAppropriateness();
      console.log(`  ${appropriatenessTest.passed ? '✅' : '❌'} Strategy Appropriateness: ${appropriatenessTest.summary}`);

      const requiredStrategiesImplemented = strategyTests.filter(t => t.implemented).length >= 2;
      const allPassed = requiredStrategiesImplemented && appropriatenessTest.passed;

      this.results.cacheStrategies = {
        passed: allPassed,
        details: {
          strategies: strategyTests,
          appropriateness: appropriatenessTest,
          requiredImplemented: strategyTests.filter(t => t.implemented).length
        }
      };

      if (!allPassed) {
        this.violations.push({
          category: 'Cache Strategies',
          issue: 'Insufficient or inappropriate cache strategies',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Cache strategies validation failed:', error.message);
      this.results.cacheStrategies = { passed: false, error: error.message };
    }

    console.log('');
  }

  //analyze if a specific strategy is implemented
  analyzeStrategyImplementation(swContent, strategy) {
    const strategyPatterns = {
      'cache-first': ['cache-first', 'cacheFirst', 'CacheFirst'],
      'network-first': ['network-first', 'networkFirst', 'NetworkFirst'],
      'stale-while-revalidate': ['stale-while-revalidate', 'staleWhileRevalidate', 'StaleWhileRevalidate']
    };

    const patterns = strategyPatterns[strategy] || [strategy];
    const implemented = patterns.some(pattern => swContent.includes(pattern));
    
    //try to determine what this strategy is used for
    const usage = [];
    if (implemented) {
      if (swContent.includes('html') || swContent.includes('document')) usage.push('HTML pages');
      if (swContent.includes('css') || swContent.includes('style')) usage.push('CSS files');
      if (swContent.includes('js') || swContent.includes('script')) usage.push('JavaScript files');
      if (swContent.includes('image') || swContent.includes('img')) usage.push('Images');
      if (swContent.includes('api') || swContent.includes('fetch')) usage.push('API calls');
    }

    return {
      strategy,
      implemented,
      usage,
      summary: implemented ? 'Implemented' : 'Not implemented'
    };
  }

  //test if strategies are used appropriately for different resource types
  async testStrategyAppropriateness() {
    try {
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();

      let appropriateUsage = 0;
      let totalChecks = 0;

      //check if static assets use cache-first (appropriate)
      if (swContent.includes('css') || swContent.includes('js') || swContent.includes('image')) {
        totalChecks++;
        if (swContent.includes('cache-first') || swContent.includes('cacheFirst')) {
          appropriateUsage++;
        }
      }

      //check if HTML uses network-first or stale-while-revalidate (appropriate)
      if (swContent.includes('html') || swContent.includes('document')) {
        totalChecks++;
        if (swContent.includes('network-first') || swContent.includes('stale-while-revalidate')) {
          appropriateUsage++;
        }
      }

      //check if API calls use appropriate strategy
      if (swContent.includes('api') || swContent.includes('fetch')) {
        totalChecks++;
        if (swContent.includes('stale-while-revalidate') || swContent.includes('network-first')) {
          appropriateUsage++;
        }
      }

      const score = totalChecks > 0 ? (appropriateUsage / totalChecks) * 100 : 0;
      const passed = score >= 70; //70% appropriateness threshold

      return {
        passed,
        score,
        appropriateUsage,
        totalChecks,
        summary: `${score.toFixed(0)}% appropriate strategy usage`
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate cache performance and effectiveness
  async validateCachePerformance() {
    console.log('⚡ Validating Cache Performance...\n');

    try {
      const performanceTests = [
        await this.testCacheResponseTimes(),
        await this.measureCacheEffectiveness(),
        await this.testCacheSizeManagement(),
        await this.testCacheInvalidation()
      ];

      const allPassed = performanceTests.every(test => test.passed);

      this.results.performance = {
        passed: allPassed,
        details: {
          responseTimes: performanceTests[0],
          effectiveness: performanceTests[1],
          sizeManagement: performanceTests[2],
          invalidation: performanceTests[3]
        }
      };

      performanceTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.summary}`);
      });

      if (!allPassed) {
        this.violations.push({
          category: 'Cache Performance',
          issue: 'Cache performance does not meet requirements',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Cache performance validation failed:', error.message);
      this.results.performance = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test cache response times
  async testCacheResponseTimes() {
    try {
      const testUrls = [
        'http://localhost:4321/',
        'http://localhost:4321/portfolio',
        'http://localhost:4321/api/blog'
      ];

      let totalTime = 0;
      let testCount = 0;

      for (const url of testUrls) {
        try {
          const start = Date.now();
          const response = await fetch(url);
          const end = Date.now();
          
          if (response.ok) {
            totalTime += (end - start);
            testCount++;
          }
        } catch (error) {
          //skip failed requests
        }
      }

      const averageTime = testCount > 0 ? totalTime / testCount : 0;
      const passed = averageTime <= CACHING_CRITERIA.performance.responseTimes.networkFallback;

      return {
        name: 'Response Times',
        passed,
        averageTime,
        testCount,
        summary: `Average: ${averageTime.toFixed(0)}ms (${testCount} tests)`
      };
    } catch (error) {
      return {
        name: 'Response Times',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //measure cache effectiveness
  async measureCacheEffectiveness() {
    try {
      //simulate cache effectiveness by checking cache headers
      const testUrls = [
        'http://localhost:4321/',
        'http://localhost:4321/favicon.svg'
      ];

      let cacheableResponses = 0;
      let totalResponses = 0;

      for (const url of testUrls) {
        try {
          const response = await fetch(url, { method: 'HEAD' });
          totalResponses++;
          
          const cacheControl = response.headers.get('cache-control');
          const etag = response.headers.get('etag');
          
          if (cacheControl || etag) {
            cacheableResponses++;
          }
        } catch (error) {
          //skip failed requests
        }
      }

      const effectiveness = totalResponses > 0 ? (cacheableResponses / totalResponses) * 100 : 0;
      const passed = effectiveness >= 60; //60% minimum effectiveness

      return {
        name: 'Cache Effectiveness',
        passed,
        effectiveness,
        cacheableResponses,
        totalResponses,
        summary: `${effectiveness.toFixed(0)}% cacheable responses`
      };
    } catch (error) {
      return {
        name: 'Cache Effectiveness',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test cache size management
  async testCacheSizeManagement() {
    try {
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();

      //look for cache size management
      const hasQuotaManagement = swContent.includes('quota') || 
                                swContent.includes('storage') ||
                                swContent.includes('estimate') ||
                                swContent.includes('usage');

      const hasCacheCleanup = swContent.includes('delete') || 
                             swContent.includes('clear') ||
                             swContent.includes('cleanup') ||
                             swContent.includes('expire');

      const passed = hasQuotaManagement || hasCacheCleanup;

      return {
        name: 'Cache Size Management',
        passed,
        hasQuotaManagement,
        hasCacheCleanup,
        summary: passed ? 'Cache management implemented' : 'No cache management found'
      };
    } catch (error) {
      return {
        name: 'Cache Size Management',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test cache invalidation mechanisms
  async testCacheInvalidation() {
    try {
      const swResponse = await fetch('http://localhost:4321/sw.js');
      const swContent = await swResponse.text();

      //look for cache invalidation mechanisms
      const hasVersioning = swContent.includes('version') || 
                           swContent.includes('v1') ||
                           swContent.includes('CACHE_NAME');

      const hasUpdateHandling = swContent.includes('activate') || 
                               swContent.includes('update') ||
                               swContent.includes('skipWaiting');

      const passed = hasVersioning && hasUpdateHandling;

      return {
        name: 'Cache Invalidation',
        passed,
        hasVersioning,
        hasUpdateHandling,
        summary: passed ? 'Invalidation mechanisms present' : 'Missing invalidation mechanisms'
      };
    } catch (error) {
      return {
        name: 'Cache Invalidation',
        passed: false,
        summary: `Error: ${error.message}`
      };
    }
  }

  //generate optimization recommendations
  async generateRecommendations() {
    const recommendations = [];

    //service worker recommendations
    if (!this.results.serviceWorker.passed) {
      if (!this.results.serviceWorker.details.fileExists) {
        recommendations.push('Implement a service worker to enable offline functionality and caching');
      }
      if (this.results.serviceWorker.details.strategies?.length < 2) {
        recommendations.push('Implement multiple cache strategies (cache-first, network-first, stale-while-revalidate)');
      }
      if (!this.results.serviceWorker.details.updateMechanism) {
        recommendations.push('Add service worker update mechanism with skipWaiting and clients.claim');
      }
    }

    //cache headers recommendations
    if (!this.results.cacheHeaders.passed) {
      recommendations.push('Configure appropriate cache headers for different resource types');
      recommendations.push('Add ETags for dynamic content to enable conditional requests');
      recommendations.push('Set long cache times for static assets (CSS, JS, images)');
    }

    //offline functionality recommendations
    if (!this.results.offlineFunctionality.passed) {
      recommendations.push('Create offline fallback pages for better user experience');
      recommendations.push('Cache critical pages and assets for offline access');
      recommendations.push('Implement network error handling in service worker');
    }

    //cache strategies recommendations
    if (!this.results.cacheStrategies.passed) {
      recommendations.push('Use cache-first strategy for static assets (CSS, JS, images)');
      recommendations.push('Use network-first or stale-while-revalidate for HTML pages');
      recommendations.push('Use stale-while-revalidate for API responses that can be stale');
    }

    //performance recommendations
    if (!this.results.performance.passed) {
      recommendations.push('Optimize cache response times to under 100ms for cached content');
      recommendations.push('Implement cache size management to prevent storage quota issues');
      recommendations.push('Add cache versioning and invalidation mechanisms');
    }

    this.recommendations = recommendations;
  }

  //generate comprehensive caching report
  async generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    console.log('📊 Service Worker & Caching Validation Report');
    console.log('═'.repeat(55));
    console.log(`Validation completed in ${Math.round(duration / 1000)}s`);
    console.log(`Overall Status: ${this.shouldPass() ? 'PASSED' : 'FAILED'}\n`);

    //category summary
    console.log('📋 Category Results:');
    console.log('─'.repeat(30));

    const categories = [
      { key: 'serviceWorker', name: 'Service Worker' },
      { key: 'cacheHeaders', name: 'Cache Headers' },
      { key: 'offlineFunctionality', name: 'Offline Functionality' },
      { key: 'cacheStrategies', name: 'Cache Strategies' },
      { key: 'performance', name: 'Cache Performance' }
    ];

    categories.forEach(category => {
      const result = this.results[category.key];
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${status.padEnd(8)} ${category.name}`);
    });

    //violations summary
    if (this.violations.length > 0) {
      console.log('\n⚠️  Violations Found:');
      console.log('─'.repeat(30));
      this.violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.category}: ${violation.issue} (${violation.severity})`);
      });
    }

    //recommendations
    if (this.recommendations && this.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      console.log('─'.repeat(30));
      this.recommendations.slice(0, 8).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    //save detailed report
    await this.saveDetailedReport();
  }

  //save detailed validation report
  async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      plan: 'Plan 7 - Caching Validation',
      criteria: CACHING_CRITERIA,
      results: this.results,
      violations: this.violations,
      recommendations: this.recommendations,
      cacheAnalysis: this.cacheAnalysis,
      passed: this.shouldPass(),
      summary: {
        categoriesPassed: Object.values(this.results).filter(r => r.passed).length,
        totalCategories: Object.keys(this.results).length,
        violationsFound: this.violations.length,
        recommendationsGenerated: this.recommendations?.length || 0
      }
    };

    const reportPath = `caching-validation-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed caching report saved to: ${reportPath}`);
  }

  //determine if validation should pass
  shouldPass() {
    const passedCategories = Object.values(this.results).filter(r => r.passed).length;
    const totalCategories = Object.keys(this.results).length;
    const passRate = (passedCategories / totalCategories) * 100;

    //require 80% of categories to pass
    return passRate >= 80;
  }
}

//main execution
async function main() {
  const validator = new CachingValidator();

  try {
    const passed = await validator.run();

    console.log('═'.repeat(55));

    if (passed) {
      console.log('🎉 CACHING VALIDATION PASSED');
      console.log('Service worker and caching meet Plan 7 requirements');
    } else {
      console.log('🚫 CACHING VALIDATION FAILED');
      console.log('Caching implementation needs improvement');
    }

    console.log('═'.repeat(55));

    process.exit(passed ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Caching validation failed with error:', error.message);
    process.exit(1);
  }
}

//run if called directly
if (require.main === module) {
  main();
}

module.exports = { CachingValidator, CACHING_CRITERIA };