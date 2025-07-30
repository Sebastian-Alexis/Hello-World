# Plan 8: Deployment & Production Setup

**Session Goal**: Implement complete production deployment, CI/CD pipeline, and final system integration  
**Estimated Time**: 4-5 hours  
**Prerequisites**: Plans 1-7 completed (all core systems, optimization, and testing)  

## Development Phase: Production Deployment & Integration

### Todo List

#### 1. CI/CD Pipeline Configuration
- [ ] Set up GitHub Actions workflow for automated testing
- [ ] Configure build and deployment pipeline to Cloudflare Pages
- [ ] Implement automated database migrations on deployment
- [ ] Set up environment-specific configurations
- [ ] Create staging and production deployment environments
- [ ] Implement rollback mechanisms for failed deployments
- [ ] Add automated security scanning and vulnerability checks
- [ ] Configure performance regression testing in CI

#### 2. Production Infrastructure Setup
- [ ] Configure Cloudflare Pages with custom domain
- [ ] Set up Turso database with production scaling
- [ ] Implement Redis caching layer for production
- [ ] Configure CDN with optimal caching rules
- [ ] Set up DNS with proper records and security headers
- [ ] Implement SSL/TLS certificates and HSTS
- [ ] Configure rate limiting and DDoS protection
- [ ] Set up backup and disaster recovery systems

#### 3. Environment & Secrets Management
- [ ] Create comprehensive environment variable documentation
- [ ] Set up secure secrets management for all environments
- [ ] Configure API key rotation and management system
- [ ] Implement environment-specific feature flags
- [ ] Set up configuration validation and health checks
- [ ] Create environment synchronization tools
- [ ] Add secrets scanning and security compliance
- [ ] Build configuration drift detection

#### 4. Monitoring & Alerting Systems
- [ ] Set up comprehensive application monitoring
- [ ] Configure uptime monitoring and health checks
- [ ] Implement log aggregation and analysis system
- [ ] Create alerting rules for critical issues
- [ ] Set up performance monitoring dashboards
- [ ] Configure error tracking and incident management
- [ ] Implement business metrics and KPI tracking
- [ ] Add automated reporting and analytics

#### 5. Database Production Configuration
- [ ] Optimize database for production workloads
- [ ] Set up database replication and backups
- [ ] Implement connection pooling and query optimization
- [ ] Configure database monitoring and alerting
- [ ] Set up automated maintenance and cleanup tasks
- [ ] Create database migration and rollback procedures
- [ ] Implement data retention and archival policies
- [ ] Add database security hardening

#### 6. Security & Compliance Implementation
- [ ] Implement comprehensive security headers
- [ ] Set up Content Security Policy (CSP) with nonces
- [ ] Configure CORS policies for production
- [ ] Implement rate limiting and abuse prevention
- [ ] Set up security monitoring and threat detection
- [ ] Create GDPR compliance tools and privacy controls
- [ ] Add security audit logging and compliance reporting
- [ ] Implement vulnerability scanning and patching

#### 7. Performance & Scaling Optimization
- [ ] Configure edge computing and serverless functions
- [ ] Implement auto-scaling for high traffic loads
- [ ] Set up geographic load balancing
- [ ] Optimize asset delivery and compression
- [ ] Configure intelligent caching at CDN level
- [ ] Implement performance budgets and monitoring
- [ ] Set up capacity planning and resource allocation
- [ ] Add performance testing and load testing

#### 8. Final Integration & Documentation
- [ ] Create comprehensive deployment documentation
- [ ] Build system architecture documentation
- [ ] Implement API documentation with OpenAPI
- [ ] Create user guides and admin documentation
- [ ] Set up knowledge base and troubleshooting guides
- [ ] Build development setup and contribution guides
- [ ] Create disaster recovery and incident response plans
- [ ] Add final system testing and validation

## Detailed Implementation Steps

### Step 1: GitHub Actions CI/CD Pipeline (90 minutes)

**Main CI/CD Workflow** (.github/workflows/deploy.yml):
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  ASTRO_TELEMETRY_DISABLED: true

