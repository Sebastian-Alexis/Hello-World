//advanced rate limiting middleware with sliding window and ddos protection
import type { MiddlewareNext } from 'astro:middleware';
import type { APIContext } from 'astro';

//rate limiting configuration
interface RateLimitConfig {
  windowMs: number;        //time window in milliseconds
  maxRequests: number;     //max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (context: APIContext) => string;
  onLimitReached?: (context: APIContext) => void;
}

//rate limit bucket for sliding window algorithm
interface RateLimitBucket {
  requests: number[];      //timestamps of requests
  blocked: boolean;        //is currently blocked
  blockedUntil?: number;   //timestamp when unblocked
}

//in-memory store (in production, use redis or similar)
const rateLimitStore = new Map<string, RateLimitBucket>();

//rate limiting rules by endpoint pattern
const RATE_LIMIT_RULES: Record<string, RateLimitConfig> = {
  //authentication endpoints - very strict
  '/api/auth/login': {
    windowMs: 15 * 60 * 1000,  //15 minutes
    maxRequests: 5,             //5 attempts per 15 min
    skipSuccessfulRequests: false,
  },
  
  '/api/auth/register': {
    windowMs: 60 * 60 * 1000,  //1 hour
    maxRequests: 3,             //3 registrations per hour per ip
    skipSuccessfulRequests: false,
  },
  
  '/api/auth/refresh': {
    windowMs: 5 * 60 * 1000,   //5 minutes
    maxRequests: 10,            //10 refreshes per 5 min
    skipSuccessfulRequests: true,
  },
  
  //api endpoints - moderate limits
  '/api/': {
    windowMs: 1 * 60 * 1000,   //1 minute
    maxRequests: 100,           //100 requests per minute
    skipSuccessfulRequests: true,
  },
  
  //admin endpoints - strict but reasonable
  '/admin/': {
    windowMs: 1 * 60 * 1000,   //1 minute
    maxRequests: 30,            //30 requests per minute
    skipSuccessfulRequests: true,
  },
  
  //general pages - lenient
  '/': {
    windowMs: 1 * 60 * 1000,   //1 minute
    maxRequests: 200,           //200 requests per minute
    skipSuccessfulRequests: true,
  }
};

//ddos protection configuration
const DDOS_CONFIG = {
  //burst detection
  BURST_THRESHOLD: 50,        //requests in burst window
  BURST_WINDOW_MS: 10 * 1000, //10 seconds
  
  //progressive penalties
  PENALTY_MULTIPLIER: 2,      //double the penalty each time
  MAX_PENALTY_MS: 60 * 60 * 1000, //max 1 hour block
  MIN_PENALTY_MS: 5 * 60 * 1000,  //min 5 minute block
  
  //whitelist for localhost and development
  WHITELIST: ['127.0.0.1', '::1', 'localhost'],
};

//get client ip address with proxy support
function getClientIP(context: APIContext): string {
  //check for forwarded headers (cloudflare, nginx, etc.)
  const forwarded = context.request.headers.get('cf-connecting-ip') ||
                   context.request.headers.get('x-forwarded-for') ||
                   context.request.headers.get('x-real-ip');
  
  if (forwarded) {
    //get first ip in case of multiple proxies
    return forwarded.split(',')[0].trim();
  }
  
  //fallback to direct connection
  return context.clientAddress || 'unknown';
}

//generate rate limit key
function generateRateLimitKey(context: APIContext, rule: RateLimitConfig): string {
  if (rule.keyGenerator) {
    return rule.keyGenerator(context);
  }
  
  const ip = getClientIP(context);
  const path = context.url.pathname;
  
  //for auth endpoints, include additional factors
  if (path.includes('/auth/')) {
    const userAgent = context.request.headers.get('user-agent') || '';
    const userAgentHash = btoa(userAgent).slice(0, 8); //short hash
    return `${ip}:${path}:${userAgentHash}`;
  }
  
  return `${ip}:${path}`;
}

