#!/usr/bin/env node

//quick script to publish more blog posts for testing the /blog page
//creates several published posts with different content types and categories

import { db } from '../src/lib/db/index.js';

const TEST_POSTS = [
  {
    title: 'Getting Started with Performance Optimization',
    slug: 'getting-started-performance-optimization',
    excerpt: 'Learn the fundamentals of web performance optimization and how to measure Core Web Vitals effectively.',
    content: `# Getting Started with Performance Optimization

Performance optimization is crucial for modern web applications. In this comprehensive guide, we'll explore the key metrics and techniques for creating lightning-fast websites.

## Core Web Vitals Overview

The three main Core Web Vitals are:

- **LCP (Largest Contentful Paint)**: Measures loading performance
- **FID (First Input Delay)**: Measures interactivity  
- **CLS (Cumulative Layout Shift)**: Measures visual stability

## Performance Budget Strategy

Setting performance budgets helps maintain fast loading times:

1. Define target metrics for your application
2. Implement monitoring tools
3. Set up alerts for regressions
4. Regular performance audits

By following these practices, you can ensure your website delivers an excellent user experience across all devices and network conditions.`,
    status: 'published',
    featured: true,
    allow_comments: true,
    featured_image_url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=400&fit=crop',
  },
  {
    title: 'Modern Caching Strategies for Web Applications',
    slug: 'modern-caching-strategies-web-applications',
    excerpt: 'Explore advanced caching techniques including HTTP caching, service workers, and CDN optimization.',
    content: `# Modern Caching Strategies for Web Applications

Effective caching can dramatically improve your application's performance. Let's explore various caching strategies and when to use them.

## HTTP Caching Headers

Understanding cache headers is fundamental:

\`\`\`http
Cache-Control: public, max-age=31536000, immutable
ETag: "abc123"
Last-Modified: Wed, 21 Oct 2024 07:28:00 GMT
\`\`\`

## Service Worker Caching

Service workers provide powerful offline capabilities:

\`\`\`javascript
//cache-first strategy for assets
self.addEventListener('fetch', event => {
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});
\`\`\`

## CDN Configuration

Optimize your CDN settings for maximum performance:

- Use appropriate cache headers
- Configure edge locations strategically  
- Implement cache purging strategies
- Monitor cache hit rates

These strategies combined can reduce loading times by 50-80% in many cases.`,
    status: 'published',
    featured: false,
    allow_comments: true,
    featured_image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&h=400&fit=crop',
  },
  {
    title: 'Bundle Optimization and Code Splitting Techniques',
    slug: 'bundle-optimization-code-splitting-techniques',
    excerpt: 'Master bundle analysis, code splitting, and tree shaking to reduce JavaScript bundle sizes.',
    content: `# Bundle Optimization and Code Splitting Techniques

Large JavaScript bundles can significantly impact your application's loading performance. Let's explore techniques to optimize bundle sizes.

## Bundle Analysis

Start by analyzing your current bundle:

\`\`\`bash
npm install --save-dev webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/static/js/*.js
\`\`\`

## Dynamic Imports and Code Splitting

Implement route-based code splitting:

\`\`\`javascript
//dynamic import for lazy loading
const LazyComponent = lazy(() => import('./LazyComponent'));

//route-based splitting
const routes = [
  {
    path: '/dashboard',
    component: lazy(() => import('./pages/Dashboard'))
  }
];
\`\`\`

## Tree Shaking Configuration

Ensure your bundler can eliminate dead code:

\`\`\`javascript
//use ES modules for better tree shaking
import { debounce } from 'lodash-es';

//avoid importing entire libraries
import debounce from 'lodash/debounce';
\`\`\`

## Third-party Library Optimization

Strategies for reducing third-party bundle impact:

1. Use bundle analyzers to identify heavy dependencies
2. Consider lighter alternatives (date-fns vs moment.js)
3. Load non-critical libraries asynchronously
4. Implement polyfill strategies

With these techniques, you can often reduce bundle sizes by 30-60%.`,
    status: 'published',
    featured: false,
    allow_comments: true,
    featured_image_url: 'https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&h=400&fit=crop',
  },
  {
    title: 'Image Optimization Best Practices',
    slug: 'image-optimization-best-practices',
    excerpt: 'Learn how to optimize images using modern formats, responsive images, and lazy loading for better performance.',
    content: `# Image Optimization Best Practices

Images often account for the majority of a webpage's weight. Proper optimization can dramatically improve loading performance.

## Modern Image Formats

Utilize next-generation formats:

\`\`\`html
<picture>
  <source srcset="image.avif" type="image/avif">
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
\`\`\`

## Responsive Images

Serve appropriate sizes for different devices:

\`\`\`html
<img 
  srcset="image-320w.jpg 320w,
          image-640w.jpg 640w,
          image-1280w.jpg 1280w"
  sizes="(max-width: 320px) 280px,
         (max-width: 640px) 580px,
         1120px"
  src="image-640w.jpg"
  alt="Description">
\`\`\`

## Lazy Loading Implementation

Implement native lazy loading:

\`\`\`html
<img src="image.jpg" loading="lazy" alt="Description">
\`\`\`

## Image Compression Strategies

1. Use appropriate quality settings (80-85% for JPEG)
2. Implement lossless compression for PNG
3. Consider vector formats (SVG) for simple graphics
4. Use CDN image optimization services

These optimizations can reduce image payload by 60-80% while maintaining visual quality.`,
    status: 'published',
    featured: false,
    allow_comments: true,
    featured_image_url: 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800&h=400&fit=crop',
  },
  {
    title: 'Service Workers for Performance and Offline Functionality',  
    slug: 'service-workers-performance-offline-functionality',
    excerpt: 'Implement service workers to improve performance through strategic caching and enable offline functionality.',
    content: `# Service Workers for Performance and Offline Functionality

Service workers are powerful tools for enhancing web application performance and providing offline capabilities.

## Service Worker Registration

Start with proper registration:

\`\`\`javascript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
\`\`\`

## Caching Strategies

Implement different caching patterns:

\`\`\`javascript
//cache first - for static assets
self.addEventListener('fetch', event => {
  if (event.request.destination === 'image') {
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
    );
  }
});

//network first - for API calls
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  }
});
\`\`\`

## Background Sync

Handle offline actions:

\`\`\`javascript
//register background sync
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

//client-side registration
navigator.serviceWorker.ready.then(registration => {
  return registration.sync.register('background-sync');
});
\`\`\`

## Performance Benefits

Service workers can provide:

- 50-90% faster repeat visits through caching
- Offline functionality for core features
- Reduced server load through strategic caching
- Better user experience with instant loading

Proper service worker implementation is essential for modern web applications.`,
    status: 'published',
    featured: false,
    allow_comments: true,
    featured_image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=800&h=400&fit=crop',
  }
];

