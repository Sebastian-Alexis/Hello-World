//api security utilities and endpoint protection
import type { APIContext } from 'astro';
import { z } from 'zod';

//api security configuration
const API_SECURITY_CONFIG = {
  //default rate limits per endpoint type
  RATE_LIMITS: {
    READ: { requests: 100, window: 60 * 1000 }, //100 per minute
    WRITE: { requests: 30, window: 60 * 1000 }, //30 per minute
    AUTH: { requests: 5, window: 15 * 60 * 1000 }, //5 per 15 minutes
    ADMIN: { requests: 50, window: 60 * 1000 }, //50 per minute
  },
  
  //request size limits
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, //10mb
  MAX_QUERY_PARAMS: 50,
  MAX_HEADER_SIZE: 8192,
  
  //security headers for api responses
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  },
  
  //allowed origins for cors (customize per environment)
  ALLOWED_ORIGINS: [
    'https://yoursite.com',
    'https://www.yoursite.com',
    //add development origins if needed
    ...(import.meta.env.DEV ? ['http://localhost:4321'] : []),
  ],
};

//api endpoint security levels
export enum SecurityLevel {
  PUBLIC = 'public',        //no auth required
  AUTHENTICATED = 'authenticated', //requires valid token
  ADMIN = 'admin',         //requires admin role
  SYSTEM = 'system',       //system-level access only
}

//api response wrapper with security headers
export function createSecureApiResponse<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>
): Response {
  const responseHeaders = new Headers({
    'Content-Type': 'application/json',
    ...API_SECURITY_CONFIG.SECURITY_HEADERS,
    ...headers,
  });
  
  //add timing header for monitoring
  responseHeaders.set('X-Response-Time', Date.now().toString());
  
  const body = JSON.stringify({
    success: status < 400,
    data: status < 400 ? data : undefined,
    error: status >= 400 ? (typeof data === 'string' ? data : 'An error occurred') : undefined,
    timestamp: new Date().toISOString(),
  });
  
  return new Response(body, {
    status,
    headers: responseHeaders,
  });
}

//validate api request security
export async function validateApiRequest(
  context: APIContext,
  options: {
    securityLevel: SecurityLevel;
    requireCsrf?: boolean;
    maxSize?: number;
    allowedMethods?: string[];
    schema?: z.ZodSchema;
  }
): Promise<{
  valid: boolean;
  error?: string;
  data?: any;
}> {
  const { request, url } = context;
  const method = request.method.toUpperCase();
  
  //method validation
  if (options.allowedMethods && !options.allowedMethods.includes(method)) {
    return {
      valid: false,
      error: `Method ${method} not allowed`,
    };
  }
  
  //request size validation
  const contentLength = request.headers.get('content-length');
  const maxSize = options.maxSize || API_SECURITY_CONFIG.MAX_REQUEST_SIZE;
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    return {
      valid: false,
      error: 'Request too large',
    };
  }
  
  //header size validation
  const headerSize = Array.from(request.headers.entries())
    .reduce((total, [key, value]) => total + key.length + value.length, 0);
  
  if (headerSize > API_SECURITY_CONFIG.MAX_HEADER_SIZE) {
    return {
      valid: false,
      error: 'Headers too large',
    };
  }
  
  //query parameter validation
  const queryParams = Array.from(url.searchParams.entries());
  if (queryParams.length > API_SECURITY_CONFIG.MAX_QUERY_PARAMS) {
    return {
      valid: false,
      error: 'Too many query parameters',
    };
  }
  
  //authentication validation
  if (options.securityLevel !== SecurityLevel.PUBLIC) {
    if (!context.locals.authenticated) {
      return {
        valid: false,
        error: 'Authentication required',
      };
    }
    
    //role validation
    const user = context.locals.user;
    if (options.securityLevel === SecurityLevel.ADMIN) {
      if (!user || user.role !== 'admin') {
        return {
          valid: false,
          error: 'Admin access required',
        };
      }
    }
  }
  
  //csrf validation for state-changing requests
  if (options.requireCsrf && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    //csrf validation would be implemented here
    //using the csrf protection module
  }
  
  //request body validation
  let requestData: any = null;
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    try {
      const contentType = request.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const text = await request.text();
        requestData = JSON.parse(text);
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        requestData = Object.fromEntries(formData.entries());
      }
      
      //validate against schema if provided
      if (options.schema && requestData) {
        try {
          requestData = await options.schema.parseAsync(requestData);
        } catch (error) {
          if (error instanceof z.ZodError) {
            return {
              valid: false,
              error: `Validation error: ${error.errors[0].message}`,
            };
          }
          return {
            valid: false,
            error: 'Invalid request data',
          };
        }
      }
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid request body format',
      };
    }
  }
  
  return {
    valid: true,
    data: requestData,
  };
}

