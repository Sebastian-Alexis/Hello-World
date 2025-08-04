import { verifyToken, extractTokenFromHeader, type TokenPayload } from './jwt.js';
import { extractSessionFromCookie } from './session.js';
import { getEnv } from '../env/index.js';
import type { User } from '../db/types.js';

//rate limiting configuration
interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

//rate limit store interface
interface RateLimitStore {
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  set(key: string, value: { count: number; resetTime: number }): Promise<void>;
  increment(key: string): Promise<{ count: number; resetTime: number }>;
}

//in-memory rate limit store (use redis in production)
class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  async get(key: string) {
    const entry = this.store.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.resetTime) {
      this.store.delete(key);
      return null;
    }
    
    return entry;
  }
  
  async set(key: string, value: { count: number; resetTime: number }) {
    this.store.set(key, value);
  }
  
  async increment(key: string) {
    const existing = await this.get(key);
    const env = getEnv();
    const windowMs = env.RATE_LIMIT_WINDOW * 60 * 1000; //convert minutes to ms
    
    if (!existing) {
      const entry = { count: 1, resetTime: Date.now() + windowMs };
      await this.set(key, entry);
      return entry;
    }
    
    existing.count++;
    await this.set(key, existing);
    return existing;
  }
}

//default rate limit store
const defaultRateLimitStore = new MemoryRateLimitStore();

//security headers configuration
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
} as const;

