import type { APIRoute } from 'astro';

//ultra-simple blog post creation for testing
export const POST: APIRoute = async ({ request }) => {
  console.log('=== SIMPLE BLOG ENDPOINT CALLED ===');
  
  try {
    console.log('1. Request method:', request.method);
    console.log('2. Request URL:', request.url);
    
    const headers = Object.fromEntries(request.headers.entries());
    console.log('3. Request headers:', headers);
    console.log('4. Content-Type:', headers['content-type']);
    
    // Let's try to read the body safely
    let bodyInfo = 'No body';
    try {
      if (headers['content-type']?.includes('multipart/form-data')) {
        console.log('5. Body type: FormData detected');
        const formData = await request.formData();
        const formKeys = Array.from(formData.keys());
        console.log('6. FormData keys:', formKeys);
        bodyInfo = `FormData with keys: ${formKeys.join(', ')}`;
      } else {
        console.log('5. Body type: Text/JSON');
        const body = await request.text();
        console.log('6. Body content:', body.substring(0, 200));
        bodyInfo = `Text body (${body.length} chars)`;
      }
    } catch (bodyError) {
      console.error('7. Body reading error:', bodyError);
      bodyInfo = `Body read failed: ${bodyError instanceof Error ? bodyError.message : 'Unknown'}`;
    }
    
    console.log('8. Returning success response...');
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Endpoint is working!',
      timestamp: new Date().toISOString(),
      requestInfo: {
        method: request.method,
        url: request.url,
        contentType: headers['content-type'],
        bodyInfo
      }
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    });

  } catch (error) {
    console.error('=== BLOG SIMPLE ERROR ===');
    console.error('Error:', error);
    console.error('Error type:', typeof error);
    console.error('Error constructor:', error?.constructor?.name);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

//also add a GET method for testing
export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'Blog-simple endpoint is available. Use POST to submit data.',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};