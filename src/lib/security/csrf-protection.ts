//csrf protection system with double submit cookie pattern
import type { APIContext } from 'astro';

//csrf configuration
const CSRF_CONFIG = {
  TOKEN_LENGTH: 32,
  TOKEN_LIFETIME: 60 * 60 * 1000, //1 hour
  COOKIE_NAME: 'csrf-token',
  HEADER_NAME: 'X-CSRF-Token',
  FORM_FIELD_NAME: '_csrf',
  
  //cookie options
  COOKIE_OPTIONS: {
    httpOnly: false, //must be false so js can read it
    secure: !import.meta.env.DEV, //secure in production
    sameSite: 'strict' as const,
    path: '/',
  }
};

//csrf token store (in production, use redis or database)
const tokenStore = new Map<string, {
  token: string;
  created: number;
  used: boolean;
  sessionId?: string;
}>();

//generate cryptographically secure random token
function generateCSRFToken(): string {
  const array = new Uint8Array(CSRF_CONFIG.TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

//create csrf token for session
export function createCSRFToken(sessionId?: string): {
  token: string;
  cookieValue: string;
} {
  const token = generateCSRFToken();
  const created = Date.now();
  
  //store token with metadata
  tokenStore.set(token, {
    token,
    created,
    used: false,
    sessionId
  });
  
  //create cookie value (just the token for double submit pattern)
  const cookieOptions = [
    `${CSRF_CONFIG.COOKIE_NAME}=${token}`,
    `Max-Age=${Math.floor(CSRF_CONFIG.TOKEN_LIFETIME / 1000)}`,
    `Path=${CSRF_CONFIG.COOKIE_OPTIONS.path}`,
    `SameSite=${CSRF_CONFIG.COOKIE_OPTIONS.sameSite}`
  ];
  
  if (CSRF_CONFIG.COOKIE_OPTIONS.secure) {
    cookieOptions.push('Secure');
  }
  
  const cookieValue = cookieOptions.join('; ');
  
  return { token, cookieValue };
}

//validate csrf token
export function validateCSRFToken(
  tokenFromRequest: string,
  tokenFromCookie: string,
  sessionId?: string
): {
  valid: boolean;
  error?: string;
} {
  //both tokens must be present
  if (!tokenFromRequest || !tokenFromCookie) {
    return {
      valid: false,
      error: 'CSRF tokens missing'
    };
  }
  
  //tokens must match (double submit cookie pattern)
  if (tokenFromRequest !== tokenFromCookie) {
    return {
      valid: false,
      error: 'CSRF tokens do not match'
    };
  }
  
  //check if token exists in store
  const storedToken = tokenStore.get(tokenFromRequest);
  if (!storedToken) {
    return {
      valid: false,
      error: 'CSRF token not found or expired'
    };
  }
  
  //check if token has expired
  const now = Date.now();
  if (now - storedToken.created > CSRF_CONFIG.TOKEN_LIFETIME) {
    tokenStore.delete(tokenFromRequest);
    return {
      valid: false,
      error: 'CSRF token has expired'
    };
  }
  
  //check session binding if provided
  if (sessionId && storedToken.sessionId && storedToken.sessionId !== sessionId) {
    return {
      valid: false,
      error: 'CSRF token session mismatch'
    };
  }
  
  //mark token as used (one-time use)
  storedToken.used = true;
  
  return { valid: true };
}

//extract csrf token from request
export function extractCSRFToken(context: APIContext): {
  fromHeader?: string;
  fromBody?: string;
  fromCookie?: string;
} {
  const fromHeader = context.request.headers.get(CSRF_CONFIG.HEADER_NAME) || undefined;
  
  //extract from cookie
  const cookies = context.request.headers.get('Cookie') || '';
  const cookieMatch = cookies.match(new RegExp(`${CSRF_CONFIG.COOKIE_NAME}=([^;]+)`));
  const fromCookie = cookieMatch ? cookieMatch[1] : undefined;
  
  //note: fromBody would need to be extracted separately when parsing form data
  
  return { fromHeader, fromCookie };
}

//middleware for csrf protection
export async function csrfProtection(context: APIContext): Promise<{
  protected: boolean;
  error?: string;
  newToken?: { token: string; cookieValue: string };
}> {
  const method = context.request.method.toUpperCase();
  
  //csrf protection only applies to state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { protected: true };
  }
  
  //extract tokens
  const { fromHeader, fromCookie } = extractCSRFToken(context);
  
  //for api endpoints, expect token in header
  if (context.url.pathname.startsWith('/api/')) {
    if (!fromHeader || !fromCookie) {
      return {
        protected: false,
        error: 'CSRF token required in header and cookie'
      };
    }
    
    const validation = validateCSRFToken(
      fromHeader,
      fromCookie,
      context.locals.session?.id
    );
    
    if (!validation.valid) {
      return {
        protected: false,
        error: validation.error
      };
    }
    
    return { protected: true };
  }
  
  //for form submissions, check both header and form field
  if (context.request.headers.get('content-type')?.includes('application/x-www-form-urlencoded')) {
    //would need to parse form data to get token from body
    //for now, just check header and cookie
    if (!fromHeader || !fromCookie) {
      return {
        protected: false,
        error: 'CSRF token required'
      };
    }
    
    const validation = validateCSRFToken(
      fromHeader,
      fromCookie,
      context.locals.session?.id
    );
    
    if (!validation.valid) {
      return {
        protected: false,
        error: validation.error
      };
    }
    
    return { protected: true };
  }
  
  return { protected: true };
}

//helper to get csrf token for templates
export function getCSRFTokenForTemplate(context: APIContext): string | null {
  const cookies = context.request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`${CSRF_CONFIG.COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

//generate html for csrf token form field
export function generateCSRFFormField(token: string): string {
  return `<input type="hidden" name="${CSRF_CONFIG.FORM_FIELD_NAME}" value="${token}">`;
}

//generate meta tag for csrf token (for ajax requests)
export function generateCSRFMetaTag(token: string): string {
  return `<meta name="csrf-token" content="${token}">`;
}

//client-side csrf helper (to be included in templates)
export const clientCSRFHelper = `
(function() {
  // get csrf token from meta tag or cookie
  function getCSRFToken() {
    // try meta tag first
    const metaTag = document.querySelector('meta[name="csrf-token"]');
    if (metaTag) {
      return metaTag.getAttribute('content');
    }
    
    // fallback to cookie
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === '${CSRF_CONFIG.COOKIE_NAME}') {
        return value;
      }
    }
    
    return null;
  }
  
  // add csrf token to fetch requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const [url, options = {}] = args;
    
    // only add csrf token to same-origin requests
    const isExternalUrl = url.toString().startsWith('http') && 
                         !url.toString().startsWith(window.location.origin);
    
    if (!isExternalUrl && options.method && 
        !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
      
      const token = getCSRFToken();
      if (token) {
        options.headers = {
          ...options.headers,
          '${CSRF_CONFIG.HEADER_NAME}': token
        };
      }
    }
    
    return originalFetch.apply(this, [url, options]);
  };
  
  // add csrf token to forms
  document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('form[method="POST"], form[method="PUT"], form[method="DELETE"]');
    
    forms.forEach(form => {
      // skip if already has csrf token
      if (form.querySelector('input[name="${CSRF_CONFIG.FORM_FIELD_NAME}"]')) {
        return;
      }
      
      const token = getCSRFToken();
      if (token) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = '${CSRF_CONFIG.FORM_FIELD_NAME}';
        input.value = token;
        form.appendChild(input);
      }
    });
  });
})();
`;

//clean up expired tokens
export function cleanupExpiredTokens(): void {
  const now = Date.now();
  
  for (const [token, data] of tokenStore.entries()) {
    if (now - data.created > CSRF_CONFIG.TOKEN_LIFETIME || data.used) {
      tokenStore.delete(token);
    }
  }
}

//get csrf statistics for monitoring
export function getCSRFStats(): {
  totalTokens: number;
  expiredTokens: number;
  usedTokens: number;
} {
  const now = Date.now();
  let expired = 0;
  let used = 0;
  
  for (const data of tokenStore.values()) {
    if (now - data.created > CSRF_CONFIG.TOKEN_LIFETIME) {
      expired++;
    }
    if (data.used) {
      used++;
    }
  }
  
  return {
    totalTokens: tokenStore.size,
    expiredTokens: expired,
    usedTokens: used
  };
}

//setup periodic cleanup
let cleanupInterval: NodeJS.Timeout;

export function initCSRFCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  
  //cleanup every 15 minutes
  cleanupInterval = setInterval(cleanupExpiredTokens, 15 * 60 * 1000);
}

export function shutdownCSRF(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
  }
  tokenStore.clear();
}