import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  console.log('Environment check endpoint called');
  
  try {
    const envCheck = {
      NODE_ENV: import.meta.env.NODE_ENV,
      MODE: import.meta.env.MODE,
      PROD: import.meta.env.PROD,
      DEV: import.meta.env.DEV,
      SSR: import.meta.env.SSR,
      // Don't expose sensitive values, just check if they exist
      HAS_TURSO_URL: !!import.meta.env.TURSO_DATABASE_URL,
      HAS_JWT_SECRET: !!import.meta.env.JWT_SECRET,
      HAS_ADMIN_EMAIL: !!import.meta.env.ADMIN_EMAIL,
    };
    
    console.log('Environment check:', envCheck);
    
    return new Response(JSON.stringify({
      success: true,
      environment: envCheck,
      processEnv: {
        NODE_ENV: process.env.NODE_ENV,
        // Check a few common env vars exist
        hasPath: !!process.env.PATH,
        hasHome: !!process.env.HOME || !!process.env.USERPROFILE,
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Environment check error:', error);
    return new Response(JSON.stringify({
      error: 'Environment check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};