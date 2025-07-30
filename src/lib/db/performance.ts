// =============================================================================
// DATABASE PERFORMANCE MONITORING & OPTIMIZATION
// Plan 7 implementation for ultra-fast edge database performance
// =============================================================================

import { getDbClient } from './connection';
import { createHash } from 'crypto';

//query performance monitoring interface
export interface QueryPerformanceMetrics {
  queryHash: string;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  tableName?: string;
  executionTimeMs: number;
  rowsExamined?: number;
  rowsReturned?: number;
  cacheHit: boolean;
  userId?: number;
  sessionId?: string;
  queryPlan?: string;
}

//cache performance interface
export interface CachePerformanceMetrics {
  cacheKey: string;
  cacheType: 'query' | 'page' | 'api';
  hitMiss: 'hit' | 'miss';
  executionTimeMs?: number;
  cacheSizeBytes?: number;
  ttlSeconds?: number;
}

//connection pool metrics interface
export interface ConnectionPoolMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  totalConnections: number;
  avgWaitTimeMs?: number;
  avgQueryTimeMs?: number;
}

//performance budget constants
export const PERFORMANCE_BUDGETS = {
  SIMPLE_QUERY_MS: 100,
  COMPLEX_QUERY_MS: 500,
  SEARCH_QUERY_MS: 300,
  WRITE_QUERY_MS: 200,
  BATCH_QUERY_MS: 1000,
} as const;

//in-memory cache for query results
class QueryCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  private readonly maxSize = 1000; //max cache entries
  private readonly defaultTtl = 5 * 60 * 1000; //5 minutes default TTL

  //gets cached result if valid
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  //sets cache entry with TTL
  set(key: string, data: any, ttlMs?: number): void {
    //evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs || this.defaultTtl,
    });
  }

  //clears cache entries matching pattern
  invalidate(pattern: string): number {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  //gets cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTtl: this.defaultTtl,
    };
  }

  //clears entire cache
  clear(): void {
    this.cache.clear();
  }
}

//singleton query cache instance
const queryCache = new QueryCache();

//generates cache key from query and parameters
function generateCacheKey(query: string, params?: unknown[]): string {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  const paramString = params ? JSON.stringify(params) : '';
  return createHash('md5').update(normalizedQuery + paramString).digest('hex');
}

//generates query hash for performance logging
function generateQueryHash(query: string): string {
  const normalizedQuery = query.replace(/\s+/g, ' ').trim();
  return createHash('md5').update(normalizedQuery).digest('hex');
}

