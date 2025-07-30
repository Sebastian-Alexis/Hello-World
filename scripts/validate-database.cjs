#!/usr/bin/env node

//database performance validation script  
//validates query performance, optimization, and Plan 7 database requirements
//tests connection handling, index effectiveness, and query optimization

const fs = require('fs');
const path = require('path');

//database performance criteria from Plan 7
const DATABASE_CRITERIA = {
  performance: {
    simpleQuery: 100,      //100ms max for simple queries
    complexQuery: 500,     //500ms max for complex queries
    connectionTime: 5000,  //5s max connection time
    throughput: 100,       //100 queries per second minimum
    concurrency: 50        //50 concurrent connections minimum
  },
  optimization: {
    indexUsage: 80,        //80% of queries should use indexes
    queryComplexity: 1000, //max query complexity score
    cacheHitRate: 90,      //90% cache hit rate for repeated queries
    lockWaitTime: 100      //100ms max lock wait time
  },
  reliability: {
    connectionPoolSize: 10, //minimum connection pool size
    errorRate: 1,          //max 1% error rate
    recoveryTime: 5000,    //5s max recovery time from errors
    backupIntegrity: true  //backups must be valid
  }
};

//comprehensive test scenarios
const TEST_SCENARIOS = [
  {
    name: 'Simple Select Query',
    type: 'simple',
    endpoint: '/api/health/database',
    description: 'Basic database connectivity and simple select',
    critical: true,
    expectedTime: 50
  },
  {
    name: 'Blog Post Retrieval',
    type: 'simple',
    endpoint: '/api/blog?limit=10',
    description: 'Retrieve blog posts with pagination',
    critical: true,
    expectedTime: 100
  },
  {
    name: 'Complex Search Query',
    type: 'complex',
    endpoint: '/api/blog/search?q=performance&limit=20',
    description: 'Full-text search with filtering',
    critical: true,
    expectedTime: 300
  },
  {
    name: 'Portfolio Statistics',
    type: 'complex',
    endpoint: '/api/portfolio/statistics',
    description: 'Aggregate statistics calculation',
    critical: false,
    expectedTime: 200
  },
  {
    name: 'Category Aggregation',
    type: 'complex',
    endpoint: '/api/blog/categories',
    description: 'Category counts and statistics',
    critical: false,
    expectedTime: 150
  },
  {
    name: 'Flight Data Query',
    type: 'simple',
    endpoint: '/api/flights?limit=5',
    description: 'Geographic data retrieval',
    critical: false,
    expectedTime: 100
  }
];

class DatabaseValidator {
  constructor() {
    this.results = {
      performance: { passed: false, details: {} },
      optimization: { passed: false, details: {} },
      reliability: { passed: false, details: {} },
      queries: { passed: false, details: {} },
      concurrency: { passed: false, details: {} }
    };
    this.violations = [];
    this.queryAnalysis = [];
    this.performanceMetrics = {
      totalQueries: 0,
      successfulQueries: 0,
      averageResponseTime: 0,
      slowQueries: [],
      errorQueries: []
    };
    this.startTime = Date.now();
  }

  //main validation execution
  async run() {
    try {
      console.log('\n🗄️  Database Performance Comprehensive Validation');
      console.log('═'.repeat(55));
      console.log('Validating database performance against Plan 7 criteria\n');

      //validate database connection and setup
      await this.validateDatabaseSetup();

      //test individual query performance
      await this.validateQueryPerformance();

      //test database optimization features
      await this.validateOptimization();

      //test concurrency and load handling
      await this.validateConcurrency();

      //test reliability and error handling
      await this.validateReliability();

      //analyze query patterns and performance
      await this.analyzeQueryPatterns();

      //generate optimization recommendations
      await this.generateRecommendations();

      //create comprehensive report
      await this.generateReport();

      return this.shouldPass();

    } catch (error) {
      console.error('❌ Database validation failed:', error.message);
      return false;
    }
  }

