// =============================================================================
// BLOG RSS FEED API - RSS 2.0 compliant feed for blog posts
// GET /api/blog/rss - Returns RSS XML feed of recent blog posts
// =============================================================================

import type { APIRoute } from 'astro';
import { db } from '@/lib/db/queries';
import { ContentProcessor } from '@/lib/content/processor';

export const GET: APIRoute = async ({ url, request }) => {
  try {
    const searchParams = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(5, parseInt(searchParams.get('limit') || '20')));

    //get site settings for RSS metadata
    const siteSettings = await db.getPublicSiteSettings();
    const baseUrl = url.origin;
    
    //get recent posts for RSS
    const posts = await db.getRssFeedPosts(limit);

    if (posts.length === 0) {
      return new Response(generateEmptyRSSFeed(siteSettings, baseUrl), {
        status: 200,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=1800, s-maxage=3600', // 30min browser, 1hr CDN
        },
      });
    }

    //generate RSS feed
    const rssXml = generateRSSFeed(posts, siteSettings, baseUrl);

    //generate etag for caching
    const lastModified = posts[0]?.updated_at || posts[0]?.published_at;
    const etag = `"rss-${posts.length}-${lastModified}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          'Cache-Control': 'public, max-age=1800, s-maxage=3600',
          'ETag': etag,
        },
      });
    }

    return new Response(rssXml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=3600',
        'ETag': etag,
        'Last-Modified': lastModified ? new Date(lastModified).toUTCString() : new Date().toUTCString(),
        'X-Feed-Items': posts.length.toString(),
      },
    });

  } catch (error) {
    console.error('RSS feed API error:', error);
    
    return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>RSS Feed Error</title>
    <description>An error occurred while generating the RSS feed</description>
    <link>${url.origin}</link>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  </channel>
</rss>`, {
      status: 500,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  }
};

function generateRSSFeed(
  posts: any[],
  siteSettings: Record<string, unknown>,
  baseUrl: string
): string {
  const siteName = (siteSettings.site_name as string) || 'Personal Blog';
  const siteDescription = (siteSettings.site_description as string) || 'Latest blog posts';
  const contactEmail = (siteSettings.contact_email as string) || 'contact@example.com';

  const items = posts.map(post => {
    const postUrl = `${baseUrl}/blog/${post.slug}`;
    const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : new Date().toUTCString();
    
    //process content for RSS (convert relative URLs to absolute)
    let description = post.excerpt || ContentProcessor.generateRssExcerpt(post.content);
    description = ContentProcessor.convertToAbsoluteUrls(description, baseUrl);
    
    //sanitize content for XML
    const title = escapeXml(post.title);
    const descriptionXml = escapeXml(description);
    const authorName = escapeXml(post.author_name || 'Author');
    
    //build categories
    const categories = post.categories ? post.categories.map((cat: any) => 
      `<category>${escapeXml(cat.name)}</category>`
    ).join('\n      ') : '';

    return `    <item>
      <title>${title}</title>
      <description><![CDATA[${description}]]></description>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${contactEmail} (${authorName})</author>
      ${categories}
      <source url="${baseUrl}/api/blog/rss">${escapeXml(siteName)}</source>
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <description>${escapeXml(siteDescription)}</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/api/blog/rss" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <managingEditor>${contactEmail}</managingEditor>
    <webMaster>${contactEmail}</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Ultra-Fast Personal Website</generator>
    <ttl>1800</ttl>
${items}
  </channel>
</rss>`;
}

function generateEmptyRSSFeed(
  siteSettings: Record<string, unknown>,
  baseUrl: string
): string {
  const siteName = (siteSettings.site_name as string) || 'Personal Blog';
  const siteDescription = (siteSettings.site_description as string) || 'Latest blog posts';
  const contactEmail = (siteSettings.contact_email as string) || 'contact@example.com';

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <description>${escapeXml(siteDescription)}</description>
    <link>${baseUrl}</link>
    <atom:link href="${baseUrl}/api/blog/rss" rel="self" type="application/rss+xml"/>
    <language>en-us</language>
    <managingEditor>${contactEmail}</managingEditor>
    <webMaster>${contactEmail}</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>Ultra-Fast Personal Website</generator>
    <ttl>1800</ttl>
  </channel>
</rss>`;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}