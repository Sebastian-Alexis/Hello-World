#!/usr/bin/env node

import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { getEnv } from '../src/lib/env/index.ts';

async function createAdminUser() {
  try {
    console.log('Creating admin user...');
    
    //get environment configuration
    const env = getEnv();
    
    //create database client
    const db = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });

    //hash admin password
    const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, env.BCRYPT_ROUNDS);
    
    //split admin name into first and last name
    const nameParts = env.ADMIN_NAME.split(' ');
    const firstName = nameParts[0] || 'Admin';
    const lastName = nameParts.slice(1).join(' ') || 'User';
    
    //generate username from email
    const username = env.ADMIN_EMAIL.split('@')[0];

    //check if admin user already exists
    const existingUser = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ? OR role = ?',
      args: [env.ADMIN_EMAIL, 'admin']
    });

    if (existingUser.rows.length > 0) {
      console.log('Admin user already exists. Updating password...');
      
      //update existing admin user
      await db.execute({
        sql: `
          UPDATE users 
          SET password_hash = ?, first_name = ?, last_name = ?, username = ?, updated_at = CURRENT_TIMESTAMP
          WHERE email = ? OR role = ?
        `,
        args: [passwordHash, firstName, lastName, username, env.ADMIN_EMAIL, 'admin']
      });
      
      console.log('✅ Admin user updated successfully!');
    } else {
      //create new admin user
      await db.execute({
        sql: `
          INSERT INTO users (
            email, username, password_hash, first_name, last_name,
            role, is_active, email_verified, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        args: [
          env.ADMIN_EMAIL,
          username,
          passwordHash,
          firstName,
          lastName,
          'admin',
          true,
          true
        ]
      });
      
      console.log('✅ Admin user created successfully!');
    }

    console.log(`
📧 Email: ${env.ADMIN_EMAIL}
👤 Name: ${env.ADMIN_NAME}
🔐 Password: ${env.ADMIN_PASSWORD}
🔑 Role: admin

You can now log in to the admin panel at /admin/login
    `);

    //close database connection
    db.close();

  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  }
}

//run the script
createAdminUser();