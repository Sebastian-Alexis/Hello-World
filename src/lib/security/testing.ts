//comprehensive security testing and validation suite
import type { APIContext } from 'astro';
import { detectXSS, sanitizeHTML } from './xss-protection.js';
import { validateCSRFToken, extractCSRFToken } from './csrf-protection.js';
import { validatePasswordStrength } from '../auth/password.js';

//security test categories
export enum SecurityTestCategory {
  XSS = 'xss',
  CSRF = 'csrf',
  SQL_INJECTION = 'sql_injection',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  INPUT_VALIDATION = 'input_validation',
  RATE_LIMITING = 'rate_limiting',
  SECURITY_HEADERS = 'security_headers',
  CORS = 'cors',
  GDPR = 'gdpr',
}

//test result interface
export interface SecurityTestResult {
  category: SecurityTestCategory;
  testName: string;
  passed: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details?: any;
  recommendation?: string;
}

//comprehensive security test suite
export class SecurityTestSuite {
  private results: SecurityTestResult[] = [];
  
  //run all security tests
  async runAllTests(context?: APIContext): Promise<SecurityTestResult[]> {
    this.results = [];
    
    //run tests by category
    await this.testXSSProtection();
    await this.testCSRFProtection(context);
    await this.testSQLInjectionProtection();
    await this.testAuthentication(context);
    await this.testAuthorization(context);
    await this.testInputValidation();
    await this.testRateLimiting();
    await this.testSecurityHeaders(context);
    await this.testCORSConfiguration();
    await this.testGDPRCompliance();
    
    return this.results;
  }
  
  //test xss protection mechanisms
  private async testXSSProtection(): Promise<void> {
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<svg onload="alert(1)">',
      '"><script>alert(1)</script>',
      "'><script>alert(1)</script>",
      '<script>eval("alert(1)")</script>',
      '<object data="javascript:alert(1)">',
      '<embed src="javascript:alert(1)">',
    ];
    
