import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { getEnv } from '../env/index.js';

//security constants
export const SECURITY_CONSTANTS = {
  //token lengths
  SESSION_ID_LENGTH: 32,
  CSRF_TOKEN_LENGTH: 32,
  API_KEY_LENGTH: 32,
  NONCE_LENGTH: 16,
  
  //timing constants
  BCRYPT_MAX_TIME: 2000, //max 2 seconds for bcrypt
  JWT_VERIFY_MAX_TIME: 100, //max 100ms for jwt verification
  
  //rate limiting
  DEFAULT_RATE_LIMIT: 100,
  AUTH_RATE_LIMIT: 10, //stricter for auth endpoints
  API_RATE_LIMIT: 1000,
  
  //session limits
  MAX_SESSIONS_PER_USER: 5,
  SESSION_CLEANUP_BATCH_SIZE: 1000,
  
  //content limits
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024, //50MB
  MAX_REQUEST_SIZE: 10 * 1024 * 1024, //10MB
  MAX_JSON_SIZE: 1024 * 1024, //1MB
  
  //security headers
  MAX_AGE_HSTS: 31536000, //1 year
  MAX_AGE_CSP: 86400, //24 hours
} as const;

//common regex patterns for validation
export const VALIDATION_PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  USERNAME: /^[a-zA-Z0-9_-]{3,30}$/,
  SLUG: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  URL: /^https?:\/\/[^\s/$.?#].[^\s]*$/i,
  IP_ADDRESS: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  SAFE_FILENAME: /^[a-zA-Z0-9._-]+$/,
} as const;

//mime type security mappings
export const MIME_TYPE_SECURITY = {
  SAFE_IMAGES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ],
  SAFE_DOCUMENTS: [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
  ],
  DANGEROUS_TYPES: [
    'application/javascript',
    'text/javascript',
    'application/x-executable',
    'application/x-msdownload',
    'application/x-sh',
    'text/html', //can contain scripts
  ],
} as const;

//generates cryptographically secure random string
export function generateSecureRandom(length: number = 32, encoding: 'hex' | 'base64' | 'base64url' = 'hex'): string {
  const bytes = randomBytes(Math.ceil(length / 2));
  
  switch (encoding) {
    case 'hex':
      return bytes.toString('hex').slice(0, length);
    case 'base64':
      return bytes.toString('base64').slice(0, length);
    case 'base64url':
      return bytes.toString('base64url').slice(0, length);
    default:
      return bytes.toString('hex').slice(0, length);
  }
}

//generates cryptographically secure nonce
export function generateNonce(length: number = SECURITY_CONSTANTS.NONCE_LENGTH): string {
  return generateSecureRandom(length, 'base64url');
}

//generates api key with specific format
export function generateApiKey(): string {
  const prefix = 'hwapp_'; //hello world app prefix
  const randomPart = generateSecureRandom(SECURITY_CONSTANTS.API_KEY_LENGTH);
  return `${prefix}${randomPart}`;
}

//creates secure hash of input
export function createSecureHash(input: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  return createHash(algorithm).update(input).digest('hex');
}

//creates hmac hash with secret
export function createHMAC(input: string, secret?: string, algorithm: 'sha256' | 'sha512' = 'sha256'): string {
  const env = getEnv();
  const hmacSecret = secret || env.JWT_SECRET;
  
  return createHash(algorithm).update(input + hmacSecret).digest('hex');
}

//timing-safe string comparison
export function timingSafeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  
  return timingSafeEqual(bufferA, bufferB);
}

//validates and sanitizes filename
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 255);
}

//checks if mime type is safe
export function isSafeMimeType(mimeType: string): boolean {
  return !MIME_TYPE_SECURITY.DANGEROUS_TYPES.includes(mimeType.toLowerCase());
}

