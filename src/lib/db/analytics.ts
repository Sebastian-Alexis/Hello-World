// =============================================================================
// DATABASE ANALYTICS & PERFORMANCE DASHBOARD - Plan 7 Implementation
// Comprehensive analytics and monitoring dashboard utilities
// =============================================================================

import { executeOptimizedQuery } from './performance';
import { maintenanceManager } from './maintenance';
import { errorHandler } from './error-handling';

//analytics dashboard data interfaces
export interface PerformanceDashboard {
  overview: {
    totalQueries: number;
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
    errorRate: number;
    uptime: number;
  };
  queryPerformance: {
    slowestQueries: SlowQueryInfo[];
    queryTypeBreakdown: QueryTypeStats[];
    performanceTrends: PerformanceTrend[];
  };
  cacheAnalytics: {
    hitRate: number;
    missRate: number;
    topCachedQueries: CacheQueryInfo[];
    cacheTypeBreakdown: CacheTypeStats[];
  };
  tableAnalytics: {
    mostQueriedTables: TableQueryStats[];
    tableGrowthRates: TableGrowthInfo[];
    indexUsageStats: IndexUsageInfo[];
  };
  errorAnalytics: {
    errorsByCategory: Record<string, number>;
    recentErrors: ErrorSummary[];
    recoveryStats: RecoveryStats;
  };
  systemHealth: {
    databaseSize: number;
    memoryUsage: number;
    connectionCount: number;
    diskSpace: number;
    lastMaintenance: string;
  };
}

//individual data interfaces
export interface SlowQueryInfo {
  queryHash: string;
  queryType: string;
  tableName?: string;
  avgExecutionTime: number;
  maxExecutionTime: number;
  executionCount: number;
  lastExecuted: string;
  sampleQuery?: string;
}

export interface QueryTypeStats {
  queryType: string;
  count: number;
  avgTime: number;
  totalTime: number;
  percentage: number;
}

export interface PerformanceTrend {
  timestamp: string;
  avgQueryTime: number;
  queryCount: number;
  errorCount: number;
  cacheHitRate: number;
}

export interface CacheQueryInfo {
  cacheKey: string;
  hitCount: number;
  missCount: number;
  hitRate: number;
  avgExecutionTime: number;
  lastHit: string;
}

export interface CacheTypeStats {
  cacheType: string;
  hitCount: number;
  missCount: number;
  hitRate: number;
  avgResponseTime: number;
}

export interface TableQueryStats {
  tableName: string;
  queryCount: number;
  avgExecutionTime: number;
  readQueries: number;
  writeQueries: number;
  lastAccessed: string;
}

export interface TableGrowthInfo {
  tableName: string;
  currentSize: number;
  growthRate: number; //records per day
  estimatedSizeIn30Days: number;
}

export interface IndexUsageInfo {
  indexName: string;
  tableName: string;
  usageCount: number;
  lastUsed: string;
  isEffective: boolean;
}

export interface ErrorSummary {
  errorId: string;
  category: string;
  severity: string;
  message: string;
  count: number;
  firstOccurrence: string;
  lastOccurrence: string;
}

export interface RecoveryStats {
  totalErrors: number;
  recoveredErrors: number;
  recoveryRate: number;
  avgRecoveryTime: number;
}

//real-time metrics interface
export interface RealTimeMetrics {
  currentQps: number; //queries per second
  activeConnections: number;
  queuedQueries: number;
  memoryUsage: number;
  cpuUsage: number;
  cacheHitRate: number;
  errorRate: number;
  lastUpdated: string;
}

export class DatabaseAnalytics {
  // =============================================================================
  // PERFORMANCE DASHBOARD
  // =============================================================================

  //generates comprehensive performance dashboard
  async generatePerformanceDashboard(timeRange: number = 24): Promise<PerformanceDashboard> {
    const hoursAgo = timeRange;
    
    try {
      const [
        overview,
        queryPerformance,
        cacheAnalytics,
        tableAnalytics,
        errorAnalytics,
        systemHealth
      ] = await Promise.all([
        this.getOverviewMetrics(hoursAgo),
        this.getQueryPerformanceMetrics(hoursAgo),
        this.getCacheAnalytics(hoursAgo),
        this.getTableAnalytics(hoursAgo),
        this.getErrorAnalytics(hoursAgo),
        this.getSystemHealthMetrics(),
      ]);

      return {
        overview,
        queryPerformance,
        cacheAnalytics,
        tableAnalytics,
        errorAnalytics,
        systemHealth,
      };
    } catch (error) {
      console.error('Failed to generate performance dashboard:', error);
      throw error;
    }
  }

