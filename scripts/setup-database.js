#!/usr/bin/env node

//database setup script for development
import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@libsql/client';

const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

async function setupDatabase() {
  console.log('🚀 Setting up database schema...');
  
  try {
    // Create client for local development
    const client = createClient({
      url: 'file:local.db'
    });

    // Read schema file
    const schemaPath = join(process.cwd(), 'database', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    
    console.log('📖 Reading schema from:', schemaPath);
    
    // Split into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements`);
    
    // Execute each statement
    let executedCount = 0;
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await client.execute(statement);
          executedCount++;
        } catch (error) {
          // Skip errors for statements that might already exist
          if (!error.message.includes('already exists')) {
            console.warn(`⚠️  Warning executing statement: ${error.message}`);
          }
        }
      }
    }
    
    console.log(`✅ Database schema setup complete! Executed ${executedCount} statements`);
    
    // Test the database connection
    const result = await client.execute('SELECT COUNT(*) as table_count FROM sqlite_master WHERE type="table"');
    const tableCount = result.rows[0]?.table_count;
    console.log(`📊 Database contains ${tableCount} tables`);
    
    await client.close();
    console.log('🔒 Database connection closed');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  setupDatabase();
}