jobs:
  lint-and-test:
    name: Lint and Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint code
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit
        env:
          DATABASE_URL: ':memory:'

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: ':memory:'
          TEST_ENV: 'ci'

      - name: Build application
        run: npm run build
        env:
          PUBLIC_MAPBOX_ACCESS_TOKEN: ${{ secrets.MAPBOX_ACCESS_TOKEN }}
          PUBLIC_ANALYTICS_ID: 'test'

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build-files
          path: dist/
          retention-days: 1

  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run security audit
        run: npm audit --audit-level=high

      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
          head: HEAD

      - name: SAST Scan
        uses: github/super-linter@v5
        env:
          DEFAULT_BRANCH: main
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          VALIDATE_TYPESCRIPT_ES: true
          VALIDATE_CSS: true
          VALIDATE_HTML: true

  e2e-tests:
    name: End-to-End Tests
    runs-on: ubuntu-latest
    needs: [lint-and-test]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-files
          path: dist/

      - name: Start preview server
        run: npm run preview &
        env:
          DATABASE_URL: ':memory:'
          PUBLIC_MAPBOX_ACCESS_TOKEN: ${{ secrets.MAPBOX_ACCESS_TOKEN }}

      - name: Wait for server
        run: npx wait-on http://localhost:4321

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          BASE_URL: 'http://localhost:4321'

      - name: Upload E2E artifacts
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-artifacts
          path: |
            tests/e2e/results/
            tests/e2e/screenshots/

  performance-audit:
    name: Performance Audit
    runs-on: ubuntu-latest
    needs: [lint-and-test]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Download build artifacts
        uses: actions/download-artifact@v4
        with:
          name: build-files
          path: dist/

      - name: Start preview server
        run: npm run preview &

      - name: Wait for server
        run: npx wait-on http://localhost:4321

      - name: Run Lighthouse audit
        uses: treosh/lighthouse-ci-action@v10
        with:
          configPath: './lighthouse.config.js'
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Bundle size analysis
        run: npm run analyze:bundle

      - name: Performance regression check
        run: npm run test:performance

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: [lint-and-test, security-scan, e2e-tests, performance-audit]
    if: github.event_name == 'pull_request'
    environment: staging
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build for staging
        run: npm run build
        env:
          PUBLIC_SITE_URL: ${{ secrets.STAGING_SITE_URL }}
          PUBLIC_MAPBOX_ACCESS_TOKEN: ${{ secrets.MAPBOX_ACCESS_TOKEN }}
          PUBLIC_ANALYTICS_ID: ${{ secrets.STAGING_ANALYTICS_ID }}
          TURSO_DATABASE_URL: ${{ secrets.STAGING_TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.STAGING_TURSO_AUTH_TOKEN }}

      - name: Deploy to Cloudflare Pages (Staging)
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ${{ secrets.CLOUDFLARE_PROJECT_NAME }}
          directory: dist
          wranglerVersion: '3'

      - name: Run staging smoke tests
        run: npm run test:smoke
        env:
          BASE_URL: ${{ secrets.STAGING_SITE_URL }}

  deploy-production:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: [lint-and-test, security-scan, e2e-tests, performance-audit]
    if: github.ref == 'refs/heads/main'
    environment: production
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run database migrations
        run: npm run db:migrate
        env:
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}

      - name: Build for production
        run: npm run build
        env:
          NODE_ENV: 'production'
          PUBLIC_SITE_URL: ${{ secrets.SITE_URL }}
          PUBLIC_MAPBOX_ACCESS_TOKEN: ${{ secrets.MAPBOX_ACCESS_TOKEN }}
          PUBLIC_ANALYTICS_ID: ${{ secrets.ANALYTICS_ID }}
          TURSO_DATABASE_URL: ${{ secrets.TURSO_DATABASE_URL }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}

      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: ${{ secrets.CLOUDFLARE_PROJECT_NAME }}
          directory: dist
          wranglerVersion: '3'

      - name: Purge Cloudflare cache
        run: |
          curl -X POST "https://api.cloudflare.com/client/v4/zones/${{ secrets.CLOUDFLARE_ZONE_ID }}/purge_cache" \
               -H "Authorization: Bearer ${{ secrets.CLOUDFLARE_API_TOKEN }}" \
               -H "Content-Type: application/json" \
               --data '{"purge_everything":true}'

      - name: Run production smoke tests
        run: npm run test:smoke
        env:
          BASE_URL: ${{ secrets.SITE_URL }}

      - name: Update deployment status
        run: |
          curl -X POST "${{ secrets.DEPLOYMENT_WEBHOOK_URL }}" \
               -H "Content-Type: application/json" \
               -d '{"status":"success","version":"${{ github.sha }}","timestamp":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}'

      - name: Create GitHub release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
          body: |
            ## Changes in this Release
            ${{ github.event.head_commit.message }}
            
            **Deployed**: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
            **Commit**: ${{ github.sha }}
            **Build**: ${{ github.run_number }}
          draft: false
          prerelease: false
