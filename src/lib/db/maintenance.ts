// =============================================================================
// DATABASE MAINTENANCE & CLEANUP PROCEDURES - Plan 7 Implementation
// Automated database optimization for peak performance
// =============================================================================

import { getDbClient } from './connection';
import { executeOptimizedQuery, DatabaseMaintenance } from './performance';
import { searchOptimization } from './search-optimization';

//maintenance configuration
export const MAINTENANCE_CONFIG = {
  //cleanup schedules (in days)
  PERFORMANCE_LOG_RETENTION: 7,
  ANALYTICS_RETENTION: 90,
  SESSION_CLEANUP: 30,
  TEMP_DATA_CLEANUP: 1,
  
  //optimization intervals
  DAILY_OPTIMIZATION: true,
  WEEKLY_DEEP_CLEAN: true,
  MONTHLY_REBUILD: true,
  
  //performance thresholds
  MAX_LOG_ENTRIES: 100000,
  MAX_ANALYTICS_ENTRIES: 1000000,
  VACUUM_THRESHOLD_MB: 100,
  
  //monitoring settings
  ALERT_SLOW_QUERIES: true,
  ALERT_CACHE_MISS_RATE: 80, //alert if cache miss rate > 80%
  ALERT_DB_SIZE_MB: 500,
} as const;

//maintenance result interface
export interface MaintenanceResult {
  taskName: string;
  success: boolean;
  duration: number;
  recordsAffected?: number;
  sizeBefore?: number;
  sizeAfter?: number;
  error?: string;
  details?: any;
}

//database health report interface
export interface DatabaseHealthReport {
  timestamp: string;
  overallHealth: 'healthy' | 'warning' | 'critical';
  issues: string[];
  recommendations: string[];
  metrics: {
    size: number;
    tableCount: number;
    indexCount: number;
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
    connectionCount: number;
  };
  maintenanceResults: MaintenanceResult[];
}

export class DatabaseMaintenanceManager {
  // =============================================================================
  // DAILY MAINTENANCE TASKS
  // =============================================================================

