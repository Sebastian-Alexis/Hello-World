// =============================================================================
// BLOG TAGS API - List all blog tags with post counts
// GET /api/blog/tags - Returns all active blog tags
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    
    //extract parameters
    const includeEmpty = searchParams.get('includeEmpty') === 'true';
    const sortBy = searchParams.get('sortBy') || 'post_count'; // 'name', 'post_count', 'created_at'
    const sortOrder = (searchParams.get('sortOrder')?.toUpperCase() as 'ASC' | 'DESC') || 'DESC';
    const limit = searchParams.get('limit') ? Math.min(200, Math.max(1, parseInt(searchParams.get('limit')!))) : undefined;
    const minPosts = Math.max(0, parseInt(searchParams.get('minPosts') || '0'));

    //get tags
    const allTags = await db.getBlogTags(!includeEmpty); // getBlogTags(true) filters out empty tags
    
    //additional filtering
    let tags = allTags.filter(tag => tag.post_count >= minPosts);

    //sort tags
    tags.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'post_count':
          comparison = a.post_count - b.post_count;
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        default:
          comparison = a.post_count - b.post_count;
      }
      
      return sortOrder === 'DESC' ? -comparison : comparison;
    });

    //apply limit if specified
    if (limit) {
      tags = tags.slice(0, limit);
    }

    //calculate statistics
    const totalTags = allTags.length;
    const activeTags = allTags.filter(tag => tag.post_count > 0).length;
    const totalPosts = allTags.reduce((sum, tag) => sum + tag.post_count, 0);
    const mostPopular = allTags.length > 0 
      ? allTags.reduce((max, tag) => tag.post_count > max.post_count ? tag : max)
      : null;

    //create tag cloud data (for visualization)
    const tagCloudData = tags.slice(0, 50).map(tag => ({
      name: tag.name,
      slug: tag.slug,
      count: tag.post_count,
      size: Math.min(3, Math.max(1, Math.log(tag.post_count + 1) * 0.5)), // Logarithmic scaling
      color: tag.color || generateTagColor(tag.name),
    }));

    //generate etag for caching
    const etag = `"tags-${totalTags}-${totalPosts}-${minPosts}-${limit || 'all'}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30min browser, 1hr CDN
          'ETag': etag,
        },
      });
    }

    const responseData = {
      success: true,
      data: tags.map(tag => ({
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description,
        color: tag.color || generateTagColor(tag.name),
        post_count: tag.post_count,
        is_active: tag.is_active,
        created_at: tag.created_at,
        updated_at: tag.updated_at,
      })),
      meta: {
        statistics: {
          totalTags,
          activeTags,
          totalPosts,
          averagePostsPerTag: activeTags > 0 ? Math.round(totalPosts / activeTags) : 0,
          mostPopular: mostPopular ? {
            name: mostPopular.name,
            slug: mostPopular.slug,
            post_count: mostPopular.post_count,
          } : null,
        },
        filters: {
          includeEmpty,
          sortBy,
          sortOrder,
          limit: limit || 'none',
          minPosts,
          applied: tags.length,
        },
        tagCloud: tagCloudData,
        timestamp: new Date().toISOString(),
      },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30min browser, 1hr CDN
        'ETag': etag,
        'Vary': 'Accept-Encoding',
        'X-Total-Tags': totalTags.toString(),
        'X-Active-Tags': activeTags.toString(),
      },
    });

  } catch (error) {
    console.error('Blog tags API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch blog tags',
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

//generates a consistent color for a tag based on its name
function generateTagColor(name: string): string {
  const colors = [
    '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
    '#EC4899', '#6B7280', '#84CC16', '#F97316', '#06B6D4',
    '#8B5A2B', '#DC2626', '#059669', '#D97706', '#7C3AED',
  ];
  
  //simple hash function to get consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}