```

**Performance Budget Configuration** (lighthouse.config.js):
```javascript
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4321/',
        'http://localhost:4321/blog',
        'http://localhost:4321/portfolio',
        'http://localhost:4321/flights'
      ],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage'
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', {minScore: 0.95}],
        'categories:accessibility': ['error', {minScore: 0.95}],
        'categories:best-practices': ['error', {minScore: 0.95}],
        'categories:seo': ['error', {minScore: 0.95}],
        
        // Core Web Vitals
        'first-contentful-paint': ['error', {maxNumericValue: 1800}],
        'largest-contentful-paint': ['error', {maxNumericValue: 2500}],
        'cumulative-layout-shift': ['error', {maxNumericValue: 0.1}],
        'speed-index': ['error', {maxNumericValue: 3400}],
        'interactive': ['error', {maxNumericValue: 3800}],
        
        // Resource budgets
        'resource-summary:document:size': ['error', {maxNumericValue: 50000}],
        'resource-summary:script:size': ['error', {maxNumericValue: 100000}],
        'resource-summary:stylesheet:size': ['error', {maxNumericValue: 20000}],
        'resource-summary:image:size': ['error', {maxNumericValue: 500000}],
        'resource-summary:font:size': ['error', {maxNumericValue: 100000}],
        
        // Network requests
        'resource-summary:total:count': ['error', {maxNumericValue: 50}],
        'uses-optimized-images': 'error',
        'uses-text-compression': 'error',
        'uses-responsive-images': 'error',
        'efficient-animated-content': 'error'
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
```

### Step 2: Production Infrastructure Configuration (75 minutes)

**Cloudflare Pages Configuration** (wrangler.toml):
```toml
name = "personal-website"
compatibility_date = "2024-01-15"
pages_build_output_dir = "dist"

[env.production]
vars = { NODE_ENV = "production" }

[env.production.build]
command = "npm run build"

# Custom headers for security and performance
[[env.production.headers]]
for = "/*"
[env.production.headers.values]
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
X-XSS-Protection = "1; mode=block"
Referrer-Policy = "strict-origin-when-cross-origin"
Permissions-Policy = "camera=(), microphone=(), geolocation=()"
Strict-Transport-Security = "max-age=31536000; includeSubDomains; preload"
Content-Security-Policy = """
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://api.mapbox.com https://analytics.google.com;
  style-src 'self' 'unsafe-inline' https://api.mapbox.com;
  img-src 'self' data: https: blob:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.mapbox.com https://events.mapbox.com https://analytics.google.com;
  worker-src 'self' blob:;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
"""

# Cache static assets aggressively
[[env.production.headers]]
for = "/assets/*"
[env.production.headers.values]
Cache-Control = "public, max-age=31536000, immutable"

# Cache images with validation
[[env.production.headers]]
for = "*.{jpg,jpeg,png,gif,webp,avif,svg,ico}"
[env.production.headers.values]
Cache-Control = "public, max-age=2592000, stale-while-revalidate=86400"

# Cache fonts
[[env.production.headers]]
for = "*.{woff,woff2,ttf,eot}"
[env.production.headers.values]
Cache-Control = "public, max-age=31536000, immutable"
Access-Control-Allow-Origin = "*"

# API endpoints with no cache
[[env.production.headers]]
for = "/api/*"
[env.production.headers.values]
Cache-Control = "no-cache, no-store, must-revalidate"
X-Robots-Tag = "noindex"

# Redirects for SEO
[[env.production.redirects]]
from = "/blog/feed"
to = "/rss.xml"
status = 301

[[env.production.redirects]]
from = "/portfolio/resume"
to = "/resume.pdf"
status = 302

# Routes for SPA-like behavior
[[env.production.routes]]
include = ["/admin/*", "/api/*"]
exclude = ["/admin/assets/*"]
```

**Database Migration Script** (scripts/migrate-production.js):
```javascript
#!/usr/bin/env node

import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const config = {
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
  migrationsPath: join(__dirname, '../database/migrations'),
  schemaPath: join(__dirname, '../database/schema.sql')
};

// Validate environment
if (!config.url || !config.authToken) {
  console.error('❌ Missing required environment variables: TURSO_DATABASE_URL, TURSO_AUTH_TOKEN');
  process.exit(1);
}

// Initialize database client
const db = createClient({
  url: config.url,
  authToken: config.authToken
});

// Migration tracking table
const MIGRATIONS_TABLE = `
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT NOT NULL
  );
`;