//csp configuration
export function getCSPHeader(nonce?: string): string {
  const env = getEnv();
  const isDev = env.NODE_ENV === 'development';
  
  const directives = [
    "default-src 'self'",
    "script-src 'self'" + (nonce ? ` 'nonce-${nonce}'` : '') + (isDev ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self'" + (isDev ? ' ws: wss:' : ''),
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ];
  
  return `Content-Security-Policy: ${directives.join('; ')}`;
}

//cors configuration
export interface CORSConfig {
  origin: string | string[] | boolean;
  methods: string[];
  allowedHeaders: string[];
  credentials: boolean;
  maxAge?: number;
}

export const DEFAULT_CORS_CONFIG: CORSConfig = {
  origin: false, //disable by default
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400, //24 hours
};

//middleware result interface
interface MiddlewareResult {
  success: boolean;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
  user?: TokenPayload;
}

//request context interface
interface RequestContext {
  url: URL;
  method: string;
  headers: Headers;
  ip?: string;
  userAgent?: string;
}

//creates request context from various request objects
export function createRequestContext(request: Request): RequestContext {
  return {
    url: new URL(request.url),
    method: request.method,
    headers: request.headers,
    ip: request.headers.get('CF-Connecting-IP') || 
        request.headers.get('X-Forwarded-For') || 
        'unknown',
    userAgent: request.headers.get('User-Agent') || 'unknown',
  };
}

//authentication middleware
export async function authMiddleware(
  request: Request,
  options: {
    required?: boolean;
    roles?: User['role'][];
  } = {}
): Promise<MiddlewareResult> {
  const { required = true, roles } = options;
  
  try {
    //extract token from header or cookie
    const authHeader = request.headers.get('Authorization');
    const cookieHeader = request.headers.get('Cookie');
    const token = extractTokenFromHeader(authHeader) || 
                  extractSessionFromCookie(cookieHeader);
    
    
    if (!token) {
      return required 
        ? { success: false, error: 'Authentication required', status: 401 }
        : { success: true };
    }
    
    let payload: TokenPayload;
    
    //check if token is JWT (starts with eyJ) or session ID
    if (token.startsWith('eyJ')) {
      //verify JWT token
      payload = await verifyToken(token);
    } else {
      //validate session ID
      const { executeQuery } = await import('../db/index.js');
      
      //query session from database
      const sessionResult = await executeQuery<{
        id: string;
        user_id: number;
        expires_at: string;
        created_at: string;
      }>(
        'SELECT * FROM user_sessions WHERE id = ? AND expires_at > datetime("now")',
        [token]
      );
      
      if (!sessionResult.rows || sessionResult.rows.length === 0) {
        return { success: false, error: 'Invalid or expired session', status: 401 };
      }
      
      //query user data
      const userResult = await executeQuery<User>(
        'SELECT * FROM users WHERE id = ? AND is_active = 1',
        [sessionResult.rows[0].user_id]
      );
      
      if (!userResult.rows || userResult.rows.length === 0) {
        return { success: false, error: 'User not found', status: 401 };
      }
      
      const user = userResult.rows[0];
      
      //create TokenPayload-like object from session data
      payload = {
        userId: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        sessionId: token,
        type: 'access' as const,
        iat: new Date(sessionResult.rows[0].created_at).getTime() / 1000,
        exp: new Date(sessionResult.rows[0].expires_at).getTime() / 1000,
      };
    }
    
    //check role permissions
    if (roles && roles.length > 0) {
      const roleHierarchy: Record<User['role'], number> = {
        viewer: 1,
        editor: 2,
        admin: 3,
      };
      
      const userLevel = roleHierarchy[payload.role];
      const minRequiredLevel = Math.min(...roles.map(role => roleHierarchy[role]));
      
      if (userLevel < minRequiredLevel) {
        return { success: false, error: 'Insufficient permissions', status: 403 };
      }
    }
    
    return { success: true, user: payload };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    return { success: false, error: message, status: 401 };
  }
}

//rate limiting middleware
export async function rateLimitMiddleware(
  request: Request,
  config: Partial<RateLimitConfig> = {},
  store: RateLimitStore = defaultRateLimitStore
): Promise<MiddlewareResult> {
  const env = getEnv();
  const fullConfig: RateLimitConfig = {
    windowMs: (config.windowMs || env.RATE_LIMIT_WINDOW) * 60 * 1000,
    maxRequests: config.maxRequests || env.RATE_LIMIT_MAX_REQUESTS,
    keyGenerator: config.keyGenerator || ((req: Request) => {
      const context = createRequestContext(req);
      return context.ip || 'unknown';
    }),
    ...config,
  };
  
  try {
    const key = fullConfig.keyGenerator!(request);
    const { count, resetTime } = await store.increment(key);
    
    const headers = {
      'X-RateLimit-Limit': fullConfig.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, fullConfig.maxRequests - count).toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    };
    
    if (count > fullConfig.maxRequests) {
      return {
        success: false,
        error: 'Rate limit exceeded',
        status: 429,
        headers: {
          ...headers,
          'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
        },
      };
    }
    
    return { success: true, headers };
  } catch (error) {
    //fail open - don't block requests if rate limiting fails
    console.error('Rate limiting error:', error);
    return { success: true };
  }
}

//csrf protection middleware
export async function csrfMiddleware(
  request: Request,
  options: {
    ignoreMethods?: string[];
    headerName?: string;
    cookieName?: string;
  } = {}
): Promise<MiddlewareResult> {
  const {
    ignoreMethods = ['GET', 'HEAD', 'OPTIONS'],
    headerName = 'X-CSRF-Token',
    cookieName = 'csrf_token',
  } = options;
  
  const method = request.method.toUpperCase();
  
  //skip csrf check for safe methods
  if (ignoreMethods.includes(method)) {
    return { success: true };
  }
  
  const csrfToken = request.headers.get(headerName);
  const cookieHeader = request.headers.get('Cookie');
  
  if (!csrfToken) {
    return { success: false, error: 'CSRF token required', status: 403 };
  }
  
  if (!cookieHeader) {
    return { success: false, error: 'CSRF cookie required', status: 403 };
  }
  
  //extract csrf token from cookie
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);
  
  const cookieToken = cookies[cookieName];
  
  if (!cookieToken || cookieToken !== csrfToken) {
    return { success: false, error: 'CSRF token mismatch', status: 403 };
  }
  
  return { success: true };
}

