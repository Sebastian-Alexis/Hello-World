//main authentication and security exports
export * from './jwt.js';
export * from './password.js';
export * from './session.js';
export * from './middleware.js';
export * from './utils.js';

//type re-exports for convenience
export type { TokenPayload, RefreshTokenPayload } from './jwt.js';
export type { PasswordValidationResult } from './password.js';
export type { SessionData, SessionActivity } from './session.js';
export type { SecurityEvent } from './utils.js';

//common authentication workflow helpers
import { createTokenPair, verifyToken } from './jwt.js';
import { hashPassword, verifyPassword } from './password.js';
import { createSession, validateSession } from './session.js';
import { authMiddleware, securityMiddleware } from './middleware.js';
import type { User } from '../db/types.js';

//complete authentication flow
export async function authenticateUser(
  email: string,
  password: string,
  userRecord: User,
  sessionOptions?: {
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<{
  success: boolean;
  error?: string;
  tokens?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
  };
  session?: ReturnType<typeof createSession>;
}> {
  try {
    //verify password
    const isValidPassword = await verifyPassword(password, userRecord.password_hash);
    if (!isValidPassword) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    //check if user is active
    if (!userRecord.is_active) {
      return { success: false, error: 'Account is disabled' };
    }
    
    //create session
    const session = createSession(userRecord, sessionOptions);
    
    //create tokens
    const tokens = await createTokenPair(userRecord, session.id);
    
    return {
      success: true,
      tokens,
      session,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

//user registration flow
export async function registerUser(userData: {
  email: string;
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  role?: User['role'];
}): Promise<{
  success: boolean;
  error?: string;
  hashedPassword?: string;
}> {
  try {
    //hash password
    const hashedPassword = await hashPassword(userData.password);
    
    return {
      success: true,
      hashedPassword,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Registration failed',
    };
  }
}

//token refresh flow  
export async function refreshTokens(
  refreshToken: string,
  sessionValidator?: (sessionId: string) => Promise<boolean>
): Promise<{
  success: boolean;
  error?: string;
  tokens?: {
    accessToken: string;
    expiresAt: Date;
  };
}> {
  try {
    //verify refresh token
    const payload = await verifyToken(refreshToken);
    
    if (payload.type !== 'refresh' || !payload.sessionId) {
      return { success: false, error: 'Invalid refresh token' };
    }
    
    //optionally validate session still exists
    if (sessionValidator) {
      const sessionExists = await sessionValidator(payload.sessionId);
      if (!sessionExists) {
        return { success: false, error: 'Session no longer valid' };
      }
    }
    
    //create new access token
    const { accessToken, expiresAt } = await (await import('./jwt.js')).refreshAccessToken(refreshToken);
    
    return {
      success: true,
      tokens: { accessToken, expiresAt },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Token refresh failed',
    };
  }
}

//comprehensive security check for requests
export async function secureRequest(
  request: Request,
  options: {
    requireAuth?: boolean;
    roles?: User['role'][];
    rateLimit?: boolean;
    csrf?: boolean;
  } = {}
): Promise<{
  success: boolean;
  error?: string;
  status?: number;
  headers?: Record<string, string>;
  user?: ReturnType<typeof verifyToken> extends Promise<infer T> ? T : never;
}> {
  return await securityMiddleware(request, {
    auth: options.requireAuth ? { required: true, roles: options.roles } : undefined,
    rateLimit: options.rateLimit ? {} : false,
    csrf: options.csrf,
    headers: { csp: true },
  });
}

//utility for checking user permissions
export function hasPermission(
  userRole: User['role'],
  requiredRole: User['role']
): boolean {
  const roleHierarchy: Record<User['role'], number> = {
    viewer: 1,
    editor: 2,
    admin: 3,
  };
  
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
}

//utility for checking multiple permissions
export function hasAnyPermission(
  userRole: User['role'],
  requiredRoles: User['role'][]
): boolean {
  return requiredRoles.some(role => hasPermission(userRole, role));
}

//security configuration presets
export const securityPresets = {
  //public endpoints - no auth required
  public: {
    requireAuth: false,
    rateLimit: true,
    csrf: false,
  },
  
  //authenticated endpoints
  authenticated: {
    requireAuth: true,
    rateLimit: true,
    csrf: true,
  },
  
  //admin-only endpoints
  admin: {
    requireAuth: true,
    roles: ['admin'] as User['role'][],
    rateLimit: true,
    csrf: true,
  },
  
  //api endpoints
  api: {
    requireAuth: true,
    rateLimit: true,
    csrf: false, //apis typically use tokens, not csrf
  },
  
  //high-security endpoints (user management, etc)
  highSecurity: {
    requireAuth: true,
    roles: ['admin'] as User['role'][],
    rateLimit: true,
    csrf: true,
  },
} as const;