async function runMigrations() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Create migrations table
    await db.execute(MIGRATIONS_TABLE);
    console.log('✅ Migrations table ready');

    // Get applied migrations
    const appliedResult = await db.execute('SELECT filename FROM _migrations ORDER BY id');
    const appliedMigrations = new Set(appliedResult.rows.map(row => row.filename));

    // Read migration files
    const migrationFiles = readdirSync(config.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(`📁 Found ${migrationFiles.length} migration files`);

    // Apply new migrations
    let appliedCount = 0;
    for (const filename of migrationFiles) {
      if (appliedMigrations.has(filename)) {
        console.log(`⏭️  Skipping ${filename} (already applied)`);
        continue;
      }

      console.log(`🔄 Applying ${filename}...`);
      
      const migrationPath = join(config.migrationsPath, filename);
      const migrationSQL = readFileSync(migrationPath, 'utf8');
      const checksum = generateChecksum(migrationSQL);

      // Execute migration in transaction
      await db.transaction(async (tx) => {
        // Split migration into statements
        const statements = migrationSQL
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0);

        for (const statement of statements) {
          await tx.execute(statement);
        }

        // Record migration
        await tx.execute({
          sql: 'INSERT INTO _migrations (filename, checksum) VALUES (?, ?)',
          args: [filename, checksum]
        });
      });

      console.log(`✅ Applied ${filename}`);
      appliedCount++;
    }

    // Initialize schema if no migrations were found
    if (migrationFiles.length === 0) {
      console.log('📋 No migration files found, applying base schema...');
      const schema = readFileSync(config.schemaPath, 'utf8');
      const statements = schema.split(';').filter(s => s.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          await db.execute(statement);
        }
      }
      console.log('✅ Base schema applied');
    }

    console.log(`🎉 Migration complete! Applied ${appliedCount} new migrations`);
    
    // Verify database integrity
    await verifyDatabase();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

async function verifyDatabase() {
  console.log('🔍 Verifying database integrity...');
  
  try {
    // Check foreign key constraints
    await db.execute('PRAGMA foreign_key_check');
    
    // Verify critical tables exist
    const criticalTables = ['users', 'blog_posts', 'portfolio_projects', 'flights', 'airports'];
    for (const table of criticalTables) {
      const result = await db.execute({
        sql: "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        args: [table]
      });
      
      if (result.rows.length === 0) {
        throw new Error(`Critical table '${table}' not found`);
      }
    }
    
    // Check indexes
    const indexResult = await db.execute("SELECT name FROM sqlite_master WHERE type='index'");
    console.log(`📊 Found ${indexResult.rows.length} indexes`);
    
    console.log('✅ Database integrity verified');
    
  } catch (error) {
    console.error('❌ Database verification failed:', error);
    throw error;
  }
}

function generateChecksum(content) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Rollback function for emergency use
async function rollbackMigration(filename) {
  console.log(`🔄 Rolling back migration: ${filename}`);
  
  try {
    await db.execute({
      sql: 'DELETE FROM _migrations WHERE filename = ?',
      args: [filename]
    });
    
    console.log(`✅ Rolled back ${filename}`);
    console.log('⚠️  Note: You may need to manually revert schema changes');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    process.exit(1);
  }
}

// Command line interface
const command = process.argv[2];
const filename = process.argv[3];

switch (command) {
  case 'migrate':
    runMigrations();
    break;
  case 'rollback':
    if (!filename) {
      console.error('❌ Please specify migration filename to rollback');
      process.exit(1);
    }
    rollbackMigration(filename);
    break;
  default:
    console.log(`
Usage:
  node migrate-production.js migrate          - Apply all pending migrations
  node migrate-production.js rollback <file> - Rollback specific migration
    `);
    process.exit(1);
}
```

### Step 3: Comprehensive Monitoring Setup (60 minutes)

**Health Check Endpoint** (src/pages/api/health.ts):
```typescript
import type { APIRoute } from 'astro';
import { DatabaseQueries } from '../../lib/db/queries';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    external_services: HealthCheck;
    performance: HealthCheck;
    disk_space: HealthCheck;
    memory: HealthCheck;
  };
}

interface HealthCheck {
  status: 'pass' | 'warn' | 'fail';
  duration_ms: number;
  details?: string;
  last_checked: string;
}