//validates file upload security
export function validateFileUpload(file: {
  filename: string;
  mimeType: string;
  size: number;
}): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  //validate filename
  if (!VALIDATION_PATTERNS.SAFE_FILENAME.test(file.filename)) {
    errors.push('Filename contains unsafe characters');
  }
  
  if (file.filename.length > 255) {
    errors.push('Filename too long');
  }
  
  //validate mime type
  if (!isSafeMimeType(file.mimeType)) {
    errors.push('File type not allowed');
  }
  
  //validate size
  if (file.size > SECURITY_CONSTANTS.MAX_UPLOAD_SIZE) {
    errors.push('File too large');
  }
  
  if (file.size === 0) {
    errors.push('File is empty');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

//extracts ip address from request with proxy support
export function extractClientIP(headers: Headers): string {
  //check various headers in order of preference
  const ipHeaders = [
    'CF-Connecting-IP', //cloudflare
    'X-Real-IP', //nginx
    'X-Forwarded-For', //proxy
    'X-Client-IP',
    'X-Cluster-Client-IP',
  ];
  
  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      //x-forwarded-for can contain multiple IPs, take the first
      const ip = value.split(',')[0].trim();
      if (VALIDATION_PATTERNS.IP_ADDRESS.test(ip)) {
        return ip;
      }
    }
  }
  
  return 'unknown';
}

//normalizes user agent string
export function normalizeUserAgent(userAgent: string): string {
  return userAgent
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 500); //limit length
}

//creates request fingerprint for security
export function createRequestFingerprint(request: {
  ip: string;
  userAgent: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
}): string {
  const components = [
    request.ip,
    normalizeUserAgent(request.userAgent),
    request.acceptLanguage || '',
    request.acceptEncoding || '',
  ];
  
  return createSecureHash(components.join('|'));
}

//validates request origin
export function validateRequestOrigin(origin: string, allowedOrigins: string[]): boolean {
  if (!origin) return false;
  
  //exact match
  if (allowedOrigins.includes(origin)) return true;
  
  //wildcard subdomain matching
  return allowedOrigins.some(allowed => {
    if (allowed.startsWith('*.')) {
      const domain = allowed.slice(2);
      return origin.endsWith(`.${domain}`) || origin === domain;
    }
    return false;
  });
}

//rate limiting key generators
export const rateLimitKeyGenerators = {
  byIP: (request: Request) => extractClientIP(new Headers(request.headers)),
  byUser: (userId: number) => `user:${userId}`,
  byEndpoint: (request: Request) => new URL(request.url).pathname,
  combined: (request: Request, userId?: number) => {
    const ip = extractClientIP(new Headers(request.headers));
    const endpoint = new URL(request.url).pathname;
    return userId ? `${ip}:${userId}:${endpoint}` : `${ip}:${endpoint}`;
  },
};

//password security utilities
export function calculatePasswordEntropy(password: string): number {
  let charsetSize = 0;
  
  if (/[a-z]/.test(password)) charsetSize += 26;
  if (/[A-Z]/.test(password)) charsetSize += 26;
  if (/[0-9]/.test(password)) charsetSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) charsetSize += 32;
  
  return password.length * Math.log2(charsetSize);
}

//checks for common password patterns
export function hasCommonPatterns(password: string): string[] {
  const patterns = [];
  
  if (/(.)\1{2,}/.test(password)) {
    patterns.push('repeated_characters');
  }
  
  if (/012|123|234|345|456|567|678|789|890/.test(password)) {
    patterns.push('sequential_numbers');
  }
  
  if (/abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
    patterns.push('sequential_letters');
  }
  
  if (/qwerty|asdf|zxcv|1234|password/i.test(password)) {
    patterns.push('keyboard_patterns');
  }
  
  return patterns;
}

