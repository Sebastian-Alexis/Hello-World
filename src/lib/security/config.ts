//comprehensive security configuration
export const SECURITY_CONFIG = {
  //environment detection
  IS_PRODUCTION: !import.meta.env.DEV,
  IS_DEVELOPMENT: import.meta.env.DEV,
  
  //jwt configuration
  JWT: {
    ACCESS_TOKEN_EXPIRES: 15 * 60, //15 minutes in seconds
    REFRESH_TOKEN_EXPIRES: 7 * 24 * 60 * 60, //7 days in seconds
    ALGORITHM: !import.meta.env.DEV ? 'RS256' : 'HS256',
    ISSUER: 'hello-world-app',
    AUDIENCE: 'hello-world-users',
  },
  
  //password requirements
  PASSWORD: {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SYMBOLS: false,
    MIN_ENTROPY: 30,
    BCRYPT_ROUNDS: import.meta.env.DEV ? 10 : 12,
  },
  
  //rate limiting configuration
  RATE_LIMIT: {
    AUTHENTICATION: {
      WINDOW_MS: 15 * 60 * 1000, //15 minutes
      MAX_REQUESTS: 5,
    },
    API_GENERAL: {
      WINDOW_MS: 1 * 60 * 1000, //1 minute
      MAX_REQUESTS: 100,
    },
    API_ADMIN: {
      WINDOW_MS: 1 * 60 * 1000, //1 minute
      MAX_REQUESTS: 30,
    },
    DDOS_PROTECTION: {
      BURST_THRESHOLD: 50,
      BURST_WINDOW_MS: 10 * 1000, //10 seconds
      PENALTY_MULTIPLIER: 2,
      MAX_PENALTY_MS: 60 * 60 * 1000, //1 hour
      MIN_PENALTY_MS: 5 * 60 * 1000, //5 minutes
    },
  },
  
  //content security policy
  CSP: {
    //strict policy for production
    STRICT: {
      DEFAULT_SRC: ["'self'"],
      SCRIPT_SRC: ["'self'", "'strict-dynamic'"],
      STYLE_SRC: ["'self'", "'unsafe-inline'"],
      IMG_SRC: ["'self'", "data:", "https:"],
      FONT_SRC: ["'self'", "data:"],
      CONNECT_SRC: ["'self'"],
      FRAME_ANCESTORS: ["'none'"],
      FORM_ACTION: ["'self'"],
      BASE_URI: ["'self'"],
      OBJECT_SRC: ["'none'"],
      UPGRADE_INSECURE_REQUESTS: true,
    },
    
    //relaxed policy for development
    DEVELOPMENT: {
      DEFAULT_SRC: ["'self'"],
      SCRIPT_SRC: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
      STYLE_SRC: ["'self'", "'unsafe-inline'"],
      IMG_SRC: ["'self'", "data:", "https:", "http:"],
      FONT_SRC: ["'self'", "data:"],
      CONNECT_SRC: ["'self'", "ws:", "wss:"],
      FRAME_ANCESTORS: ["'none'"],
      FORM_ACTION: ["'self'"],
      BASE_URI: ["'self'"],
      OBJECT_SRC: ["'none'"],
    },
  },
  
  //security headers
  HEADERS: {
    HSTS: {
      MAX_AGE: 63072000, //2 years
      INCLUDE_SUBDOMAINS: true,
      PRELOAD: true,
    },
    X_CONTENT_TYPE_OPTIONS: 'nosniff',
    X_FRAME_OPTIONS: 'DENY',
    X_XSS_PROTECTION: '1; mode=block',
    REFERRER_POLICY: 'strict-origin-when-cross-origin',
    PERMISSIONS_POLICY: {
      ACCELEROMETER: [],
      AMBIENT_LIGHT_SENSOR: [],
      AUTOPLAY: [],
      BATTERY: [],
      CAMERA: [],
      CROSS_ORIGIN_ISOLATED: [],
      DISPLAY_CAPTURE: [],
      DOCUMENT_DOMAIN: [],
      ENCRYPTED_MEDIA: [],
      EXECUTION_WHILE_NOT_RENDERED: [],
      EXECUTION_WHILE_OUT_OF_VIEWPORT: [],
      FULLSCREEN: ['self'],
      GEOLOCATION: [],
      GYROSCOPE: [],
      KEYBOARD_MAP: [],
      MAGNETOMETER: [],
      MICROPHONE: [],
      MIDI: [],
      NAVIGATION_OVERRIDE: [],
      PAYMENT: [],
      PICTURE_IN_PICTURE: [],
      PUBLICKEY_CREDENTIALS_GET: [],
      SCREEN_WAKE_LOCK: [],
      SYNC_XHR: [],
      USB: [],
      WEB_SHARE: [],
      XR_SPATIAL_TRACKING: [],
    },
  },
  
  //input validation
  INPUT_VALIDATION: {
    MAX_STRING_LENGTH: 10000,
    MAX_ARRAY_LENGTH: 1000,
    MAX_OBJECT_DEPTH: 10,
    MAX_REQUEST_SIZE: 10 * 1024 * 1024, //10mb
    MAX_QUERY_PARAMS: 50,
    MAX_HEADER_SIZE: 8192,
  },
  
  //file upload restrictions
  FILE_UPLOAD: {
    MAX_SIZE: 10 * 1024 * 1024, //10mb
    ALLOWED_MIME_TYPES: [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'text/plain',
      'application/pdf',
      'application/json',
    ],
    BLOCKED_EXTENSIONS: [
      'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
      'php', 'asp', 'aspx', 'jsp', 'py', 'rb', 'pl', 'sh',
    ],
  },
  
  //session management
  SESSION: {
    MAX_AGE: 24 * 60 * 60 * 1000, //24 hours
    CLEANUP_INTERVAL: 60 * 60 * 1000, //1 hour
    SECURE_COOKIES: !import.meta.env.DEV,
    SAME_SITE: 'strict' as const,
    HTTP_ONLY: true,
  },
  
  //csrf protection
  CSRF: {
    TOKEN_LENGTH: 32,
    TOKEN_LIFETIME: 60 * 60 * 1000, //1 hour
    COOKIE_NAME: 'csrf-token',
    HEADER_NAME: 'X-CSRF-Token',
    FORM_FIELD_NAME: '_csrf',
  },
  
  //gdpr compliance
  GDPR: {
    CONSENT_COOKIE: 'gdpr-consent',
    CONSENT_MAX_AGE: 365 * 24 * 60 * 60, //1 year
    RETENTION_PERIODS: {
      USER_DATA: 2555, //7 years
      ANALYTICS_DATA: 780, //26 months
      LOG_DATA: 90, //3 months
      SESSION_DATA: 30, //1 month
      MARKETING_DATA: 365, //1 year
    },
    COOKIE_CATEGORIES: {
      NECESSARY: 'necessary',
      FUNCTIONAL: 'functional',
      ANALYTICS: 'analytics',
      MARKETING: 'marketing',
    },
  },
  
  //monitoring and alerting
  MONITORING: {
    EVENT_RETENTION: 30 * 24 * 60 * 60 * 1000, //30 days
    CLEANUP_INTERVAL: 60 * 60 * 1000, //1 hour
    ALERT_SUPPRESSION: 15 * 60 * 1000, //15 minutes
    THREAT_DETECTION: {
      SUSPICIOUS_REQUEST_THRESHOLD: 50, //requests per hour
      FAILED_LOGIN_THRESHOLD: 5, //attempts per 15 minutes
      DDOS_THRESHOLD: 100, //requests per minute
    },
  },
  
  //cors configuration
  CORS: {
    ALLOWED_ORIGINS: [
      'https://yoursite.com',
      'https://www.yoursite.com',
      ...(import.meta.env.DEV ? ['http://localhost:4321', 'http://127.0.0.1:4321'] : []),
    ],
    ALLOWED_METHODS: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    ALLOWED_HEADERS: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    MAX_AGE: 86400, //24 hours
    CREDENTIALS: true,
  },
  
  //trusted domains for external resources
  TRUSTED_DOMAINS: {
    CDN: ['cdn.yoursite.com'],
    ANALYTICS: ['analytics.google.com', 'www.google-analytics.com'],
    FONTS: ['fonts.googleapis.com', 'fonts.gstatic.com'],
    IMAGES: ['images.yoursite.com'],
  },
  
  //database security
  DATABASE: {
    CONNECTION_TIMEOUT: 30000, //30 seconds
    QUERY_TIMEOUT: 10000, //10 seconds
    MAX_CONNECTIONS: 10,
    SSL_MODE: !import.meta.env.DEV,
  },
  
  //api security
  API: {
    VERSION: 'v1',
    RATE_LIMIT_HEADER: 'X-RateLimit-Remaining',
    REQUEST_ID_HEADER: 'X-Request-ID',
    RESPONSE_TIME_HEADER: 'X-Response-Time',
    DEFAULT_TIMEOUT: 30000, //30 seconds
  },
  
  //security testing
  TESTING: {
    XSS_PAYLOADS: [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<svg onload="alert(1)">',
    ],
    SQL_PAYLOADS: [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin'--",
      "' OR 1=1 --",
    ],
    WEAK_PASSWORDS: [
      'password',
      '123456',
      '123456789',
      'qwerty',
      'abc123',
      'password123',
      'admin',
      'letmein',
    ],
  },
} as const;