//find matching rate limit rule
function findMatchingRule(pathname: string): RateLimitConfig | null {
  //exact match first
  if (RATE_LIMIT_RULES[pathname]) {
    return RATE_LIMIT_RULES[pathname];
  }
  
  //prefix match (longest first)
  const prefixes = Object.keys(RATE_LIMIT_RULES).sort((a, b) => b.length - a.length);
  
  for (const prefix of prefixes) {
    if (pathname.startsWith(prefix)) {
      return RATE_LIMIT_RULES[prefix];
    }
  }
  
  return null;
}

//check if ip is whitelisted
function isWhitelisted(ip: string): boolean {
  return DDOS_CONFIG.WHITELIST.includes(ip) || ip.startsWith('192.168.') || ip.startsWith('10.');
}

//sliding window rate limiting
function checkRateLimit(bucket: RateLimitBucket, rule: RateLimitConfig): {
  allowed: boolean;
  remainingRequests: number;
  resetTime: number;
} {
  const now = Date.now();
  const windowStart = now - rule.windowMs;
  
  //remove old requests outside the window
  bucket.requests = bucket.requests.filter(timestamp => timestamp > windowStart);
  
  //check if currently blocked
  if (bucket.blocked && bucket.blockedUntil && now < bucket.blockedUntil) {
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: bucket.blockedUntil
    };
  }
  
  //unblock if penalty period is over
  if (bucket.blocked && bucket.blockedUntil && now >= bucket.blockedUntil) {
    bucket.blocked = false;
    bucket.blockedUntil = undefined;
  }
  
  //check if limit exceeded
  if (bucket.requests.length >= rule.maxRequests) {
    //apply penalty
    const penaltyDuration = Math.min(
      DDOS_CONFIG.MIN_PENALTY_MS * Math.pow(DDOS_CONFIG.PENALTY_MULTIPLIER, bucket.requests.length - rule.maxRequests),
      DDOS_CONFIG.MAX_PENALTY_MS
    );
    
    bucket.blocked = true;
    bucket.blockedUntil = now + penaltyDuration;
    
    if (rule.onLimitReached) {
      //defer execution to avoid blocking the response
      setTimeout(() => rule.onLimitReached!(context as any), 0);
    }
    
    return {
      allowed: false,
      remainingRequests: 0,
      resetTime: bucket.blockedUntil
    };
  }
  
  return {
    allowed: true,
    remainingRequests: rule.maxRequests - bucket.requests.length,
    resetTime: windowStart + rule.windowMs
  };
}

//ddos burst detection
function checkDDoSProtection(ip: string): {
  blocked: boolean;
  reason?: string;
} {
  const burstKey = `burst:${ip}`;
  const burstBucket = rateLimitStore.get(burstKey);
  
  if (!burstBucket) {
    rateLimitStore.set(burstKey, {
      requests: [Date.now()],
      blocked: false
    });
    return { blocked: false };
  }
  
  const now = Date.now();
  const burstWindowStart = now - DDOS_CONFIG.BURST_WINDOW_MS;
  
  //remove old burst requests
  burstBucket.requests = burstBucket.requests.filter(timestamp => timestamp > burstWindowStart);
  burstBucket.requests.push(now);
  
  //check for burst attack
  if (burstBucket.requests.length > DDOS_CONFIG.BURST_THRESHOLD) {
    burstBucket.blocked = true;
    burstBucket.blockedUntil = now + DDOS_CONFIG.MIN_PENALTY_MS;
    
    return {
      blocked: true,
      reason: 'DDoS burst protection triggered'
    };
  }
  
  return { blocked: false };
}