//security headers middleware
export function securityHeadersMiddleware(
  request: Request,
  options: {
    csp?: boolean;
    nonce?: string;
    additionalHeaders?: Record<string, string>;
  } = {}
): MiddlewareResult {
  const { csp = true, nonce, additionalHeaders = {} } = options;
  
  const headers = { ...SECURITY_HEADERS };
  
  if (csp) {
    const cspHeader = getCSPHeader(nonce);
    headers['Content-Security-Policy'] = cspHeader.split(': ')[1];
  }
  
  //add additional headers
  Object.assign(headers, additionalHeaders);
  
  return { success: true, headers };
}

//cors middleware
export function corsMiddleware(
  request: Request,
  config: Partial<CORSConfig> = {}
): MiddlewareResult {
  const fullConfig = { ...DEFAULT_CORS_CONFIG, ...config };
  const origin = request.headers.get('Origin');
  const method = request.method.toUpperCase();
  
  const headers: Record<string, string> = {};
  
  //handle origin
  if (fullConfig.origin === true) {
    headers['Access-Control-Allow-Origin'] = origin || '*';
  } else if (typeof fullConfig.origin === 'string') {
    headers['Access-Control-Allow-Origin'] = fullConfig.origin;
  } else if (Array.isArray(fullConfig.origin) && origin) {
    if (fullConfig.origin.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
  }
  
  //handle credentials
  if (fullConfig.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  
  //handle preflight requests
  if (method === 'OPTIONS') {
    headers['Access-Control-Allow-Methods'] = fullConfig.methods.join(', ');
    headers['Access-Control-Allow-Headers'] = fullConfig.allowedHeaders.join(', ');
    
    if (fullConfig.maxAge) {
      headers['Access-Control-Max-Age'] = fullConfig.maxAge.toString();
    }
    
    return { success: true, headers, status: 204 };
  }
  
  return { success: true, headers };
}

//comprehensive security middleware that combines all protections
export async function securityMiddleware(
  request: Request,
  options: {
    auth?: { required?: boolean; roles?: User['role'][] };
    rateLimit?: Partial<RateLimitConfig>;
    csrf?: boolean;
    cors?: Partial<CORSConfig>;
    headers?: { csp?: boolean; nonce?: string };
  } = {}
): Promise<MiddlewareResult> {
  const results: MiddlewareResult[] = [];
  
  //apply security headers
  if (options.headers !== false) {
    results.push(securityHeadersMiddleware(request, options.headers));
  }
  
  //apply cors if configured
  if (options.cors) {
    results.push(corsMiddleware(request, options.cors));
  }
  
  //apply rate limiting
  if (options.rateLimit !== false) {
    results.push(await rateLimitMiddleware(request, options.rateLimit));
  }
  
  //apply csrf protection
  if (options.csrf) {
    results.push(await csrfMiddleware(request));
  }
  
  //apply authentication
  if (options.auth) {
    results.push(await authMiddleware(request, options.auth));
  }
  
  //check for any failures
  const failed = results.find(result => !result.success);
  if (failed) {
    return failed;
  }
  
  //combine headers from all middleware
  const combinedHeaders: Record<string, string> = {};
  results.forEach(result => {
    if (result.headers) {
      Object.assign(combinedHeaders, result.headers);
    }
  });
  
  //get user from auth middleware
  const authResult = results.find(result => result.user);
  
  return {
    success: true,
    headers: Object.keys(combinedHeaders).length > 0 ? combinedHeaders : undefined,
    user: authResult?.user,
  };
}

//generates csrf token
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

//creates csrf cookie
export function createCSRFCookie(token: string): string {
  const env = getEnv();
  const secure = env.NODE_ENV === 'production';
  
  return `csrf_token=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${secure ? '; Secure' : ''}`;
}

//input sanitization middleware
export function sanitizeInput(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      //basic html sanitization
      sanitized[key] = value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput({ item }).item : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeInput(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}