//input sanitization utilities
export const sanitizers = {
  //basic html sanitization
  html: (input: string): string => {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  },
  
  //sql injection prevention
  sql: (input: string): string => {
    return input.replace(/['";\\]/g, '\\$&');
  },
  
  //javascript sanitization
  js: (input: string): string => {
    return input
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/'/g, '\\u0027')
      .replace(/"/g, '\\u0022');
  },
  
  //url sanitization
  url: (input: string): string => {
    try {
      const url = new URL(input);
      //only allow http/https
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('Invalid protocol');
      }
      return url.toString();
    } catch {
      return '';
    }
  },
  
  //filename sanitization
  filename: sanitizeFilename,
};

//security event logging
export interface SecurityEvent {
  type: 'auth_failure' | 'rate_limit' | 'csrf_failure' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  ip: string;
  userAgent: string;
  userId?: number;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export function createSecurityEvent(
  type: SecurityEvent['type'],
  severity: SecurityEvent['severity'],
  message: string,
  context: {
    ip: string;
    userAgent: string;
    userId?: number;
    metadata?: Record<string, unknown>;
  }
): SecurityEvent {
  return {
    type,
    severity,
    message,
    ip: context.ip,
    userAgent: context.userAgent,
    userId: context.userId,
    timestamp: new Date(),
    metadata: context.metadata,
  };
}

//security monitoring utilities
export const securityMonitor = {
  //tracks failed login attempts
  trackFailedLogin: (ip: string, email: string) => {
    return createSecurityEvent(
      'auth_failure',
      'medium',
      'Failed login attempt',
      { ip, userAgent: '', metadata: { email } }
    );
  },
  
  //tracks rate limit violations
  trackRateLimit: (ip: string, endpoint: string) => {
    return createSecurityEvent(
      'rate_limit',
      'low',
      'Rate limit exceeded',
      { ip, userAgent: '', metadata: { endpoint } }
    );
  },
  
  //tracks csrf failures
  trackCSRFFailure: (ip: string, userAgent: string) => {
    return createSecurityEvent(
      'csrf_failure',
      'high',
      'CSRF token validation failed',
      { ip, userAgent }
    );
  },
  
  //tracks suspicious activity
  trackSuspiciousActivity: (ip: string, userAgent: string, reason: string) => {
    return createSecurityEvent(
      'suspicious_activity',
      'high',
      'Suspicious activity detected',
      { ip, userAgent, metadata: { reason } }
    );
  },
};

//utility to check if request looks suspicious
export function isSuspiciousRequest(request: {
  ip: string;
  userAgent: string;
  method: string;
  url: string;
  headers: Record<string, string>;
}): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  //check for missing or suspicious user agent
  if (!request.userAgent || request.userAgent.length < 10) {
    reasons.push('missing_or_short_user_agent');
  }
  
  //check for automated tools
  const automatedPatterns = [
    /bot/i, /crawler/i, /spider/i, /curl/i, /wget/i,
    /python/i, /java/i, /php/i, /ruby/i, /perl/i,
  ];
  
  if (automatedPatterns.some(pattern => pattern.test(request.userAgent))) {
    reasons.push('automated_tool_user_agent');
  }
  
  //check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-host', 'x-original-url', 'x-rewrite-url'];
  if (suspiciousHeaders.some(header => request.headers[header])) {
    reasons.push('suspicious_headers');
  }
  
  //check for unusual method/url combinations
  if (request.method === 'POST' && request.url.includes('..')) {
    reasons.push('path_traversal_attempt');
  }
  
  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}

//converts various time formats to milliseconds
export function timeToMs(time: string | number): number {
  if (typeof time === 'number') return time;
  
  const units: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };
  
  const match = time.match(/^(\d+)([a-zA-Z]+)$/);
  if (!match) throw new Error('Invalid time format');
  
  const [, value, unit] = match;
  const multiplier = units[unit.toLowerCase()];
  
  if (!multiplier) throw new Error('Invalid time unit');
  
  return parseInt(value) * multiplier;
}

//environment-aware security configuration
export function getSecurityConfig() {
  const env = getEnv();
  
  return {
    isDevelopment: env.NODE_ENV === 'development',
    isProduction: env.NODE_ENV === 'production',
    bcryptRounds: env.BCRYPT_ROUNDS,
    jwtSecret: env.JWT_SECRET,
    sessionSecret: env.SESSION_SECRET,
    rateLimitWindow: env.RATE_LIMIT_WINDOW,
    rateLimitMax: env.RATE_LIMIT_MAX_REQUESTS,
    siteUrl: env.SITE_URL,
    corsOrigins: env.NODE_ENV === 'development' 
      ? ['http://localhost:3000', 'http://localhost:4321']
      : [env.SITE_URL],
  };
}