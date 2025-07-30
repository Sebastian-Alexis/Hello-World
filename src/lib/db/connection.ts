import { createClient, type Client } from '@libsql/client';
import { getDbConfig, isDev } from '@/lib/env';
import { readFileSync } from 'fs';
import { join } from 'path';

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

  try {
    console.log('Initializing local database schema...');
    
    const schemaPath = join(process.cwd(), 'database', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    const client = getDbClient();
    
    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        await client.execute(statement);
      }
    }
    
    console.log(`✅ Database schema initialized successfully (${statements.length} statements)`);
  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    throw error;
  }
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
    await client.execute('BEGIN TRANSACTION');
    
    for (const { query, params } of queries) {
      await client.execute(query, params);
    }
    
    await client.execute('COMMIT');
  } catch (error) {
    await client.execute('ROLLBACK');
    throw error;
  }
}

//database statistics for monitoring
export async function getDatabaseStats(): Promise<{
  size: number;
  tables: number;
  indexes: number;
  pragmaStats: Record<string, unknown>;
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
    ]).then(([cache, journal, sync]) => ({
      cache_size: cache.rows[0],
      journal_mode: journal.rows[0],
      synchronous: sync.rows[0],
    }));
    
    return {
      size: Number(sizeResult.rows[0]?.page_count) * 4096, // Assuming 4KB page size
      tables: Number(tablesResult.rows[0]?.count),
      indexes: Number(indexesResult.rows[0]?.count),
      pragmaStats,
    };
  } catch (error) {
    console.error('Failed to get database stats:', error);
    throw error;
  }
}