//comprehensive input validation and sanitization middleware
import type { MiddlewareNext } from 'astro:middleware';
import type { APIContext } from 'astro';
import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

//validation result interface
interface ValidationResult {
  valid: boolean;
  data?: any;
  error?: string;
  sanitized?: any;
}

//sanitization configuration
const SANITIZATION_CONFIG = {
  //html sanitization options
  HTML: {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'blockquote'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false,
  },
  
  //sql injection patterns to detect and block
  SQL_INJECTION_PATTERNS: [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(';|";|'|"|--|\*|\||&)/gi,
    /(\b(WAITFOR|DELAY)\b)/gi,
    /(\b(XP_|SP_)\w+)/gi,
  ],
  
  //xss patterns to detect
  XSS_PATTERNS: [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  ],
  
  //file upload restrictions
  UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024, //10mb
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'application/pdf',
      'application/json',
    ],
    BLOCKED_EXTENSIONS: [
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
      'php', 'asp', 'aspx', 'jsp', 'py', 'rb', 'pl', 'sh',
    ],
  }
};

//sanitize html content
function sanitizeHTML(input: string): string {
  if (typeof input !== 'string') return '';
  
  //use dompurify with strict config
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: SANITIZATION_CONFIG.HTML.ALLOWED_TAGS,
    ALLOWED_ATTR: SANITIZATION_CONFIG.HTML.ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: SANITIZATION_CONFIG.HTML.ALLOWED_URI_REGEXP,
    KEEP_CONTENT: SANITIZATION_CONFIG.HTML.KEEP_CONTENT,
  });
}

//sanitize string for sql safety
function sanitizeSQL(input: string): string {
  if (typeof input !== 'string') return '';
  
  //detect potential sql injection
  for (const pattern of SANITIZATION_CONFIG.SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      throw new Error('Potential SQL injection detected');
    }
  }
  
  //escape special characters
  return input
    .replace(/'/g, "''")  //escape single quotes
    .replace(/\\/g, '\\\\') //escape backslashes
    .replace(/\x00/g, ''); //remove null bytes
}

//detect xss attempts
function detectXSS(input: string): boolean {
  if (typeof input !== 'string') return false;
  
  for (const pattern of SANITIZATION_CONFIG.XSS_PATTERNS) {
    if (pattern.test(input)) {
      return true;
    }
  }
  
  return false;
}

//sanitize object recursively
function sanitizeObject(obj: any, context: 'html' | 'sql' | 'general' = 'general'): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === 'string') {
    //detect xss first
    if (detectXSS(obj)) {
      throw new Error('XSS attempt detected');
    }
    
    switch (context) {
      case 'html':
        return sanitizeHTML(obj);
      case 'sql':
        return sanitizeSQL(obj);
      default:
        //general sanitization - remove control characters
        return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, context));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      //sanitize key names too
      const sanitizedKey = sanitizeObject(key, 'general');
      sanitized[sanitizedKey] = sanitizeObject(value, context);
    }
    return sanitized;
  }
  
  return obj;
}

//validate file uploads
function validateFileUpload(file: any): { valid: boolean; error?: string } {
  if (!file) return { valid: true }; //no file is ok
  
  //check required properties
  if (!file.filename || !file.mimetype || !file.size) {
    return { valid: false, error: 'Invalid file structure' };
  }
  
  //check file size
  if (file.size > SANITIZATION_CONFIG.UPLOAD.MAX_SIZE) {
    return { 
      valid: false, 
      error: `File too large. Maximum size is ${SANITIZATION_CONFIG.UPLOAD.MAX_SIZE / 1024 / 1024}MB` 
    };
  }
  
  //check mime type
  if (!SANITIZATION_CONFIG.UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  //check file extension
  const extension = file.filename.split('.').pop()?.toLowerCase();
  if (extension && SANITIZATION_CONFIG.UPLOAD.BLOCKED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'File extension not allowed' };
  }
  
  //check for double extensions (e.g., file.jpg.exe)
  const parts = file.filename.split('.');
  if (parts.length > 2) {
    for (let i = 1; i < parts.length - 1; i++) {
      if (SANITIZATION_CONFIG.UPLOAD.BLOCKED_EXTENSIONS.includes(parts[i].toLowerCase())) {
        return { valid: false, error: 'Suspicious file name detected' };
      }
    }
  }
  
  return { valid: true };
}

//validate json schema for specific endpoints
const API_SCHEMAS: Record<string, z.ZodSchema> = {
  '/api/auth/login': z.object({
    email: z.string().email().max(255),
    password: z.string().min(1).max(128),
    rememberMe: z.boolean().optional(),
  }),
  
  '/api/auth/register': z.object({
    username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
    email: z.string().email().max(255),
    password: z.string().min(8).max(128),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
  }),
  
  '/api/blog': z.object({
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(50000),
    excerpt: z.string().max(500).optional(),
    categories: z.array(z.string()).max(10).optional(),
    tags: z.array(z.string()).max(20).optional(),
    status: z.enum(['draft', 'published']).optional(),
  }),
  
  '/api/portfolio': z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    technologies: z.array(z.string()).max(20),
    githubUrl: z.string().url().optional(),
    liveUrl: z.string().url().optional(),
    featured: z.boolean().optional(),
  }),
};

//get validation schema for endpoint
function getValidationSchema(pathname: string, method: string): z.ZodSchema | null {
  //exact match first
  const key = `${pathname}`;
  if (API_SCHEMAS[key]) {
    return API_SCHEMAS[key];
  }
  
  //pattern matching for dynamic routes
  if (pathname.match(/^\/api\/blog\/\d+$/) && method === 'PUT') {
    return API_SCHEMAS['/api/blog'];
  }
  
  if (pathname.match(/^\/api\/portfolio\/\d+$/) && method === 'PUT') {
    return API_SCHEMAS['/api/portfolio'];
  }
  
  return null;
}

