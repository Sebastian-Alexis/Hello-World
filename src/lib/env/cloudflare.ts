// Cloudflare Workers environment variable handling
import type { Env } from './index';

// Global store for Cloudflare environment
let cloudflareEnv: any = null;

// Set the Cloudflare environment (called from _worker.js)
export function setCloudflareEnv(env: any) {
  cloudflareEnv = env;
}

// Get environment variable with Cloudflare Workers compatibility
export function getEnvVar(key: string): string | undefined {
  // First try Cloudflare env from global
  if (typeof globalThis !== 'undefined' && (globalThis as any).__CLOUDFLARE_ENV__ && (globalThis as any).__CLOUDFLARE_ENV__[key] !== undefined) {
    return (globalThis as any).__CLOUDFLARE_ENV__[key];
  }
  
  // Then try stored Cloudflare env
  if (cloudflareEnv && cloudflareEnv[key] !== undefined) {
    return cloudflareEnv[key];
  }
  
  // Then try import.meta.env (Vite/Astro)
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
    return import.meta.env[key];
  }
  
  // Finally try process.env (Node.js - development only)
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }
  
  return undefined;
}

// Get all environment variables
export function getAllEnvVars(): Record<string, string | undefined> {
  const vars: Record<string, string | undefined> = {};
  
  // List of expected environment variables
  const envKeys = [
    'TURSO_DATABASE_URL',
    'TURSO_AUTH_TOKEN',
    'TURSO_SYNC_URL',
    'JWT_SECRET',
    'BCRYPT_ROUNDS',
    'SESSION_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'ADMIN_NAME',
    'VITE_MAPBOX_ACCESS_TOKEN',
    'PUBLIC_MAPBOX_ACCESS_TOKEN',
    'MAPBOX_STYLE_URL',
    'AVIATION_STACK_API',
    'SITE_URL',
    'SITE_NAME',
    'SITE_DESCRIPTION',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'FROM_EMAIL',
    'GOOGLE_ANALYTICS_ID',
    'UMAMI_WEBSITE_ID',
    'UMAMI_URL',
    'CDN_URL',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'NODE_ENV',
    'DEBUG',
    'VERBOSE_LOGGING',
    'RATE_LIMIT_WINDOW',
    'RATE_LIMIT_MAX_REQUESTS',
    'CACHE_TTL',
    'REDIS_URL',
    'ENVIRONMENT', // Cloudflare-specific
  ];
  
  for (const key of envKeys) {
    vars[key] = getEnvVar(key);
  }
  
  return vars;
}