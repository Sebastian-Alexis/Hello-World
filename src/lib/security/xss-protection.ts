//comprehensive xss protection system
import DOMPurify from 'isomorphic-dompurify';

//xss protection configuration
const XSS_CONFIG = {
  //strict html sanitization
  STRICT_HTML: {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  },
  
  //moderate html sanitization (for blog posts)
  MODERATE_HTML: {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'code', 'pre'
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'class'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
  },
  
  //dangerous patterns to always block
  DANGEROUS_PATTERNS: [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
    /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
    /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
    /<embed[\s\S]*?>[\s\S]*?<\/embed>/gi,
    /<applet[\s\S]*?>[\s\S]*?<\/applet>/gi,
    /<meta[\s\S]*?>/gi,
    /<link[\s\S]*?>/gi,
    /<style[\s\S]*?>[\s\S]*?<\/style>/gi,
  ],
  
  //javascript patterns
  JS_PATTERNS: [
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /data:application\/x-javascript/gi,
    /on\w+\s*=/gi, //event handlers
  ],
  
  //content security policy nonce validation
  CSP_NONCE_PATTERN: /nonce-([a-f0-9]{32})/,
};

//sanitization levels
export enum SanitizationLevel {
  STRICT = 'strict',
  MODERATE = 'moderate',
  NONE = 'none' //use with extreme caution
}

//xss detection result
interface XSSDetectionResult {
  safe: boolean;
  threats: string[];
  sanitized?: string;
}

//detect xss attempts in input
export function detectXSS(input: string): XSSDetectionResult {
  const threats: string[] = [];
  
  if (!input || typeof input !== 'string') {
    return { safe: true, threats: [] };
  }
  
  //check for dangerous html patterns
  for (const pattern of XSS_CONFIG.DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('Dangerous HTML tags detected');
      break;
    }
  }
  
  //check for javascript patterns
  for (const pattern of XSS_CONFIG.JS_PATTERNS) {
    if (pattern.test(input)) {
      threats.push('JavaScript execution attempt detected');
      break;
    }
  }
  
  //check for html entities that could be used for evasion
  const decodedInput = decodeHTMLEntities(input);
  if (decodedInput !== input) {
    //check decoded version for threats
    for (const pattern of XSS_CONFIG.DANGEROUS_PATTERNS) {
      if (pattern.test(decodedInput)) {
        threats.push('HTML entity evasion attempt detected');
        break;
      }
    }
  }
  
  //check for data uris with suspicious content
  if (input.includes('data:')) {
    const dataUriRegex = /data:([^;]+);([^,]+),(.+)/gi;
    const matches = input.matchAll(dataUriRegex);
    
    for (const match of matches) {
      const mimeType = match[1];
      const encoding = match[2];
      const data = match[3];
      
      if (mimeType.includes('html') || mimeType.includes('javascript')) {
        threats.push('Dangerous data URI detected');
      }
      
      if (encoding === 'base64') {
        try {
          const decoded = atob(data);
          if (/<script|javascript:|vbscript:/i.test(decoded)) {
            threats.push('Base64 encoded XSS attempt detected');
          }
        } catch (e) {
          //ignore decode errors
        }
      }
    }
  }
  
  //check for unicode homograph attacks
  if (containsHomographs(input)) {
    threats.push('Unicode homograph attack detected');
  }
  
  return {
    safe: threats.length === 0,
    threats
  };
}

//sanitize html content
export function sanitizeHTML(
  input: string, 
  level: SanitizationLevel = SanitizationLevel.STRICT,
  allowedDomains?: string[]
): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  if (level === SanitizationLevel.NONE) {
    //only remove obviously dangerous content
    return input.replace(/<script[\s\S]*?<\/script>/gi, '');
  }
  
  const config = level === SanitizationLevel.STRICT 
    ? XSS_CONFIG.STRICT_HTML 
    : XSS_CONFIG.MODERATE_HTML;
  
  //create dompurify config
  const purifyConfig: any = {
    ALLOWED_TAGS: config.ALLOWED_TAGS,
    ALLOWED_ATTR: config.ALLOWED_ATTR,
    KEEP_CONTENT: config.KEEP_CONTENT,
    ALLOW_DATA_ATTR: config.ALLOW_DATA_ATTR || false,
  };
  
  //add uri validation if moderate level
  if (level === SanitizationLevel.MODERATE) {
    purifyConfig.ALLOWED_URI_REGEXP = config.ALLOWED_URI_REGEXP;
  }
  
  //add domain restriction for links
  if (allowedDomains && allowedDomains.length > 0) {
    purifyConfig.ALLOWED_URI_REGEXP = new RegExp(
      `^(?:(?:https?://)(?:${allowedDomains.map(d => d.replace('.', '\\.')).join('|')})|(?:mailto:|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$)))`,
      'i'
    );
  }
  
  //sanitize with dompurify
  let sanitized = DOMPurify.sanitize(input, purifyConfig);
  
  //additional custom sanitization
  sanitized = sanitized
    .replace(/javascript:/gi, '') //remove any remaining javascript:
    .replace(/vbscript:/gi, '')   //remove vbscript:
    .replace(/data:text\/html/gi, '') //remove html data uris
    .replace(/<!--[\s\S]*?-->/g, ''); //remove html comments
  
  return sanitized;
}

