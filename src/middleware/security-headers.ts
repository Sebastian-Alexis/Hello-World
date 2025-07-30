//comprehensive security headers middleware with strict csp
import type { MiddlewareNext } from 'astro:middleware';
import type { APIContext } from 'astro';

//security configuration with defense-in-depth approach
const SECURITY_CONFIG = {
  //content security policy with strict nonce-based approach
  CSP: {
    //generate secure nonce for each request
    generateNonce: () => {
      const array = new Uint8Array(16);
      crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },
    
    //strict csp directives
    getDirectives: (nonce: string, isDev: boolean = false) => {
      const baseDirectives = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "upgrade-insecure-requests",
        `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`, //unsafe-inline needed for astro
        "img-src 'self' data: https:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "media-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'"
      ];
      
      //relaxed directives for development
      if (isDev) {
        return baseDirectives.map(directive => {
          if (directive.startsWith('script-src')) {
            return `script-src 'self' 'unsafe-eval' 'unsafe-inline' 'nonce-${nonce}'`;
          }
          if (directive.startsWith('connect-src')) {
            return "connect-src 'self' ws: wss:"; //allow websockets for hmr
          }
          return directive;
        });
      }
      
      return baseDirectives;
    }
  },
  
  //security headers configuration
  HEADERS: {
    //strict transport security - 2 years with preload
    HSTS: 'max-age=63072000; includeSubDomains; preload',
    
    //prevent mime type sniffing
    X_CONTENT_TYPE_OPTIONS: 'nosniff',
    
    //prevent clickjacking
    X_FRAME_OPTIONS: 'DENY',
    
    //xss protection (legacy but still useful)
    X_XSS_PROTECTION: '1; mode=block',
    
    //referrer policy for privacy
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    
    //permissions policy (restrictive by default)
    PERMISSIONS_POLICY: [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()'
    ].join(', ')
  }
};

//determine if running in development mode
function isDevelopment(): boolean {
  return import.meta.env.DEV || process.env.NODE_ENV === 'development';
}

//apply comprehensive security headers
export async function securityHeadersMiddleware(
  context: APIContext,
  next: MiddlewareNext
) {
  const response = await next();
  const isDev = isDevelopment();
  
  //generate unique nonce for this request
  const nonce = SECURITY_CONFIG.CSP.generateNonce();
  
  //store nonce in locals for use in templates
  context.locals.nonce = nonce;
  
  //build csp header
  const cspDirectives = SECURITY_CONFIG.CSP.getDirectives(nonce, isDev);
  const cspHeader = cspDirectives.join('; ');
  
  //apply security headers
  const headers = new Headers(response.headers);
  
  //content security policy
  headers.set('Content-Security-Policy', cspHeader);
  
  //only set hsts for https connections in production
  if (!isDev && context.url.protocol === 'https:') {
    headers.set('Strict-Transport-Security', SECURITY_CONFIG.HEADERS.HSTS);
  }
  
  //security headers that apply to all environments
  headers.set('X-Content-Type-Options', SECURITY_CONFIG.HEADERS.X_CONTENT_TYPE_OPTIONS);
  headers.set('X-Frame-Options', SECURITY_CONFIG.HEADERS.X_FRAME_OPTIONS);
  headers.set('X-XSS-Protection', SECURITY_CONFIG.HEADERS.X_XSS_PROTECTION);
  headers.set('Referrer-Policy', SECURITY_CONFIG.HEADERS.REFERRER_POLICY);
  headers.set('Permissions-Policy', SECURITY_CONFIG.HEADERS.PERMISSIONS_POLICY);
  
  //remove server identification headers
  headers.delete('Server');
  headers.delete('X-Powered-By');
  
  //set secure cache headers for sensitive content
  if (context.url.pathname.startsWith('/admin/') || 
      context.url.pathname.startsWith('/api/auth/')) {
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
  }
  
  //add security headers for api responses
  if (context.url.pathname.startsWith('/api/')) {
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('X-Frame-Options', 'DENY');
    
    //cors headers for api (restrictive by default)
    if (context.request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Access-Control-Max-Age', '86400'); //24 hours
      
      //only allow same origin by default
      const origin = context.request.headers.get('Origin');
      if (origin && new URL(origin).origin === context.url.origin) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Allow-Credentials', 'true');
      }
    }
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

//helper to get nonce from context for use in templates
export function getNonce(context: APIContext): string {
  return context.locals.nonce || '';
}

//validate csp compliance (for testing)
export function validateCSPCompliance(content: string, nonce: string): {
  compliant: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  
  //check for inline scripts without nonce
  const inlineScriptRegex = /<script(?![^>]*nonce=)[^>]*>[\s\S]*?<\/script>/gi;
  const inlineScripts = content.match(inlineScriptRegex);
  if (inlineScripts) {
    violations.push(`Found ${inlineScripts.length} inline script(s) without nonce`);
  }
  
  //check for event handlers
  const eventHandlerRegex = /on\w+\s*=\s*["'][^"']*["']/gi;
  const eventHandlers = content.match(eventHandlerRegex);
  if (eventHandlers) {
    violations.push(`Found ${eventHandlers.length} inline event handler(s)`);
  }
  
  //check for javascript: urls
  const jsUrlRegex = /href\s*=\s*["']javascript:[^"']*["']/gi;
  const jsUrls = content.match(jsUrlRegex);
  if (jsUrls) {
    violations.push(`Found ${jsUrls.length} javascript: URL(s)`);
  }
  
  return {
    compliant: violations.length === 0,
    violations
  };
}