import type { APIRoute } from 'astro';
import { securityMiddleware } from '../../../lib/auth/middleware.js';
import { authenticateUser } from '../../../lib/auth/index.js';
import { createSessionCookie, createRefreshTokenCookie } from '../../../lib/auth/session.js';
import { db } from '../../../lib/db/queries.js';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    //apply security middleware with rate limiting
    const security = await securityMiddleware(request, {
      rateLimit: {
        windowMs: 15 * 60 * 1000, //15 minutes
        maxRequests: 5, //5 attempts per 15 minutes
      },
      headers: { csp: true },
    });

    if (!security.success) {
      return new Response(JSON.stringify({
        success: false,
        error: security.error || 'Security check failed',
      }), {
        status: security.status || 500,
        headers: {
          'Content-Type': 'application/json',
          ...security.headers,
        },
      });
    }

    //parse request body
    const body = await request.json();
    const { email, password, remember_me = false } = body;

    //validation
    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email and password are required',
      }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          ...security.headers,
        },
      });
    }

    //find user
    const user = await db.findUserByEmail(email);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password',
      }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          ...security.headers,
        },
      });
    }

    //authenticate user
    const authResult = await authenticateUser(email, password, user, {
      ipAddress: clientAddress,
      userAgent: request.headers.get('User-Agent') || undefined,
    });

    if (!authResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: authResult.error || 'Authentication failed',
      }), {
        status: 401,
        headers: { 
          'Content-Type': 'application/json',
          ...security.headers,
        },
      });
    }

    //update last login
    await db.updateUserLastLogin(user.id);

    //create session in database
    if (authResult.session) {
      await db.createUserSession({
        id: authResult.session.id,
        user_id: authResult.session.userId,
        expires_at: authResult.session.expiresAt.toISOString(),
        ip_address: authResult.session.ipAddress,
        user_agent: authResult.session.userAgent,
      });
    }

    //prepare response headers with cookies
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...security.headers,
    };

    const cookies: string[] = [];

    if (authResult.tokens) {
      //set session cookie (access token)
      cookies.push(createSessionCookie(authResult.tokens.accessToken));

      //set refresh token cookie if remember me is enabled
      if (remember_me && authResult.tokens.refreshToken) {
        cookies.push(createRefreshTokenCookie(authResult.tokens.refreshToken));
      }
    }

    if (cookies.length > 0) {
      responseHeaders['Set-Cookie'] = cookies.join(', ');
    }

    //prepare user data for response
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      avatar_url: user.avatar_url,
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: userData,
        session: authResult.session ? {
          id: authResult.session.id,
          expiresAt: authResult.session.expiresAt.toISOString(),
        } : undefined,
      },
      message: 'Login successful',
    }), {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Login API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};