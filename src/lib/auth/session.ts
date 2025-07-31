import { randomBytes } from 'crypto';
import { getEnv } from '../env/index.ts';
import type { User, UserSession } from '../db/types.ts';

//session configuration
export const SESSION_CONFIG = {
  COOKIE_NAME: 'session',
  REFRESH_COOKIE_NAME: 'refresh_token',
  EXPIRES_IN: 7 * 24 * 60 * 60 * 1000, //7 days in milliseconds
  CLEANUP_INTERVAL: 60 * 60 * 1000, //1 hour cleanup interval
  MAX_SESSIONS_PER_USER: 5, //limit concurrent sessions
} as const;

//secure cookie options
export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, //requires HTTPS in production
  sameSite: 'strict' as const,
  path: '/',
  maxAge: SESSION_CONFIG.EXPIRES_IN / 1000, //convert to seconds
} as const;

//session data interface
export interface SessionData {
  id: string;
  userId: number;
  user: {
    id: number;
    email: string;
    username: string;
    role: User['role'];
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

//generates cryptographically secure session id
export function generateSessionId(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

//creates a new session
export function createSession(
  user: Pick<User, 'id' | 'email' | 'username' | 'role' | 'first_name' | 'last_name' | 'avatar_url'>,
  options: {
    ipAddress?: string;
    userAgent?: string;
    expiresIn?: number;
  } = {}
): SessionData {
  const sessionId = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + (options.expiresIn || SESSION_CONFIG.EXPIRES_IN));
  
  return {
    id: sessionId,
    userId: user.id,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
    },
    createdAt: now,
    expiresAt,
    ipAddress: options.ipAddress,
    userAgent: options.userAgent,
    isActive: true,
  };
}

//validates session data
export function validateSession(session: SessionData): boolean {
  if (!session || !session.id || !session.userId || !session.user) {
    return false;
  }
  
  //check if session is expired
  if (session.expiresAt < new Date()) {
    return false;
  }
  
  //check if session is active
  if (!session.isActive) {
    return false;
  }
  
  return true;
}

//extracts session id from cookie string
export function extractSessionFromCookie(cookieString?: string): string | null {
  if (!cookieString) return null;
  
  const cookies = cookieString.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);
  
  return cookies[SESSION_CONFIG.COOKIE_NAME] || null;
}

//creates secure cookie string for session
export function createSessionCookie(sessionId: string, options: Partial<typeof COOKIE_OPTIONS> = {}): string {
  const env = getEnv();
  const cookieOptions = {
    ...COOKIE_OPTIONS,
    secure: env.NODE_ENV === 'production', //only secure in production
    ...options,
  };
  
  const parts = [
    `${SESSION_CONFIG.COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'HttpOnly',
    `Path=${cookieOptions.path}`,
    `Max-Age=${cookieOptions.maxAge}`,
    `SameSite=${cookieOptions.sameSite}`,
  ];
  
  if (cookieOptions.secure) {
    parts.push('Secure');
  }
  
  return parts.join('; ');
}

//creates cookie string to clear session
export function clearSessionCookie(): string {
  return `${SESSION_CONFIG.COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=strict`;
}

//creates refresh token cookie
export function createRefreshTokenCookie(refreshToken: string, options: Partial<typeof COOKIE_OPTIONS> = {}): string {
  const env = getEnv();
  const cookieOptions = {
    ...COOKIE_OPTIONS,
    secure: env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60, //7 days
    ...options,
  };
  
  const parts = [
    `${SESSION_CONFIG.REFRESH_COOKIE_NAME}=${encodeURIComponent(refreshToken)}`,
    'HttpOnly',
    `Path=${cookieOptions.path}`,
    `Max-Age=${cookieOptions.maxAge}`,
    `SameSite=${cookieOptions.sameSite}`,
  ];
  
  if (cookieOptions.secure) {
    parts.push('Secure');
  }
  
  return parts.join('; ');
}

//clears refresh token cookie
export function clearRefreshTokenCookie(): string {
  return `${SESSION_CONFIG.REFRESH_COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=strict`;
}

//extends session expiration
export function extendSession(session: SessionData, extensionMs: number = SESSION_CONFIG.EXPIRES_IN): SessionData {
  return {
    ...session,
    expiresAt: new Date(Date.now() + extensionMs),
  };
}

//checks if session needs refresh (within 1 day of expiry)
export function shouldRefreshSession(session: SessionData): boolean {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const timeUntilExpiry = session.expiresAt.getTime() - Date.now();
  return timeUntilExpiry < oneDayMs;
}

//validates session security context
export function validateSessionSecurity(
  session: SessionData,
  request: {
    ipAddress?: string;
    userAgent?: string;
  }
): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  let valid = true;
  
  //check ip address consistency (strict mode)
  if (session.ipAddress && request.ipAddress && session.ipAddress !== request.ipAddress) {
    warnings.push('IP address mismatch detected');
    //uncomment for strict ip validation
    //valid = false;
  }
  
  //check user agent consistency (looser validation)
  if (session.userAgent && request.userAgent) {
    //extract browser and os info for comparison
    const sessionBrowser = extractBrowserInfo(session.userAgent);
    const requestBrowser = extractBrowserInfo(request.userAgent);
    
    if (sessionBrowser !== requestBrowser) {
      warnings.push('Browser change detected');
      //uncomment for strict user agent validation
      //valid = false;
    }
  }
  
  return { valid, warnings };
}

//extracts basic browser info from user agent
function extractBrowserInfo(userAgent: string): string {
  const ua = userAgent.toLowerCase();
  
  if (ua.includes('chrome')) return 'chrome';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('edge')) return 'edge';
  if (ua.includes('opera')) return 'opera';
  
  return 'unknown';
}

//creates session fingerprint for additional security
export function createSessionFingerprint(request: {
  ipAddress?: string;
  userAgent?: string;
  acceptLanguage?: string;
  acceptEncoding?: string;
}): string {
  const fingerprint = JSON.stringify({
    ip: request.ipAddress || '',
    ua: request.userAgent || '',
    lang: request.acceptLanguage || '',
    enc: request.acceptEncoding || '',
  });
  
  //create a simple hash of the fingerprint
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; //convert to 32-bit integer
  }
  
  return hash.toString(36);
}

//session activity tracking
export interface SessionActivity {
  sessionId: string;
  action: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

//logs session activity
export function logSessionActivity(
  sessionId: string,
  action: string,
  context: {
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
  } = {}
): SessionActivity {
  return {
    sessionId,
    action,
    timestamp: new Date(),
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: context.metadata,
  };
}

//session cleanup utility
export function isSessionExpired(session: { expiresAt: Date | string }): boolean {
  const expiresAt = typeof session.expiresAt === 'string' 
    ? new Date(session.expiresAt) 
    : session.expiresAt;
    
  return expiresAt < new Date();
}

//converts database session to session data
export function dbSessionToSessionData(
  dbSession: UserSession,
  user: Pick<User, 'id' | 'email' | 'username' | 'role' | 'first_name' | 'last_name' | 'avatar_url'>
): SessionData {
  return {
    id: dbSession.id,
    userId: dbSession.user_id,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url,
    },
    createdAt: new Date(dbSession.created_at),
    expiresAt: new Date(dbSession.expires_at),
    ipAddress: dbSession.ip_address,
    userAgent: dbSession.user_agent,
    isActive: true,
  };
}