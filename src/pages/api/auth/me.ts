import type { APIRoute } from 'astro';
import { authMiddleware } from '../../../lib/auth/middleware.js';
import { db } from '../../../lib/db/queries.js';

export const GET: APIRoute = async ({ request }) => {
  try {
    //require authentication
    const auth = await authMiddleware(request, { required: true });

    if (!auth.success) {
      return new Response(JSON.stringify({
        success: false,
        error: auth.error || 'Authentication required',
      }), {
        status: auth.status || 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!auth.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found in token',
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //get fresh user data from database
    const user = await db.findUserById(auth.user.userId);
    if (!user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'User not found',
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    //prepare user data for response (exclude sensitive fields)
    const userData = {
      id: user.id,
      email: user.email,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      avatar_url: user.avatar_url,
      bio: user.bio,
      is_active: user.is_active,
      email_verified: user.email_verified,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: userData,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('User info API error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};