//security monitoring api endpoint
import type { APIRoute } from 'astro';
import { createSecureApiHandler, SecurityLevel } from '../../../lib/security/api-security.js';
import { 
  getSecurityMetrics, 
  getSecurityEvents, 
  detectThreats,
  SecurityEventType,
  Severity 
} from '../../../lib/security/monitoring.js';
import { getRateLimitStats } from '../../../middleware/rate-limiting.js';
import { getCSRFStats } from '../../../lib/security/csrf-protection.js';
import { z } from 'zod';

//monitoring query schema
const monitoringQuerySchema = z.object({
  timeWindow: z.number().min(60000).max(7 * 24 * 60 * 60 * 1000).optional(), //1 minute to 7 days
  eventType: z.nativeEnum(SecurityEventType).optional(),
  severity: z.nativeEnum(Severity).optional(),
  limit: z.number().min(1).max(1000).optional(),
});

export const GET = createSecureApiHandler(
  async (context, data) => {
    const timeWindow = data?.timeWindow || 24 * 60 * 60 * 1000; //default 24 hours
    
    //get security metrics
    const securityMetrics = getSecurityMetrics(timeWindow);
    
    //get recent security events
    const recentEvents = getSecurityEvents({
      type: data?.eventType,
      severity: data?.severity,
      since: new Date(Date.now() - timeWindow),
      limit: data?.limit || 100,
    });
    
    //get rate limiting stats
    const rateLimitStats = getRateLimitStats();
    
    //get csrf stats
    const csrfStats = getCSRFStats();
    
    //detect current threats
    const threats = detectThreats();
    
    return {
      metrics: securityMetrics,
      events: recentEvents.slice(0, 20), //limit for api response
      rateLimiting: rateLimitStats,
      csrf: csrfStats,
      threats,
      timeWindow,
      timestamp: new Date().toISOString(),
    };
  },
  {
    securityLevel: SecurityLevel.ADMIN,
    allowedMethods: ['GET'],
    schema: monitoringQuerySchema,
  }
);

//endpoint to resolve security events
const resolveEventSchema = z.object({
  eventId: z.string(),
  notes: z.string().optional(),
});

export const POST = createSecureApiHandler(
  async (context, data) => {
    const { resolveSecurityEvent } = await import('../../../lib/security/monitoring.js');
    
    const resolved = resolveSecurityEvent(
      data.eventId,
      context.locals.user?.username || 'admin',
      data.notes
    );
    
    if (!resolved) {
      throw new Error('Security event not found');
    }
    
    return {
      success: true,
      message: 'Security event resolved',
      eventId: data.eventId,
    };
  },
  {
    securityLevel: SecurityLevel.ADMIN,
    allowedMethods: ['POST'],
    schema: resolveEventSchema,
  }
);