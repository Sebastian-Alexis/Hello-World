// =============================================================================
// BLOG POST API - Individual blog post endpoint with related posts
// GET /api/blog/[slug] - Returns single blog post with related content
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const { slug } = params;
    
    if (!slug || typeof slug !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or missing slug parameter',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //check if this is a bot/crawler to skip view increment
    const userAgent = request.headers.get('user-agent') || '';
    const isBot = /bot|crawler|spider|crawling|facebookexternalhit|twitterbot|linkedinbot/i.test(userAgent);
    
    //get the blog post
    const post = await db.getBlogPostBySlug(slug, true);
    
    if (!post) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Blog post not found',
        message: `No published post found with slug: ${slug}`,
        timestamp: new Date().toISOString(),
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300', // Cache 404s briefly
        },
      });
    }

    //increment view count for real users (not bots)
    if (!isBot) {
      await db.incrementPostViewCount(post.id);
      post.view_count = (post.view_count || 0) + 1; // Update local copy
    }

    //get related posts asynchronously
    const relatedPostsPromise = db.getRelatedPosts(post.id, 3);
    
    //prepare response data
    const responseData = {
      success: true,
      data: {
        post,
        relatedPosts: await relatedPostsPromise,
      },
      meta: {
        slug,
        viewIncremented: !isBot,
        timestamp: new Date().toISOString(),
        seo: {
          title: post.meta_title || post.title,
          description: post.meta_description || post.excerpt,
          canonicalUrl: post.canonical_url,
          ogImage: post.og_image_url || post.featured_image_url,
          keywords: post.meta_keywords,
          publishedTime: post.published_at,
          modifiedTime: post.updated_at,
          author: post.author_name,
          readingTime: post.reading_time,
          wordCount: post.word_count,
        },
      },
    };

    //generate etag for caching
    const etag = `"post-${post.id}-${post.updated_at}-${post.view_count}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag && isBot) {
      //only return 304 for bots to avoid view count issues
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=600, s-maxage=3600', // 10min browser, 1hr CDN
          'ETag': etag,
        },
      });
    }

    //determine cache headers based on user agent
    const cacheControl = isBot 
      ? 'public, max-age=3600, s-maxage=7200' // Longer cache for bots
      : 'public, max-age=300, s-maxage=1800';  // Shorter cache for users

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': cacheControl,
        'ETag': etag,
        'Vary': 'Accept-Encoding, User-Agent',
        'X-Post-Views': post.view_count?.toString() || '0',
        'X-Reading-Time': post.reading_time?.toString() || '0',
      },
    });

  } catch (error) {
    console.error('Blog post API error:', { slug: params.slug, error });
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch blog post',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
  }
};