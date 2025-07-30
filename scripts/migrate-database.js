#!/usr/bin/env node

//database migration script
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@libsql/client';

async function runMigrations() {
  console.log('🚀 Running database migrations...');
  
  try {
    // Create client for local development
    const client = createClient({
      url: 'file:local.db'
    });

    // Create migrations table if it doesn't exist
    await client.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL UNIQUE,
        executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of executed migrations
    const executedResult = await client.execute('SELECT filename FROM migrations ORDER BY id');
    const executedMigrations = new Set(executedResult.rows.map(row => row.filename));

    // Look for migration files (future enhancement)
    const migrationsDir = join(process.cwd(), 'database', 'migrations');
    let migrationFiles = [];
    
    try {
      migrationFiles = readdirSync(migrationsDir)
        .filter(file => file.endsWith('.sql'))
        .sort();
    } catch (error) {
      console.log('📁 No migrations directory found, creating schema from scratch...');
      
      // Run the main schema setup instead
      const { setupDatabase } = await import('./setup-database.js');
      await setupDatabase();
      return;
    }

    if (migrationFiles.length === 0) {
      console.log('📝 No migration files found');
      return;
    }

    // Execute new migrations
    let executedCount = 0;
    for (const filename of migrationFiles) {
      if (executedMigrations.has(filename)) {
        console.log(`⏭️  Skipping already executed migration: ${filename}`);
        continue;
      }

      console.log(`🔄 Executing migration: ${filename}`);
      
      const migrationPath = join(migrationsDir, filename);
      const migrationSql = readFileSync(migrationPath, 'utf-8');
      
      // Execute migration in a transaction
      await client.execute('BEGIN TRANSACTION');
      
      try {
        // Split and execute statements
        const statements = migrationSql
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            await client.execute(statement);
          }
        }

        // Record migration as executed
        await client.execute(
          'INSERT INTO migrations (filename) VALUES (?)',
          [filename]
        );

        await client.execute('COMMIT');
        executedCount++;
        console.log(`✅ Migration ${filename} completed`);
        
      } catch (error) {
        await client.execute('ROLLBACK');
        console.error(`❌ Migration ${filename} failed:`, error);
        throw error;
      }
    }

    if (executedCount > 0) {
      console.log(`🎉 Successfully executed ${executedCount} migrations`);
    } else {
      console.log('📋 Database is up to date');
    }

    await client.close();
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}