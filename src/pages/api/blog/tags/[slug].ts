// =============================================================================
// BLOG TAG API - Blog posts filtered by tag
// GET /api/blog/tags/[slug] - Returns posts with specific tag
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';
import type { QueryOptions } from '@/lib/db/types';

export const GET: APIRoute = async ({ params, url, request }) => {
  try {
    const { slug } = params;
    
    if (!slug || typeof slug !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid or missing tag slug',
        timestamp: new Date().toISOString(),
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const searchParams = new URL(request.url).searchParams;
    
    //extract query options
    const options: QueryOptions = {
      page: Math.max(1, parseInt(searchParams.get('page') || '1')),
      limit: Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10'))),
      sortBy: (searchParams.get('sortBy') as any) || 'published_at',
      sortOrder: (searchParams.get('sortOrder') as 'ASC' | 'DESC') || 'DESC',
    };

    //validate tag exists
    const tags = await db.getBlogTags(true);
    const tag = tags.find(t => t.slug === slug);
    
    if (!tag) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tag not found',
        message: `No tag found with slug: ${slug}`,
        availableTags: tags.slice(0, 20).map(t => ({
          slug: t.slug,
          name: t.name,
          post_count: t.post_count,
        })),
        timestamp: new Date().toISOString(),
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    //get posts with this tag
    const result = await db.getBlogPostsByTag(slug, options);

    //generate etag for caching
    const etag = `"tag-${tag.id}-${options.page}-${result.pagination.total}-${tag.updated_at}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=600, s-maxage=1800',
          'ETag': etag,
        },
      });
    }

    const responseData = {
      success: true,
      data: result.data,
      pagination: result.pagination,
      meta: {
        tag: {
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          description: tag.description,
          color: tag.color,
          post_count: tag.post_count,
        },
        totalPostsWithTag: tag.post_count,
        currentPage: result.pagination.page,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600, s-maxage=1800', // 10min browser, 30min CDN
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Tag-Name': tag.name,
        'X-Tag-Posts': tag.post_count.toString(),
      },
    });

  } catch (error) {
    console.error('Blog tag API error:', { slug: params.slug, error });
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch tag posts',
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