import type { APIRoute } from 'astro';
import { refreshTokens } from '../../../lib/auth/index.js';
import { createSessionCookie } from '../../../lib/auth/session.js';
import { db } from '../../../lib/db/queries.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    //extract refresh token from cookie
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No refresh token provided',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //parse cookies
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        acc[key] = decodeURIComponent(value);
      }
      return acc;
    }, {} as Record<string, string>);

    const refreshToken = cookies['refresh_token'];
    if (!refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No refresh token provided',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //validate that session still exists in database
    const sessionValidator = async (sessionId: string): Promise<boolean> => {
      const session = await db.findSessionByToken(sessionId);
      return session !== null;
    };

    //refresh tokens
    const refreshResult = await refreshTokens(refreshToken, sessionValidator);

    if (!refreshResult.success) {
      return new Response(JSON.stringify({
        success: false,
        error: refreshResult.error || 'Token refresh failed',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //prepare response with new access token cookie
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (refreshResult.tokens) {
      responseHeaders['Set-Cookie'] = createSessionCookie(refreshResult.tokens.accessToken);
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        expiresAt: refreshResult.tokens?.expiresAt.toISOString(),
      },
      message: 'Token refreshed successfully',
    }), {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Token refresh API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Token refresh failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};