  //runs daily maintenance tasks
  async runDailyMaintenance(): Promise<MaintenanceResult[]> {
    console.log('🔧 Starting daily database maintenance...');
    const results: MaintenanceResult[] = [];

    //cleanup expired sessions
    results.push(await this.cleanupExpiredSessions());
    
    //cleanup old performance logs
    results.push(await this.cleanupPerformanceLogs());
    
    //cleanup temporary data
    results.push(await this.cleanupTemporaryData());
    
    //optimize query planner statistics
    results.push(await this.updateQueryPlannerStats());
    
    //vacuum if needed
    results.push(await this.conditionalVacuum());
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Daily maintenance completed: ${successCount}/${results.length} tasks successful`);
    
    return results;
  }

  //cleans up expired user sessions
  async cleanupExpiredSessions(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const query = `DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP`;
      const result = await executeOptimizedQuery(query, [], {
        useCache: false,
        skipLogging: true,
      });

      return {
        taskName: 'cleanup_expired_sessions',
        success: true,
        duration: Date.now() - startTime,
        recordsAffected: result.rowsAffected,
      };
    } catch (error) {
      return {
        taskName: 'cleanup_expired_sessions',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //cleans up old performance logs
  async cleanupPerformanceLogs(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const queries = [
        `DELETE FROM query_performance_log WHERE created_at < datetime('now', '-${MAINTENANCE_CONFIG.PERFORMANCE_LOG_RETENTION} days')`,
        `DELETE FROM cache_performance_log WHERE created_at < datetime('now', '-${MAINTENANCE_CONFIG.PERFORMANCE_LOG_RETENTION} days')`,
        `DELETE FROM connection_pool_metrics WHERE created_at < datetime('now', '-${MAINTENANCE_CONFIG.PERFORMANCE_LOG_RETENTION} days')`,
      ];

      let totalDeleted = 0;
      for (const query of queries) {
        const result = await executeOptimizedQuery(query, [], {
          useCache: false,
          skipLogging: true,
        });
        totalDeleted += result.rowsAffected;
      }

      return {
        taskName: 'cleanup_performance_logs',
        success: true,
        duration: Date.now() - startTime,
        recordsAffected: totalDeleted,
      };
    } catch (error) {
      return {
        taskName: 'cleanup_performance_logs',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //cleans up temporary data and orphaned records
  async cleanupTemporaryData(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const queries = [
        //cleanup orphaned blog post categories
        `DELETE FROM blog_post_categories WHERE post_id NOT IN (SELECT id FROM blog_posts)`,
        //cleanup orphaned blog post tags
        `DELETE FROM blog_post_tags WHERE post_id NOT IN (SELECT id FROM blog_posts)`,
        //cleanup orphaned project categories
        `DELETE FROM project_project_categories WHERE project_id NOT IN (SELECT id FROM portfolio_projects)`,
        //cleanup orphaned project technologies
        `DELETE FROM project_project_technologies WHERE project_id NOT IN (SELECT id FROM portfolio_projects)`,
        //cleanup orphaned project skills
        `DELETE FROM project_skills WHERE project_id NOT IN (SELECT id FROM portfolio_projects)`,
        //cleanup orphaned case study sections
        `DELETE FROM case_study_sections WHERE project_id NOT IN (SELECT id FROM portfolio_projects)`,
        //cleanup orphaned testimonials
        `DELETE FROM testimonials WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM portfolio_projects)`,
        //cleanup old analytics events
        `DELETE FROM analytics_events WHERE created_at < datetime('now', '-${MAINTENANCE_CONFIG.ANALYTICS_RETENTION} days')`,
      ];

      let totalDeleted = 0;
      for (const query of queries) {
        const result = await executeOptimizedQuery(query, [], {
          useCache: false,
          skipLogging: true,
        });
        totalDeleted += result.rowsAffected;
      }

      return {
        taskName: 'cleanup_temporary_data',
        success: true,
        duration: Date.now() - startTime,
        recordsAffected: totalDeleted,
      };
    } catch (error) {
      return {
        taskName: 'cleanup_temporary_data',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //updates query planner statistics
  async updateQueryPlannerStats(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const client = getDbClient();
      await client.execute('ANALYZE');
      await client.execute('PRAGMA optimize');

      return {
        taskName: 'update_query_planner_stats',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskName: 'update_query_planner_stats',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //runs vacuum if database size exceeds threshold
  async conditionalVacuum(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const client = getDbClient();
      
      //check database size
      const sizeResult = await client.execute('PRAGMA page_count');
      const pageSize = await client.execute('PRAGMA page_size');
      
      const sizeMB = (Number(sizeResult.rows[0]?.page_count) * Number(pageSize.rows[0]?.page_size)) / (1024 * 1024);
      
      if (sizeMB > MAINTENANCE_CONFIG.VACUUM_THRESHOLD_MB) {
        await client.execute('VACUUM');
        
        //get new size
        const newSizeResult = await client.execute('PRAGMA page_count');
        const newSizeMB = (Number(newSizeResult.rows[0]?.page_count) * Number(pageSize.rows[0]?.page_size)) / (1024 * 1024);
        
        return {
          taskName: 'conditional_vacuum',
          success: true,
          duration: Date.now() - startTime,
          sizeBefore: Math.round(sizeMB * 100) / 100,
          sizeAfter: Math.round(newSizeMB * 100) / 100,
        };
      } else {
        return {
          taskName: 'conditional_vacuum',
          success: true,
          duration: Date.now() - startTime,
          details: 'Vacuum skipped - size below threshold',
        };
      }
    } catch (error) {
      return {
        taskName: 'conditional_vacuum',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // =============================================================================
  // WEEKLY MAINTENANCE TASKS
  // =============================================================================

  //runs weekly deep maintenance
  async runWeeklyMaintenance(): Promise<MaintenanceResult[]> {
    console.log('🔧 Starting weekly database maintenance...');
    const results: MaintenanceResult[] = [];

    //run daily tasks first
    results.push(...await this.runDailyMaintenance());
    
    //rebuild search indexes
    results.push(await this.rebuildSearchIndexes());
    
    //optimize indexes
    results.push(await this.optimizeIndexes());
    
    //update table statistics
    results.push(await this.updateTableStatistics());
    
    //check database integrity
    results.push(await this.checkDatabaseIntegrity());
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Weekly maintenance completed: ${successCount}/${results.length} tasks successful`);
    
    return results;
  }

  //rebuilds search indexes
  async rebuildSearchIndexes(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      await searchOptimization.rebuildSearchIndexes();
      await searchOptimization.optimizeSearchIndexes();

      return {
        taskName: 'rebuild_search_indexes',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskName: 'rebuild_search_indexes',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //optimizes database indexes
  async optimizeIndexes(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const client = getDbClient();
      
      //reindex all indexes
      await client.execute('REINDEX');
      
      //update index statistics
      await client.execute('ANALYZE');

      return {
        taskName: 'optimize_indexes',
        success: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        taskName: 'optimize_indexes',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //updates comprehensive table statistics
  async updateTableStatistics(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const client = getDbClient();
      
      //get list of all tables
      const tablesResult = await client.execute(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `);
      
      const tables = tablesResult.rows.map(row => row.name as string);
      
      //analyze each table individually for better statistics
      for (const table of tables) {
        await client.execute(`ANALYZE ${table}`);
      }

      return {
        taskName: 'update_table_statistics',
        success: true,
        duration: Date.now() - startTime,
        details: { tablesAnalyzed: tables.length },
      };
    } catch (error) {
      return {
        taskName: 'update_table_statistics',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //checks database integrity
  async checkDatabaseIntegrity(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const client = getDbClient();
      
      //run integrity check
      const integrityResult = await client.execute('PRAGMA integrity_check');
      const isHealthy = integrityResult.rows[0]?.integrity_check === 'ok';
      
      //run foreign key check
      const fkResult = await client.execute('PRAGMA foreign_key_check');
      const hasFKIssues = fkResult.rows.length > 0;

      return {
        taskName: 'check_database_integrity',
        success: isHealthy && !hasFKIssues,
        duration: Date.now() - startTime,
        details: {
          integrityCheck: integrityResult.rows[0]?.integrity_check,
          foreignKeyIssues: fkResult.rows.length,
        },
      };
    } catch (error) {
      return {
        taskName: 'check_database_integrity',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // =============================================================================
  // MONTHLY MAINTENANCE TASKS
  // =============================================================================

  //runs comprehensive monthly maintenance
  async runMonthlyMaintenance(): Promise<MaintenanceResult[]> {
    console.log('🔧 Starting monthly database maintenance...');
    const results: MaintenanceResult[] = [];

    //run weekly tasks first
    results.push(...await this.runWeeklyMaintenance());
    
    //full vacuum
    results.push(await this.fullVacuum());
    
    //comprehensive cleanup
    results.push(await this.comprehensiveCleanup());
    
    //archive old data
    results.push(await this.archiveOldData());
    
    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Monthly maintenance completed: ${successCount}/${results.length} tasks successful`);
    
    return results;
  }

  //runs full vacuum
  async fullVacuum(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      const client = getDbClient();
      
      //get size before
      const beforeResult = await client.execute('PRAGMA page_count');
      const pageSize = await client.execute('PRAGMA page_size');
      const sizeBefore = (Number(beforeResult.rows[0]?.page_count) * Number(pageSize.rows[0]?.page_size)) / (1024 * 1024);
      
      //run full vacuum
      await client.execute('VACUUM');
      
      //get size after
      const afterResult = await client.execute('PRAGMA page_count');
      const sizeAfter = (Number(afterResult.rows[0]?.page_count) * Number(pageSize.rows[0]?.page_size)) / (1024 * 1024);

      return {
        taskName: 'full_vacuum',
        success: true,
        duration: Date.now() - startTime,
        sizeBefore: Math.round(sizeBefore * 100) / 100,
        sizeAfter: Math.round(sizeAfter * 100) / 100,
      };
    } catch (error) {
      return {
        taskName: 'full_vacuum',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //comprehensive data cleanup
  async comprehensiveCleanup(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      let totalDeleted = 0;
      
      //cleanup categories/tags with no posts
      const categoryCleanup = await executeOptimizedQuery(`
        DELETE FROM blog_categories 
        WHERE id NOT IN (
          SELECT DISTINCT category_id FROM blog_post_categories 
          WHERE category_id IS NOT NULL
        ) AND id > 4
      `, [], { useCache: false, skipLogging: true });
      totalDeleted += categoryCleanup.rowsAffected;
      
      const tagCleanup = await executeOptimizedQuery(`
        DELETE FROM blog_tags 
        WHERE id NOT IN (
          SELECT DISTINCT tag_id FROM blog_post_tags 
          WHERE tag_id IS NOT NULL
        )
      `, [], { useCache: false, skipLogging: true });
      totalDeleted += tagCleanup.rowsAffected;
      
      //cleanup unused media files (careful with this in production)
      const mediaCleanup = await executeOptimizedQuery(`
        UPDATE media_files SET is_public = FALSE 
        WHERE created_at < datetime('now', '-6 months')
        AND id NOT IN (
          SELECT DISTINCT CAST(substr(featured_image_url, -10) AS INTEGER) 
          FROM blog_posts 
          WHERE featured_image_url IS NOT NULL
          UNION
          SELECT DISTINCT CAST(substr(featured_image_url, -10) AS INTEGER) 
          FROM portfolio_projects 
          WHERE featured_image_url IS NOT NULL
        )
      `, [], { useCache: false, skipLogging: true });
      totalDeleted += mediaCleanup.rowsAffected;
      
      return {
        taskName: 'comprehensive_cleanup',
        success: true,
        duration: Date.now() - startTime,
        recordsAffected: totalDeleted,
      };
    } catch (error) {
      return {
        taskName: 'comprehensive_cleanup',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  //archives old data (placeholder for future implementation)
  async archiveOldData(): Promise<MaintenanceResult> {
    const startTime = Date.now();
    
    try {
      //placeholder for archiving logic
      //in production, you might move old data to separate archive tables
      
      return {
        taskName: 'archive_old_data',
        success: true,
        duration: Date.now() - startTime,
        details: 'Archiving not implemented yet',
      };
    } catch (error) {
      return {
        taskName: 'archive_old_data',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // =============================================================================
  // HEALTH MONITORING
  // =============================================================================

  //generates comprehensive database health report
  async generateHealthReport(): Promise<DatabaseHealthReport> {
    const timestamp = new Date().toISOString();
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    try {
      //get database metrics
      const client = getDbClient();
      
      const [
        sizeResult,
        tableCountResult,
        indexCountResult,
        performanceResult
      ] = await Promise.all([
        client.execute('PRAGMA page_count'),
        client.execute("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'"),
        client.execute("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index'"),
        this.getPerformanceMetrics(),
      ]);
      
      const pageSize = await client.execute('PRAGMA page_size');
      const sizeMB = (Number(sizeResult.rows[0]?.page_count) * Number(pageSize.rows[0]?.page_size)) / (1024 * 1024);
      
      const metrics = {
        size: Math.round(sizeMB * 100) / 100,
        tableCount: Number(tableCountResult.rows[0]?.count),
        indexCount: Number(indexCountResult.rows[0]?.count),
        avgQueryTime: performanceResult.avgQueryTime,
        slowQueries: performanceResult.slowQueries,
        cacheHitRate: performanceResult.cacheHitRate,
        connectionCount: 1, //SQLite single connection
      };
      
      //analyze health issues
      if (metrics.size > MAINTENANCE_CONFIG.ALERT_DB_SIZE_MB) {
        issues.push(`Database size (${metrics.size}MB) exceeds threshold (${MAINTENANCE_CONFIG.ALERT_DB_SIZE_MB}MB)`);
        recommendations.push('Consider running VACUUM and archiving old data');
      }
      
      if (metrics.avgQueryTime > 100) {
        issues.push(`Average query time (${metrics.avgQueryTime}ms) is high`);
        recommendations.push('Review and optimize slow queries, check index usage');
      }
      
      if (metrics.slowQueries > 10) {
        issues.push(`${metrics.slowQueries} slow queries detected in the last hour`);
        recommendations.push('Analyze slow query log and add missing indexes');
      }
      
      if (metrics.cacheHitRate < 70) {
        issues.push(`Cache hit rate (${metrics.cacheHitRate}%) is low`);
        recommendations.push('Review cache configuration and increase cache timeout for stable data');
      }
      
      //determine overall health
      let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (issues.length > 0) {
        overallHealth = issues.length > 2 ? 'critical' : 'warning';
      }
      
      return {
        timestamp,
        overallHealth,
        issues,
        recommendations,
        metrics,
        maintenanceResults: [], //populated by maintenance runs
      };
      
    } catch (error) {
      return {
        timestamp,
        overallHealth: 'critical',
        issues: [`Failed to generate health report: ${error}`],
        recommendations: ['Check database connectivity and permissions'],
        metrics: {
          size: 0,
          tableCount: 0,
          indexCount: 0,
          avgQueryTime: -1,
          slowQueries: -1,
          cacheHitRate: -1,
          connectionCount: 0,
        },
        maintenanceResults: [],
      };
    }
  }

  //gets performance metrics for health monitoring
  private async getPerformanceMetrics(): Promise<{
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
  }> {
    try {
      const [avgTimeResult, slowQueriesResult, cacheStatsResult] = await Promise.all([
        executeOptimizedQuery<{ avg_time: number }>(`
          SELECT AVG(execution_time_ms) as avg_time 
          FROM query_performance_log 
          WHERE created_at > datetime('now', '-1 hour')
        `, [], { useCache: true, skipLogging: true }),
        
        executeOptimizedQuery<{ count: number }>(`
          SELECT COUNT(*) as count 
          FROM query_performance_log 
          WHERE execution_time_ms > 100 
            AND created_at > datetime('now', '-1 hour')
        `, [], { useCache: true, skipLogging: true }),
        
        executeOptimizedQuery<{ total: number; hits: number }>(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hits
          FROM cache_performance_log 
          WHERE created_at > datetime('now', '-1 hour')
        `, [], { useCache: true, skipLogging: true }),
      ]);

      const avgTime = avgTimeResult.rows[0]?.avg_time || 0;
      const slowCount = slowQueriesResult.rows[0]?.count || 0;
      const cacheStats = cacheStatsResult.rows[0];
      const cacheHitRate = cacheStats?.total > 0 
        ? (Number(cacheStats.hits) / Number(cacheStats.total)) * 100 
        : 0;

      return {
        avgQueryTime: Math.round(avgTime * 100) / 100,
        slowQueries: slowCount,
        cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      };
    } catch (error) {
      console.warn('Could not retrieve performance metrics:', error);
      return {
        avgQueryTime: 0,
        slowQueries: 0,
        cacheHitRate: 0,
      };
    }
  }
}

//singleton instance
export const maintenanceManager = new DatabaseMaintenanceManager();

//maintenance scheduler (for use with cron jobs or similar)
export const MaintenanceScheduler = {
  //schedules daily maintenance
  scheduleDailyMaintenance: () => {
    //run at 2 AM daily
    return maintenanceManager.runDailyMaintenance();
  },
  
  //schedules weekly maintenance
  scheduleWeeklyMaintenance: () => {
    //run on Sunday at 3 AM
    return maintenanceManager.runWeeklyMaintenance();
  },
  
  //schedules monthly maintenance
  scheduleMonthlyMaintenance: () => {
    //run on first day of month at 4 AM
    return maintenanceManager.runMonthlyMaintenance();
  },
  
  //generates daily health report
  generateDailyHealthReport: () => {
    return maintenanceManager.generateHealthReport();
  },
};