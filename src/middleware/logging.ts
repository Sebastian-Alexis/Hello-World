//security logging and monitoring middleware
import type { MiddlewareNext } from 'astro:middleware';
import type { APIContext } from 'astro';

//log levels
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

//security event types
enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'auth_success',
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHORIZATION_FAILURE = 'authz_failure',
  RATE_LIMIT_EXCEEDED = 'rate_limit',
  SUSPICIOUS_REQUEST = 'suspicious',
  XSS_ATTEMPT = 'xss_attempt',
  SQL_INJECTION_ATTEMPT = 'sql_injection',
  INVALID_INPUT = 'invalid_input',
  SESSION_HIJACK = 'session_hijack',
  BRUTE_FORCE = 'brute_force',
  DDOS_ATTEMPT = 'ddos',
}

//log entry interface
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  eventType?: SecurityEventType;
  message: string;
  context: {
    requestId: string;
    method: string;
    path: string;
    ip: string;
    userAgent: string;
    userId?: number;
    sessionId?: string;
    responseTime?: number;
    statusCode?: number;
    error?: string;
    extra?: Record<string, any>;
  };
}

//request tracking
const requestTracking = new Map<string, {
  startTime: number;
  ip: string;
  suspicious: boolean;
}>();

//threat detection patterns
const THREAT_PATTERNS = {
  //suspicious user agents
  SUSPICIOUS_USER_AGENTS: [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /burp/i,
    /nmap/i,
    /masscan/i,
    /zap/i,
    /w3af/i,
    /havij/i,
    /curl.*python/i,
  ],
  
  //suspicious paths
  SUSPICIOUS_PATHS: [
    /\/\.env/,
    /\/admin\/phpmyadmin/,
    /\/wp-admin/,
    /\/wp-login/,
    /\/xmlrpc\.php/,
    /\/config\.php/,
    /\/phpinfo\.php/,
    /\/\.git/,
    /\/\.svn/,
    /\/backup/,
    /\/db_dump/,
    /\/sql/,
  ],
  
  //suspicious query parameters
  SUSPICIOUS_PARAMS: [
    /union.*select/i,
    /script.*alert/i,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /\.\.\/\.\.\//,
    /etc\/passwd/,
    /windows\/system32/,
  ],
};

//generate unique request id
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

//detect suspicious requests
function detectSuspiciousActivity(context: APIContext): {
  suspicious: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  
  //check user agent
  const userAgent = context.request.headers.get('user-agent') || '';
  for (const pattern of THREAT_PATTERNS.SUSPICIOUS_USER_AGENTS) {
    if (pattern.test(userAgent)) {
      reasons.push(`Suspicious user agent: ${userAgent}`);
      break;
    }
  }
  
  //check path
  const path = context.url.pathname;
  for (const pattern of THREAT_PATTERNS.SUSPICIOUS_PATHS) {
    if (pattern.test(path)) {
      reasons.push(`Suspicious path: ${path}`);
      break;
    }
  }
  
  //check query parameters
  const query = context.url.search;
  if (query) {
    for (const pattern of THREAT_PATTERNS.SUSPICIOUS_PARAMS) {
      if (pattern.test(query)) {
        reasons.push(`Suspicious query: ${query}`);
        break;
      }
    }
  }
  
  //check for common attack patterns in headers
  const headers = context.request.headers;
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'host'];
  
  suspiciousHeaders.forEach(headerName => {
    const headerValue = headers.get(headerName);
    if (headerValue) {
      //check for header injection attempts
      if (headerValue.includes('\n') || headerValue.includes('\r')) {
        reasons.push(`Header injection attempt in ${headerName}`);
      }
      
      //check for suspicious host headers
      if (headerName === 'host' && !headerValue.includes(context.url.hostname)) {
        reasons.push(`Suspicious host header: ${headerValue}`);
      }
    }
  });
  
  return {
    suspicious: reasons.length > 0,
    reasons
  };
}

//format log entry for output
function formatLogEntry(entry: LogEntry): string {
  const levelName = LogLevel[entry.level];
  const timestamp = entry.timestamp;
  const requestId = entry.context.requestId;
  
  const baseInfo = `[${timestamp}] ${levelName} [${requestId}]`;
  const requestInfo = `${entry.context.method} ${entry.context.path}`;
  const clientInfo = `IP: ${entry.context.ip}`;
  
  let logLine = `${baseInfo} ${entry.message} | ${requestInfo} | ${clientInfo}`;
  
  if (entry.context.userId) {
    logLine += ` | User: ${entry.context.userId}`;
  }
  
  if (entry.context.responseTime) {
    logLine += ` | Time: ${entry.context.responseTime}ms`;
  }
  
  if (entry.context.statusCode) {
    logLine += ` | Status: ${entry.context.statusCode}`;
  }
  
  if (entry.context.error) {
    logLine += ` | Error: ${entry.context.error}`;
  }
  
  return logLine;
}

