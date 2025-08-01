import type { APIRoute } from 'astro';
import { getDbClient } from '../../../lib/db/connection';

export const GET: APIRoute = async () => {
  try {
    const client = getDbClient();
    
    //check all blog posts and their slugs
    const result = await client.execute(`
      SELECT id, title, slug, status, published_at 
      FROM blog_posts 
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    const posts = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      published_at: row.published_at,
      hasSlug: !!row.slug,
      slugValue: row.slug || 'NULL',
      slugType: typeof row.slug,
      willRedirect: !row.slug
    }));
    
    //check for posts without slugs
    const nullSlugResult = await client.execute(`
      SELECT COUNT(*) as count 
      FROM blog_posts 
      WHERE slug IS NULL OR slug = ''
    `);
    
    const publishedWithoutSlug = await client.execute(`
      SELECT COUNT(*) as count 
      FROM blog_posts 
      WHERE status = 'published' AND (slug IS NULL OR slug = '')
    `);
    
    return new Response(JSON.stringify({
      totalPosts: posts.length,
      posts: posts,
      statistics: {
        postsWithoutSlug: Number(nullSlugResult.rows[0].count),
        publishedPostsWithoutSlug: Number(publishedWithoutSlug.rows[0].count)
      },
      analysis: {
        hasSlugIssue: posts.some(p => !p.slug),
        publishedWithoutSlug: posts.filter(p => p.status === 'published' && !p.slug)
      }
    }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Database query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};