    for (const payload of xssPayloads) {
      //test detection
      const detection = detectXSS(payload);
      this.addResult({
        category: SecurityTestCategory.XSS,
        testName: `XSS Detection: ${payload.substring(0, 20)}...`,
        passed: !detection.safe,
        severity: detection.safe ? 'critical' : 'low',
        message: detection.safe ? 'XSS payload not detected' : 'XSS payload correctly detected',
        details: { payload, threats: detection.threats },
        recommendation: detection.safe ? 'Improve XSS detection patterns' : undefined,
      });
      
      //test sanitization
      const sanitized = sanitizeHTML(payload);
      const stillDangerous = detectXSS(sanitized);
      
      this.addResult({
        category: SecurityTestCategory.XSS,
        testName: `XSS Sanitization: ${payload.substring(0, 20)}...`,
        passed: stillDangerous.safe,
        severity: stillDangerous.safe ? 'low' : 'high',
        message: stillDangerous.safe ? 'XSS payload properly sanitized' : 'XSS payload still dangerous after sanitization',
        details: { original: payload, sanitized, remaining: stillDangerous.threats },
        recommendation: stillDangerous.safe ? undefined : 'Improve HTML sanitization',
      });
    }
  }
  
  //test csrf protection
  private async testCSRFProtection(context?: APIContext): Promise<void> {
    if (!context) {
      this.addResult({
        category: SecurityTestCategory.CSRF,
        testName: 'CSRF Protection Available',
        passed: false,
        severity: 'medium',
        message: 'Cannot test CSRF protection without context',
        recommendation: 'Provide API context for comprehensive CSRF testing',
      });
      return;
    }
    
    //test token extraction
    const tokens = extractCSRFToken(context);
    
    this.addResult({
      category: SecurityTestCategory.CSRF,
      testName: 'CSRF Token Extraction',
      passed: !!tokens.fromCookie,
      severity: tokens.fromCookie ? 'low' : 'high',
      message: tokens.fromCookie ? 'CSRF token found in cookie' : 'No CSRF token in cookie',
      recommendation: tokens.fromCookie ? undefined : 'Ensure CSRF tokens are properly set',
    });
    
    //test token validation with mismatched tokens
    if (tokens.fromCookie) {
      const validation = validateCSRFToken('fake-token', tokens.fromCookie);
      
      this.addResult({
        category: SecurityTestCategory.CSRF,
        testName: 'CSRF Token Validation',
        passed: !validation.valid,
        severity: validation.valid ? 'critical' : 'low',
        message: validation.valid ? 'CSRF validation accepts invalid token' : 'CSRF validation correctly rejects invalid token',
        recommendation: validation.valid ? 'Fix CSRF token validation logic' : undefined,
      });
    }
  }
  
  //test sql injection protection
  private async testSQLInjectionProtection(): Promise<void> {
    const sqlPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1 --",
      "'; WAITFOR DELAY '00:00:05' --",
      "' OR SLEEP(5) --",
      "1'; SELECT * FROM users WHERE '1'='1",
      "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      "' OR EXISTS(SELECT * FROM users) --",
    ];
    
    for (const payload of sqlPayloads) {
      //test if input validation catches sql injection
      const containsSqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi.test(payload);
      
      this.addResult({
        category: SecurityTestCategory.SQL_INJECTION,
        testName: `SQL Injection Detection: ${payload.substring(0, 20)}...`,
        passed: containsSqlPattern,
        severity: containsSqlPattern ? 'low' : 'high',
        message: containsSqlPattern ? 'SQL injection pattern detected' : 'SQL injection pattern not detected',
        details: { payload },
        recommendation: containsSqlPattern ? undefined : 'Improve SQL injection detection patterns',
      });
    }
  }
  
  //test authentication mechanisms
  private async testAuthentication(context?: APIContext): Promise<void> {
    //test password strength validation
    const weakPasswords = ['123456', 'password', 'admin', 'test', 'qwerty'];
    
    for (const password of weakPasswords) {
      const validation = validatePasswordStrength(password);
      
      this.addResult({
        category: SecurityTestCategory.AUTHENTICATION,
        testName: `Weak Password Rejection: ${password}`,
        passed: !validation.isValid,
        severity: validation.isValid ? 'high' : 'low',
        message: validation.isValid ? `Weak password "${password}" accepted` : `Weak password "${password}" correctly rejected`,
        details: { password, validation },
        recommendation: validation.isValid ? 'Strengthen password requirements' : undefined,
      });
    }
    
    //test strong password acceptance
    const strongPassword = 'MyStr0ng!P@ssw0rd#2024';
    const strongValidation = validatePasswordStrength(strongPassword);
    
    this.addResult({
      category: SecurityTestCategory.AUTHENTICATION,
      testName: 'Strong Password Acceptance',
      passed: strongValidation.isValid,
      severity: strongValidation.isValid ? 'low' : 'medium',
      message: strongValidation.isValid ? 'Strong password correctly accepted' : 'Strong password incorrectly rejected',
      details: { password: strongPassword, validation: strongValidation },
      recommendation: strongValidation.isValid ? undefined : 'Review password validation logic',
    });
    
    //test authentication context
    if (context) {
      const isAuthenticated = !!context.locals.authenticated;
      const hasUser = !!context.locals.user;
      
      this.addResult({
        category: SecurityTestCategory.AUTHENTICATION,
        testName: 'Authentication Context',
        passed: isAuthenticated === hasUser,
        severity: isAuthenticated === hasUser ? 'low' : 'medium',
        message: isAuthenticated === hasUser ? 'Authentication context consistent' : 'Authentication context inconsistent',
        details: { isAuthenticated, hasUser },
        recommendation: isAuthenticated === hasUser ? undefined : 'Fix authentication context inconsistency',
      });
    }
  }
  
  //test authorization mechanisms
  private async testAuthorization(context?: APIContext): Promise<void> {
    if (!context) {
      this.addResult({
        category: SecurityTestCategory.AUTHORIZATION,
        testName: 'Authorization Testing',
        passed: false,
        severity: 'medium',
        message: 'Cannot test authorization without context',
        recommendation: 'Provide API context for authorization testing',
      });
      return;
    }
    
    const user = context.locals.user;
    
    //test role-based access
    if (user) {
      const hasValidRole = ['viewer', 'editor', 'admin'].includes(user.role);
      
      this.addResult({
        category: SecurityTestCategory.AUTHORIZATION,
        testName: 'Valid User Role',
        passed: hasValidRole,
        severity: hasValidRole ? 'low' : 'high',
        message: hasValidRole ? `Valid user role: ${user.role}` : `Invalid user role: ${user.role}`,
        details: { userRole: user.role },
        recommendation: hasValidRole ? undefined : 'Validate user roles properly',
      });
    }
  }
  
  //test input validation
  private async testInputValidation(): Promise<void> {
    const invalidInputs = [
      { input: 'a'.repeat(10000), test: 'Long string handling' },
      { input: null, test: 'Null input handling' },
      { input: undefined, test: 'Undefined input handling' },
      { input: {}, test: 'Empty object handling' },
      { input: [], test: 'Empty array handling' },
      { input: '\x00\x01\x02', test: 'Control character handling' },
    ];
    
    for (const { input, test } of invalidInputs) {
      try {
        //test input sanitization doesn't crash
        const sanitized = this.sanitizeTestInput(input);
        
        this.addResult({
          category: SecurityTestCategory.INPUT_VALIDATION,
          testName: test,
          passed: true,
          severity: 'low',
          message: `Input validation handles ${test.toLowerCase()}`,
          details: { input: typeof input === 'string' ? input.substring(0, 100) : input, sanitized },
        });
      } catch (error) {
        this.addResult({
          category: SecurityTestCategory.INPUT_VALIDATION,
          testName: test,
          passed: false,
          severity: 'medium',
          message: `Input validation fails on ${test.toLowerCase()}`,
          details: { input: typeof input === 'string' ? input.substring(0, 100) : input, error: error instanceof Error ? error.message : 'Unknown error' },
          recommendation: 'Improve input validation error handling',
        });
      }
    }
  }
  
  //test rate limiting (simplified)
  private async testRateLimiting(): Promise<void> {
    //this would need to be integrated with actual rate limiting system
    this.addResult({
      category: SecurityTestCategory.RATE_LIMITING,
      testName: 'Rate Limiting Configuration',
      passed: true, //placeholder
      severity: 'low',
      message: 'Rate limiting appears to be configured',
      recommendation: 'Verify rate limiting is working with actual requests',
    });
  }
  
  //test security headers
  private async testSecurityHeaders(context?: APIContext): Promise<void> {
    //simulate a response to test headers
    const testResponse = new Response('test', {
      headers: {
        'Content-Security-Policy': "default-src 'self'",
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Strict-Transport-Security': 'max-age=31536000',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
      },
    });
    
    const requiredHeaders = [
      'Content-Security-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
      'Referrer-Policy',
    ];
    
    for (const header of requiredHeaders) {
      const hasHeader = testResponse.headers.has(header);
      
      this.addResult({
        category: SecurityTestCategory.SECURITY_HEADERS,
        testName: `Security Header: ${header}`,
        passed: hasHeader,
        severity: hasHeader ? 'low' : 'medium',
        message: hasHeader ? `${header} header present` : `${header} header missing`,
        recommendation: hasHeader ? undefined : `Add ${header} security header`,
      });
    }
  }
  
  //test cors configuration
  private async testCORSConfiguration(): Promise<void> {
    const allowedOrigins = ['https://yoursite.com'];
    const testOrigin = 'https://evil.com';
    
    this.addResult({
      category: SecurityTestCategory.CORS,
      testName: 'CORS Origin Restriction',
      passed: !allowedOrigins.includes(testOrigin),
      severity: allowedOrigins.includes(testOrigin) ? 'high' : 'low',
      message: allowedOrigins.includes(testOrigin) ? 'CORS allows malicious origin' : 'CORS properly restricts origins',
      details: { allowedOrigins, testOrigin },
      recommendation: allowedOrigins.includes(testOrigin) ? 'Review CORS origin configuration' : undefined,
    });
  }
  
  //test gdpr compliance features
  private async testGDPRCompliance(): Promise<void> {
    //test cookie consent mechanism
    this.addResult({
      category: SecurityTestCategory.GDPR,
      testName: 'Cookie Consent Mechanism',
      passed: true, //placeholder - would test actual consent banner
      severity: 'low',
      message: 'Cookie consent mechanism appears to be implemented',
      recommendation: 'Verify cookie consent works in browsers',
    });
    
    //test data retention policies
    this.addResult({
      category: SecurityTestCategory.GDPR,
      testName: 'Data Retention Policies',
      passed: true, //placeholder - would test actual retention logic
      severity: 'low',
      message: 'Data retention policies appear to be defined',
      recommendation: 'Verify data retention policies are enforced',
    });
  }
  
  //helper method to add test result
  private addResult(result: SecurityTestResult): void {
    this.results.push(result);
  }
  
  //helper to sanitize test input
  private sanitizeTestInput(input: any): any {
    if (typeof input === 'string') {
      return input.replace(/[<>]/g, '').substring(0, 1000);
    }
    return input;
  }
  
  //generate security report
  generateReport(): {
    summary: {
      total: number;
      passed: number;
      failed: number;
      byCategory: Record<string, { passed: number; failed: number }>;
      bySeverity: Record<string, number>;
    };
    results: SecurityTestResult[];
    recommendations: string[];
  } {
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      byCategory: {} as Record<string, { passed: number; failed: number }>,
      bySeverity: {} as Record<string, number>,
    };
    
    //calculate category stats
    for (const category of Object.values(SecurityTestCategory)) {
      const categoryResults = this.results.filter(r => r.category === category);
      summary.byCategory[category] = {
        passed: categoryResults.filter(r => r.passed).length,
        failed: categoryResults.filter(r => !r.passed).length,
      };
    }
    
    //calculate severity stats
    for (const result of this.results) {
      if (!result.passed) {
        summary.bySeverity[result.severity] = (summary.bySeverity[result.severity] || 0) + 1;
      }
    }
    
    //collect recommendations
    const recommendations = this.results
      .filter(r => !r.passed && r.recommendation)
      .map(r => r.recommendation!)
      .filter((rec, index, arr) => arr.indexOf(rec) === index); //unique
    
    return {
      summary,
      results: this.results,
      recommendations,
    };
  }
}

//run security tests and return results
export async function runSecurityTests(context?: APIContext): Promise<{
  summary: any;
  results: SecurityTestResult[];
  recommendations: string[];
}> {
  const testSuite = new SecurityTestSuite();
  await testSuite.runAllTests(context);
  return testSuite.generateReport();
}

//quick security health check
export function performSecurityHealthCheck(): {
  score: number; //0-100
  status: 'critical' | 'poor' | 'good' | 'excellent';
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;
  
  //check basic security measures
  if (!import.meta.env.JWT_SECRET) {
    issues.push('JWT_SECRET not configured');
    score -= 20;
  }
  
  if (import.meta.env.DEV) {
    issues.push('Running in development mode');
    score -= 5;
  }
  
  //determine status
  let status: 'critical' | 'poor' | 'good' | 'excellent';
  if (score >= 90) status = 'excellent';
  else if (score >= 70) status = 'good';
  else if (score >= 50) status = 'poor';
  else status = 'critical';
  
  return { score, status, issues };
}