  //gets overview metrics
  private async getOverviewMetrics(hoursAgo: number) {
    const queries = [
      //total queries
      `SELECT COUNT(*) as total FROM query_performance_log WHERE created_at > datetime('now', '-${hoursAgo} hours')`,
      //average query time
      `SELECT AVG(execution_time_ms) as avg_time FROM query_performance_log WHERE created_at > datetime('now', '-${hoursAgo} hours')`,
      //slow queries
      `SELECT COUNT(*) as slow FROM query_performance_log WHERE execution_time_ms > 100 AND created_at > datetime('now', '-${hoursAgo} hours')`,
      //cache hit rate
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hits
       FROM cache_performance_log WHERE created_at > datetime('now', '-${hoursAgo} hours')`,
      //error rate
      `SELECT COUNT(*) as errors FROM analytics_events WHERE event_type = 'database_error' AND created_at > datetime('now', '-${hoursAgo} hours')`,
    ];

    const results = await Promise.all(
      queries.map(query => executeOptimizedQuery<any>(query, [], { useCache: true, cacheTimeout: 60000 }))
    );

    const totalQueries = results[0].rows[0]?.total || 0;
    const avgQueryTime = results[1].rows[0]?.avg_time || 0;
    const slowQueries = results[2].rows[0]?.slow || 0;
    const cacheStats = results[3].rows[0];
    const errors = results[4].rows[0]?.errors || 0;

    const cacheHitRate = cacheStats?.total > 0 
      ? (Number(cacheStats.hits) / Number(cacheStats.total)) * 100 
      : 0;
    
    const errorRate = totalQueries > 0 ? (errors / totalQueries) * 100 : 0;

    return {
      totalQueries,
      avgQueryTime: Math.round(avgQueryTime * 100) / 100,
      slowQueries,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      errorRate: Math.round(errorRate * 100) / 100,
      uptime: 99.9, //placeholder - implement actual uptime tracking
    };
  }

  //gets query performance metrics
  private async getQueryPerformanceMetrics(hoursAgo: number) {
    //slowest queries
    const slowestQueriesResult = await executeOptimizedQuery<SlowQueryInfo>(`
      SELECT 
        query_hash as queryHash,
        query_type as queryType,
        table_name as tableName,
        AVG(execution_time_ms) as avgExecutionTime,
        MAX(execution_time_ms) as maxExecutionTime,
        COUNT(*) as executionCount,
        MAX(created_at) as lastExecuted
      FROM query_performance_log 
      WHERE created_at > datetime('now', '-${hoursAgo} hours')
      GROUP BY query_hash, query_type, table_name
      ORDER BY avgExecutionTime DESC
      LIMIT 10
    `, [], { useCache: true, cacheTimeout: 300000 });

    //query type breakdown
    const queryTypeResult = await executeOptimizedQuery<QueryTypeStats>(`
      SELECT 
        query_type as queryType,
        COUNT(*) as count,
        AVG(execution_time_ms) as avgTime,
        SUM(execution_time_ms) as totalTime,
        ROUND((COUNT(*) * 100.0) / (SELECT COUNT(*) FROM query_performance_log WHERE created_at > datetime('now', '-${hoursAgo} hours')), 2) as percentage
      FROM query_performance_log 
      WHERE created_at > datetime('now', '-${hoursAgo} hours')
      GROUP BY query_type
      ORDER BY count DESC
    `, [], { useCache: true, cacheTimeout: 300000 });

    //performance trends (hourly)
    const trendsResult = await executeOptimizedQuery<PerformanceTrend>(`
      SELECT 
        strftime('%Y-%m-%d %H:00:00', created_at) as timestamp,
        AVG(execution_time_ms) as avgQueryTime,
        COUNT(*) as queryCount,
        SUM(CASE WHEN execution_time_ms > 100 THEN 1 ELSE 0 END) as errorCount,
        0 as cacheHitRate
      FROM query_performance_log 
      WHERE created_at > datetime('now', '-${hoursAgo} hours')
      GROUP BY strftime('%Y-%m-%d %H', created_at)
      ORDER BY timestamp DESC
      LIMIT 24
    `, [], { useCache: true, cacheTimeout: 300000 });

    return {
      slowestQueries: slowestQueriesResult.rows,
      queryTypeBreakdown: queryTypeResult.rows,
      performanceTrends: trendsResult.rows,
    };
  }

  //gets cache analytics
  private async getCacheAnalytics(hoursAgo: number) {
    //overall cache stats
    const overallStatsResult = await executeOptimizedQuery<{ total: number; hits: number }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hits
      FROM cache_performance_log 
      WHERE created_at > datetime('now', '-${hoursAgo} hours')
    `, [], { useCache: true, cacheTimeout: 300000 });

    const overallStats = overallStatsResult.rows[0];
    const hitRate = overallStats?.total > 0 
      ? (Number(overallStats.hits) / Number(overallStats.total)) * 100 
      : 0;
    const missRate = 100 - hitRate;

    //top cached queries
    const topCachedResult = await executeOptimizedQuery<CacheQueryInfo>(`
      SELECT 
        cache_key as cacheKey,
        SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hitCount,
        SUM(CASE WHEN hit_miss = 'miss' THEN 1 ELSE 0 END) as missCount,
        ROUND((SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2) as hitRate,
        AVG(execution_time_ms) as avgExecutionTime,
        MAX(created_at) as lastHit
      FROM cache_performance_log 
      WHERE created_at > datetime('now', '-${hoursAgo} hours')
      GROUP BY cache_key
      HAVING hitCount > 0
      ORDER BY hitCount DESC
      LIMIT 10
    `, [], { useCache: true, cacheTimeout: 300000 });

    //cache type breakdown
    const cacheTypeResult = await executeOptimizedQuery<CacheTypeStats>(`
      SELECT 
        cache_type as cacheType,
        SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hitCount,
        SUM(CASE WHEN hit_miss = 'miss' THEN 1 ELSE 0 END) as missCount,
        ROUND((SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 2) as hitRate,
        AVG(execution_time_ms) as avgResponseTime
      FROM cache_performance_log 
      WHERE created_at > datetime('now', '-${hoursAgo} hours')
      GROUP BY cache_type
      ORDER BY hitCount DESC
    `, [], { useCache: true, cacheTimeout: 300000 });

    return {
      hitRate: Math.round(hitRate * 100) / 100,
      missRate: Math.round(missRate * 100) / 100,
      topCachedQueries: topCachedResult.rows,
      cacheTypeBreakdown: cacheTypeResult.rows,
    };
  }

