//admin API endpoint to run blog slug migration
//accessible only by admin users for security

import type { APIRoute } from 'astro';
import { checkAndFixBlogSlugs, validateExistingSlugs, quickSlugCheck } from '../../../fix-blog-slugs';

export const POST: APIRoute = async ({ request }) => {
  try {
    //basic auth check - in production, this should verify admin JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized - Admin access required',
        timestamp: new Date().toISOString(),
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const action = new URL(request.url).searchParams.get('action') || 'check';
    
    if (action === 'check') {
      //just check for issues without fixing
      const healthCheck = await quickSlugCheck();
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          action: 'check',
          hasIssues: healthCheck.hasIssues,
          missingCount: healthCheck.missingCount,
          duplicateCount: healthCheck.duplicateCount,
          message: healthCheck.hasIssues 
            ? `Found ${healthCheck.missingCount} posts with missing slugs and ${healthCheck.duplicateCount} duplicate slugs`
            : 'All blog posts have valid slugs'
        },
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (action === 'fix') {
      //run the actual migration
      console.log('🚀 Starting blog slug migration via API...');
      
      const { fixed, remaining } = await checkAndFixBlogSlugs();
      const validationPassed = await validateExistingSlugs();
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          action: 'fix',
          postsFixed: fixed,
          postsRemaining: remaining,
          validationPassed,
          message: fixed > 0 
            ? `Successfully fixed ${fixed} blog posts. ${remaining} posts may need manual attention.`
            : 'No blog posts needed slug fixes.'
        },
        timestamp: new Date().toISOString(),
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action. Use ?action=check or ?action=fix',
      timestamp: new Date().toISOString(),
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Slug migration API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Migration failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const GET: APIRoute = async ({ request }) => {
  try {
    //simple health check for slug issues
    const healthCheck = await quickSlugCheck();
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        healthy: !healthCheck.hasIssues,
        issues: {
          missingCount: healthCheck.missingCount,
          duplicateCount: healthCheck.duplicateCount,
        },
        message: healthCheck.hasIssues 
          ? 'Blog slug issues detected'
          : 'All blog slugs are healthy',
        endpoints: {
          check: '/api/admin/migrate-slugs?action=check',
          fix: '/api/admin/migrate-slugs?action=fix (POST only)',
        }
      },
      timestamp: new Date().toISOString(),
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
    });
    
  } catch (error) {
    console.error('Slug health check API error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Health check failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};