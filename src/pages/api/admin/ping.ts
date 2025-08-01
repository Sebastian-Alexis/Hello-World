import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  console.log('Ping endpoint called');
  return new Response(JSON.stringify({ message: 'pong', timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST: APIRoute = async ({ request }) => {
  console.log('Ping POST endpoint called');
  
  try {
    const body = await request.text();
    console.log('Request body:', body);
    
    return new Response(JSON.stringify({ 
      message: 'POST pong', 
      timestamp: new Date().toISOString(),
      receivedBody: body 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Ping POST error:', error);
    return new Response(JSON.stringify({ 
      error: 'Ping POST failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};