  //gets table analytics
  private async getTableAnalytics(hoursAgo: number) {
    //most queried tables
    const mostQueriedResult = await executeOptimizedQuery<TableQueryStats>(`
      SELECT 
        table_name as tableName,
        COUNT(*) as queryCount,
        AVG(execution_time_ms) as avgExecutionTime,
        SUM(CASE WHEN query_type = 'SELECT' THEN 1 ELSE 0 END) as readQueries,
        SUM(CASE WHEN query_type IN ('INSERT', 'UPDATE', 'DELETE') THEN 1 ELSE 0 END) as writeQueries,
        MAX(created_at) as lastAccessed
      FROM query_performance_log 
      WHERE created_at > datetime('now', '-${hoursAgo} hours')
        AND table_name IS NOT NULL
      GROUP BY table_name
      ORDER BY queryCount DESC
      LIMIT 10
    `, [], { useCache: true, cacheTimeout: 300000 });

    //table growth rates (placeholder - would need historical data)
    const tableGrowthResult = await executeOptimizedQuery<TableGrowthInfo>(`
      SELECT 
        'blog_posts' as tableName,
        (SELECT COUNT(*) FROM blog_posts) as currentSize,
        1.2 as growthRate,
        (SELECT COUNT(*) FROM blog_posts) * 1.36 as estimatedSizeIn30Days
      UNION ALL
      SELECT 
        'portfolio_projects' as tableName,
        (SELECT COUNT(*) FROM portfolio_projects) as currentSize,
        0.5 as growthRate,
        (SELECT COUNT(*) FROM portfolio_projects) * 1.15 as estimatedSizeIn30Days
      UNION ALL
      SELECT 
        'flights' as tableName,
        (SELECT COUNT(*) FROM flights) as currentSize,
        2.0 as growthRate,
        (SELECT COUNT(*) FROM flights) * 1.6 as estimatedSizeIn30Days
    `, [], { useCache: true, cacheTimeout: 3600000 }); //1 hour cache

    //index usage (placeholder - complex to implement accurately)
    const indexUsageResult = await executeOptimizedQuery<IndexUsageInfo>(`
      SELECT 
        name as indexName,
        tbl_name as tableName,
        100 as usageCount,
        datetime('now') as lastUsed,
        1 as isEffective
      FROM sqlite_master 
      WHERE type = 'index' 
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
      LIMIT 20
    `, [], { useCache: true, cacheTimeout: 3600000 });

    return {
      mostQueriedTables: mostQueriedResult.rows,
      tableGrowthRates: tableGrowthResult.rows,
      indexUsageStats: indexUsageResult.rows.map(row => ({
        ...row,
        isEffective: Boolean(row.isEffective),
      })),
    };
  }

