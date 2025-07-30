module.exports = {
  ci: {
    // Build configuration
    collect: {
      // URLs to test - adjust based on your important pages
      url: [
        'http://localhost:4321',
        'http://localhost:4321/portfolio',
        'http://localhost:4321/blog',
        'http://localhost:4321/flights',
        'http://localhost:4321/skills',
      ],
      // Number of times to run Lighthouse on each URL
      numberOfRuns: 3,
      // Additional Lighthouse settings
      settings: {
        // Use desktop configuration for consistent results
        preset: 'desktop',
        // Disable storage reset for faster CI runs
        disableStorageReset: false,
        // Set consistent throttling
        throttlingMethod: 'simulate',
        // Mobile throttling settings
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        // Screen emulation
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        },
        // Form factor
        formFactor: 'desktop',
        // Include only necessary audits for CI performance
        onlyAudits: [
          'first-contentful-paint',
          'largest-contentful-paint',
          'first-meaningful-paint',
          'speed-index',
          'total-blocking-time',
          'cumulative-layout-shift',
          'interactive',
          'server-response-time',
          'render-blocking-resources',
          'unused-css-rules',
          'unused-javascript',
          'modern-image-formats',
          'uses-optimized-images',
          'uses-text-compression',
          'uses-responsive-images',
          'efficient-animated-content',
          'preload-lcp-image',
          'uses-rel-preconnect',
          'uses-rel-preload',
          'font-display',
          'bootup-time',
          'mainthread-work-breakdown',
          'dom-depth',
          'critical-request-chains',
          'user-timings',
          'uses-passive-event-listeners',
          'no-document-write',
          'uses-http2',
          'uses-long-cache-ttl',
          'total-byte-weight',
          'uses-webp-images',
          'uses-avif-images'
        ]
      }
    },
    // Upload configuration for CI server (optional)
    upload: {
      // Configure target to send results
      target: 'temporary-public-storage',
      // Alternative: Use your own LHCI server
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,
    },
    // Performance budgets and assertions
    assert: {
      // Assertion method - 'lighthouse:default' for Lighthouse scores
      assertions: {
        // Categories: performance, accessibility, best-practices, seo, pwa
        'categories:performance': ['error', {minScore: 0.95}], // 95+ performance score
        'categories:accessibility': ['error', {minScore: 0.95}], // 95+ accessibility score
        'categories:best-practices': ['error', {minScore: 0.90}], // 90+ best practices score
        'categories:seo': ['error', {minScore: 0.90}], // 90+ SEO score
        
        // Core Web Vitals thresholds (in milliseconds)
        'audits:first-contentful-paint': ['error', {maxNumericValue: 1800}], // 1.8s FCP
        'audits:largest-contentful-paint': ['error', {maxNumericValue: 2500}], // 2.5s LCP
        'audits:cumulative-layout-shift': ['error', {maxNumericValue: 0.1}], // 0.1 CLS
        'audits:total-blocking-time': ['error', {maxNumericValue: 200}], // 200ms TBT
        'audits:speed-index': ['error', {maxNumericValue: 3400}], // 3.4s Speed Index
        'audits:interactive': ['error', {maxNumericValue: 5000}], // 5s TTI
        
        // Performance budgets
        'audits:server-response-time': ['error', {maxNumericValue: 600}], // 600ms TTFB
        'audits:render-blocking-resources': ['warn', {maxNumericValue: 500}], // 500ms blocking
        'audits:unused-css-rules': ['warn', {maxNumericValue: 20000}], // 20KB unused CSS
        'audits:unused-javascript': ['warn', {maxNumericValue: 50000}], // 50KB unused JS
        'audits:total-byte-weight': ['warn', {maxNumericValue: 1600000}], // 1.6MB total size
        
        // Image optimization
        'audits:modern-image-formats': ['warn', {maxNumericValue: 85}],
        'audits:uses-optimized-images': ['warn', {maxNumericValue: 85}],
        'audits:uses-webp-images': ['warn', {maxNumericValue: 85}],
        'audits:uses-avif-images': ['warn', {maxNumericValue: 85}],
        'audits:uses-responsive-images': ['warn', {maxNumericValue: 85}],
        
        // Caching and compression
        'audits:uses-text-compression': ['warn', {maxNumericValue: 85}],
        'audits:uses-long-cache-ttl': ['warn', {maxNumericValue: 85}],
        
        // Critical resource optimization
        'audits:preload-lcp-image': ['warn', {maxNumericValue: 85}],
        'audits:uses-rel-preconnect': ['warn', {maxNumericValue: 85}],
        'audits:uses-rel-preload': ['warn', {maxNumericValue: 85}],
        'audits:font-display': ['warn', {maxNumericValue: 85}],
        
        // JavaScript performance
        'audits:bootup-time': ['warn', {maxNumericValue: 3500}], // 3.5s bootup time
        'audits:mainthread-work-breakdown': ['warn', {maxNumericValue: 4000}], // 4s main thread
        
        // DOM and structure
        'audits:dom-depth': ['warn', {maxNumericValue: 1500}], // DOM depth
        
        // Modern web features
        'audits:uses-passive-event-listeners': ['warn', {minScore: 1}],
        'audits:no-document-write': ['error', {minScore: 1}],
        'audits:uses-http2': ['warn', {minScore: 0.8}]
      },
      // Preset configurations
      preset: 'lighthouse:recommended',
      // Include assertions from presets but override with custom ones above
      includePassedAssertions: true
    },
    // Server configuration (for running your own LHCI server)
    server: {
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'sqlite',
        sqlDatabasePath: './lhci.db'
      }
    },
    // Wizard configuration
    wizard: {
      // Skip the wizard in CI environments
      enable: false
    }
  }
};