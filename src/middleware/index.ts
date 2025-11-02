//main middleware entry point with security-first approach
import { defineMiddleware } from 'astro:middleware';
import { securityHeadersMiddleware } from './security-headers.js';
import { rateLimitMiddleware } from './rate-limiting.js';
import { authMiddleware } from './auth.js';
import { validationMiddleware } from './validation.js';
import { loggingMiddleware } from './logging.js';

//compose middleware chain with security first
export const onRequest = defineMiddleware(async (context, next) => {
  const pathname = context.url.pathname;

  //identify route types
  const isApiRoute = pathname.startsWith('/api/');
  const isAdminRoute = pathname.startsWith('/admin/');
  const isProtectedRoute = isAdminRoute || pathname.startsWith('/protected/');

  //exclude certain endpoints to avoid body consumption conflicts
  const excludedPaths = [
    '/api/auth/login',
    '/api/admin/media/upload',
    '/api/admin/blog',
    '/api/admin/blog-simple',
    '/api/flights/trips',
    '/api/flights/fetch',
    '/api/airports/lookup'
  ];
  const isExcludedRoute = excludedPaths.some(path => pathname.includes(path));

  //public paths that don't require authentication
  const publicPaths = [
    '/admin/login'
  ];
  const isPublicPath = publicPaths.some(path => pathname === path || pathname.startsWith(path));

  //apply security middleware for API routes
  if (isApiRoute && !isExcludedRoute) {
    //security headers must be applied first
    await securityHeadersMiddleware(context, next);

    //rate limiting to prevent abuse
    const rateLimitResult = await rateLimitMiddleware(context, next);
    if (!rateLimitResult.allowed) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter?.toString() || '60'
        }
      });
    }

    //request logging for security monitoring
    await loggingMiddleware(context, next);
  }

  //authentication for protected routes (both API and page routes)
  if ((isProtectedRoute || pathname.startsWith('/api/auth/me')) && !isPublicPath) {
    const authResult = await authMiddleware(context, next);
    if (!authResult.authenticated) {
      if (isApiRoute) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Authentication required'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      //redirect to login for web routes
      return context.redirect('/admin/login');
    }
  }

  return next();
});