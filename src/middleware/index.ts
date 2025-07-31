//main middleware entry point with security-first approach
import { defineMiddleware } from 'astro:middleware';
import { securityHeadersMiddleware } from './security-headers.js';
import { rateLimitMiddleware } from './rate-limiting.js';
import { authMiddleware } from './auth.js';
import { validationMiddleware } from './validation.js';
import { loggingMiddleware } from './logging.js';

//compose middleware chain with security first
export const onRequest = defineMiddleware(async (context, next) => {
  //only run middleware for API routes (server-rendered endpoints)
  //exclude login endpoint to avoid body consumption conflicts
  const isApiRoute = context.url.pathname.startsWith('/api/');
  const isLoginRoute = context.url.pathname === '/api/auth/login';
  
  if (isApiRoute && !isLoginRoute) {
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
    
    //note: input validation is handled within individual API routes
    //to avoid consuming the request body before the endpoint can process it
    
    //authentication for protected routes (excluding login endpoint)
    if ((context.url.pathname.startsWith('/admin/') || 
        context.url.pathname.startsWith('/api/auth/me') ||
        context.url.pathname.includes('protected')) &&
        !context.url.pathname.startsWith('/api/auth/login')) {
      const authResult = await authMiddleware(context, next);
      if (!authResult.authenticated) {
        if (context.url.pathname.startsWith('/api/')) {
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
  }
  
  return next();
});