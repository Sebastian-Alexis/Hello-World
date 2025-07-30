import type { APIRoute } from 'astro';
import { monitoring } from '../../../lib/monitoring';

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange') || '1h';
    const includeDetails = url.searchParams.get('details') === 'true';

    //get system status
    const systemStatus = monitoring.getSystemStatus();

    //collect data from all monitoring components
    const dashboardData = {
      timestamp: Date.now(),
      timeRange,
      systemStatus,
      overview: {
        systemHealth: 'healthy', // simplified for demo
        uptime: '99.9%',
        responseTime: '250ms',
        errorRate: '0.1%',
        activeUsers: 42,
        totalRequests: 15847,
      },
      performance: {
        avgResponseTime: 250,
        p95ResponseTime: 450,
        p99ResponseTime: 800,
        requestsPerMinute: 125,
        errorsPerMinute: 2,
        memoryUsage: 65.4,
        cpuUsage: 23.2,
      },
      health: {
        overallStatus: 'healthy',
        checks: {
          database: { status: 'healthy', responseTime: 45 },
          api: { status: 'healthy', responseTime: 120 },
          cache: { status: 'healthy', responseTime: 5 },
          storage: { status: 'healthy', responseTime: 15 },
        },
        criticalIssues: 0,
        warnings: 1,
      },
      alerts: {
        active: 2,
        critical: 0,
        warning: 2,
        info: 0,
        recent: [
          {
            id: 'alert_1',
            title: 'High Memory Usage Warning',
            severity: 'warning',
            timestamp: Date.now() - 300000, // 5 minutes ago
            status: 'active',
          },
          {
            id: 'alert_2',
            title: 'Slow Database Query',
            severity: 'warning',
            timestamp: Date.now() - 600000, // 10 minutes ago
            status: 'acknowledged',
          },
        ],
      },
      uptime: {
        overallUptime: 99.95,
        services: [
          { name: 'Main Website', uptime: 99.98, status: 'operational' },
          { name: 'API', uptime: 99.92, status: 'operational' },
          { name: 'Database', uptime: 99.99, status: 'operational' },
          { name: 'CDN', uptime: 99.85, status: 'degraded' },
        ],
        incidents: [
          {
            id: 'inc_1',
            title: 'CDN Performance Degradation',
            status: 'monitoring',
            severity: 'medium',
            startTime: Date.now() - 1800000, // 30 minutes ago
            affectedServices: ['CDN'],
          },
        ],
      },
      logs: {
        totalLogs: 8456,
        errorRate: 0.8,
        logsByLevel: {
          error: 67,
          warn: 234,
          info: 5432,
          debug: 2723,
        },
        recentErrors: [
          {
            timestamp: Date.now() - 120000,
            level: 'error',
            message: 'Database connection timeout',
            source: 'database',
          },
          {
            timestamp: Date.now() - 300000,
            level: 'error',
            message: 'Failed to load user profile',
            source: 'api',
          },
        ],
        topSources: [
          { source: 'api', count: 4231 },
          { source: 'auth', count: 1876 },
          { source: 'database', count: 1543 },
          { source: 'cache', count: 806 },
        ],
      },
      traces: {
        totalTraces: 1234,
        avgDuration: 185,
        errorRate: 2.3,
        topOperations: [
          { name: 'GET /api/portfolio', count: 456, avgDuration: 125 },
          { name: 'GET /api/blog', count: 234, avgDuration: 95 },
          { name: 'POST /api/analytics/track', count: 189, avgDuration: 45 },
          { name: 'GET /api/health', count: 123, avgDuration: 15 },
        ],
        recentTraces: [
          {
            id: 'trace_1',
            duration: 245,
            operations: 4,
            errors: 0,
            services: ['api', 'database'],
            timestamp: Date.now() - 60000,
          },
          {
            id: 'trace_2',
            duration: 1250,
            operations: 8,
            errors: 1,
            services: ['api', 'database', 'cache'],
            timestamp: Date.now() - 120000,
          },
        ],
      },
      backup: {
        lastBackup: Date.now() - 28800000, // 8 hours ago
        nextBackup: Date.now() + 14400000, // 4 hours from now
        totalBackups: 45,
        healthyBackups: 44,
        totalSize: '2.3GB',
        jobs: [
          {
            name: 'Daily Database Backup',
            status: 'completed',
            lastRun: Date.now() - 28800000,
            nextRun: Date.now() + 14400000,
          },
          {
            name: 'Weekly Configuration Backup',
            status: 'pending',
            lastRun: Date.now() - 518400000, // 6 days ago
            nextRun: Date.now() + 86400000, // 1 day from now
          },
        ],
      },
    };

    //add detailed information if requested
    if (includeDetails) {
      dashboardData.performance = {
        ...dashboardData.performance,
        detailedMetrics: {
          requestDistribution: [
            { endpoint: '/api/portfolio', requests: 2341, avgTime: 125 },
            { endpoint: '/api/blog', requests: 1876, avgTime: 95 },
            { endpoint: '/api/analytics/track', requests: 4231, avgTime: 45 },
            { endpoint: '/api/health', requests: 7399, avgTime: 15 },
          ],
          errorDistribution: [
            { type: 'database_timeout', count: 23 },
            { type: 'validation_error', count: 12 },
            { type: 'rate_limit_exceeded', count: 8 },
            { type: 'auth_failure', count: 5 },
          ],
          memoryTrend: [
            { timestamp: Date.now() - 3600000, value: 62.1 },
            { timestamp: Date.now() - 2700000, value: 63.8 },
            { timestamp: Date.now() - 1800000, value: 64.2 },
            { timestamp: Date.now() - 900000, value: 65.1 },
            { timestamp: Date.now(), value: 65.4 },
          ],
        },
      };
    }

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    
    return new Response(JSON.stringify({
      error: 'Failed to load dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
};