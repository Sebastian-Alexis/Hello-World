#!/usr/bin/env node

//database migration script for lighthouse CI schema
//extends existing database with lighthouse performance monitoring tables

const fs = require('fs');
const path = require('path');
const { DatabaseQueries } = require('../src/lib/db/queries.js');

const LIGHTHOUSE_SCHEMA_PATH = path.join(__dirname, '../database/lighthouse-schema.sql');

async function migrateLighthouseSchema() {
  console.log('🚀 Starting Lighthouse CI schema migration...\n');
  
  try {
    //check if schema file exists
    if (!fs.existsSync(LIGHTHOUSE_SCHEMA_PATH)) {
      throw new Error(`Lighthouse schema file not found at: ${LIGHTHOUSE_SCHEMA_PATH}`);
    }
    
    //read schema file
    const schema = fs.readFileSync(LIGHTHOUSE_SCHEMA_PATH, 'utf8');
    console.log('📋 Read Lighthouse CI schema file');
    
    //initialize database connection
    const db = new DatabaseQueries();
    console.log('🔌 Connected to database');
    
    //split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);
    
    //execute each statement
    let successCount = 0;
    let skipCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        //log statement type
        const statementType = getStatementType(statement);
        process.stdout.write(`${i + 1}/${statements.length} Executing ${statementType}... `);
        
        //execute statement
        await db.executeRaw(statement);
        
        console.log('✅');
        successCount++;
        
      } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('⏭️  (already exists)');
          skipCount++;
        } else {
          console.log('❌');
          console.error(`Error executing statement: ${error.message}`);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          throw error;
        }
      }
    }
    
    console.log(`\n📊 Migration Summary:`);
    console.log(`   ✅ Executed: ${successCount} statements`);
    console.log(`   ⏭️  Skipped: ${skipCount} statements (already exist)`);
    console.log(`   ❌ Failed: 0 statements`);
    
    //verify tables were created
    await verifyTables(db);
    
    //insert sample data if needed
    await insertSampleData(db);
    
    console.log('\n🎉 Lighthouse CI schema migration completed successfully!');
    console.log('\n📚 New tables available:');
    console.log('   • lighthouse_results - Lighthouse test results');
    console.log('   • lighthouse_baselines - Performance baselines');
    console.log('   • performance_regressions - Detected regressions');
    console.log('   • performance_trends - Performance trend analysis');
    console.log('   • performance_alerts - Performance alerts and notifications');
    console.log('   • lighthouse_config - Lighthouse CI configurations');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

