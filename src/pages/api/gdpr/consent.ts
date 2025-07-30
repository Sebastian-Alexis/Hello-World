//gdpr consent management api endpoint
import type { APIRoute } from 'astro';
import { createSecureApiHandler, SecurityLevel } from '../../../lib/security/api-security.js';
import { saveConsentPreferences, getConsentPreferences } from '../../../lib/security/gdpr-compliance.js';
import { z } from 'zod';

//consent preferences schema
const consentSchema = z.object({
  necessary: z.boolean().default(true),
  functional: z.boolean().default(false),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
});

export const GET = createSecureApiHandler(
  async (context) => {
    //get current consent preferences
    const preferences = getConsentPreferences(context);
    
    return {
      preferences,
      hasConsent: !!preferences,
    };
  },
  {
    securityLevel: SecurityLevel.PUBLIC,
    allowedMethods: ['GET'],
  }
);

export const POST = createSecureApiHandler(
  async (context, data) => {
    //save consent preferences
    const cookieValue = saveConsentPreferences(data);
    
    //create response with consent cookie
    const response = new Response(JSON.stringify({
      success: true,
      message: 'Consent preferences saved',
      preferences: data,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieValue,
      },
    });
    
    return response;
  },
  {
    securityLevel: SecurityLevel.PUBLIC,
    allowedMethods: ['POST'],
    schema: consentSchema,
  }
);