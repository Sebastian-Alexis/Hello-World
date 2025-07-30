// =============================================================================
// BLOG ARCHIVE API - Blog posts grouped by month/year
// GET /api/blog/archive - Returns blog archive data with post counts
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    
    //check if specific year/month is requested
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const includePosts = searchParams.get('includePosts') === 'true';

    if (year && month) {
      //get posts for specific month
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);
      
      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid year or month parameter',
          message: 'Year must be a valid year and month must be 1-12',
          timestamp: new Date().toISOString(),
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      //get start and end dates for the month
      const startDate = new Date(yearNum, monthNum - 1, 1).toISOString();
      const endDate = new Date(yearNum, monthNum, 0, 23, 59, 59).toISOString();

      const posts = await db.getBlogPosts({
        page: 1,
        limit: 100, // Reasonable limit for monthly posts
        sortBy: 'published_at',
        sortOrder: 'DESC',
        includeAuthor: true,
        includeCategories: true,
        includeTags: false, // Keep response smaller
      });

      //filter posts by date (could be done in query but this is simpler)
      const filteredPosts = posts.data.filter(post => 
        post.published_at && 
        post.published_at >= startDate && 
        post.published_at <= endDate
      );

      return new Response(JSON.stringify({
        success: true,
        data: {
          year: yearNum,
          month: monthNum,
          month_name: new Date(yearNum, monthNum - 1).toLocaleString('en-US', { month: 'long' }),
          post_count: filteredPosts.length,
          posts: filteredPosts,
        },
        meta: {
          type: 'monthly_archive',
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30min browser, 1hr CDN
          'Vary': 'Accept-Encoding',
        },
      });
    }

    //get full archive data
    const archive = await db.getBlogArchive();

    //optionally include posts for each archive entry (expensive)
    if (includePosts && archive.length <= 24) { // Only for last 2 years worth
      const archiveWithPosts = await Promise.all(
        archive.map(async (entry) => {
          const startDate = new Date(entry.year, entry.month - 1, 1).toISOString();
          const endDate = new Date(entry.year, entry.month, 0, 23, 59, 59).toISOString();
          
          const posts = await db.getBlogPosts({
            page: 1,
            limit: 20, // Limit to prevent huge responses
            sortBy: 'published_at',
            sortOrder: 'DESC',
            includeAuthor: false, // Keep it light
            includeCategories: false,
            includeTags: false,
          });

          const filteredPosts = posts.data.filter(post => 
            post.published_at && 
            post.published_at >= startDate && 
            post.published_at <= endDate
          );

          return {
            ...entry,
            posts: filteredPosts,
          };
        })
      );

      return new Response(JSON.stringify({
        success: true,
        data: archiveWithPosts,
        meta: {
          type: 'full_archive_with_posts',
          totalEntries: archive.length,
          includesPosts: true,
          postsLimitPerEntry: 20,
          timestamp: new Date().toISOString(),
        },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600, s-maxage=7200', // 1hr browser, 2hr CDN
          'Vary': 'Accept-Encoding',
        },
      });
    }

    //generate etag for caching
    const totalPosts = archive.reduce((sum, entry) => sum + entry.post_count, 0);
    const etag = `"archive-${archive.length}-${totalPosts}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=7200',
          'ETag': etag,
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: archive,
      meta: {
        type: 'archive_summary',
        totalEntries: archive.length,
        totalPosts: totalPosts,
        oldestPost: archive.length > 0 ? `${archive[archive.length - 1].year}-${archive[archive.length - 1].month.toString().padStart(2, '0')}` : null,
        newestPost: archive.length > 0 ? `${archive[0].year}-${archive[0].month.toString().padStart(2, '0')}` : null,
        includesPosts: false,
        timestamp: new Date().toISOString(),
      },
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600, s-maxage=7200', // 1hr browser, 2hr CDN
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Archive-Entries': archive.length.toString(),
        'X-Total-Posts': totalPosts.toString(),
      },
    });

  } catch (error) {
    console.error('Blog archive API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch blog archive',
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