//extracts table name from query
function extractTableName(query: string): string | undefined {
  const normalizedQuery = query.toUpperCase().trim();
  
  //match common patterns
  const patterns = [
    /FROM\s+(\w+)/,
    /UPDATE\s+(\w+)/,
    /INSERT\s+INTO\s+(\w+)/,
    /DELETE\s+FROM\s+(\w+)/,
  ];
  
  for (const pattern of patterns) {
    const match = normalizedQuery.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  
  return undefined;
}

//determines query type from SQL
function getQueryType(query: string): QueryPerformanceMetrics['queryType'] {
  const normalizedQuery = query.toUpperCase().trim();
  
  if (normalizedQuery.startsWith('SELECT')) return 'SELECT';
  if (normalizedQuery.startsWith('INSERT')) return 'INSERT';
  if (normalizedQuery.startsWith('UPDATE')) return 'UPDATE';
  if (normalizedQuery.startsWith('DELETE')) return 'DELETE';
  
  return 'SELECT'; //default fallback
}

//logs query performance metrics
async function logQueryPerformance(metrics: QueryPerformanceMetrics): Promise<void> {
  try {
    const client = getDbClient();
    await client.execute(`
      INSERT INTO query_performance_log (
        query_hash, query_type, table_name, execution_time_ms,
        rows_examined, rows_returned, cache_hit, user_id, session_id, query_plan
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      metrics.queryHash,
      metrics.queryType,
      metrics.tableName,
      metrics.executionTimeMs,
      metrics.rowsExamined,
      metrics.rowsReturned,
      metrics.cacheHit,
      metrics.userId,
      metrics.sessionId,
      metrics.queryPlan,
    ]);

    //warn if query exceeds performance budget
    const budget = getPerformanceBudget(metrics.queryType);
    if (metrics.executionTimeMs > budget) {
      console.warn(`🐌 Slow query detected: ${metrics.executionTimeMs}ms (budget: ${budget}ms)`, {
        queryHash: metrics.queryHash,
        tableName: metrics.tableName,
        queryType: metrics.queryType,
      });
    }
  } catch (error) {
    console.error('Failed to log query performance:', error);
  }
}

//logs cache performance metrics
async function logCachePerformance(metrics: CachePerformanceMetrics): Promise<void> {
  try {
    const client = getDbClient();
    await client.execute(`
      INSERT INTO cache_performance_log (
        cache_key, cache_type, hit_miss, execution_time_ms, cache_size_bytes, ttl_seconds
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      metrics.cacheKey,
      metrics.cacheType,
      metrics.hitMiss,
      metrics.executionTimeMs,
      metrics.cacheSizeBytes,
      metrics.ttlSeconds,
    ]);
  } catch (error) {
    console.error('Failed to log cache performance:', error);
  }
}

//gets performance budget for query type
function getPerformanceBudget(queryType: QueryPerformanceMetrics['queryType']): number {
  switch (queryType) {
    case 'SELECT': return PERFORMANCE_BUDGETS.SIMPLE_QUERY_MS;
    case 'INSERT': return PERFORMANCE_BUDGETS.WRITE_QUERY_MS;
    case 'UPDATE': return PERFORMANCE_BUDGETS.WRITE_QUERY_MS;
    case 'DELETE': return PERFORMANCE_BUDGETS.WRITE_QUERY_MS;
    default: return PERFORMANCE_BUDGETS.SIMPLE_QUERY_MS;
  }
}

//enhanced query execution with performance monitoring and caching
export async function executeOptimizedQuery<T = unknown>(
  query: string,
  params?: unknown[],
  options?: {
    useCache?: boolean;
    cacheTimeout?: number;
    userId?: number;
    sessionId?: string;
    skipLogging?: boolean;
  }
): Promise<{ rows: T[]; rowsAffected: number; insertId?: number; fromCache: boolean }> {
  const startTime = Date.now();
  const cacheKey = generateCacheKey(query, params);
  const queryHash = generateQueryHash(query);
  const queryType = getQueryType(query);
  const tableName = extractTableName(query);
  
  //check cache for SELECT queries
  if (options?.useCache !== false && queryType === 'SELECT') {
    const cachedResult = queryCache.get(cacheKey);
    if (cachedResult) {
      const executionTime = Date.now() - startTime;
      
      //log cache hit
      if (!options?.skipLogging) {
        await logCachePerformance({
          cacheKey,
          cacheType: 'query',
          hitMiss: 'hit',
          executionTimeMs: executionTime,
        });
        
        await logQueryPerformance({
          queryHash,
          queryType,
          tableName,
          executionTimeMs: executionTime,
          rowsReturned: cachedResult.rows?.length,
          cacheHit: true,
          userId: options?.userId,
          sessionId: options?.sessionId,
        });
      }
      
      return { ...cachedResult, fromCache: true };
    }
  }

  try {
    const client = getDbClient();
    
    //get query plan for complex queries in development
    let queryPlan: string | undefined;
    if (process.env.NODE_ENV === 'development' && queryType === 'SELECT') {
      try {
        const planResult = await client.execute(`EXPLAIN QUERY PLAN ${query}`, params);
        queryPlan = JSON.stringify(planResult.rows);
      } catch {
        //ignore plan errors
      }
    }
    
    //execute query
    const result = await client.execute(query, params);
    const executionTime = Date.now() - startTime;
    
    const queryResult = {
      rows: result.rows as T[],
      rowsAffected: result.rowsAffected,
      insertId: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
      fromCache: false,
    };

    //cache SELECT query results
    if (queryType === 'SELECT' && options?.useCache !== false) {
      queryCache.set(cacheKey, queryResult, options?.cacheTimeout);
      
      //log cache miss
      if (!options?.skipLogging) {
        await logCachePerformance({
          cacheKey,
          cacheType: 'query',
          hitMiss: 'miss',
          executionTimeMs: executionTime,
          cacheSizeBytes: JSON.stringify(queryResult).length,
          ttlSeconds: (options?.cacheTimeout || 300000) / 1000,
        });
      }
    }

    //log query performance
    if (!options?.skipLogging) {
      await logQueryPerformance({
        queryHash,
        queryType,
        tableName,
        executionTimeMs: executionTime,
        rowsExamined: result.rowsAffected,
        rowsReturned: queryResult.rows.length,
        cacheHit: false,
        userId: options?.userId,
        sessionId: options?.sessionId,
        queryPlan,
      });
    }

    return queryResult;
  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    //log failed query
    if (!options?.skipLogging) {
      console.error('Query execution failed:', {
        queryHash,
        queryType,
        tableName,
        executionTime,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    
    throw error;
  }
}

//enhanced transaction execution with performance monitoring
export async function executeOptimizedTransaction(
  queries: Array<{ query: string; params?: unknown[] }>,
  options?: {
    userId?: number;
    sessionId?: string;
    skipLogging?: boolean;
  }
): Promise<void> {
  const startTime = Date.now();
  const client = getDbClient();
  
  try {
    await client.execute('BEGIN TRANSACTION');
    
    for (const { query, params } of queries) {
      await client.execute(query, params);
      
      //log individual query performance in transaction
      if (!options?.skipLogging) {
        const queryHash = generateQueryHash(query);
        const queryType = getQueryType(query);
        const tableName = extractTableName(query);
        
        await logQueryPerformance({
          queryHash,
          queryType,
          tableName,
          executionTimeMs: Date.now() - startTime,
          cacheHit: false,
          userId: options?.userId,
          sessionId: options?.sessionId,
        });
      }
    }
    
    await client.execute('COMMIT');
    
    const totalTime = Date.now() - startTime;
    if (totalTime > PERFORMANCE_BUDGETS.BATCH_QUERY_MS) {
      console.warn(`🐌 Slow transaction detected: ${totalTime}ms (budget: ${PERFORMANCE_BUDGETS.BATCH_QUERY_MS}ms)`);
    }
    
  } catch (error) {
    await client.execute('ROLLBACK');
    
    const executionTime = Date.now() - startTime;
    console.error('Transaction failed:', {
      executionTime,
      queriesCount: queries.length,
      error: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

//cache management functions
export const CacheManager = {
  //invalidates cache entries for specific table
  invalidateTable: (tableName: string): number => {
    return queryCache.invalidate(tableName);
  },
  
  //invalidates cache entries matching pattern
  invalidatePattern: (pattern: string): number => {
    return queryCache.invalidate(pattern);
  },
  
  //clears entire cache
  clearAll: (): void => {
    queryCache.clear();
  },
  
  //gets cache statistics
  getStats: () => {
    return queryCache.getStats();
  },
};

//performance analytics functions
export const PerformanceAnalytics = {
  //gets slow query report
  getSlowQueries: async (limitMs: number = 100, limit: number = 10) => {
    const result = await executeOptimizedQuery(`
      SELECT 
        query_hash,
        query_type,
        table_name,
        AVG(execution_time_ms) as avg_time,
        MAX(execution_time_ms) as max_time,
        COUNT(*) as execution_count,
        SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits
      FROM query_performance_log 
      WHERE execution_time_ms > ? 
        AND created_at > datetime('now', '-1 day')
      GROUP BY query_hash, query_type, table_name
      ORDER BY avg_time DESC
      LIMIT ?
    `, [limitMs, limit]);
    
    return result.rows;
  },
  
  //gets cache hit rate statistics
  getCacheStats: async () => {
    const result = await executeOptimizedQuery(`
      SELECT 
        cache_type,
        COUNT(*) as total_requests,
        SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as cache_hits,
        ROUND(
          (SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) * 100.0) / COUNT(*), 
          2
        ) as hit_rate_percent,
        AVG(execution_time_ms) as avg_time_ms
      FROM cache_performance_log 
      WHERE created_at > datetime('now', '-1 day')
      GROUP BY cache_type
    `);
    
    return result.rows;
  },
  
  //gets performance summary by table
  getTablePerformance: async () => {
    const result = await executeOptimizedQuery(`
      SELECT 
        table_name,
        query_type,
        COUNT(*) as query_count,
        AVG(execution_time_ms) as avg_time,
        MAX(execution_time_ms) as max_time,
        MIN(execution_time_ms) as min_time
      FROM query_performance_log 
      WHERE created_at > datetime('now', '-1 day')
        AND table_name IS NOT NULL
      GROUP BY table_name, query_type
      ORDER BY avg_time DESC
    `);
    
    return result.rows;
  },
};

//connection pool monitoring (simulated for SQLite/Turso)
export const ConnectionPoolMonitor = {
  //logs connection pool metrics
  logMetrics: async (metrics: ConnectionPoolMetrics): Promise<void> => {
    try {
      const client = getDbClient();
      await client.execute(`
        INSERT INTO connection_pool_metrics (
          active_connections, idle_connections, waiting_connections,
          total_connections, avg_wait_time_ms, avg_query_time_ms
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        metrics.activeConnections,
        metrics.idleConnections,
        metrics.waitingConnections,
        metrics.totalConnections,
        metrics.avgWaitTimeMs,
        metrics.avgQueryTimeMs,
      ]);
    } catch (error) {
      console.error('Failed to log connection pool metrics:', error);
    }
  },
  
  //gets connection pool statistics
  getStats: async () => {
    const result = await executeOptimizedQuery(`
      SELECT 
        AVG(active_connections) as avg_active,
        AVG(idle_connections) as avg_idle,
        AVG(waiting_connections) as avg_waiting,
        AVG(total_connections) as avg_total,
        AVG(avg_wait_time_ms) as avg_wait_time,
        AVG(avg_query_time_ms) as avg_query_time
      FROM connection_pool_metrics 
      WHERE created_at > datetime('now', '-1 hour')
    `);
    
    return result.rows[0];
  },
};

//database maintenance functions
export const DatabaseMaintenance = {
  //runs database optimization
  optimize: async (): Promise<void> => {
    const client = getDbClient();
    await client.execute('PRAGMA optimize');
    await client.execute('ANALYZE');
    console.log('✅ Database optimization completed');
  },
  
  //vacuum database to reclaim space
  vacuum: async (): Promise<void> => {
    const client = getDbClient();
    await client.execute('VACUUM');
    console.log('✅ Database vacuum completed');
  },
  
  //cleanup old performance logs
  cleanupLogs: async (olderThanDays: number = 7): Promise<number> => {
    const queries = [
      {
        query: `DELETE FROM query_performance_log WHERE created_at < datetime('now', '-${olderThanDays} days')`,
      },
      {
        query: `DELETE FROM cache_performance_log WHERE created_at < datetime('now', '-${olderThanDays} days')`,
      },
      {
        query: `DELETE FROM connection_pool_metrics WHERE created_at < datetime('now', '-${olderThanDays} days')`,
      },
    ];
    
    let totalDeleted = 0;
    for (const { query } of queries) {
      const result = await executeOptimizedQuery(query);
      totalDeleted += result.rowsAffected;
    }
    
    console.log(`✅ Cleaned up ${totalDeleted} old performance log entries`);
    return totalDeleted;
  },
};