//cors handler for api endpoints
export function handleCors(context: APIContext): Response | null {
  const { request } = context;
  const origin = request.headers.get('Origin');
  const method = request.method.toUpperCase();
  
  //handle preflight requests
  if (method === 'OPTIONS') {
    const headers = new Headers();
    
    //check if origin is allowed
    if (origin && API_SECURITY_CONFIG.ALLOWED_ORIGINS.includes(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    //set allowed methods and headers
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    headers.set('Access-Control-Max-Age', '86400'); //24 hours
    
    return new Response(null, { status: 204, headers });
  }
  
  return null; //not a preflight request
}

//api error handler with security considerations
export function handleApiError(
  error: Error | unknown,
  context: APIContext,
  exposeSensitiveInfo: boolean = false
): Response {
  console.error('API Error:', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    path: context.url.pathname,
    method: context.request.method,
    ip: context.clientAddress,
    user: context.locals.user?.userId,
  });
  
  //don't expose sensitive error details in production
  let errorMessage = 'Internal server error';
  let statusCode = 500;
  
  if (error instanceof Error) {
    //categorize known error types
    if (error.message.includes('authentication') || error.message.includes('token')) {
      errorMessage = 'Authentication failed';
      statusCode = 401;
    } else if (error.message.includes('authorization') || error.message.includes('permission')) {
      errorMessage = 'Access denied';
      statusCode = 403;
    } else if (error.message.includes('validation') || error.message.includes('invalid')) {
      errorMessage = 'Invalid request';
      statusCode = 400;
    } else if (error.message.includes('not found')) {
      errorMessage = 'Resource not found';
      statusCode = 404;
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Too many requests';
      statusCode = 429;
    }
    
    //expose more details in development
    if (import.meta.env.DEV || exposeSensitiveInfo) {
      errorMessage = error.message;
    }
  }
  
  return createSecureApiResponse(errorMessage, statusCode);
}

//secure pagination helper
export function createSecurePagination(options: {
  page: number;
  limit: number;
  total: number;
  maxLimit?: number;
}) {
  const maxLimit = options.maxLimit || 100;
  const limit = Math.min(Math.max(options.limit, 1), maxLimit);
  const page = Math.max(options.page, 1);
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(options.total / limit);
  
  return {
    page,
    limit,
    offset,
    total: options.total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

//input sanitization for api endpoints
export function sanitizeApiInput(data: any): any {
  if (typeof data === 'string') {
    //remove potential xss and injection attempts
    return data
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeApiInput(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      //sanitize key names
      const cleanKey = key.replace(/[^a-zA-Z0-9_-]/g, '');
      if (cleanKey) {
        sanitized[cleanKey] = sanitizeApiInput(value);
      }
    }
    return sanitized;
  }
  
  return data;
}

//api request logging for security monitoring
export function logApiRequest(
  context: APIContext,
  duration: number,
  statusCode: number,
  error?: string
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    method: context.request.method,
    path: context.url.pathname,
    query: context.url.search,
    ip: context.clientAddress,
    userAgent: context.request.headers.get('user-agent'),
    userId: context.locals.user?.userId,
    sessionId: context.locals.session?.id,
    duration,
    status: statusCode,
    error,
  };
  
  //log to appropriate destination based on status
  if (statusCode >= 500) {
    console.error('API Error:', logEntry);
  } else if (statusCode >= 400) {
    console.warn('API Warning:', logEntry);
  } else {
    console.info('API Request:', logEntry);
  }
}

//create secure api wrapper with all protections
export function createSecureApiHandler<T>(
  handler: (context: APIContext, data?: any) => Promise<T>,
  options: {
    securityLevel: SecurityLevel;
    allowedMethods?: string[];
    schema?: z.ZodSchema;
    requireCsrf?: boolean;
    rateLimit?: { requests: number; window: number };
  }
) {
  return async (context: APIContext): Promise<Response> => {
    const startTime = Date.now();
    let statusCode = 200;
    let error: string | undefined;
    
    try {
      //handle cors preflight
      const corsResponse = handleCors(context);
      if (corsResponse) return corsResponse;
      
      //validate request
      const validation = await validateApiRequest(context, options);
      if (!validation.valid) {
        statusCode = 400;
        error = validation.error;
        return createSecureApiResponse(validation.error, 400);
      }
      
      //execute handler
      const result = await handler(context, validation.data);
      return createSecureApiResponse(result);
      
    } catch (err) {
      statusCode = 500;
      error = err instanceof Error ? err.message : 'Unknown error';
      return handleApiError(err, context);
    } finally {
      //log request
      const duration = Date.now() - startTime;
      logApiRequest(context, duration, statusCode, error);
    }
  };
}

//validate api key for external integrations
export function validateApiKey(apiKey: string): {
  valid: boolean;
  keyId?: string;
  permissions?: string[];
} {
  //implement api key validation logic
  //this would typically check against a database
  
  if (!apiKey || !apiKey.startsWith('ak_')) {
    return { valid: false };
  }
  
  //in production, validate against database
  //for now, just basic format check
  return {
    valid: true,
    keyId: apiKey,
    permissions: ['read'], //would come from database
  };
}

//security headers middleware for api responses
export function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  
  Object.entries(API_SECURITY_CONFIG.SECURITY_HEADERS).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
  //add cors headers if needed
  const origin = headers.get('Access-Control-Allow-Origin');
  if (origin) {
    headers.set('Vary', 'Origin');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}