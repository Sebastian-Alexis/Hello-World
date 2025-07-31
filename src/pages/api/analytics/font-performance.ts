import type { APIRoute } from 'astro';

//prevent prerendering for server-side API endpoint
export const prerender = false;

//handle font performance metrics
export const POST: APIRoute = async ({ request }) => {
  try {
    //skip content-type check and body parsing for now
    //just log that we received the request and return success
    console.log('Font performance request received from:', request.headers.get('user-agent'));
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Font performance metrics recorded'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Font performance tracking error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};