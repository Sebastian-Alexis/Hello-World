//main middleware entry point with security-first approach
import { defineMiddleware } from 'astro:middleware';
import { securityHeadersMiddleware } from './security-headers.js';
import { rateLimitMiddleware } from './rate-limiting.js';
import { authMiddleware } from './auth.js';
import { validationMiddleware } from './validation.js';
import { loggingMiddleware } from './logging.js';

//compose middleware chain with security first
export const onRequest = defineMiddleware(async (context, next) => {
  //skip middleware for static pages during build - only run for API routes and in development
  const isApiRoute = context.url.pathname.startsWith('/api/');
  const isDevelopment = import.meta.env.MODE === 'development';
  
  if (isDevelopment || isApiRoute) {
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
    
    //input validation for api routes
    if (context.url.pathname.startsWith('/api/')) {
      const validationResult = await validationMiddleware(context, next);
      if (!validationResult.valid) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Validation failed',
          message: validationResult.error
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    //authentication for protected routes
    if (context.url.pathname.startsWith('/admin/') || 
        context.url.pathname.startsWith('/api/auth/me') ||
        context.url.pathname.includes('protected')) {
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