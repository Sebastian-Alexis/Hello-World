// =============================================================================
// BLOG POPULAR POSTS API - Most viewed posts within time period
// GET /api/blog/popular - Returns popular blog posts based on view count
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    
    //extract parameters
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10')));
    const days = Math.min(365, Math.max(1, parseInt(searchParams.get('days') || '30')));
    const includeFeatured = searchParams.get('includeFeatured') !== 'false';
    const minViews = Math.max(0, parseInt(searchParams.get('minViews') || '0'));

    //get popular posts
    const posts = await db.getPopularBlogPosts(limit, days);

    //optionally filter by minimum views
    const filteredPosts = minViews > 0 
      ? posts.filter(post => (post.view_count || 0) >= minViews)
      : posts;

    //get featured posts if requested and we have space
    let featuredPosts = [];
    if (includeFeatured && filteredPosts.length < limit) {
      const remainingSlots = limit - filteredPosts.length;
      featuredPosts = await db.getFeaturedBlogPosts(remainingSlots);
      
      //remove any duplicates with popular posts
      const popularIds = new Set(filteredPosts.map(p => p.id));
      featuredPosts = featuredPosts.filter(p => !popularIds.has(p.id));
    }

    //combine and limit results
    const combinedPosts = [...filteredPosts, ...featuredPosts].slice(0, limit);

    //calculate popularity metrics
    const totalViews = combinedPosts.reduce((sum, post) => sum + (post.view_count || 0), 0);
    const averageViews = combinedPosts.length > 0 ? Math.round(totalViews / combinedPosts.length) : 0;
    const mostPopular = combinedPosts.length > 0 ? combinedPosts[0] : null;

    //generate etag for caching
    const etag = `"popular-${days}-${limit}-${combinedPosts.length}-${totalViews}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=900, s-maxage=1800', // 15min browser, 30min CDN
          'ETag': etag,
        },
      });
    }

    const responseData = {
      success: true,
      data: combinedPosts,
      meta: {
        period: {
          days,
          periodStart: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          periodEnd: new Date().toISOString(),
        },
        statistics: {
          totalPosts: combinedPosts.length,
          totalViews,
          averageViews,
          minViews,
          mostPopular: mostPopular ? {
            title: mostPopular.title,
            slug: mostPopular.slug,
            views: mostPopular.view_count,
          } : null,
        },
        filters: {
          limit,
          days,
          includeFeatured,
          minViews,
        },
        composition: {
          popularPosts: filteredPosts.length,
          featuredPosts: featuredPosts.length,
        },
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900, s-maxage=1800', // 15min browser, 30min CDN
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Popular-Posts': filteredPosts.length.toString(),
        'X-Featured-Posts': featuredPosts.length.toString(),
        'X-Total-Views': totalViews.toString(),
      },
    });

  } catch (error) {
    console.error('Popular posts API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch popular posts',
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