  //gets error analytics
  private async getErrorAnalytics(hoursAgo: number) {
    const errorStats = errorHandler.getErrorStatistics(hoursAgo);
    
    //recent error summary
    const recentErrorsResult = await executeOptimizedQuery<ErrorSummary>(`
      SELECT 
        json_extract(metadata, '$.error_id') as errorId,
        json_extract(metadata, '$.category') as category,
        json_extract(metadata, '$.severity') as severity,
        json_extract(metadata, '$.message') as message,
        COUNT(*) as count,
        MIN(created_at) as firstOccurrence,
        MAX(created_at) as lastOccurrence
      FROM analytics_events 
      WHERE event_type = 'database_error' 
        AND created_at > datetime('now', '-${hoursAgo} hours')
      GROUP BY json_extract(metadata, '$.error_id')
      ORDER BY count DESC, lastOccurrence DESC
      LIMIT 10
    `, [], { useCache: true, cacheTimeout: 300000 });

    const recoveryStats: RecoveryStats = {
      totalErrors: errorStats.totalErrors,
      recoveredErrors: Math.floor(errorStats.totalErrors * (errorStats.recoveryRate / 100)),
      recoveryRate: errorStats.recoveryRate,
      avgRecoveryTime: errorStats.avgRecoveryTime,
    };

    return {
      errorsByCategory: errorStats.errorsByCategory,
      recentErrors: recentErrorsResult.rows,
      recoveryStats,
    };
  }

  //gets system health metrics
  private async getSystemHealthMetrics() {
    try {
      const healthReport = await maintenanceManager.generateHealthReport();
      
      return {
        databaseSize: healthReport.metrics.size,
        memoryUsage: 0, //placeholder - implement actual memory monitoring
        connectionCount: healthReport.metrics.connectionCount,
        diskSpace: 0, //placeholder - implement actual disk monitoring
        lastMaintenance: new Date().toISOString(), //placeholder
      };
    } catch (error) {
      return {
        databaseSize: 0,
        memoryUsage: 0,
        connectionCount: 0,
        diskSpace: 0,
        lastMaintenance: 'unknown',
      };
    }
  }

  // =============================================================================
  // REAL-TIME METRICS
  // =============================================================================