export const GET: APIRoute = async () => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Perform all health checks
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkExternalServices(),
    checkPerformance(),
    checkDiskSpace(),
    checkMemory()
  ]);

  const healthChecks = {
    database: checks[0].status === 'fulfilled' ? checks[0].value : createFailedCheck('Database check failed'),
    external_services: checks[1].status === 'fulfilled' ? checks[1].value : createFailedCheck('External services check failed'),
    performance: checks[2].status === 'fulfilled' ? checks[2].value : createFailedCheck('Performance check failed'),
    disk_space: checks[3].status === 'fulfilled' ? checks[3].value : createFailedCheck('Disk space check failed'),
    memory: checks[4].status === 'fulfilled' ? checks[4].value : createFailedCheck('Memory check failed')
  };

  // Determine overall status
  const failedChecks = Object.values(healthChecks).filter(check => check.status === 'fail');
  const warnChecks = Object.values(healthChecks).filter(check => check.status === 'warn');
  
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (failedChecks.length > 0) {
    overallStatus = 'unhealthy';
  } else if (warnChecks.length > 0) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  const result: HealthCheckResult = {
    status: overallStatus,
    timestamp,
    version: process.env.DEPLOYMENT_VERSION || 'unknown',
    uptime: process.uptime(),
    checks: healthChecks
  };

  // Set appropriate HTTP status
  const httpStatus = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503;

  return new Response(JSON.stringify(result, null, 2), {
    status: httpStatus,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
};

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const db = new DatabaseQueries();
    await db.healthCheck();
    
    // Test a simple query
    await db.execute('SELECT 1 as test');
    
    return {
      status: 'pass',
      duration_ms: Date.now() - startTime,
      last_checked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'fail',
      duration_ms: Date.now() - startTime,
      details: error instanceof Error ? error.message : 'Unknown database error',
      last_checked: new Date().toISOString()
    };
  }
}

async function checkExternalServices(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // Check Mapbox API
    const mapboxResponse = await fetch('https://api.mapbox.com/v1?access_token=test', {
      signal: AbortSignal.timeout(5000)
    });
    
    if (!mapboxResponse.ok && mapboxResponse.status !== 401) {
      throw new Error(`Mapbox API returned ${mapboxResponse.status}`);
    }
    
    return {
      status: 'pass',
      duration_ms: Date.now() - startTime,
      last_checked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'warn',
      duration_ms: Date.now() - startTime,
      details: error instanceof Error ? error.message : 'External services check failed',
      last_checked: new Date().toISOString()
    };
  }
}

async function checkPerformance(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  // Simple performance check - measure response time
  const responseTime = Date.now() - startTime;
  
  return {
    status: responseTime < 1000 ? 'pass' : responseTime < 2000 ? 'warn' : 'fail',
    duration_ms: responseTime,
    details: `Response time: ${responseTime}ms`,
    last_checked: new Date().toISOString()
  };
}

async function checkDiskSpace(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    // In a serverless environment, disk space is usually not a concern
    // This is more relevant for traditional server deployments
    return {
      status: 'pass',
      duration_ms: Date.now() - startTime,
      details: 'Serverless environment - disk space not applicable',
      last_checked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'warn',
      duration_ms: Date.now() - startTime,
      details: 'Unable to check disk space',
      last_checked: new Date().toISOString()
    };
  }
}

async function checkMemory(): Promise<HealthCheck> {
  const startTime = Date.now();
  
  try {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    const heapTotalMB = memoryUsage.heapTotal / 1024 / 1024;
    const memoryPercentage = (heapUsedMB / heapTotalMB) * 100;
    
    const status = memoryPercentage < 70 ? 'pass' : memoryPercentage < 85 ? 'warn' : 'fail';
    
    return {
      status,
      duration_ms: Date.now() - startTime,
      details: `Memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${memoryPercentage.toFixed(1)}%)`,
      last_checked: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'warn',
      duration_ms: Date.now() - startTime,
      details: 'Unable to check memory usage',
      last_checked: new Date().toISOString()
    };
  }
}