//write log entry
function writeLog(entry: LogEntry): void {
  const formattedLog = formatLogEntry(entry);
  
  //in development, log to console
  if (import.meta.env.DEV) {
    switch (entry.level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.info(formattedLog);
        break;
      case LogLevel.WARN:
        console.warn(formattedLog);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formattedLog);
        break;
    }
    return;
  }
  
  //in production, send to external logging service
  //this could be cloudflare logs, datadog, elasticsearch, etc.
  console.log(formattedLog);
  
  //for critical events, also send alerts
  if (entry.level >= LogLevel.ERROR) {
    sendSecurityAlert(entry);
  }
}

//send security alerts (implement based on your notification system)
function sendSecurityAlert(entry: LogEntry): void {
  //in production, integrate with:
  // - slack webhook
  // - email alerts
  // - pagerduty
  // - discord webhook
  // - sms alerts
  
  console.error('SECURITY ALERT:', entry);
  
  //example webhook call (implement your actual alerting)
  /*
  fetch('https://hooks.slack.com/your-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Security Alert: ${entry.message}`,
      attachments: [{
        color: 'danger',
        fields: [
          { title: 'IP', value: entry.context.ip, short: true },
          { title: 'Path', value: entry.context.path, short: true },
          { title: 'User Agent', value: entry.context.userAgent, short: false }
        ]
      }]
    })
  }).catch(err => console.error('Failed to send alert:', err));
  */
}

//main logging middleware
export async function loggingMiddleware(
  context: APIContext,
  next: MiddlewareNext
): Promise<void> {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const ip = context.clientAddress || 'unknown';
  const userAgent = context.request.headers.get('user-agent') || '';
  
  //store request info for tracking
  requestTracking.set(requestId, {
    startTime,
    ip,
    suspicious: false
  });
  
  //add request id to context
  context.locals.requestId = requestId;
  
  //detect suspicious activity
  const suspiciousCheck = detectSuspiciousActivity(context);
  if (suspiciousCheck.suspicious) {
    requestTracking.get(requestId)!.suspicious = true;
    
    //log suspicious activity immediately
    const suspiciousEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      eventType: SecurityEventType.SUSPICIOUS_REQUEST,
      message: `Suspicious request detected: ${suspiciousCheck.reasons.join(', ')}`,
      context: {
        requestId,
        method: context.request.method,
        path: context.url.pathname,
        ip,
        userAgent,
        extra: { reasons: suspiciousCheck.reasons }
      }
    };
    writeLog(suspiciousEntry);
  }
  
  //log request start
  const startEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: LogLevel.INFO,
    message: 'Request started',
    context: {
      requestId,
      method: context.request.method,
      path: context.url.pathname,
      ip,
      userAgent,
    }
  };
  writeLog(startEntry);
  
  let response: Response;
  let error: Error | null = null;
  
  try {
    response = await next();
  } catch (err) {
    error = err instanceof Error ? err : new Error('Unknown error');
    
    //create error response
    response = new Response('Internal Server Error', { status: 500 });
  }
  
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  
  //determine log level based on response
  let logLevel = LogLevel.INFO;
  if (response.status >= 500) {
    logLevel = LogLevel.ERROR;
  } else if (response.status >= 400) {
    logLevel = LogLevel.WARN;
  }
  
  //if this was a suspicious request and resulted in error, escalate
  const tracking = requestTracking.get(requestId);
  if (tracking?.suspicious && response.status >= 400) {
    logLevel = LogLevel.ERROR;
  }
  
  //log request completion
  const endEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: logLevel,
    message: error ? 'Request failed' : 'Request completed',
    context: {
      requestId,
      method: context.request.method,
      path: context.url.pathname,
      ip,
      userAgent,
      userId: context.locals.user?.userId,
      sessionId: context.locals.session?.id,
      responseTime,
      statusCode: response.status,
      error: error?.message,
    }
  };
  writeLog(endEntry);
  
  //cleanup tracking
  requestTracking.delete(requestId);
  
  return response;
}

//helper function to log security events from other middleware
export function logSecurityEvent(
  context: APIContext,
  eventType: SecurityEventType,
  message: string,
  level: LogLevel = LogLevel.WARN,
  extra?: Record<string, any>
): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    eventType,
    message,
    context: {
      requestId: context.locals.requestId || 'unknown',
      method: context.request.method,
      path: context.url.pathname,
      ip: context.clientAddress || 'unknown',
      userAgent: context.request.headers.get('user-agent') || '',
      userId: context.locals.user?.userId,
      sessionId: context.locals.session?.id,
      extra
    }
  };
  
  writeLog(entry);
}

//get request metrics for monitoring
export function getRequestMetrics(): {
  activeRequests: number;
  averageResponseTime: number;
  suspiciousRequests: number;
} {
  const now = Date.now();
  const activeRequests = Array.from(requestTracking.values());
  
  const averageResponseTime = activeRequests.length > 0
    ? activeRequests.reduce((sum, req) => sum + (now - req.startTime), 0) / activeRequests.length
    : 0;
  
  const suspiciousRequests = activeRequests.filter(req => req.suspicious).length;
  
  return {
    activeRequests: activeRequests.length,
    averageResponseTime,
    suspiciousRequests
  };
}

//cleanup old request tracking (call periodically)
export function cleanupRequestTracking(): void {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; //5 minutes
  
  for (const [requestId, tracking] of requestTracking.entries()) {
    if (now - tracking.startTime > maxAge) {
      requestTracking.delete(requestId);
    }
  }
}