//main validation middleware
export async function validationMiddleware(
  context: APIContext,
  next: MiddlewareNext
): Promise<ValidationResult> {
  const pathname = context.url.pathname;
  const method = context.request.method;
  
  //skip validation for GET requests (no body to validate)
  if (method === 'GET') {
    return { valid: true };
  }
  
  try {
    let body: any;
    
    //parse request body based on content type
    const contentType = context.request.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const rawBody = await context.request.text();
        body = JSON.parse(rawBody);
      } catch (error) {
        return { valid: false, error: 'Invalid JSON format' };
      }
    } else if (contentType.includes('multipart/form-data')) {
      try {
        const formData = await context.request.formData();
        body = Object.fromEntries(formData.entries());
        
        //validate file uploads
        for (const [key, value] of Object.entries(body)) {
          if (value && typeof value === 'object' && 'stream' in value) {
            const fileValidation = validateFileUpload(value);
            if (!fileValidation.valid) {
              return { valid: false, error: fileValidation.error };
            }
          }
        }
      } catch (error) {
        return { valid: false, error: 'Invalid form data' };
      }
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const formData = await context.request.formData();
        body = Object.fromEntries(formData.entries());
      } catch (error) {
        return { valid: false, error: 'Invalid form data' };
      }
    }
    
    //if no body, validation passes
    if (!body) {
      return { valid: true };
    }
    
    //get validation schema for this endpoint
    const schema = getValidationSchema(pathname, method);
    
    //sanitize input based on endpoint type
    let sensitiveContext: 'html' | 'sql' | 'general' = 'general';
    if (pathname.includes('/blog') || pathname.includes('/portfolio')) {
      sensitiveContext = 'html'; //allow some html tags
    }
    
    let sanitizedBody: any;
    try {
      sanitizedBody = sanitizeObject(body, sensitiveContext);
    } catch (error) {
      return { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Input sanitization failed' 
      };
    }
    
    //validate against schema if available
    if (schema) {
      try {
        const validatedData = await schema.parseAsync(sanitizedBody);
        return { 
          valid: true, 
          data: validatedData,
          sanitized: sanitizedBody 
        };
      } catch (error) {
        if (error instanceof z.ZodError) {
          const firstError = error.errors[0];
          return { 
            valid: false, 
            error: `${firstError.path.join('.')}: ${firstError.message}` 
          };
        }
        return { valid: false, error: 'Validation failed' };
      }
    }
    
    //no specific schema but still return sanitized data
    return { 
      valid: true, 
      data: sanitizedBody,
      sanitized: sanitizedBody 
    };
    
  } catch (error) {
    console.error('Validation middleware error:', error);
    return { valid: false, error: 'Validation process failed' };
  }
}

//helper to add validation to specific routes
export function createRouteValidator(schema: z.ZodSchema) {
  return async (context: APIContext): Promise<ValidationResult> => {
    try {
      const body = await context.request.json();
      const sanitized = sanitizeObject(body, 'general');
      const validated = await schema.parseAsync(sanitized);
      
      return { valid: true, data: validated, sanitized };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          valid: false, 
          error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        };
      }
      return { valid: false, error: 'Validation failed' };
    }
  };
}

//security-focused string validation helpers
export const secureValidators = {
  //email with additional security checks
  secureEmail: z.string()
    .email()
    .max(255)
    .refine(email => !email.includes('..'), 'Invalid email format')
    .refine(email => !/[<>]/.test(email), 'Invalid characters in email'),
  
  //username with strict rules
  secureUsername: z.string()
    .min(3)
    .max(50)
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and dashes')
    .refine(username => !username.startsWith('-'), 'Username cannot start with dash')
    .refine(username => !username.endsWith('-'), 'Username cannot end with dash'),
  
  //url with protocol restrictions
  secureUrl: z.string()
    .url()
    .refine(url => url.startsWith('https://') || url.startsWith('http://'), 'Only HTTP/HTTPS URLs allowed')
    .refine(url => !url.includes('..'), 'Invalid URL format')
    .refine(url => !/[<>"]/.test(url), 'Invalid characters in URL'),
  
  //html content with sanitization
  htmlContent: z.string()
    .max(50000)
    .transform(content => sanitizeHTML(content)),
  
  //safe filename
  filename: z.string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid filename characters')
    .refine(name => !name.startsWith('.'), 'Filename cannot start with dot')
    .refine(name => {
      const ext = name.split('.').pop()?.toLowerCase();
      return !ext || !SANITIZATION_CONFIG.UPLOAD.BLOCKED_EXTENSIONS.includes(ext);
    }, 'File extension not allowed'),
};

//rate limiting by input complexity (to prevent resource exhaustion)
export function checkInputComplexity(data: any): { valid: boolean; error?: string } {
  const complexity = calculateComplexity(data);
  const maxComplexity = 10000; //adjust based on needs
  
  if (complexity > maxComplexity) {
    return { valid: false, error: 'Input too complex' };
  }
  
  return { valid: true };
}

function calculateComplexity(data: any, depth: number = 0): number {
  if (depth > 10) return 1000; //prevent deep recursion
  
  if (typeof data === 'string') {
    return data.length;
  }
  
  if (Array.isArray(data)) {
    return data.reduce((sum, item) => sum + calculateComplexity(item, depth + 1), 0);
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.values(data).reduce((sum, value) => sum + calculateComplexity(value, depth + 1), 0);
  }
  
  return 1;
}