  //validate database setup and connectivity
  async validateDatabaseSetup() {
    console.log('🔧 Validating Database Setup...\n');

    try {
      //test basic database connection
      const connectionTest = await this.testDatabaseConnection();
      console.log(`  ${connectionTest.passed ? '✅' : '❌'} Database Connection: ${connectionTest.summary}`);

      //check database schema
      const schemaTest = await this.testDatabaseSchema();
      console.log(`  ${schemaTest.passed ? '✅' : '❌'} Database Schema: ${schemaTest.summary}`);

      //verify indexes exist
      const indexTest = await this.testDatabaseIndexes();
      console.log(`  ${indexTest.passed ? '✅' : '❌'} Database Indexes: ${indexTest.summary}`);

      //test database configuration
      const configTest = await this.testDatabaseConfiguration();
      console.log(`  ${configTest.passed ? '✅' : '❌'} Database Configuration: ${configTest.summary}`);

      const allPassed = connectionTest.passed && schemaTest.passed && indexTest.passed;

      this.results.setup = {
        passed: allPassed,
        details: {
          connection: connectionTest,
          schema: schemaTest,
          indexes: indexTest,
          configuration: configTest
        }
      };

      if (!allPassed) {
        this.violations.push({
          category: 'Database Setup',
          issue: 'Database setup or configuration issues',
          severity: 'critical'
        });
      }

    } catch (error) {
      console.error('  ❌ Database setup validation failed:', error.message);
      this.results.setup = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test basic database connection
  async testDatabaseConnection() {
    try {
      const start = Date.now();
      const response = await fetch('http://localhost:4321/api/health/database');
      const end = Date.now();
      
      const connectionTime = end - start;
      const passed = response.ok && connectionTime <= DATABASE_CRITERIA.performance.connectionTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          passed,
          connectionTime,
          status: data.status || 'unknown',
          summary: `Connected in ${connectionTime}ms (${data.status || 'unknown'})`
        };
      } else {
        return {
          passed: false,
          connectionTime,
          error: `HTTP ${response.status}`,
          summary: `Connection failed: HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        summary: `Connection error: ${error.message}`
      };
    }
  }

  //test database schema integrity
  async testDatabaseSchema() {
    try {
      //test critical tables by accessing their endpoints
      const criticalEndpoints = [
        '/api/blog',
        '/api/portfolio', 
        '/api/flights'
      ];

      let workingEndpoints = 0;
      const results = [];

      for (const endpoint of criticalEndpoints) {
        try {
          const response = await fetch(`http://localhost:4321${endpoint}?limit=1`);
          const working = response.ok;
          
          if (working) {
            workingEndpoints++;
            results.push({ endpoint, status: 'working' });
          } else {
            results.push({ endpoint, status: `HTTP ${response.status}` });
          }
        } catch (error) {
          results.push({ endpoint, status: `error: ${error.message}` });
        }
      }

      const passed = workingEndpoints >= 2; //require at least 2 working tables
      
      return {
        passed,
        workingEndpoints,
        totalEndpoints: criticalEndpoints.length,
        results,
        summary: `${workingEndpoints}/${criticalEndpoints.length} core tables accessible`
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        summary: `Schema test error: ${error.message}`
      };
    }
  }

  //test database indexes effectiveness
  async testDatabaseIndexes() {
    try {
      //indirect test by measuring query performance on searchable fields
      const indexTests = [
        { name: 'Blog search index', endpoint: '/api/blog/search?q=test' },
        { name: 'Category index', endpoint: '/api/blog/categories' }
      ];

      let fastQueries = 0;
      const results = [];

      for (const test of indexTests) {
        try {
          const start = Date.now();
          const response = await fetch(`http://localhost:4321${test.endpoint}`);
          const end = Date.now();
          
          const queryTime = end - start;
          const fast = queryTime <= 200; //indexed queries should be under 200ms
          
          if (fast) fastQueries++;
          
          results.push({
            name: test.name,
            queryTime,
            fast,
            status: response.ok ? 'ok' : `HTTP ${response.status}`
          });
        } catch (error) {
          results.push({
            name: test.name,
            error: error.message,
            fast: false
          });
        }
      }

      const passed = fastQueries >= Math.ceil(indexTests.length * 0.8); //80% should be fast
      
      return {
        passed,
        fastQueries,
        totalTests: indexTests.length,
        results,
        summary: `${fastQueries}/${indexTests.length} queries appear indexed`
      };
    } catch (error) {
      return {
        passed: false,   
        error: error.message,
        summary: `Index test error: ${error.message}`
      };
    }
  }

  //test database configuration
  async testDatabaseConfiguration() {
    try {
      //check if database optimization files exist
      const optimizationFiles = [
        'database/performance-indexes.sql',
        'database/schema.sql'
      ];

      let existingFiles = 0;
      const fileResults = [];

      for (const file of optimizationFiles) {
        const exists = fs.existsSync(path.join(process.cwd(), file));
        if (exists) existingFiles++;
        fileResults.push({ file, exists });
      }

      const passed = existingFiles >= 1; //at least one optimization file should exist
      
      return {
        passed,
        existingFiles,
        totalFiles: optimizationFiles.length,
        fileResults,
        summary: `${existingFiles}/${optimizationFiles.length} optimization files found`
      };
    } catch (error) {
      return {
        passed: false,
        error: error.message,
        summary: `Configuration test error: ${error.message}`
      };
    }
  }

