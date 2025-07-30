import type { APIRoute } from 'astro';
import { authMiddleware } from '../../../lib/auth/middleware.js';
import { clearSessionCookie, clearRefreshTokenCookie, extractSessionFromCookie } from '../../../lib/auth/session.js';
import { db } from '../../../lib/db/queries.js';

export const POST: APIRoute = async ({ request }) => {
  try {
    //apply auth middleware (optional - allow logout even if token is expired)
    const auth = await authMiddleware(request, { required: false });

    //extract session token from cookie
    const cookieHeader = request.headers.get('Cookie');
    const sessionToken = extractSessionFromCookie(cookieHeader);

    //delete session from database if we have a session token
    if (sessionToken) {
      try {
        await db.deleteSession(sessionToken);
      } catch (error) {
        //don't fail logout if session deletion fails
        console.warn('Failed to delete session from database:', error);
      }
    }

    //prepare response headers to clear cookies
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    //clear session and refresh token cookies
    const cookies = [
      clearSessionCookie(),
      clearRefreshTokenCookie(),
    ];

    responseHeaders['Set-Cookie'] = cookies.join(', ');

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully',
    }), {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Logout API error:', error);
    
    //still clear cookies even if there's an error
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Set-Cookie': [clearSessionCookie(), clearRefreshTokenCookie()].join(', '),
    };

    return new Response(JSON.stringify({
      success: true,
      message: 'Logged out successfully',
    }), {
      status: 200,
      headers: responseHeaders,
    });
  }
};