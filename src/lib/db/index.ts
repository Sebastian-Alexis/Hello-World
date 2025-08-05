// =============================================================================
// DATABASE OPTIMIZATION SUITE - Plan 7 Implementation
// Ultra-fast database layer with comprehensive performance optimization
// =============================================================================

//core database functionality
export { 
  getDbClient, 
  closeDb, 
  healthCheck, 
  enhancedHealthCheck,
  executeQuery,
  executeTransaction,
  getDatabaseStats,
  monitorConnection,
} from './connection';

//performance monitoring and optimization
export {
  executeOptimizedQuery,
  executeOptimizedTransaction,
  CacheManager,
  PerformanceAnalytics,
  ConnectionPoolMonitor,
  DatabaseMaintenance,
  PERFORMANCE_BUDGETS,
  type QueryPerformanceMetrics,
  type CachePerformanceMetrics,
  type ConnectionPoolMetrics,
} from './performance';

//optimized database queries
export {
  OptimizedDatabaseQueries,
  optimizedQueries,
} from './optimized-queries';

//database queries instance
export { db } from './queries';

//full-text search optimization
export {
  SearchOptimization,
  searchOptimization,
  SEARCH_CONFIG,
  type SearchResult,
  type SearchSuggestion,
  type AdvancedSearchOptions,
} from './search-optimization';

//database maintenance and cleanup
export {
  DatabaseMaintenanceManager,
  maintenanceManager,
  MaintenanceScheduler,
  MAINTENANCE_CONFIG,
  type MaintenanceResult,
  type DatabaseHealthReport,
} from './maintenance';

//error handling and recovery
export {
  DatabaseErrorHandler,
  errorHandler,
  executeQueryWithErrorHandling,
  DatabaseCircuitBreaker,
  databaseCircuitBreaker,
  DatabaseErrorCategory,
  ErrorSeverity,
  type DatabaseError,
  type ErrorContext,
  type RecoveryStrategy,
  type ErrorStatistics,
} from './error-handling';

//analytics and performance dashboard
export {
  DatabaseAnalytics,
  databaseAnalytics,
  type PerformanceDashboard,
  type RealTimeMetrics,
  type PerformanceAlert,
  type SlowQueryInfo,
  type QueryTypeStats,
  type PerformanceTrend,
  type CacheQueryInfo,
  type CacheTypeStats,
  type TableQueryStats,
  type TableGrowthInfo,
  type IndexUsageInfo,
  type ErrorSummary,
  type RecoveryStats,
} from './analytics';

//type definitions
export * from './types';

// =============================================================================
// QUICK START GUIDE
// =============================================================================

/*
PLAN 7 DATABASE OPTIMIZATION QUICK START:

1. BASIC USAGE:
   import { optimizedQueries } from '@/lib/db';
   const posts = await optimizedQueries.getBlogPosts({ page: 1, limit: 10 });

2. SEARCH FUNCTIONALITY:
   import { searchOptimization } from '@/lib/db';
   const results = await searchOptimization.searchBlogPosts('typescript');

3. PERFORMANCE MONITORING:  
   import { databaseAnalytics } from '@/lib/db';
   const dashboard = await databaseAnalytics.generatePerformanceDashboard();

4. MAINTENANCE:
   import { maintenanceManager } from '@/lib/db';
   await maintenanceManager.runDailyMaintenance();

5. ERROR HANDLING:
   import { executeQueryWithErrorHandling } from '@/lib/db';
   const result = await executeQueryWithErrorHandling('SELECT * FROM posts');

PERFORMANCE FEATURES:
✅ <100ms query performance budget
✅ Automatic query caching with TTL
✅ Connection pooling simulation
✅ Real-time performance monitoring
✅ FTS5 search optimization
✅ Automatic error recovery
✅ Database maintenance automation
✅ Comprehensive analytics dashboard

MONITORING ENDPOINTS:
- Real-time metrics: databaseAnalytics.getRealTimeMetrics()
- Health check: enhancedHealthCheck()
- Performance alerts: databaseAnalytics.checkPerformanceAlerts()
- Error statistics: errorHandler.getErrorStatistics()

MAINTENANCE SCHEDULE:
- Daily: Cleanup, optimization, stats update
- Weekly: Deep clean, index rebuild, integrity check
- Monthly: Full vacuum, archiving, comprehensive cleanup
*/

// =============================================================================
// INITIALIZATION HELPERS
// =============================================================================

