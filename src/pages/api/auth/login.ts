import type { APIRoute } from 'astro';
import { rateLimitMiddleware, securityHeadersMiddleware } from '../../../lib/auth/middleware.ts';
import { authenticateUser } from '../../../lib/auth/index.ts';
import { createSessionCookie, createRefreshTokenCookie } from '../../../lib/auth/session.ts';
import { db } from '../../../lib/db/queries.ts';

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const startTime = Date.now();
  
  try {
    //apply rate limiting manually (since we bypass middleware)
    const rateLimitResult = await rateLimitMiddleware(request);
    if (!rateLimitResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many login attempts. Please try again later.',
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': '300', //5 minutes
        },
      });
    }

    //parse request body first (before any middleware that might consume it)
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

    //get security headers
    const securityHeaders = securityHeadersMiddleware(request, { csp: true });
    
    //prepare response headers with cookies and security
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...securityHeaders.headers,
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

    //log successful login
    console.log(`[${new Date().toISOString()}] INFO Login successful | User: ${user.email} | IP: ${clientAddress} | Time: ${Date.now() - startTime}ms`);

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
    //log failed login attempt
    console.error(`[${new Date().toISOString()}] ERROR Login failed | IP: ${clientAddress} | Time: ${Date.now() - startTime}ms | Error:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};