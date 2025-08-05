import { z } from 'zod';
import * as dotenv from 'dotenv';
import { getEnvVar, getAllEnvVars } from './cloudflare';

// Load .env file (only in Node.js environments)
if (typeof process !== 'undefined' && process.env) {
  dotenv.config();
}

const envSchema = z.object({
  // Database Configuration
  TURSO_DATABASE_URL: z.string().min(1, 'Database URL is required'),
  TURSO_AUTH_TOKEN: z.string().optional(),
  TURSO_SYNC_URL: z.string().optional(),

  // Authentication & Security
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  BCRYPT_ROUNDS: z.string().transform(Number).pipe(z.number().int().min(8).max(15)).default('12'),
  SESSION_SECRET: z.string().min(16, 'Session secret must be at least 16 characters'),

  // Admin User
  ADMIN_EMAIL: z.string().email('Valid admin email is required'),
  ADMIN_PASSWORD: z.string().min(8, 'Admin password must be at least 8 characters'),
  ADMIN_NAME: z.string().min(1, 'Admin name is required'),

  // External APIs
  VITE_MAPBOX_ACCESS_TOKEN: z.string().optional(),
  PUBLIC_MAPBOX_ACCESS_TOKEN: z.string().optional(),
  MAPBOX_STYLE_URL: z.string().url().optional(),
  AVIATION_STACK_API: z.string().optional(),

  // Site Configuration
  SITE_URL: z.string().url('Valid site URL is required'),
  SITE_NAME: z.string().min(1, 'Site name is required'),
  SITE_DESCRIPTION: z.string().min(1, 'Site description is required'),

  // Email Configuration (optional)
  SMTP_HOST: z.preprocess(
    val => {
      if (val === undefined || val === null || val === '' || 
          val === 'smtp.gmail.com' || val === 'your_smtp_host') {
        return undefined;
      }
      return val;
    },
    z.string().optional()
  ),
  SMTP_PORT: z.preprocess(
    val => {
      if (val === undefined || val === null || val === '') return undefined;
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.union([z.number().int().min(1).max(65535), z.undefined()]).optional()
  ),
  SMTP_USER: z.preprocess(
    val => {
      if (val === undefined || val === null || val === '' || 
          val === 'your_email@gmail.com' || val === 'your_smtp_user') {
        return undefined;
      }
      return val;
    },
    z.string().optional()
  ),
  SMTP_PASS: z.preprocess(
    val => {
      if (val === undefined || val === null || val === '' || 
          val === 'your_app_password' || val === 'your_smtp_password') {
        return undefined;
      }
      return val;
    },
    z.string().optional()
  ),
  FROM_EMAIL: z.preprocess(
    val => {
      // Handle empty strings and common placeholder values
      if (val === undefined || val === null || val === '' || 
          val === 'noreply@yoursite.com' || val === 'dev@localhost' ||
          val === 'your_email@gmail.com') {
        return undefined;
      }
      return val;
    },
    z.union([z.string().email(), z.undefined()]).optional()
  ),

  // Analytics (optional)
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  UMAMI_WEBSITE_ID: z.string().optional(),
  UMAMI_URL: z.preprocess(
    val => {
      if (val === undefined || val === null || val === '') return undefined;
      return val;
    },
    z.union([z.string().url(), z.undefined()]).optional()
  ),

  // CDN & Assets (optional)
  CDN_URL: z.preprocess(
    val => {
      if (val === undefined || val === null || val === '') return undefined;
      return val;
    },
    z.union([z.string().url(), z.undefined()]).optional()
  ),
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Development
  NODE_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  DEBUG: z.string().transform(val => val === 'true').default('false'),
  VERBOSE_LOGGING: z.string().transform(val => val === 'true').default('false'),

  // API Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).pipe(z.number().int().positive()).default('15'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().int().positive()).default('100'),

  // Cache Configuration
  CACHE_TTL: z.string().transform(Number).pipe(z.number().int().positive()).default('3600'),
  REDIS_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

//validates and caches environment variables
export function validateEnv(): Env {
  if (_env) return _env;

  try {
    //use Cloudflare-compatible environment variable access
    const env = getAllEnvVars();
    
    //merge with default values for development
    const envWithDefaults = {
      ...env,
      //development defaults
      NODE_ENV: env.NODE_ENV || 'development',
      DEBUG: env.DEBUG || 'false',
      VERBOSE_LOGGING: env.VERBOSE_LOGGING || 'false',
      BCRYPT_ROUNDS: env.BCRYPT_ROUNDS || '12',
      RATE_LIMIT_WINDOW: env.RATE_LIMIT_WINDOW || '15',
      RATE_LIMIT_MAX_REQUESTS: env.RATE_LIMIT_MAX_REQUESTS || '100',
      CACHE_TTL: env.CACHE_TTL || '3600',
    };

    _env = envSchema.parse(envWithDefaults);
    return _env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Environment validation failed:\n${messages.join('\n')}`);
    }
    throw error;
  }
}

//gets validated environment variables
export function getEnv(): Env {
  if (!_env) {
    throw new Error('Environment not validated. Call validateEnv() first.');
  }
  return _env;
}

//checks if we're in development mode
export function isDev(): boolean {
  return getEnv().NODE_ENV === 'development';
}

//checks if we're in production mode
export function isProd(): boolean {
  return getEnv().NODE_ENV === 'production';
}

//checks if we're in test mode
export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}

//gets database configuration
export function getDbConfig() {
  const env = getEnv();
  return {
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
    syncUrl: env.TURSO_SYNC_URL,
  };
}

//gets site configuration
export function getSiteConfig() {
  const env = getEnv();
  return {
    url: env.SITE_URL,
    name: env.SITE_NAME,
    description: env.SITE_DESCRIPTION,
  };
}

//gets authentication configuration
export function getAuthConfig() {
  const env = getEnv();
  return {
    jwtSecret: env.JWT_SECRET,
    bcryptRounds: env.BCRYPT_ROUNDS,
    sessionSecret: env.SESSION_SECRET,
  };
}

//gets external API configuration
export function getApiConfig() {
  const env = getEnv();
  return {
    mapboxToken: env.VITE_MAPBOX_ACCESS_TOKEN,
    mapboxStyleUrl: env.MAPBOX_STYLE_URL,
    aviationStackApi: env.AVIATION_STACK_API,
  };
}

//initialize environment validation on module load
try {
  validateEnv();
} catch (error) {
  console.error('Failed to initialize environment:', error);
  if (import.meta.env.NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('Environment validation failed in development mode. Some features may not work correctly.');
  }
}