//escape html for safe output
export function escapeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

//decode html entities
function decodeHTMLEntities(input: string): string {
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#39;': "'",
  };
  
  return input.replace(/&[^;]+;/g, (entity) => {
    return entityMap[entity] || entity;
  });
}

//check for unicode homograph attacks
function containsHomographs(input: string): boolean {
  //cyrillic characters that look like latin
  const homographs = [
    '\u0430', // cyrillic 'a'
    '\u043e', // cyrillic 'o'
    '\u0440', // cyrillic 'p'
    '\u0435', // cyrillic 'e'
    '\u0440', // cyrillic 'r'
    '\u0445', // cyrillic 'x'
    '\u0441', // cyrillic 'c'
  ];
  
  return homographs.some(char => input.includes(char));
}

//validate script tags with nonce
export function validateScriptNonce(scriptTag: string, expectedNonce: string): boolean {
  if (!expectedNonce) return false;
  
  const nonceMatch = scriptTag.match(/nonce=["']([^"']+)["']/);
  if (!nonceMatch) return false;
  
  return nonceMatch[1] === expectedNonce;
}

//generate csp-compliant inline styles
export function generateSecureInlineStyle(css: string, nonce: string): string {
  //sanitize css
  const safeCss = css
    .replace(/javascript:/gi, '')
    .replace(/expression\(/gi, '')
    .replace(/behavior:/gi, '')
    .replace(/binding:/gi, '')
    .replace(/@import/gi, '');
  
  return `<style nonce="${nonce}">${safeCss}</style>`;
}

//content security policy violation handler
export function handleCSPViolation(violationReport: any): void {
  console.error('CSP Violation:', {
    documentURI: violationReport.documentURI,
    violatedDirective: violationReport.violatedDirective,
    blockedURI: violationReport.blockedURI,
    sourceFile: violationReport.sourceFile,
    lineNumber: violationReport.lineNumber,
    columnNumber: violationReport.columnNumber,
    sample: violationReport.sample,
  });
  
  //in production, send to monitoring service
  //sendSecurityAlert('CSP_VIOLATION', violationReport);
}

//trusted types implementation (for supporting browsers)
export function createTrustedHTML(html: string, level: SanitizationLevel = SanitizationLevel.STRICT): string {
  //first sanitize the html
  const sanitizedHTML = sanitizeHTML(html, level);
  
  //if trusted types is supported, use it
  if (typeof window !== 'undefined' && 'trustedTypes' in window) {
    try {
      const policy = (window as any).trustedTypes.createPolicy('default', {
        createHTML: (input: string) => input, //already sanitized
      });
      return policy.createHTML(sanitizedHTML);
    } catch (e) {
      //fallback to sanitized html
      return sanitizedHTML;
    }
  }
  
  return sanitizedHTML;
}

//xss protection for json responses
export function sanitizeJSONResponse(data: any): any {
  if (typeof data === 'string') {
    //basic xss prevention for json strings
    return data
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026')
      .replace(/'/g, '\\u0027')
      .replace(/"/g, '\\u0022');
  }
  
  if (Array.isArray(data)) {
    return data.map(item => sanitizeJSONResponse(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeJSONResponse(value);
    }
    return sanitized;
  }
  
  return data;
}

//helper to wrap user content for safe display
export function wrapUserContent(
  content: string, 
  level: SanitizationLevel = SanitizationLevel.MODERATE
): { html: string; truncated: boolean } {
  if (!content) {
    return { html: '', truncated: false };
  }
  
  const maxLength = 10000; //prevent excessive content
  let truncated = false;
  
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '...';
    truncated = true;
  }
  
  const sanitized = sanitizeHTML(content, level);
  
  return { html: sanitized, truncated };
}