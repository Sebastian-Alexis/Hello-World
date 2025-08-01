import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  try {
    console.log('Test endpoint called');
    
    // Test 1: Basic API functionality
    console.log('✅ API endpoint accessible');
    
    // Test 2: Database import
    try {
      const { db } = await import('../../../lib/db/queries');
      console.log('✅ Database queries imported successfully');
      
      // Test 3: Database connection
      try {
        // Try a simple database operation - get blog categories
        const categories = await db.getBlogCategories();
        console.log('✅ Database connection working, categories:', categories);
        
        return new Response(JSON.stringify({
          success: true,
          message: 'All tests passed',
          tests: {
            api: 'OK',
            import: 'OK',
            database: 'OK',
            categories: categories
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (dbError) {
        console.error('❌ Database connection failed:', dbError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Database connection failed',
          details: dbError instanceof Error ? dbError.message : 'Unknown database error',
          stack: dbError instanceof Error ? dbError.stack : null
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    } catch (importError) {
      console.error('❌ Database import failed:', importError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Database import failed',
        details: importError instanceof Error ? importError.message : 'Unknown import error',
        stack: importError instanceof Error ? importError.stack : null
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('❌ Test endpoint failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Test endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};