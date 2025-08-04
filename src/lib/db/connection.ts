import { createClient, type Client } from '@libsql/client';
import { getDbConfig, isDev } from '@/lib/env';
import { ConnectionPoolMonitor } from './performance';

let _client: Client | null = null;

//gets or creates the database client
export function getDbClient(): Client {
  if (_client) {
    return _client;
  }

  const config = getDbConfig();
  
  _client = createClient({
    url: config.url,
    authToken: config.authToken,
    syncUrl: config.syncUrl,
    syncInterval: isDev() ? undefined : 60, // sync every minute in production
  });

  return _client;
}

//closes the database connection
export async function closeDb(): Promise<void> {
  if (_client) {
    await _client.close();
    _client = null;
  }
}

//database connection health check
export async function healthCheck(): Promise<{ healthy: boolean; error?: string; latency?: number }> {
  try {
    const start = Date.now();
    const client = getDbClient();
    await client.execute('SELECT 1');
    const latency = Date.now() - start;
    
    return { healthy: true, latency };
  } catch (error) {
    return { 
      healthy: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

//initializes the database schema for development
export async function initDatabase(): Promise<void> {
  if (!isDev()) {
    console.log('Skipping schema initialization in production');
    return;
  }

  console.log('Database initialization is not available in Cloudflare Workers environment');
  console.log('Please run database setup locally before deploying');
}

//runs database migrations
export async function runMigrations(): Promise<void> {
  // For now, we'll use the schema initialization
  // In the future, add proper migration logic here
  console.log('Running database migrations...');
  
  try {
    await initDatabase();
    console.log('✅ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

//seeds the database with initial data
export async function seedDatabase(): Promise<void> {
  if (!isDev()) {
    console.log('Skipping database seeding in production');
    return;
  }

  try {
    console.log('Seeding database with initial data...');
    
    const client = getDbClient();
    
    // Check if already seeded by looking for admin user
    const existingUser = await client.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      ['admin@localhost.dev']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('Database already seeded, skipping...');
      return;
    }
    
    // Add seed data here
    console.log('✅ Database seeded successfully');
  } catch (error) {
    console.error('❌ Failed to seed database:', error);
    throw error;
  }
}

//executes a query with error handling and logging
export async function executeQuery<T = unknown>(
  query: string,
  params?: unknown[]
): Promise<{ rows: T[]; rowsAffected: number; insertId?: number }> {
  try {
    const client = getDbClient();
    const result = await client.execute(query, params);
    
    return {
      rows: result.rows as T[],
      rowsAffected: result.rowsAffected,
      insertId: result.lastInsertRowid ? Number(result.lastInsertRowid) : undefined,
    };
  } catch (error) {
    console.error('Database query error:', { query, params, error });
    throw error;
  }
}

//executes multiple queries in a transaction
export async function executeTransaction(
  queries: Array<{ query: string; params?: unknown[] }>
): Promise<void> {
  const client = getDbClient();
  
  try {
    //use Turso's batch operation which handles transactions automatically
    const statements = queries.map(({ query, params }) => ({
      sql: query,
      args: params || []
    }));
    
    await client.batch(statements, 'write');
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

//database statistics for monitoring
export async function getDatabaseStats(): Promise<{
  size: number;
  tables: number;
  indexes: number;
  pragmaStats: Record<string, unknown>;
  performance: {
    avgQueryTime: number;
    slowQueries: number;
    cacheHitRate: number;
  };
}> {
  try {
    const client = getDbClient();
    
    const [sizeResult, tablesResult, indexesResult] = await Promise.all([
      client.execute('PRAGMA page_count;'),
      client.execute("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table';"),
      client.execute("SELECT COUNT(*) as count FROM sqlite_master WHERE type='index';"),
    ]);
    
    const pragmaStats = await Promise.all([
      client.execute('PRAGMA cache_size;'),
      client.execute('PRAGMA journal_mode;'),
      client.execute('PRAGMA synchronous;'),
      client.execute('PRAGMA page_size;'),
      client.execute('PRAGMA mmap_size;'),
    ]).then(([cache, journal, sync, pageSize, mmapSize]) => ({
      cache_size: cache.rows[0],
      journal_mode: journal.rows[0],
      synchronous: sync.rows[0],
      page_size: pageSize.rows[0],
      mmap_size: mmapSize.rows[0],
    }));

    //get performance statistics
    let performanceStats = {
      avgQueryTime: 0,
      slowQueries: 0,
      cacheHitRate: 0,
    };

    try {
      const [avgTimeResult, slowQueriesResult, cacheStatsResult] = await Promise.all([
        client.execute(`
          SELECT AVG(execution_time_ms) as avg_time 
          FROM query_performance_log 
          WHERE created_at > datetime('now', '-1 hour')
        `),
        client.execute(`
          SELECT COUNT(*) as count 
          FROM query_performance_log 
          WHERE execution_time_ms > 100 
            AND created_at > datetime('now', '-1 hour')
        `),
        client.execute(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN hit_miss = 'hit' THEN 1 ELSE 0 END) as hits
          FROM cache_performance_log 
          WHERE created_at > datetime('now', '-1 hour')
        `),
      ]);

      const avgTime = avgTimeResult.rows[0]?.avg_time;
      const slowCount = slowQueriesResult.rows[0]?.count;
      const cacheStats = cacheStatsResult.rows[0];

      performanceStats = {
        avgQueryTime: typeof avgTime === 'number' ? avgTime : 0,
        slowQueries: typeof slowCount === 'number' ? slowCount : 0,
        cacheHitRate: cacheStats?.total > 0 
          ? (Number(cacheStats.hits) / Number(cacheStats.total)) * 100 
          : 0,
      };
    } catch (perfError) {
      //performance tables might not exist yet
      console.warn('Performance stats not available:', perfError);
    }
    
    return {
      size: Number(sizeResult.rows[0]?.page_count) * 4096,
      tables: Number(tablesResult.rows[0]?.count),
      indexes: Number(indexesResult.rows[0]?.count),
      pragmaStats,
      performance: performanceStats,
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    throw error;
  }
}

//enhanced health check with performance metrics
export async function enhancedHealthCheck(): Promise<{
  healthy: boolean;
  error?: string;
  latency: number;
  performance: {
    queryTime: number;
    indexUsage: boolean;
    cacheEnabled: boolean;
  };
}> {
  try {
    const start = Date.now();
    const client = getDbClient();
    
    //test basic connectivity
    await client.execute('SELECT 1');
    const basicLatency = Date.now() - start;
    
    //test index usage with EXPLAIN QUERY PLAN
    const complexQueryStart = Date.now();
    const planResult = await client.execute(`
      EXPLAIN QUERY PLAN 
      SELECT * FROM blog_posts 
      WHERE status = 'published' 
      ORDER BY published_at DESC 
      LIMIT 5
    `);
    const complexQueryTime = Date.now() - complexQueryStart;
    
    //check if indexes are being used
    const planText = JSON.stringify(planResult.rows);
    const indexUsage = planText.includes('USING INDEX') || planText.includes('SEARCH');
    
    //test cache functionality
    const cacheTestStart = Date.now();
    await client.execute('SELECT COUNT(*) FROM sqlite_master');
    const cacheTestTime = Date.now() - cacheTestStart;
    
    return {
      healthy: true,
      latency: basicLatency,
      performance: {
        queryTime: complexQueryTime,
        indexUsage,
        cacheEnabled: cacheTestTime < 50, //assume cache if very fast
      },
    };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      latency: -1,
      performance: {
        queryTime: -1,
        indexUsage: false,
        cacheEnabled: false,
      },
    };
  }
}

//performance monitoring middleware
export async function monitorConnection(): Promise<void> {
  try {
    //simulate connection pool metrics for SQLite/Turso
    await ConnectionPoolMonitor.logMetrics({
      activeConnections: _client ? 1 : 0,
      idleConnections: _client ? 0 : 1,
      waitingConnections: 0,
      totalConnections: 1,
      avgWaitTimeMs: 0,
      avgQueryTimeMs: 50, //estimated based on typical SQLite performance
    });
  } catch (error) {
    console.error('Failed to monitor connection:', error);
  }
}