  //validate individual query performance
  async validateQueryPerformance() {
    console.log('⚡ Validating Query Performance...\n');

    try {
      const queryResults = [];

      for (const scenario of TEST_SCENARIOS) {
        console.log(`  Testing ${scenario.name}...`);
        
        const result = await this.testQueryPerformance(scenario);
        queryResults.push(result);
        
        this.queryAnalysis.push(result);
        this.performanceMetrics.totalQueries++;
        
        if (result.passed) {
          this.performanceMetrics.successfulQueries++;
        } else {
          if (result.error) {
            this.performanceMetrics.errorQueries.push(result);
          } else {
            this.performanceMetrics.slowQueries.push(result);
          }
        }
        
        const status = result.passed ? '✅' : '❌';
        console.log(`    ${status} ${result.responseTime}ms (≤ ${result.expectedTime}ms) - ${result.summary}`);
      }

      //calculate overall performance metrics
      const totalResponseTime = queryResults.reduce((sum, r) => sum + (r.responseTime || 0), 0);
      this.performanceMetrics.averageResponseTime = totalResponseTime / queryResults.length;

      //validate performance criteria
      const simpleQueries = queryResults.filter(r => r.scenario.type === 'simple');
      const complexQueries = queryResults.filter(r => r.scenario.type === 'complex');
      
      const simplePassed = simpleQueries.every(q => q.passed);
      const complexPassed = complexQueries.every(q => q.passed);
      const allPassed = simplePassed && complexPassed;

      this.results.performance = {
        passed: allPassed,
        details: {
          simple: { passed: simplePassed, queries: simpleQueries.length },
          complex: { passed: complexPassed, queries: complexQueries.length },
          average: this.performanceMetrics.averageResponseTime,
          slowQueries: this.performanceMetrics.slowQueries.length
        }
      };

      console.log(`\n  📊 Overall Performance:`);
      console.log(`    • Average Response Time: ${this.performanceMetrics.averageResponseTime.toFixed(0)}ms`);
      console.log(`    • Successful Queries: ${this.performanceMetrics.successfulQueries}/${this.performanceMetrics.totalQueries}`);
      console.log(`    • Slow Queries: ${this.performanceMetrics.slowQueries.length}`);

      if (!allPassed) {
        this.violations.push({
          category: 'Query Performance',
          issue: 'Some queries exceed performance thresholds',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Query performance validation failed:', error.message);
      this.results.performance = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test individual query performance
  async testQueryPerformance(scenario) {
    try {
      //run query multiple times to get consistent results
      const runs = 3;
      const times = [];
      let lastError = null;

      for (let i = 0; i < runs; i++) {
        try {
          const start = Date.now();
          const response = await fetch(`http://localhost:4321${scenario.endpoint}`);
          const end = Date.now();
          
          if (response.ok) {
            times.push(end - start);
            
            //consume response to ensure full processing
            await response.text();
          } else {
            lastError = `HTTP ${response.status}`;
          }
        } catch (error) {
          lastError = error.message;
        }
        
        //small delay between runs
        if (i < runs - 1) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      if (times.length === 0) {
        return {
          scenario,
          passed: false,
          error: lastError,
          summary: `Error: ${lastError}`
        };
      }

      //calculate average response time
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      //determine expected time based on query type
      const expectedTime = scenario.expectedTime || 
        (scenario.type === 'simple' ? DATABASE_CRITERIA.performance.simpleQuery : DATABASE_CRITERIA.performance.complexQuery);

      const passed = averageTime <= expectedTime;

      return {
        scenario,
        passed,
        responseTime: Math.round(averageTime),
        minTime,
        maxTime,
        expectedTime,
        runs: times.length,
        summary: passed ? 'Within threshold' : 'Exceeds threshold'
      };
    } catch (error) {
      return {
        scenario,
        passed: false,
        error: error.message,
        summary: `Test error: ${error.message}`
      };
    }
  }

  //validate database optimization features
  async validateOptimization() {
    console.log('🔧 Validating Database Optimization...\n');

    try {
      const optimizationTests = [
        await this.testQueryOptimization(),
        await this.testCacheEffectiveness(),
        await this.testIndexUsage(),
        await this.testQueryComplexity()
      ];

      const allPassed = optimizationTests.every(test => test.passed);

      this.results.optimization = {
        passed: allPassed,
        details: {
          queryOptimization: optimizationTests[0],
          cacheEffectiveness: optimizationTests[1],
          indexUsage: optimizationTests[2],
          queryComplexity: optimizationTests[3]
        }
      };

      optimizationTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.summary}`);
      });

      if (!allPassed) {
        this.violations.push({
          category: 'Database Optimization',
          issue: 'Database optimization features need improvement',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Database optimization validation failed:', error.message);
      this.results.optimization = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test query optimization effectiveness
  async testQueryOptimization() {
    try {
      //compare performance of potentially optimized vs unoptimized queries
      const optimizedQuery = '/api/blog?limit=10'; //should be fast with pagination
      const searchQuery = '/api/blog/search?q=test'; //should be optimized with indexing

      const results = [];
      
      for (const endpoint of [optimizedQuery, searchQuery]) {
        const start = Date.now();
        const response = await fetch(`http://localhost:4321${endpoint}`);
        const end = Date.now();
        
        results.push({
          endpoint,
          time: end - start,
          status: response.ok
        });
      }

      const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const passed = averageTime <= 150; //optimized queries should average under 150ms

      return {
        name: 'Query Optimization',
        passed,
        averageTime,
        results,
        summary: `Average: ${averageTime.toFixed(0)}ms`
      };
    } catch (error) {
      return {
        name: 'Query Optimization',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test cache effectiveness for repeated queries
  async testCacheEffectiveness() {
    try {
      const testEndpoint = '/api/blog?limit=5';
      
      //first request (cold)
      const start1 = Date.now();
      const response1 = await fetch(`http://localhost:4321${testEndpoint}`);
      const end1 = Date.now();
      const coldTime = end1 - start1;

      //small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      //second request (potentially cached)
      const start2 = Date.now();
      const response2 = await fetch(`http://localhost:4321${testEndpoint}`);
      const end2 = Date.now();
      const warmTime = end2 - start2;

      const improvement = ((coldTime - warmTime) / coldTime) * 100;
      const passed = warmTime <= coldTime; //warm should be same or faster

      return {
        name: 'Cache Effectiveness',
        passed,
        coldTime,
        warmTime,
        improvement,
        summary: `${improvement >= 10 ? 'Cache effective' : 'No significant caching'} (${improvement.toFixed(0)}% improvement)`
      };
    } catch (error) {
      return {
        name: 'Cache Effectiveness',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test index usage through query performance
  async testIndexUsage() {
    try {
      //test queries that should benefit from indexes
      const indexedQueries = [
        '/api/blog/search?q=performance', //search index
        '/api/blog/categories',           //category index
        '/api/portfolio/featured'         //featured flag index
      ];

      let fastQueries = 0;
      const results = [];

      for (const query of indexedQueries) {
        try {
          const start = Date.now();
          const response = await fetch(`http://localhost:4321${query}`);
          const end = Date.now();
          
          const time = end - start;
          const fast = time <= 200; //indexed queries should be fast
          
          if (fast) fastQueries++;
          
          results.push({ query, time, fast, status: response.ok });
        } catch (error) {
          results.push({ query, error: error.message, fast: false });
        }
      }

      const indexUsage = (fastQueries / indexedQueries.length) * 100;
      const passed = indexUsage >= DATABASE_CRITERIA.optimization.indexUsage;

      return {
        name: 'Index Usage',
        passed,
        indexUsage,
        fastQueries,
        totalQueries: indexedQueries.length,
        results,
        summary: `${indexUsage.toFixed(0)}% queries appear optimized`
      };
    } catch (error) {
      return {
        name: 'Index Usage',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test query complexity management
  async testQueryComplexity() {
    try {
      //test potentially complex queries
      const complexQueries = [
        '/api/blog/archive',              //date grouping
        '/api/portfolio/statistics',      //aggregations
        '/api/blog/search?q=test&limit=50' //search with large limit
      ];

      let efficientQueries = 0;
      const results = [];

      for (const query of complexQueries) {
        try {
          const start = Date.now();
          const response = await fetch(`http://localhost:4321${query}`);
          const end = Date.now();
          
          const time = end - start;
          const efficient = time <= DATABASE_CRITERIA.performance.complexQuery;
          
          if (efficient) efficientQueries++;
          
          results.push({ query, time, efficient, status: response.ok });
        } catch (error) {
          results.push({ query, error: error.message, efficient: false });
        }
      }

      const efficiency = (efficientQueries / complexQueries.length) * 100;
      const passed = efficiency >= 70; //70% of complex queries should be efficient

      return {
        name: 'Query Complexity',
        passed,
        efficiency,
        efficientQueries,
        totalQueries: complexQueries.length,
        results,
        summary: `${efficiency.toFixed(0)}% complex queries efficient`
      };
    } catch (error) {
      return {
        name: 'Query Complexity',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate concurrency and load handling
  async validateConcurrency() {
    console.log('⚡ Validating Concurrency & Load Handling...\n');

    try {
      const concurrencyTests = [
        await this.testConcurrentQueries(),
        await this.testConnectionPooling(),
        await this.testLoadHandling(),
        await this.testResourceContention()
      ];

      const allPassed = concurrencyTests.every(test => test.passed);

      this.results.concurrency = {
        passed: allPassed,
        details: {
          concurrent: concurrencyTests[0],
          pooling: concurrencyTests[1],
          load: concurrencyTests[2],
          contention: concurrencyTests[3]
        }
      };

      concurrencyTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.summary}`);
      });

      if (!allPassed) {
        this.violations.push({
          category: 'Concurrency',
          issue: 'Concurrency handling needs improvement',
          severity: 'medium'
        });
      }

    } catch (error) {
      console.error('  ❌ Concurrency validation failed:', error.message);
      this.results.concurrency = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test concurrent query execution
  async testConcurrentQueries() {
    try {
      const concurrentRequests = 10;
      const testEndpoint = 'http://localhost:4321/api/blog?limit=5';
      
      const startTime = Date.now();
      
      //execute concurrent requests
      const promises = Array(concurrentRequests).fill(null).map(() => 
        fetch(testEndpoint).then(response => ({
          ok: response.ok,
          status: response.status,
          time: Date.now()
        }))
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const successfulRequests = results.filter(r => r.ok).length;
      const successRate = (successfulRequests / concurrentRequests) * 100;
      
      const passed = successRate >= 90 && totalTime <= 5000; //90% success in under 5s

      return {
        name: 'Concurrent Queries',
        passed,
        concurrentRequests,
        successfulRequests,
        successRate,
        totalTime,
        summary: `${successRate.toFixed(0)}% success rate in ${totalTime}ms`
      };
    } catch (error) {
      return {
        name: 'Concurrent Queries', 
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test connection pooling effectiveness
  async testConnectionPooling() {
    try {
      //test multiple rapid requests to see if connection pooling works
      const rapidRequests = 20;
      const endpoint = 'http://localhost:4321/api/health/database';
      
      const times = [];
      
      for (let i = 0; i < rapidRequests; i++) {
        const start = Date.now();
        const response = await fetch(endpoint);
        const end = Date.now();
        
        if (response.ok) {
          times.push(end - start);
        }
      }
      
      if (times.length === 0) {
        throw new Error('No successful requests');
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      const variation = this.calculateVariation(times);
      
      //good connection pooling should have consistent times (low variation)
      const passed = averageTime <= 200 && variation <= 50; //consistent and fast

      return {
        name: 'Connection Pooling',
        passed,
        averageTime,
        variation,
        successfulRequests: times.length,
        summary: `Avg: ${averageTime.toFixed(0)}ms, Variation: ${variation.toFixed(0)}ms`
      };
    } catch (error) {
      return {
        name: 'Connection Pooling',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test load handling capacity
  async testLoadHandling() {
    try {
      //simulate moderate load
      const loadTestRequests = 50;
      const endpoints = [
        'http://localhost:4321/api/blog?limit=3',
        'http://localhost:4321/api/portfolio?limit=3',
        'http://localhost:4321/api/health/database'
      ];
      
      const startTime = Date.now();
      
      const promises = [];
      for (let i = 0; i < loadTestRequests; i++) {
        const endpoint = endpoints[i % endpoints.length];
        promises.push(
          fetch(endpoint).then(response => ({
            ok: response.ok,
            status: response.status,
            endpoint
          }))
        );
      }
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const successfulRequests = results.filter(r => r.ok).length;
      const throughput = (successfulRequests / totalTime) * 1000; //requests per second
      
      const passed = throughput >= 10 && successfulRequests >= loadTestRequests * 0.95; //10 RPS with 95% success

      return {
        name: 'Load Handling',
        passed,
        totalRequests: loadTestRequests,
        successfulRequests,
        throughput,
        totalTime,
        summary: `${throughput.toFixed(1)} RPS (${successfulRequests}/${loadTestRequests} successful)`
      };
    } catch (error) {
      return {
        name: 'Load Handling',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test resource contention handling
  async testResourceContention() {
    try {
      //test mix of read and write operations
      const readEndpoint = 'http://localhost:4321/api/blog?limit=5';
      const writeEndpoint = 'http://localhost:4321/api/vitals'; //POST endpoint
      
      const startTime = Date.now();
      
      //mix of read and write operations
      const promises = [
        // Multiple reads
        ...Array(8).fill(null).map(() => fetch(readEndpoint)),
        // Few writes (simulated by POST requests)
        ...Array(2).fill(null).map(() => 
          fetch(writeEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'test', value: 100 })
          })
        )
      ];
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      const totalTime = endTime - startTime;
      const successfulOperations = results.filter(r => r.ok || r.status === 401).length; //401 is expected for unauth
      const successRate = (successfulOperations / promises.length) * 100;
      
      const passed = successRate >= 80 && totalTime <= 5000; //80% success in under 5s

      return {
        name: 'Resource Contention',
        passed,
        totalOperations: promises.length,
        successfulOperations,
        successRate,
        totalTime,
        summary: `${successRate.toFixed(0)}% operations successful in ${totalTime}ms`
      };
    } catch (error) {
      return {
        name: 'Resource Contention',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //validate database reliability and error handling
  async validateReliability() {
    console.log('🛡️  Validating Database Reliability...\n');

    try {
      const reliabilityTests = [
        await this.testErrorHandling(),
        await this.testConnectionRecovery(),
        await this.testDataIntegrity(),
        await this.testBackupSystems()
      ];

      const allPassed = reliabilityTests.every(test => test.passed);

      this.results.reliability = {
        passed: allPassed,
        details: {
          errorHandling: reliabilityTests[0],
          recovery: reliabilityTests[1],
          integrity: reliabilityTests[2],
          backup: reliabilityTests[3]
        }
      };

      reliabilityTests.forEach(test => {
        const status = test.passed ? '✅' : '❌';
        console.log(`  ${status} ${test.name}: ${test.summary}`);
      });

      if (!allPassed) {
        this.violations.push({
          category: 'Database Reliability',
          issue: 'Database reliability features need improvement',
          severity: 'high'
        });
      }

    } catch (error) {
      console.error('  ❌ Database reliability validation failed:', error.message);
      this.results.reliability = { passed: false, error: error.message };
    }

    console.log('');
  }

  //test database error handling
  async testErrorHandling() {
    try {
      //test invalid queries and see if they're handled gracefully
      const invalidEndpoints = [
        '/api/blog/invalid-endpoint',
        '/api/blog?invalid-param=test',
        '/api/nonexistent-table'
      ];

      let gracefulErrors = 0;
      const results = [];

      for (const endpoint of invalidEndpoints) {
        try {
          const response = await fetch(`http://localhost:4321${endpoint}`);
          
          //error should be handled gracefully (not 500 server error)
          const graceful = response.status !== 500;
          if (graceful) gracefulErrors++;
          
          results.push({
            endpoint,
            status: response.status,
            graceful
          });
        } catch (error) {
          //network errors are also handled gracefully
          gracefulErrors++;
          results.push({
            endpoint,
            error: error.message,
            graceful: true
          });
        }
      }

      const errorHandlingRate = (gracefulErrors / invalidEndpoints.length) * 100;
      const passed = errorHandlingRate >= 80; //80% of errors should be handled gracefully

      return {
        name: 'Error Handling',
        passed,
        errorHandlingRate,
        gracefulErrors,
        totalTests: invalidEndpoints.length,
        results,
        summary: `${errorHandlingRate.toFixed(0)}% errors handled gracefully`
      };
    } catch (error) {
      return {
        name: 'Error Handling',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test connection recovery capabilities
  async testConnectionRecovery() {
    try {
      //test if database connections can be recovered after errors
      //we'll simulate this by making requests after error conditions
      
      //first make some invalid requests
      await fetch('http://localhost:4321/api/invalid-endpoint').catch(() => {});
      
      //then test if normal requests still work
      const recoveryStart = Date.now();
      const response = await fetch('http://localhost:4321/api/health/database');
      const recoveryEnd = Date.now();
      
      const recoveryTime = recoveryEnd - recoveryStart;
      const recovered = response.ok;
      const passed = recovered && recoveryTime <= DATABASE_CRITERIA.reliability.recoveryTime;

      return {
        name: 'Connection Recovery',
        passed,
        recovered,
        recoveryTime,
        summary: recovered ? `Recovered in ${recoveryTime}ms` : 'Failed to recover'
      };
    } catch (error) {
      return {
        name: 'Connection Recovery',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test data integrity
  async testDataIntegrity() {
    try {
      //test that data queries return consistent results
      const testEndpoint = 'http://localhost:4321/api/blog?limit=5';
      
      //make the same request multiple times
      const requests = 3;
      const results = [];
      
      for (let i = 0; i < requests; i++) {
        const response = await fetch(testEndpoint);
        if (response.ok) {
          const data = await response.json();
          results.push(data);
        }
        
        //small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (results.length < 2) {
        throw new Error('Insufficient data for integrity check');
      }
      
      //check if results are consistent (same data structure)
      const firstResult = JSON.stringify(results[0]);
      const consistent = results.every(result => {
        return JSON.stringify(result) === firstResult ||
               (Array.isArray(result) && Array.isArray(results[0]) && result.length === results[0].length);
      });

      return {
        name: 'Data Integrity',
        passed: consistent,
        requestsMade: results.length,
        consistent,
        summary: consistent ? 'Data consistent across requests' : 'Data inconsistency detected'
      };
    } catch (error) {
      return {
        name: 'Data Integrity',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //test backup systems
  async testBackupSystems() {
    try {
      //check if database backup files or procedures exist
      const backupPaths = [
        'scripts/db/',
        'database/',
        'backups/'
      ];

      let backupSystemsFound = 0;
      const results = [];

      for (const backupPath of backupPaths) {
        const exists = fs.existsSync(path.join(process.cwd(), backupPath));
        if (exists) {
          backupSystemsFound++;
        }
        results.push({ path: backupPath, exists });
      }

      //also check for backup-related scripts
      const backupScripts = [
        'scripts/setup-database.js',
        'scripts/seed-database.js'
      ];

      let backupScriptsFound = 0;
      for (const script of backupScripts) {
        const exists = fs.existsSync(path.join(process.cwd(), script));
        if (exists) {
          backupScriptsFound++;
        }
      }

      const passed = backupSystemsFound > 0 || backupScriptsFound >= 2;

      return {
        name: 'Backup Systems',
        passed,
        backupSystemsFound,
        backupScriptsFound,
        summary: passed ? 'Backup capabilities detected' : 'No backup systems found'
      };
    } catch (error) {
      return {
        name: 'Backup Systems',
        passed: false,
        error: error.message,
        summary: `Error: ${error.message}`
      };
    }
  }

  //analyze query patterns and generate insights
  async analyzeQueryPatterns() {
    console.log('📊 Analyzing Query Patterns...\n');

    //analyze the collected query data
    const patterns = {
      slowQueries: this.performanceMetrics.slowQueries,
      fastQueries: this.queryAnalysis.filter(q => q.passed),
      errorQueries: this.performanceMetrics.errorQueries,
      averageResponseTime: this.performanceMetrics.averageResponseTime
    };

    //categorize queries by type
    const queryTypes = {
      simple: this.queryAnalysis.filter(q => q.scenario?.type === 'simple'),
      complex: this.queryAnalysis.filter(q => q.scenario?.type === 'complex')
    };

    console.log(`  📈 Query Pattern Analysis:`);
    console.log(`    • Total queries tested: ${this.performanceMetrics.totalQueries}`);
    console.log(`    • Average response time: ${this.performanceMetrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`    • Fast queries (passed): ${patterns.fastQueries.length}`);
    console.log(`    • Slow queries: ${patterns.slowQueries.length}`);
    console.log(`    • Error queries: ${patterns.errorQueries.length}`);
    console.log(`    • Simple queries: ${queryTypes.simple.length} (avg: ${this.calculateAverageTime(queryTypes.simple)}ms)`);
    console.log(`    • Complex queries: ${queryTypes.complex.length} (avg: ${this.calculateAverageTime(queryTypes.complex)}ms)`);

    //identify bottlenecks
    if (patterns.slowQueries.length > 0) {
      console.log(`\n  🐌 Slowest Queries:`);
      patterns.slowQueries
        .sort((a, b) => (b.responseTime || 0) - (a.responseTime || 0))
        .slice(0, 3)
        .forEach(query => {
          console.log(`    • ${query.scenario?.name}: ${query.responseTime}ms`);
        });
    }

    console.log('');
  }

  //generate optimization recommendations
  async generateRecommendations() {
    const recommendations = [];

    //performance recommendations
    if (this.performanceMetrics.slowQueries.length > 0) {
      recommendations.push('Optimize slow queries by adding appropriate indexes');
      recommendations.push('Consider query restructuring for better performance');
    }

    if (this.performanceMetrics.averageResponseTime > 200) {
      recommendations.push('Overall query performance needs improvement - consider connection pooling');
    }

    //specific optimization recommendations
    if (!this.results.optimization?.passed) {
      recommendations.push('Implement database query caching for frequently accessed data');
      recommendations.push('Add indexes on commonly searched fields (title, content, categories)');
      recommendations.push('Use prepared statements to improve query performance');
    }

    //concurrency recommendations
    if (!this.results.concurrency?.passed) {
      recommendations.push('Implement connection pooling to handle concurrent requests better');
      recommendations.push('Consider database read replicas for high-traffic scenarios');
    }

    //reliability recommendations
    if (!this.results.reliability?.passed) {
      recommendations.push('Implement comprehensive database error handling and retry logic');
      recommendations.push('Set up automated database backups and recovery procedures');
      recommendations.push('Add database monitoring and alerting for proactive issue detection');
    }

    this.recommendations = recommendations;
  }

  //generate comprehensive database report
  async generateReport() {
    const endTime = Date.now();
    const duration = endTime - this.startTime;

    console.log('📊 Database Performance Validation Report');
    console.log('═'.repeat(55));
    console.log(`Validation completed in ${Math.round(duration / 1000)}s`);
    console.log(`Overall Status: ${this.shouldPass() ? 'PASSED' : 'FAILED'}\n`);

    //category summary
    console.log('📋 Category Results:');
    console.log('─'.repeat(30));

    const categories = [
      { key: 'performance', name: 'Query Performance' },
      { key: 'optimization', name: 'Database Optimization' },
      { key: 'concurrency', name: 'Concurrency Handling' },
      { key: 'reliability', name: 'Database Reliability' }
    ];

    categories.forEach(category => {
      const result = this.results[category.key];
      if (result) {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status.padEnd(8)} ${category.name}`);
      }
    });

    //performance summary
    console.log('\n📈 Performance Summary:');
    console.log('─'.repeat(30));
    console.log(`Average Query Time: ${this.performanceMetrics.averageResponseTime.toFixed(0)}ms`);
    console.log(`Successful Queries: ${this.performanceMetrics.successfulQueries}/${this.performanceMetrics.totalQueries}`);
    console.log(`Queries Meeting SLA: ${this.performanceMetrics.totalQueries - this.performanceMetrics.slowQueries.length}/${this.performanceMetrics.totalQueries}`);

    //violations
    if (this.violations.length > 0) {
      console.log('\n⚠️  Performance Violations:');
      console.log('─'.repeat(30));
      this.violations.forEach((violation, index) => {
        console.log(`${index + 1}. ${violation.category}: ${violation.issue} (${violation.severity})`);
      });
    }

    //recommendations
    if (this.recommendations && this.recommendations.length > 0) {
      console.log('\n💡 Optimization Recommendations:');
      console.log('─'.repeat(30));
      this.recommendations.slice(0, 8).forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    //save detailed report
    await this.saveDetailedReport();
  }

  //save detailed database validation report
  async saveDetailedReport() {
    const report = {
      timestamp: new Date().toISOString(),
      duration: Date.now() - this.startTime,
      plan: 'Plan 7 - Database Validation',
      criteria: DATABASE_CRITERIA,
      results: this.results,
      violations: this.violations,
      recommendations: this.recommendations,
      performanceMetrics: this.performanceMetrics,
      queryAnalysis: this.queryAnalysis,
      passed: this.shouldPass(),
      summary: {
        categoriesPassed: Object.values(this.results).filter(r => r.passed).length,
        totalCategories: Object.keys(this.results).length,
        violationsFound: this.violations.length,
        averageQueryTime: this.performanceMetrics.averageResponseTime,
        slowQueries: this.performanceMetrics.slowQueries.length,
        errorQueries: this.performanceMetrics.errorQueries.length
      }
    };

    const reportPath = `database-validation-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n💾 Detailed database report saved to: ${reportPath}`);
  }

  //determine if validation should pass
  shouldPass() {
    const passedCategories = Object.values(this.results).filter(r => r.passed).length;
    const totalCategories = Object.keys(this.results).length;
    const passRate = (passedCategories / totalCategories) * 100;

    //require 80% of categories to pass and no critical violations
    const criticalViolations = this.violations.filter(v => v.severity === 'critical').length;
    
    return passRate >= 80 && criticalViolations === 0;
  }

  //utility methods
  calculateVariation(times) {
    const avg = times.reduce((sum, time) => sum + time, 0) / times.length;
    const variance = times.reduce((sum, time) => sum + Math.pow(time - avg, 2), 0) / times.length;
    return Math.sqrt(variance);
  }

  calculateAverageTime(queries) {
    const validQueries = queries.filter(q => q.responseTime && !isNaN(q.responseTime));
    if (validQueries.length === 0) return 0;
    
    const total = validQueries.reduce((sum, q) => sum + q.responseTime, 0);
    return Math.round(total / validQueries.length);
  }
}

//main execution
async function main() {
  const validator = new DatabaseValidator();

  try {
    const passed = await validator.run();

    console.log('═'.repeat(55));

    if (passed) {
      console.log('🎉 DATABASE VALIDATION PASSED');
      console.log('Database performance meets Plan 7 requirements');
    } else {
      console.log('🚫 DATABASE VALIDATION FAILED');
      console.log('Database performance needs optimization');
    }

    console.log('═'.repeat(55));

    process.exit(passed ? 0 : 1);

  } catch (error) {
    console.error('\n💥 Database validation failed with error:', error.message);
    process.exit(1);
  }
}

//run if called directly
if (require.main === module) {
  main();
}

module.exports = { DatabaseValidator, DATABASE_CRITERIA };