//get statement type for logging
function getStatementType(statement) {
  const sql = statement.toUpperCase().trim();
  
  if (sql.startsWith('CREATE TABLE')) {
    const match = sql.match(/CREATE TABLE[^`]*`?([^`\s]+)`?/);
    return `CREATE TABLE ${match ? match[1] : ''}`;
  }
  
  if (sql.startsWith('CREATE INDEX')) {
    const match = sql.match(/CREATE INDEX[^`]*`?([^`\s]+)`?/);
    return `CREATE INDEX ${match ? match[1] : ''}`;
  }
  
  if (sql.startsWith('CREATE VIEW')) {
    const match = sql.match(/CREATE VIEW[^`]*`?([^`\s]+)`?/);
    return `CREATE VIEW ${match ? match[1] : ''}`;
  }
  
  if (sql.startsWith('INSERT')) {
    const match = sql.match(/INSERT[^`]*INTO[^`]*`?([^`\s]+)`?/);
    return `INSERT INTO ${match ? match[1] : ''}`;
  }
  
  return sql.split(' ')[0] + (sql.split(' ')[1] || '');
}

//verify that required tables were created
async function verifyTables(db) {
  console.log('\n🔍 Verifying table creation...');
  
  const requiredTables = [
    'lighthouse_results',
    'lighthouse_baselines', 
    'performance_regressions',
    'performance_trends',
    'performance_alerts',
    'lighthouse_config'
  ];
  
  for (const tableName of requiredTables) {
    try {
      const result = await db.executeRaw(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
      
      if (result && (Array.isArray(result) ? result.length > 0 : result.name)) {
        console.log(`   ✅ ${tableName} table exists`);
      } else {
        throw new Error(`Table ${tableName} was not created`);
      }
    } catch (error) {
      console.log(`   ❌ ${tableName} table missing`);
      throw error;
    }
  }
  
  console.log('✅ All required tables verified');
}

//insert sample/default data
async function insertSampleData(db) {
  console.log('\n📝 Checking for sample data...');
  
  try {
    //check if lighthouse_config has default entries
    const configCount = await db.executeRaw(`SELECT COUNT(*) as count FROM lighthouse_config`);
    const count = Array.isArray(configCount) ? configCount[0].count : configCount.count;
    
    if (count === 0) {
      console.log('   📦 Inserting default Lighthouse configurations...');
      
      const defaultConfigs = [
        {
          name: 'default-desktop',
          config_data: JSON.stringify({
            preset: 'desktop',
            throttling: {
              rttMs: 40,
              throughputKbps: 10240,
              cpuSlowdownMultiplier: 1
            },
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1
            }
          })
        },
        {
          name: 'default-mobile',
          config_data: JSON.stringify({
            preset: 'mobile',
            throttling: {
              rttMs: 150,
              throughputKbps: 1638.4,
              cpuSlowdownMultiplier: 4
            },
            screenEmulation: {
              mobile: true,
              width: 375,
              height: 667,
              deviceScaleFactor: 2
            }
          })
        }
      ];
      
      for (const config of defaultConfigs) {
        await db.executeRaw(`
          INSERT INTO lighthouse_config (name, config_data, is_active) 
          VALUES (?, ?, ?)
        `, [config.name, config.config_data, true]);
      }
      
      console.log('   ✅ Default configurations inserted');
    } else {
      console.log('   ⏭️  Lighthouse configurations already exist');
    }
    
    //check if performance_alerts has default budget alerts
    const alertCount = await db.executeRaw(`SELECT COUNT(*) as count FROM performance_alerts WHERE alert_type = 'budget_exceeded'`);
    const alertCountValue = Array.isArray(alertCount) ? alertCount[0].count : alertCount.count;
    
    if (alertCountValue === 0) {
      console.log('   📊 Inserting default performance budget alerts...');
      
      const defaultBudgets = [
        {
          title: 'Performance Score Budget',
          message: 'Performance score should be >= 95',
          metric_name: 'performance_score',
          threshold_value: 0.95
        },
        {
          title: 'LCP Budget',
          message: 'Largest Contentful Paint should be <= 2.5s',
          metric_name: 'lcp',
          threshold_value: 2500
        },
        {
          title: 'CLS Budget', 
          message: 'Cumulative Layout Shift should be <= 0.1',
          metric_name: 'cls',
          threshold_value: 0.1
        },
        {
          title: 'TBT Budget',
          message: 'Total Blocking Time should be <= 200ms',
          metric_name: 'tbt',
          threshold_value: 200
        }
      ];
      
      for (const budget of defaultBudgets) {
        await db.executeRaw(`
          INSERT INTO performance_alerts (
            alert_type, title, message, url, metric_name, 
            threshold_value, status, severity
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          'budget_exceeded',
          budget.title,
          budget.message,
          '*',
          budget.metric_name,
          budget.threshold_value,
          'active',
          'medium'
        ]);
      }
      
      console.log('   ✅ Default performance budgets inserted');
    } else {
      console.log('   ⏭️  Performance budget alerts already exist');
    }
    
  } catch (error) {
    console.error('   ❌ Error inserting sample data:', error.message);
    //don't fail migration for sample data errors
  }
}

//add executeRaw method to DatabaseQueries for migration
if (!DatabaseQueries.prototype.executeRaw) {
  const { executeQuery } = require('../src/lib/db/connection.js');
  
  DatabaseQueries.prototype.executeRaw = async function(sql, params = []) {
    return await executeQuery(sql, params);
  };
}

//run migration if called directly
if (require.main === module) {
  migrateLighthouseSchema();
}

module.exports = { migrateLighthouseSchema };