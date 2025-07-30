import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getEnv } from '../env/index.js';
import type { User } from '../db/types.js';

//jwt payload interface extending standard JWT claims
export interface TokenPayload extends JWTPayload {
  userId: number;
  email: string;
  role: User['role'];
  username: string;
  sessionId?: string;
  type: 'access' | 'refresh';
}

//refresh token specific payload
export interface RefreshTokenPayload extends TokenPayload {
  type: 'refresh';
  sessionId: string;
}

//jwt configuration with security best practices
export const JWT_CONFIG = {
  ACCESS_TOKEN_EXPIRES: '15m', //short-lived for security
  REFRESH_TOKEN_EXPIRES: '7d', //longer for user convenience
  ALGORITHM: 'HS256' as const, //using HS256 for simplicity, RS256 recommended for production
  ISSUER: 'hello-world-app',
  AUDIENCE: 'hello-world-users',
} as const;

//gets jwt secret as Uint8Array for jose library
function getJwtSecret(): Uint8Array {
  const env = getEnv();
  return new TextEncoder().encode(env.JWT_SECRET);
}

//creates access token with user information
export async function createAccessToken(user: {
  id: number;
  email: string;
  role: User['role'];
  username: string;
}, sessionId?: string): Promise<string> {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    username: user.username,
    type: 'access',
    sessionId,
    iat: now,
    exp: now + (15 * 60), //15 minutes
    iss: JWT_CONFIG.ISSUER,
    aud: JWT_CONFIG.AUDIENCE,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_CONFIG.ALGORITHM })
    .sign(secret);
}

//creates refresh token for session management
export async function createRefreshToken(user: {
  id: number;
  email: string;
  role: User['role'];
  username: string;
}, sessionId: string): Promise<string> {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  
  const payload: RefreshTokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    username: user.username,
    type: 'refresh',
    sessionId,
    iat: now,
    exp: now + (7 * 24 * 60 * 60), //7 days
    iss: JWT_CONFIG.ISSUER,
    aud: JWT_CONFIG.AUDIENCE,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_CONFIG.ALGORITHM })
    .sign(secret);
}

//creates both access and refresh tokens
export async function createTokenPair(user: {
  id: number;
  email: string;
  role: User['role'];
  username: string;
}, sessionId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(user, sessionId),
    createRefreshToken(user, sessionId),
  ]);

  const expiresAt = new Date(Date.now() + (15 * 60 * 1000)); //15 minutes from now

  return {
    accessToken,
    refreshToken,
    expiresAt,
  };
}

//verifies and decodes jwt token
export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const secret = getJwtSecret();
    
    const { payload } = await jwtVerify(token, secret, {
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE,
    });

    //validate required fields
    if (
      typeof payload.userId !== 'number' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.username !== 'string' ||
      typeof payload.type !== 'string'
    ) {
      throw new Error('Invalid token payload structure');
    }

    return payload as TokenPayload;
  } catch (error) {
    if (error instanceof Error) {
      //map jose errors to more specific messages
      if (error.message.includes('expired')) {
        throw new Error('Token has expired');
      }
      if (error.message.includes('invalid')) {
        throw new Error('Invalid token');
      }
      if (error.message.includes('malformed')) {
        throw new Error('Malformed token');
      }
    }
    throw new Error('Token verification failed');
  }
}

//extracts token from authorization header
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  return match ? match[1] : null;
}

//checks if token is expired without verification (for client-side)
export function isTokenExpired(token: string): boolean {
  try {
    //decode without verification to check expiration
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    return payload.exp ? payload.exp < now : true;
  } catch {
    return true;
  }
}

//gets time until token expires
export function getTokenTimeToExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    return payload.exp ? Math.max(0, payload.exp - now) : null;
  } catch {
    return null;
  }
}

//refreshes access token using refresh token
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const payload = await verifyToken(refreshToken);
  
  if (payload.type !== 'refresh') {
    throw new Error('Invalid refresh token type');
  }
  
  if (!payload.sessionId) {
    throw new Error('Missing session ID in refresh token');
  }

  const accessToken = await createAccessToken({
    id: payload.userId,
    email: payload.email,
    role: payload.role,
    username: payload.username,
  }, payload.sessionId);

  const expiresAt = new Date(Date.now() + (15 * 60 * 1000));

  return {
    accessToken,
    expiresAt,
  };
}

//validates token payload structure and permissions
export function validateTokenPayload(payload: TokenPayload, requiredRole?: User['role']): boolean {
  //check required fields
  if (!payload.userId || !payload.email || !payload.role || !payload.username) {
    return false;
  }

  //check role hierarchy if required
  if (requiredRole) {
    const roleHierarchy: Record<User['role'], number> = {
      viewer: 1,
      editor: 2,
      admin: 3,
    };

    const userLevel = roleHierarchy[payload.role];
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return false;
    }
  }

  return true;
}

//creates a jwt for password reset (short-lived)
export async function createPasswordResetToken(userId: number, email: string): Promise<string> {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    userId,
    email,
    type: 'password_reset',
    iat: now,
    exp: now + (30 * 60), //30 minutes for password reset
    iss: JWT_CONFIG.ISSUER,
    aud: JWT_CONFIG.AUDIENCE,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_CONFIG.ALGORITHM })
    .sign(secret);
}

//creates a jwt for email verification (longer-lived)
export async function createEmailVerificationToken(userId: number, email: string): Promise<string> {
  const secret = getJwtSecret();
  const now = Math.floor(Date.now() / 1000);
  
  const payload = {
    userId,
    email,
    type: 'email_verification',
    iat: now,
    exp: now + (24 * 60 * 60), //24 hours for email verification
    iss: JWT_CONFIG.ISSUER,
    aud: JWT_CONFIG.AUDIENCE,
  };

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: JWT_CONFIG.ALGORITHM })
    .sign(secret);
}