//main rate limiting middleware
export async function rateLimitMiddleware(
  context: APIContext,
  next: MiddlewareNext
): Promise<{
  allowed: boolean;
  retryAfter?: number;
  error?: string;
}> {
  const ip = getClientIP(context);
  const pathname = context.url.pathname;
  
  //skip rate limiting for whitelisted ips in development
  if (isWhitelisted(ip) && import.meta.env.DEV) {
    return { allowed: true };
  }
  
  //ddos protection check
  const ddosCheck = checkDDoSProtection(ip);
  if (ddosCheck.blocked) {
    return {
      allowed: false,
      retryAfter: Math.ceil(DDOS_CONFIG.MIN_PENALTY_MS / 1000),
      error: ddosCheck.reason
    };
  }
  
  //find applicable rate limit rule
  const rule = findMatchingRule(pathname);
  if (!rule) {
    return { allowed: true }; //no rule, allow request
  }
  
  //generate unique key for this client/endpoint combination
  const key = generateRateLimitKey(context, rule);
  let bucket = rateLimitStore.get(key);
  
  if (!bucket) {
    bucket = {
      requests: [],
      blocked: false
    };
    rateLimitStore.set(key, bucket);
  }
  
  //check rate limit
  const limitCheck = checkRateLimit(bucket, rule);
  
  if (!limitCheck.allowed) {
    return {
      allowed: false,
      retryAfter: Math.ceil((limitCheck.resetTime - Date.now()) / 1000),
      error: 'Rate limit exceeded'
    };
  }
  
  //record this request
  bucket.requests.push(Date.now());
  
  //add rate limit headers to response
  const response = await next();
  const headers = new Headers(response.headers);
  
  headers.set('X-RateLimit-Limit', rule.maxRequests.toString());
  headers.set('X-RateLimit-Remaining', limitCheck.remainingRequests.toString());
  headers.set('X-RateLimit-Reset', Math.ceil(limitCheck.resetTime / 1000).toString());
  headers.set('X-RateLimit-Window', Math.ceil(rule.windowMs / 1000).toString());
  
  return { allowed: true };
}

//cleanup expired entries (call periodically)
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; //24 hours
  
  for (const [key, bucket] of rateLimitStore.entries()) {
    //remove if no recent requests and not blocked
    const lastRequest = bucket.requests[bucket.requests.length - 1];
    const isStale = !lastRequest || (now - lastRequest > maxAge);
    const notBlocked = !bucket.blocked || (bucket.blockedUntil && now > bucket.blockedUntil);
    
    if (isStale && notBlocked) {
      rateLimitStore.delete(key);
    }
  }
}

//get rate limit stats for monitoring
export function getRateLimitStats(): {
  totalKeys: number;
  blockedKeys: number;
  topOffenders: Array<{ key: string; requests: number; blocked: boolean }>;
} {
  const stats = {
    totalKeys: rateLimitStore.size,
    blockedKeys: 0,
    topOffenders: [] as Array<{ key: string; requests: number; blocked: boolean }>
  };
  
  const entries = Array.from(rateLimitStore.entries())
    .map(([key, bucket]) => ({
      key,
      requests: bucket.requests.length,
      blocked: bucket.blocked
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10);
  
  stats.topOffenders = entries;
  stats.blockedKeys = entries.filter(entry => entry.blocked).length;
  
  return stats;
}

//manual block/unblock functions for administration
export function blockIP(ip: string, durationMs: number = DDOS_CONFIG.MIN_PENALTY_MS): void {
  const key = `manual:${ip}`;
  rateLimitStore.set(key, {
    requests: [],
    blocked: true,
    blockedUntil: Date.now() + durationMs
  });
}

export function unblockIP(ip: string): void {
  const patterns = [`manual:${ip}`, `burst:${ip}`];
  
  for (const pattern of patterns) {
    const bucket = rateLimitStore.get(pattern);
    if (bucket) {
      bucket.blocked = false;
      bucket.blockedUntil = undefined;
    }
  }
}

//setup cleanup interval (call once at startup)
let cleanupInterval: NodeJS.Timeout;

export function initRateLimitCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  //cleanup every 30 minutes
  cleanupInterval = setInterval(cleanupRateLimitStore, 30 * 60 * 1000);
}

//shutdown cleanup
export function shutdownRateLimit(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  rateLimitStore.clear();
}