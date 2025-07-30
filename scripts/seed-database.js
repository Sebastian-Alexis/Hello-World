#!/usr/bin/env node

//database seeding script for development
import { createClient } from '@libsql/client';
import { createHash } from 'crypto';

//hash password using simple crypto (in production, use bcrypt)
function hashPassword(password) {
  return createHash('sha256').update(password + 'salt').digest('hex');
}

async function seedDatabase() {
  console.log('🌱 Seeding database with initial data...');
  
  try {
    const client = createClient({
      url: 'file:local.db'
    });

    // Check if already seeded
    const existingUser = await client.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      ['admin@localhost.dev']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('🌾 Database already seeded, skipping...');
      await client.close();
      return;
    }

    console.log('👤 Creating admin user...');
    
    // Create admin user
    const adminResult = await client.execute(`
      INSERT INTO users (
        email, username, password_hash, first_name, last_name, 
        role, bio, is_active, email_verified
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      'admin@localhost.dev',
      'admin',
      hashPassword('admin123'),
      'Admin',
      'User',
      'admin',
      'Default admin user for development',
      true,
      true
    ]);

    const adminId = Number(adminResult.lastInsertRowid);
    console.log(`✅ Created admin user with ID: ${adminId}`);

    // Create blog categories
    console.log('📂 Creating blog categories...');
    const categories = [
      { name: 'Technology', slug: 'technology', description: 'Tech articles and tutorials', color: '#3B82F6' },
      { name: 'Travel', slug: 'travel', description: 'Travel experiences and tips', color: '#10B981' },
      { name: 'Personal', slug: 'personal', description: 'Personal thoughts and experiences', color: '#8B5CF6' },
      { name: 'Tutorial', slug: 'tutorial', description: 'Step-by-step guides', color: '#F59E0B' },
    ];

    for (const category of categories) {
      await client.execute(`
        INSERT INTO blog_categories (name, slug, description, color, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [category.name, category.slug, category.description, category.color, true, 1]);
    }

    // Create blog tags
    console.log('🏷️ Creating blog tags...');
    const tags = [
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'TypeScript', slug: 'typescript' },
      { name: 'React', slug: 'react' },
      { name: 'Node.js', slug: 'nodejs' },
      { name: 'Database', slug: 'database' },
      { name: 'Performance', slug: 'performance' },
      { name: 'Design', slug: 'design' },
    ];

    for (const tag of tags) {
      await client.execute(`
        INSERT INTO blog_tags (name, slug, is_active)
        VALUES (?, ?, ?)
      `, [tag.name, tag.slug, true]);
    }

    // Create project categories
    console.log('💼 Creating project categories...');
    const projectCategories = [
      { name: 'Web Application', slug: 'web-app', color: '#3B82F6' },
      { name: 'Mobile App', slug: 'mobile-app', color: '#10B981' },
      { name: 'Desktop App', slug: 'desktop-app', color: '#8B5CF6' },
      { name: 'Library', slug: 'library', color: '#F59E0B' },
      { name: 'Tool', slug: 'tool', color: '#EF4444' },
    ];

    for (const category of projectCategories) {
      await client.execute(`
        INSERT INTO project_categories (name, slug, color, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?)
      `, [category.name, category.slug, category.color, true, 1]);
    }

    // Create project technologies
    console.log('⚙️ Creating project technologies...');
    const technologies = [
      { name: 'JavaScript', slug: 'javascript', category: 'language', color: '#F7DF1E' },
      { name: 'TypeScript', slug: 'typescript', category: 'language', color: '#3178C6' },
      { name: 'React', slug: 'react', category: 'framework', color: '#61DAFB' },
      { name: 'Svelte', slug: 'svelte', category: 'framework', color: '#FF3E00' },
      { name: 'Astro', slug: 'astro', category: 'framework', color: '#FF5D01' },
      { name: 'Node.js', slug: 'nodejs', category: 'platform', color: '#339933' },
      { name: 'SQLite', slug: 'sqlite', category: 'database', color: '#003B57' },
      { name: 'Tailwind CSS', slug: 'tailwind', category: 'library', color: '#06B6D4' },
    ];

    for (const tech of technologies) {
      await client.execute(`
        INSERT INTO project_technologies (name, slug, category, color, is_active, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [tech.name, tech.slug, tech.category, tech.color, true, 1]);
    }

    // Create sample airports
    console.log('✈️ Creating sample airports...');
    const airports = [
      { iata: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'United States', country_code: 'US', lat: 33.9425, lng: -118.4081 },
      { iata: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'United States', country_code: 'US', lat: 40.6413, lng: -73.7781 },
      { iata: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'United Kingdom', country_code: 'GB', lat: 51.4700, lng: -0.4543 },
      { iata: 'NRT', name: 'Tokyo Narita International Airport', city: 'Tokyo', country: 'Japan', country_code: 'JP', lat: 35.7720, lng: 140.3929 },
    ];

    for (const airport of airports) {
      await client.execute(`
        INSERT INTO airports (
          iata_code, name, city, country, country_code, 
          latitude, longitude, type, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        airport.iata, airport.name, airport.city, airport.country, 
        airport.country_code, airport.lat, airport.lng, 'airport', true
      ]);
    }

    // Create site settings
    console.log('⚙️ Creating site settings...');
    const settings = [
      { key: 'site_name', value: 'Personal Website (Dev)', data_type: 'string', category: 'general', is_public: true },
      { key: 'site_description', value: 'Ultra-fast personal website with blog, portfolio, and flight tracking', data_type: 'string', category: 'general', is_public: true },
      { key: 'posts_per_page', value: '10', data_type: 'integer', category: 'blog', is_public: true },
      { key: 'projects_per_page', value: '9', data_type: 'integer', category: 'portfolio', is_public: true },
      { key: 'enable_comments', value: 'true', data_type: 'boolean', category: 'blog', is_public: true },
      { key: 'maintenance_mode', value: 'false', data_type: 'boolean', category: 'general', is_public: false },
    ];

    for (const setting of settings) {
      await client.execute(`
        INSERT INTO site_settings (key, value, data_type, category, is_public, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        setting.key, setting.value, setting.data_type, 
        setting.category, setting.is_public, 
        `Auto-generated setting for ${setting.key}`
      ]);
    }

    await client.close();
    console.log('🎉 Database seeding completed successfully!');
    console.log('');
    console.log('📋 Seeded data summary:');
    console.log('  👤 1 admin user (admin@localhost.dev / admin123)');
    console.log(`  📂 ${categories.length} blog categories`);
    console.log(`  🏷️ ${tags.length} blog tags`);
    console.log(`  💼 ${projectCategories.length} project categories`);
    console.log(`  ⚙️ ${technologies.length} project technologies`);
    console.log(`  ✈️ ${airports.length} sample airports`);
    console.log(`  ⚙️ ${settings.length} site settings`);
    console.log('');
    console.log('🚀 Ready for development!');
    
  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}