  //gets real-time performance metrics
  async getRealTimeMetrics(): Promise<RealTimeMetrics> {
    try {
      const [
        recentQueries,
        cacheStats,
        errorCount
      ] = await Promise.all([
        executeOptimizedQuery<{ count: number }>(`
          SELECT COUNT(*) as count 
          FROM query_performance_log 
          WHERE created_at > datetime('now', '-1 minute')
        `, [], { useCache: false }),
        
        executeOptimizedQuery<{ total: number; hits: number }>(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hits
          FROM cache_performance_log 
          WHERE created_at > datetime('now', '-5 minutes')
        `, [], { useCache: false }),
        
        executeOptimizedQuery<{ count: number }>(`
          SELECT COUNT(*) as count 
          FROM analytics_events 
          WHERE event_type = 'database_error' 
            AND created_at > datetime('now', '-1 minute')
        `, [], { useCache: false }),
      ]);

      const queriesPerMinute = recentQueries.rows[0]?.count || 0;
      const cacheData = cacheStats.rows[0];
      const errors = errorCount.rows[0]?.count || 0;

      const cacheHitRate = cacheData?.total > 0 
        ? (Number(cacheData.hits) / Number(cacheData.total)) * 100 
        : 0;
      
      const errorRate = queriesPerMinute > 0 ? (errors / queriesPerMinute) * 100 : 0;

      return {
        currentQps: Math.round(queriesPerMinute / 60 * 100) / 100,
        activeConnections: 1, //SQLite single connection
        queuedQueries: 0, //SQLite doesn't queue
        memoryUsage: 0, //placeholder
        cpuUsage: 0, //placeholder
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
        errorRate: Math.round(errorRate * 100) / 100,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Failed to get real-time metrics:', error);
      return {
        currentQps: 0,
        activeConnections: 0,
        queuedQueries: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        cacheHitRate: 0,
        errorRate: 0,
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  // =============================================================================
  // REPORTING & EXPORTS
  // =============================================================================

  //generates performance report for specific time period
  async generatePerformanceReport(
    startDate: string,
    endDate: string,
    format: 'json' | 'csv' = 'json'
  ): Promise<any> {
    const query = `
      SELECT 
        DATE(created_at) as date,
        query_type,
        table_name,
        COUNT(*) as query_count,
        AVG(execution_time_ms) as avg_execution_time,
        MAX(execution_time_ms) as max_execution_time,
        MIN(execution_time_ms) as min_execution_time,
        SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits
      FROM query_performance_log
      WHERE created_at BETWEEN ? AND ?
      GROUP BY DATE(created_at), query_type, table_name
      ORDER BY date DESC, avg_execution_time DESC
    `;

    const result = await executeOptimizedQuery(query, [startDate, endDate], {
      useCache: true,
      cacheTimeout: 1800000, //30 minutes
    });

    if (format === 'csv') {
      return this.convertToCSV(result.rows);
    }

    return {
      reportPeriod: { startDate, endDate },
      generatedAt: new Date().toISOString(),
      data: result.rows,
      summary: {
        totalQueries: result.rows.reduce((sum, row) => sum + (row.query_count || 0), 0),
        avgResponseTime: result.rows.length > 0 
          ? result.rows.reduce((sum, row) => sum + (row.avg_execution_time || 0), 0) / result.rows.length 
          : 0,
      },
    };
  }

  //converts data to CSV format
  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value;
        }).join(',')
      )
    ];

    return csvRows.join('\n');
  }

  // =============================================================================
  // ALERTING & NOTIFICATIONS
  // =============================================================================

  //checks for performance alerts
  async checkPerformanceAlerts(): Promise<{
    alerts: PerformanceAlert[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const alerts: PerformanceAlert[] = [];
    
    //check average query time
    const avgTimeResult = await executeOptimizedQuery<{ avg_time: number }>(`
      SELECT AVG(execution_time_ms) as avg_time 
      FROM query_performance_log 
      WHERE created_at > datetime('now', '-1 hour')
    `, [], { useCache: true, cacheTimeout: 60000 });

    const avgTime = avgTimeResult.rows[0]?.avg_time || 0;
    if (avgTime > 200) {
      alerts.push({
        type: 'slow_queries',
        severity: avgTime > 500 ? 'critical' : 'high',
        message: `Average query time is ${Math.round(avgTime)}ms`,
        threshold: 200,
        currentValue: avgTime,
        timestamp: new Date().toISOString(),
      });
    }

    //check cache hit rate
    const cacheResult = await executeOptimizedQuery<{ total: number; hits: number }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hits
      FROM cache_performance_log 
      WHERE created_at > datetime('now', '-1 hour')
    `, [], { useCache: true, cacheTimeout: 60000 });

    const cacheStats = cacheResult.rows[0];
    const hitRate = cacheStats?.total > 0 
      ? (Number(cacheStats.hits) / Number(cacheStats.total)) * 100 
      : 0;

    if (hitRate < 70) {
      alerts.push({
        type: 'low_cache_hit_rate',
        severity: hitRate < 50 ? 'high' : 'medium',
        message: `Cache hit rate is ${Math.round(hitRate)}%`,
        threshold: 70,
        currentValue: hitRate,
        timestamp: new Date().toISOString(),
      });
    }

    //determine overall severity
    const severities = alerts.map(alert => alert.severity);
    let overallSeverity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    if (severities.includes('critical')) overallSeverity = 'critical';
    else if (severities.includes('high')) overallSeverity = 'high';
    else if (severities.includes('medium')) overallSeverity = 'medium';

    return { alerts, severity: overallSeverity };
  }
}

//performance alert interface
export interface PerformanceAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: string;
}

//singleton instance
export const databaseAnalytics = new DatabaseAnalytics();