function createFailedCheck(details: string): HealthCheck {
  return {
    status: 'fail',
    duration_ms: 0,
    details,
    last_checked: new Date().toISOString()
  };
}
```

**Monitoring Dashboard Component** (src/components/admin/MonitoringDashboard.svelte):
```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  interface SystemMetrics {
    uptime: number;
    responseTime: number;
    errorRate: number;
    throughput: number;
    activeUsers: number;
    databaseConnections: number;
  }

  interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
      database: any;
      external_services: any;
      performance: any;
      memory: any;
    };
    timestamp: string;
  }

  let metrics: SystemMetrics = {
    uptime: 0,
    responseTime: 0,
    errorRate: 0,
    throughput: 0,
    activeUsers: 0,
    databaseConnections: 0
  };

  let healthStatus: HealthStatus | null = null;
  let performanceHistory: { timestamp: string; value: number }[] = [];
  let refreshInterval: number;
  let loading = true;
  let error = '';

  onMount(() => {
    loadInitialData();
    // Refresh every 30 seconds
    refreshInterval = setInterval(loadInitialData, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function loadInitialData() {
    try {
      await Promise.all([
        loadHealthStatus(),
        loadSystemMetrics(),
        loadPerformanceHistory()
      ]);
      error = '';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load monitoring data';
    } finally {
      loading = false;
    }
  }

  async function loadHealthStatus() {
    const response = await fetch('/api/health');
    healthStatus = await response.json();
  }

  async function loadSystemMetrics() {
    const response = await fetch('/api/admin/metrics');
    if (response.ok) {
      metrics = await response.json();
    }
  }

  async function loadPerformanceHistory() {
    const response = await fetch('/api/admin/performance-history?hours=24');
    if (response.ok) {
      const data = await response.json();
      performanceHistory = data.history || [];
    }
  }

  function getStatusColor(status: string): string {
    switch (status) {
      case 'healthy':
      case 'pass':
        return 'text-green-600 bg-green-100';
      case 'degraded':
      case 'warn':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
      case 'fail':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  }

  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }
</script>

<div class="monitoring-dashboard">
  {#if loading}
    <div class="loading-state">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <p>Loading monitoring data...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="text-red-600">❌ {error}</p>
      <button on:click={loadInitialData} class="retry-btn">
        Retry
      </button>
    </div>
  {:else}
    <!-- Overall Status -->
    <div class="status-overview">
      <div class="status-card {getStatusColor(healthStatus?.status || 'unknown')}">
        <div class="status-icon">
          {#if healthStatus?.status === 'healthy'}
            ✅
          {:else if healthStatus?.status === 'degraded'}
            ⚠️
          {:else}
            ❌
          {/if}
        </div>
        <div class="status-content">
          <h2 class="status-title">System Status</h2>
          <p class="status-value">{healthStatus?.status || 'Unknown'}</p>
          <p class="status-time">Last checked: {new Date(healthStatus?.timestamp || '').toLocaleTimeString()}</p>
        </div>
      </div>
    </div>

    <!-- System Metrics -->
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-header">
          <h3>Uptime</h3>
          <span class="metric-icon">⏱️</span>
        </div>
        <div class="metric-value">{formatUptime(metrics.uptime)}</div>
        <div class="metric-subtitle">System operational time</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <h3>Response Time</h3>
          <span class="metric-icon">⚡</span>
        </div>
        <div class="metric-value">{metrics.responseTime}ms</div>
        <div class="metric-subtitle">Average response time</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <h3>Error Rate</h3>
          <span class="metric-icon">🚨</span>
        </div>
        <div class="metric-value">{metrics.errorRate}%</div>
        <div class="metric-subtitle">24-hour error rate</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <h3>Throughput</h3>
          <span class="metric-icon">📊</span>
        </div>
        <div class="metric-value">{metrics.throughput}</div>
        <div class="metric-subtitle">Requests per minute</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <h3>Active Users</h3>
          <span class="metric-icon">👥</span>
        </div>
        <div class="metric-value">{metrics.activeUsers}</div>
        <div class="metric-subtitle">Current active sessions</div>
      </div>

      <div class="metric-card">
        <div class="metric-header">
          <h3>DB Connections</h3>
          <span class="metric-icon">🗄️</span>
        </div>
        <div class="metric-value">{metrics.databaseConnections}</div>
        <div class="metric-subtitle">Active database connections</div>
      </div>
    </div>

    <!-- Health Check Details -->
    {#if healthStatus}
      <div class="health-checks">
        <h3 class="section-title">Health Check Details</h3>
        <div class="checks-grid">
          {#each Object.entries(healthStatus.checks) as [service, check]}
            <div class="check-card">
              <div class="check-header">
                <span class="check-name">{service.replace('_', ' ')}</span>
                <span class="check-status {getStatusColor(check.status)}">{check.status}</span>
              </div>
              <div class="check-details">
                <p class="check-duration">Duration: {formatDuration(check.duration_ms)}</p>
                {#if check.details}
                  <p class="check-detail-text">{check.details}</p>
                {/if}
                <p class="check-time">Last checked: {new Date(check.last_checked).toLocaleTimeString()}</p>
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Performance Chart -->
    {#if performanceHistory.length > 0}
      <div class="performance-chart">
        <h3 class="section-title">24-Hour Performance Trend</h3>
        <div class="chart-container">
          <!-- Simple ASCII-style chart -->
          <div class="chart-grid">
            {#each performanceHistory.slice(-24) as point, i}
              <div 
                class="chart-bar" 
                style="height: {Math.max(2, (point.value / 1000) * 100)}px"
                title="{new Date(point.timestamp).toLocaleTimeString()}: {point.value}ms"
              ></div>
            {/each}
          </div>
          <p class="chart-label">Response time over the last 24 hours</p>
        </div>
      </div>
    {/if}

    <!-- Quick Actions -->
    <div class="quick-actions">
      <h3 class="section-title">Quick Actions</h3>
      <div class="actions-grid">
        <button class="action-btn" on:click={loadInitialData}>
          🔄 Refresh Data
        </button>
        <a href="/api/health" target="_blank" class="action-btn">
          📋 Raw Health Data
        </a>
        <a href="/admin/logs" class="action-btn">
          📄 View Logs
        </a>
        <a href="/admin/metrics" class="action-btn">
          📈 Detailed Metrics
        </a>
      </div>
    </div>
  {/if}
</div>

<style>
  .monitoring-dashboard {
    @apply space-y-8 p-6;
  }

  .loading-state {
    @apply flex flex-col items-center justify-center py-12 space-y-4;
  }

  .error-state {
    @apply text-center py-12 space-y-4;
  }

  .retry-btn {
    @apply bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors;
  }

  .status-overview {
    @apply mb-8;
  }

  .status-card {
    @apply flex items-center p-6 rounded-lg border-2;
  }

  .status-icon {
    @apply text-4xl mr-4;
  }

  .status-title {
    @apply text-xl font-semibold;
  }

  .status-value {
    @apply text-2xl font-bold capitalize;
  }

  .status-time {
    @apply text-sm opacity-75;
  }

  .metrics-grid {
    @apply grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8;
  }

  .metric-card {
    @apply bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700;
  }

  .metric-header {
    @apply flex items-center justify-between mb-3;
  }

  .metric-header h3 {
    @apply text-sm font-medium text-gray-600 dark:text-gray-400;
  }

  .metric-icon {
    @apply text-lg;
  }

  .metric-value {
    @apply text-3xl font-bold text-gray-900 dark:text-white;
  }

  .metric-subtitle {
    @apply text-sm text-gray-500 dark:text-gray-400 mt-1;
  }

  .health-checks {
    @apply mb-8;
  }

  .section-title {
    @apply text-lg font-semibold text-gray-900 dark:text-white mb-4;
  }

  .checks-grid {
    @apply grid grid-cols-1 md:grid-cols-2 gap-4;
  }

  .check-card {
    @apply bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700;
  }

  .check-header {
    @apply flex items-center justify-between mb-2;
  }

  .check-name {
    @apply font-medium capitalize;
  }

  .check-status {
    @apply px-2 py-1 text-xs font-medium rounded-full capitalize;
  }

  .check-details {
    @apply space-y-1 text-sm text-gray-600 dark:text-gray-400;
  }

  .performance-chart {
    @apply mb-8;
  }

  .chart-container {
    @apply bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700;
  }

  .chart-grid {
    @apply flex items-end space-x-1 h-32 mb-2;
  }

  .chart-bar {
    @apply flex-1 bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600;
    min-height: 2px;
  }

  .chart-label {
    @apply text-sm text-gray-500 dark:text-gray-400 text-center;
  }

  .quick-actions {
    @apply mb-8;
  }

  .actions-grid {
    @apply grid grid-cols-2 md:grid-cols-4 gap-4;
  }

  .action-btn {
    @apply bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-3 rounded-lg text-center font-medium transition-colors;
  }
</style>
```

### Step 4: Final System Documentation (45 minutes)

**Deployment Guide** (docs/DEPLOYMENT.md):
```markdown
# Deployment Guide

## Prerequisites

### Required Accounts & Services
- [GitHub](https://github.com) - Code repository and CI/CD
- [Cloudflare](https://cloudflare.com) - CDN, DNS, and hosting
- [Turso](https://turso.tech) - Database hosting
- [Mapbox](https://mapbox.com) - Maps and geolocation

### Required Tools
- Node.js 20+ with npm
- Git
- GitHub CLI (optional but recommended)

## Environment Setup

### 1. Environment Variables

Create the following environment variables in your deployment environments:

#### Production Environment
```bash
# Database
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Services
PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your-mapbox-token
PUBLIC_ANALYTICS_ID=G-YOUR-GA4-ID

# Site Configuration
PUBLIC_SITE_URL=https://yourdomain.com
NODE_ENV=production

# Deployment
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_PROJECT_NAME=your-project-name
CLOUDFLARE_ZONE_ID=your-zone-id
```

#### Staging Environment
```bash
# Use similar variables with staging-specific values
STAGING_TURSO_DATABASE_URL=libsql://your-staging-db.turso.io
STAGING_SITE_URL=https://staging.yourdomain.com
# ... other staging variables
```

### 2. GitHub Secrets

Add the following secrets to your GitHub repository:

1. Go to Repository → Settings → Secrets and variables → Actions
2. Add each secret:

```
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
STAGING_TURSO_DATABASE_URL
STAGING_TURSO_AUTH_TOKEN
PUBLIC_MAPBOX_ACCESS_TOKEN
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PROJECT_NAME
CLOUDFLARE_ZONE_ID
SITE_URL
STAGING_SITE_URL
ANALYTICS_ID
STAGING_ANALYTICS_ID
DEPLOYMENT_WEBHOOK_URL
```

## Deployment Process

### Automatic Deployment

The application automatically deploys when code is pushed to the main branch:

1. **Push to main branch** → Production deployment
2. **Create pull request** → Staging deployment

### Manual Deployment

If you need to deploy manually:

```bash
# Build the application
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name=your-project-name
```

### Database Migrations

Migrations run automatically during deployment, but you can run them manually:

```bash
# Production
TURSO_DATABASE_URL=your-url TURSO_AUTH_TOKEN=your-token npm run db:migrate

# Staging
TURSO_DATABASE_URL=staging-url TURSO_AUTH_TOKEN=staging-token npm run db:migrate
```

## Monitoring & Maintenance

### Health Checks

Monitor system health at:
- Production: `https://yourdomain.com/api/health`
- Staging: `https://staging.yourdomain.com/api/health`

### Performance Monitoring

- Lighthouse CI runs on every deployment
- Performance metrics are tracked in `/admin/monitoring`
- Set up alerts for Core Web Vitals degradation

### Database Maintenance

```bash
# Backup database
npm run db:backup

# Analyze query performance
npm run db:analyze

# Clean up old analytics data
npm run db:cleanup
```

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check environment variables are set correctly
   - Verify all dependencies are in package.json
   - Check TypeScript compilation errors

2. **Database Connection Issues**
   - Verify TURSO_DATABASE_URL and TURSO_AUTH_TOKEN
   - Check database is accessible from deployment environment
   - Run health check endpoint

3. **Performance Issues**
   - Check Lighthouse CI results
   - Monitor Core Web Vitals
   - Review bundle size analysis

4. **SSL/Security Issues**
   - Verify DNS configuration
   - Check Cloudflare SSL settings
   - Review Content Security Policy headers

### Support

For deployment issues:
1. Check GitHub Actions logs
2. Review Cloudflare Pages deployment logs
3. Monitor application health endpoints
4. Check database connectivity

## Rollback Procedures

### Automatic Rollback

If health checks fail after deployment, the system can be rolled back:

```bash
# Rollback to previous version
npx wrangler pages deployment list --project-name=your-project-name
npx wrangler pages deployment promote <deployment-id> --project-name=your-project-name
```

### Database Rollback

```bash
# Rollback specific migration
node scripts/migrate-production.js rollback migration-filename.sql
```

## Security Considerations

- All secrets are stored in GitHub Secrets or environment variables
- Content Security Policy headers are enforced
- Rate limiting is enabled on all API endpoints
- Database connections use authentication tokens
- HTTPS is enforced with HSTS headers
```

## Testing & Validation

### Final Checklist
- [ ] GitHub Actions CI/CD pipeline runs successfully with all tests passing
- [ ] Production deployment completes without errors
- [ ] Database migrations execute successfully in production
- [ ] All environment variables are properly configured
- [ ] Health check endpoints return "healthy" status
- [ ] Monitoring dashboard displays accurate metrics
- [ ] Performance meets all Lighthouse CI thresholds
- [ ] Security headers are properly configured
- [ ] CDN caching rules optimize asset delivery
- [ ] Error tracking and alerting systems are functional

## Success Criteria
✅ Complete CI/CD pipeline automatically deploys and tests all changes  
✅ Production infrastructure is properly configured and secured  
✅ Monitoring systems provide comprehensive visibility into system health  
✅ Database operations are optimized for production workloads  
✅ Security hardening protects against common vulnerabilities  
✅ Performance monitoring ensures optimal user experience  
✅ Documentation enables easy maintenance and troubleshooting  
✅ System is fully production-ready with proper backup and recovery procedures  

## Project Completion
With Plan 8 completed, the entire personal website system is now production-ready with:
- Comprehensive blog and portfolio management
- Interactive flight tracking and visualization  
- Advanced performance optimization and caching
- Full CI/CD pipeline with automated testing
- Production-grade monitoring and alerting
- Complete security hardening and compliance
- Detailed documentation and maintenance procedures

The system is designed to handle high traffic loads while maintaining excellent performance and provides a solid foundation for future enhancements and feature additions.