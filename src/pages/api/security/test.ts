//security testing api endpoint
import type { APIRoute } from 'astro';
import { createSecureApiHandler, SecurityLevel } from '../../../lib/security/api-security.js';
import { runSecurityTests, performSecurityHealthCheck } from '../../../lib/security/testing.js';
import { z } from 'zod';

//security test request schema
const securityTestSchema = z.object({
  categories: z.array(z.string()).optional(),
  includeDetails: z.boolean().optional(),
});

export const GET = createSecureApiHandler(
  async (context) => {
    //perform quick health check
    const healthCheck = performSecurityHealthCheck();
    
    return {
      healthCheck,
      timestamp: new Date().toISOString(),
      environment: import.meta.env.DEV ? 'development' : 'production',
    };
  },
  {
    securityLevel: SecurityLevel.ADMIN,
    allowedMethods: ['GET'],
  }
);

export const POST = createSecureApiHandler(
  async (context, data) => {
    //run comprehensive security tests
    const testResults = await runSecurityTests(context);
    
    //filter results if specific categories requested
    if (data?.categories && Array.isArray(data.categories)) {
      testResults.results = testResults.results.filter(result => 
        data.categories.includes(result.category)
      );
    }
    
    //remove details if not requested
    if (!data?.includeDetails) {
      testResults.results = testResults.results.map(result => ({
        ...result,
        details: undefined,
      }));
    }
    
    return {
      ...testResults,
      timestamp: new Date().toISOString(),
      environment: import.meta.env.DEV ? 'development' : 'production',
    };
  },
  {
    securityLevel: SecurityLevel.ADMIN,
    allowedMethods: ['POST'],
    schema: securityTestSchema,
  }
);