//helper functions to get configuration values
export const getSecurityConfig = () => SECURITY_CONFIG;

export const isProduction = () => SECURITY_CONFIG.IS_PRODUCTION;

export const isDevelopment = () => SECURITY_CONFIG.IS_DEVELOPMENT;

//validate security configuration on startup
export function validateSecurityConfig(): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  //check environment variables
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET environment variable is required');
  }
  
  if (!process.env.BCRYPT_ROUNDS) {
    warnings.push('BCRYPT_ROUNDS not set, using default');
  }
  
  //check production-specific requirements
  if (SECURITY_CONFIG.IS_PRODUCTION) {
    if (SECURITY_CONFIG.JWT.ALGORITHM !== 'RS256') {
      warnings.push('Consider using RS256 for JWT in production');
    }
    
    if (!SECURITY_CONFIG.SESSION.SECURE_COOKIES) {
      errors.push('Secure cookies must be enabled in production');
    }
    
    if (SECURITY_CONFIG.CORS.ALLOWED_ORIGINS.some(origin => origin.includes('localhost'))) {
      warnings.push('Remove localhost from CORS origins in production');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

//export specific configurations for easy access
export const JWT_CONFIG = SECURITY_CONFIG.JWT;
export const PASSWORD_CONFIG = SECURITY_CONFIG.PASSWORD;
export const CSP_CONFIG = SECURITY_CONFIG.CSP;
export const RATE_LIMIT_CONFIG = SECURITY_CONFIG.RATE_LIMIT;
export const GDPR_CONFIG = SECURITY_CONFIG.GDPR;
export const MONITORING_CONFIG = SECURITY_CONFIG.MONITORING;