async function publishTestPosts() {
  console.log('🚀 Publishing test blog posts...\n');

  try {
    //get first user (admin) for author
    const users = await db.query('SELECT id FROM users LIMIT 1');
    
    if (users.length === 0) {
      console.error('❌ No users found. Please create an admin user first.');
      process.exit(1);
    }

    const authorId = users[0].id;
    let publishedCount = 0;

    for (const postData of TEST_POSTS) {
      try {
        //check if post already exists
        const existing = await db.query('SELECT id FROM blog_posts WHERE slug = ?', [postData.slug]);
        
        if (existing.length > 0) {
          console.log(`⏭️  Post "${postData.title}" already exists, skipping...`);
          continue;
        }

        //calculate reading time (rough estimate: 200 words per minute)
        const wordCount = postData.content.split(/\s+/).length;
        const readingTime = Math.max(1, Math.ceil(wordCount / 200));

        //create the blog post
        await db.query(`
          INSERT INTO blog_posts (
            title, slug, excerpt, content, content_html, status, featured, 
            allow_comments, featured_image_url, reading_time, word_count,
            author_id, published_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
          postData.title,
          postData.slug,
          postData.excerpt,
          postData.content,
          postData.content, //basic HTML content (could be processed with markdown parser)
          postData.status,
          postData.featured,
          postData.allow_comments,
          postData.featured_image_url,
          readingTime,
          wordCount,
          authorId
        ]);

        publishedCount++;
        console.log(`✅ Published: "${postData.title}"`);
        console.log(`   📖 ${readingTime} min read (${wordCount} words)`);
        console.log(`   🔗 /blog/${postData.slug}\n`);

      } catch (error) {
        console.error(`❌ Failed to publish "${postData.title}":`, error.message);
      }
    }

    console.log('='.repeat(50));
    console.log(`🎉 Successfully published ${publishedCount} blog posts!`);
    console.log('📄 Blog posts are now available at /blog');
    console.log('='.repeat(50));

  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  }
}

//run the script
publishTestPosts();