//initializes optimized database with all performance features
export async function initializeOptimizedDatabase(): Promise<{
  success: boolean;
  message: string;
  features: string[];
  performance: any;
}> {
  try {
    console.log('🚀 Initializing Plan 7 Database Optimization Suite...');
    
    //run health check
    const health = await enhancedHealthCheck();
    
    //test search functionality
    await searchOptimization.optimizeSearchIndexes();
    
    //generate initial performance baseline
    const metrics = await databaseAnalytics.getRealTimeMetrics();
    
    const features = [
      '⚡ Ultra-fast query execution (<100ms budget)',
      '🔍 FTS5 full-text search optimization',
      '📊 Real-time performance monitoring',
      '🛠️ Automated maintenance procedures',
      '🔄 Automatic error recovery',
      '💾 Intelligent query caching',
      '📈 Comprehensive analytics dashboard',
      '🔒 Circuit breaker protection',
    ];
    
    console.log('✅ Database optimization suite initialized successfully');
    console.log(`📊 Current performance: ${metrics.currentQps} QPS, ${metrics.cacheHitRate}% cache hit rate`);
    
    return {
      success: true,
      message: 'Database optimization suite initialized successfully',
      features,
      performance: {
        healthy: health.healthy,
        latency: health.latency,
        indexUsage: health.performance.indexUsage,
        cacheEnabled: health.performance.cacheEnabled,
        currentQps: metrics.currentQps,
        cacheHitRate: metrics.cacheHitRate,
      },
    };
    
  } catch (error) {
    console.error('❌ Failed to initialize database optimization suite:', error);
    return {
      success: false,
      message: `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
      features: [],
      performance: null,
    };
  }
}

//runs comprehensive database health check
export async function runHealthCheck(): Promise<{
  status: 'healthy' | 'warning' | 'critical';
  summary: string;
  details: any;
  recommendations: string[];
}> {
  try {
    const [healthReport, realTimeMetrics, errorStats] = await Promise.all([
      maintenanceManager.generateHealthReport(),
      databaseAnalytics.getRealTimeMetrics(),
      errorHandler.getErrorStatistics(24),
    ]);
    
    const recommendations: string[] = [];
    
    //analyze health status
    if (healthReport.metrics.avgQueryTime > 100) {
      recommendations.push('Consider optimizing slow queries or adding indexes');
    }
    
    if (healthReport.metrics.cacheHitRate < 70) {
      recommendations.push('Review cache configuration and increase TTL for stable data');
    }
    
    if (errorStats.totalErrors > 10) {
      recommendations.push('Investigate recent database errors and improve error handling');
    }
    
    if (healthReport.metrics.size > 500) {
      recommendations.push('Consider running database maintenance and cleanup procedures');
    }
    
    return {
      status: healthReport.overallHealth,
      summary: `Database is ${healthReport.overallHealth}. ${healthReport.issues.length} issues detected.`,
      details: {
        health: healthReport,
        realTime: realTimeMetrics,
        errors: errorStats,
      },
      recommendations: recommendations.length > 0 ? recommendations : ['Database is performing optimally'],
    };
    
  } catch (error) {
    return {
      status: 'critical',
      summary: 'Health check failed',
      details: { error: error instanceof Error ? error.message : String(error) },
      recommendations: ['Check database connectivity and permissions'],
    };
  }
}

//optimization status check
export async function getOptimizationStatus(): Promise<{
  enabled: boolean;
  features: Record<string, boolean>;
  performance: any;
  lastMaintenance: string;
}> {
  try {
    const [health, metrics, cacheStats] = await Promise.all([
      enhancedHealthCheck(),
      databaseAnalytics.getRealTimeMetrics(),
      CacheManager.getStats(),
    ]);
    
    const features = {
      performanceMonitoring: health.healthy,
      queryOptimization: health.performance.indexUsage,
      caching: health.performance.cacheEnabled,
      searchOptimization: true, //FTS5 always available
      errorRecovery: true, //always enabled
      maintenance: true, //always available
      analytics: health.healthy,
      circuitBreaker: true, //always enabled
    };
    
    return {
      enabled: Object.values(features).every(Boolean),
      features,
      performance: {
        queryTime: health.performance.queryTime,
        cacheHitRate: metrics.cacheHitRate,
        qps: metrics.currentQps,
        errorRate: metrics.errorRate,
        cacheSize: cacheStats.size,
      },
      lastMaintenance: new Date().toISOString(), //placeholder
    };
    
  } catch (error) {
    return {
      enabled: false,
      features: {},
      performance: null,
      lastMaintenance: 'unknown',
    };
  }
}