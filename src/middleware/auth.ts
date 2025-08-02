//authentication middleware with session management
import type { MiddlewareNext } from 'astro:middleware';
import type { APIContext } from 'astro';
import { verifyToken, extractTokenFromHeader, type TokenPayload } from '../lib/auth/jwt.js';
import { getSession, isSessionValid } from '../lib/auth/session.js';

//authentication result interface
interface AuthResult {
  authenticated: boolean;
  user?: TokenPayload;
  session?: any;
  error?: string;
}

//protected route patterns
const PROTECTED_PATTERNS = [
  '/admin/',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/admin/',
  '/protected/',
];

//routes that require specific roles
const ROLE_PROTECTED_ROUTES: Record<string, string[]> = {
  '/admin/users/': ['admin'],
  '/api/admin/': ['admin', 'editor'],
  '/admin/settings/': ['admin'],
};

//check if route requires authentication
function requiresAuth(pathname: string): boolean {
  return PROTECTED_PATTERNS.some(pattern => pathname.startsWith(pattern));
}

//check if route requires specific role
function getRequiredRoles(pathname: string): string[] | null {
  for (const [pattern, roles] of Object.entries(ROLE_PROTECTED_ROUTES)) {
    if (pathname.startsWith(pattern)) {
      return roles;
    }
  }
  return null;
}

//extract authentication token from request
function extractAuthToken(request: Request): string | null {
  //check authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    return extractTokenFromHeader(authHeader);
  }
  
  //check for token in cookie (for web sessions)
  const cookies = request.headers.get('Cookie');
  if (cookies) {
    // Check for auth-token first (legacy)
    let match = cookies.match(/(?:^|; )auth-token=([^;]*)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
    
    // Check for session cookie (new format)
    match = cookies.match(/(?:^|; )session=([^;]*)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }
  }
  
  return null;
}

//validate user role against required roles
function hasRequiredRole(userRole: string, requiredRoles: string[]): boolean {
  //role hierarchy
  const roleHierarchy: Record<string, number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
  };
  
  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = Math.max(...requiredRoles.map(role => roleHierarchy[role] || 0));
  
  return userLevel >= requiredLevel;
}

//main authentication middleware
export async function authMiddleware(
  context: APIContext,
  next: MiddlewareNext
): Promise<AuthResult> {
  const pathname = context.url.pathname;
  
  //skip auth for non-protected routes
  if (!requiresAuth(pathname)) {
    return { authenticated: true };
  }
  
  try {
    //extract token from request
    const token = extractAuthToken(context.request);
    if (!token) {
      return {
        authenticated: false,
        error: 'No authentication token provided'
      };
    }
    
    //verify jwt token
    let tokenPayload: TokenPayload;
    try {
      tokenPayload = await verifyToken(token);
    } catch (error) {
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : 'Invalid token'
      };
    }
    
    //verify session if sessionId is present
    if (tokenPayload.sessionId) {
      const session = await getSession(tokenPayload.sessionId);
      if (!session || !isSessionValid(session)) {
        return {
          authenticated: false,
          error: 'Invalid or expired session'
        };
      }
      
      //check if session belongs to the user
      if (session.userId !== tokenPayload.userId) {
        return {
          authenticated: false,
          error: 'Session user mismatch'
        };
      }
      
      //store session in context
      context.locals.session = session;
    }
    
    //check role-based access
    const requiredRoles = getRequiredRoles(pathname);
    if (requiredRoles && !hasRequiredRole(tokenPayload.role, requiredRoles)) {
      return {
        authenticated: false,
        error: 'Insufficient permissions'
      };
    }
    
    //store user info in context for use in routes
    context.locals.user = tokenPayload;
    context.locals.authenticated = true;
    
    return {
      authenticated: true,
      user: tokenPayload,
      session: context.locals.session
    };
    
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return {
      authenticated: false,
      error: 'Authentication failed'
    };
  }
}

//middleware for optional authentication (adds user info if available)
export async function optionalAuthMiddleware(
  context: APIContext,
  next: MiddlewareNext
): Promise<void> {
  try {
    const token = extractAuthToken(context.request);
    if (token) {
      try {
        const tokenPayload = await verifyToken(token);
        
        //verify session if present
        if (tokenPayload.sessionId) {
          const session = await getSession(tokenPayload.sessionId);
          if (session && isSessionValid(session) && session.userId === tokenPayload.userId) {
            context.locals.session = session;
          }
        }
        
        context.locals.user = tokenPayload;
        context.locals.authenticated = true;
      } catch (error) {
        //ignore token errors for optional auth
        context.locals.authenticated = false;
      }
    } else {
      context.locals.authenticated = false;
    }
  } catch (error) {
    //ignore errors for optional auth
    context.locals.authenticated = false;
  }
}

//check if current user has specific permission
export function hasPermission(context: APIContext, requiredRoles: string[]): boolean {
  const user = context.locals.user as TokenPayload;
  if (!user) return false;
  
  return hasRequiredRole(user.role, requiredRoles);
}

//get current authenticated user
export function getCurrentUser(context: APIContext): TokenPayload | null {
  return context.locals.user || null;
}

//check if user is authenticated
export function isAuthenticated(context: APIContext): boolean {
  return !!context.locals.authenticated;
}

//logout helper (clears context)
export function clearAuthContext(context: APIContext): void {
  delete context.locals.user;
  delete context.locals.session;
  context.locals.authenticated = false;
}

//create secure auth cookie
export function createAuthCookie(token: string, maxAge: number = 7 * 24 * 60 * 60): string {
  const secure = !import.meta.env.DEV; //secure in production
  const sameSite = 'strict';
  
  const cookieOptions = [
    `auth-token=${encodeURIComponent(token)}`,
    `Max-Age=${maxAge}`,
    'HttpOnly',
    'Path=/',
    `SameSite=${sameSite}`
  ];
  
  if (secure) {
    cookieOptions.push('Secure');
  }
  
  return cookieOptions.join('; ');
}

//create logout cookie (expires immediately)
export function createLogoutCookie(): string {
  const secure = !import.meta.env.DEV;
  
  const cookieOptions = [
    'auth-token=',
    'Max-Age=0',
    'HttpOnly',
    'Path=/',
    'SameSite=strict'
  ];
  
  if (secure) {
    cookieOptions.push('Secure');
  }
  
  return cookieOptions.join('; ');
}

//audit log helper for security events
export function logSecurityEvent(
  context: APIContext,
  event: string,
  details?: Record<string, any>
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    ip: context.clientAddress,
    userAgent: context.request.headers.get('User-Agent'),
    path: context.url.pathname,
    method: context.request.method,
    user: context.locals.user?.userId || 'anonymous',
    details
  };
  
  //in production, send to logging service
  console.log('Security Event:', JSON.stringify(logEntry));
}