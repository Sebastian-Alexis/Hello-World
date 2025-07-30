import { z } from 'zod';
import type { User } from '../db/types.js';

//common validation patterns
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const HEX_COLOR_REGEX = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

//sanitization helpers
function sanitizeString(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

//common field schemas
export const commonSchemas = {
  id: z.number().int().positive(),
  email: z.string()
    .min(1, 'Email is required')
    .max(255, 'Email too long')
    .regex(EMAIL_REGEX, 'Invalid email format')
    .transform(val => val.toLowerCase().trim()),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[0-9]/, 'Password must contain number'),
  
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username too long')
    .regex(USERNAME_REGEX, 'Username can only contain letters, numbers, hyphens, and underscores')
    .transform(val => val.toLowerCase().trim()),
  
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .transform(sanitizeString),
  
  slug: z.string()
    .min(1, 'Slug is required')
    .max(100, 'Slug too long')
    .regex(SLUG_REGEX, 'Slug must be lowercase with hyphens only')
    .transform(val => val.toLowerCase().trim()),
  
  url: z.string()
    .url('Invalid URL format')
    .max(2048, 'URL too long')
    .optional(),
  
  hexColor: z.string()
    .regex(HEX_COLOR_REGEX, 'Invalid hex color format')
    .transform(val => val.toLowerCase()),
  
  richText: z.string()
    .max(50000, 'Content too long')
    .transform(sanitizeString),
  
  plainText: z.string()
    .max(1000, 'Text too long')
    .transform(sanitizeHtml),
};

//user authentication schemas
export const authSchemas = {
  login: z.object({
    email: commonSchemas.email,
    password: z.string().min(1, 'Password is required'),
    remember: z.boolean().default(false),
  }),
  
  register: z.object({
    email: commonSchemas.email,
    username: commonSchemas.username,
    password: commonSchemas.password,
    first_name: commonSchemas.name,
    last_name: commonSchemas.name,
    terms_accepted: z.boolean().refine(val => val === true, 'You must accept the terms'),
  }),
  
  forgotPassword: z.object({
    email: commonSchemas.email,
  }),
  
  resetPassword: z.object({
    token: z.string().min(1, 'Reset token is required'),
    password: commonSchemas.password,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
  
  changePassword: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: commonSchemas.password,
    confirmPassword: z.string().min(1, 'Password confirmation is required'),
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }),
  
  verifyEmail: z.object({
    token: z.string().min(1, 'Verification token is required'),
  }),
};

//user management schemas
export const userSchemas = {
  profile: z.object({
    first_name: commonSchemas.name,
    last_name: commonSchemas.name,
    bio: z.string().max(500, 'Bio too long').optional().transform(val => val ? sanitizeHtml(val) : val),
    avatar_url: commonSchemas.url,
  }),
  
  updateUser: z.object({
    email: commonSchemas.email.optional(),
    username: commonSchemas.username.optional(),
    first_name: commonSchemas.name.optional(),
    last_name: commonSchemas.name.optional(),
    role: z.enum(['admin', 'editor', 'viewer']).optional(),
    is_active: z.boolean().optional(),
  }),
  
  createUser: z.object({
    email: commonSchemas.email,
    username: commonSchemas.username,
    password: commonSchemas.password,
    first_name: commonSchemas.name,
    last_name: commonSchemas.name,
    role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
  }),
};

//blog post schemas
export const blogSchemas = {
  create: z.object({
    title: z.string()
      .min(1, 'Title is required')
      .max(200, 'Title too long')
      .transform(sanitizeString),
    slug: commonSchemas.slug,
    excerpt: z.string()
      .max(500, 'Excerpt too long')
      .optional()
      .transform(val => val ? sanitizeHtml(val) : val),
    content: commonSchemas.richText,
    featured_image: commonSchemas.url,
    gallery_images: z.array(z.string().url()).max(10, 'Too many gallery images').optional(),
    meta_title: z.string().max(60, 'Meta title too long').optional().transform(val => val ? sanitizeString(val) : val),
    meta_description: z.string().max(160, 'Meta description too long').optional().transform(val => val ? sanitizeString(val) : val),
    canonical_url: commonSchemas.url,
    og_image: commonSchemas.url,
    status: z.enum(['draft', 'published']).default('draft'),
    featured: z.boolean().default(false),
    allow_comments: z.boolean().default(true),
    category_ids: z.array(z.number().int().positive()).min(1, 'At least one category required'),
    tag_ids: z.array(z.number().int().positive()).default([]),
    published_at: z.string().datetime().optional(),
  }),
  
  update: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').transform(sanitizeString).optional(),
    slug: commonSchemas.slug.optional(),
    excerpt: z.string().max(500, 'Excerpt too long').optional().transform(val => val ? sanitizeHtml(val) : val),
    content: commonSchemas.richText.optional(),
    featured_image: commonSchemas.url,
    gallery_images: z.array(z.string().url()).max(10, 'Too many gallery images').optional(),
    meta_title: z.string().max(60, 'Meta title too long').optional().transform(val => val ? sanitizeString(val) : val),
    meta_description: z.string().max(160, 'Meta description too long').optional().transform(val => val ? sanitizeString(val) : val),
    canonical_url: commonSchemas.url,
    og_image: commonSchemas.url,
    status: z.enum(['draft', 'published', 'archived']).optional(),
    featured: z.boolean().optional(),
    allow_comments: z.boolean().optional(),
    category_ids: z.array(z.number().int().positive()).optional(),
    tag_ids: z.array(z.number().int().positive()).optional(),
    published_at: z.string().datetime().optional(),
  }),
  
  category: z.object({
    name: commonSchemas.name,
    slug: commonSchemas.slug,
    description: z.string().max(500, 'Description too long').optional().transform(val => val ? sanitizeString(val) : val),
    color: commonSchemas.hexColor,
    icon: z.string().max(50, 'Icon name too long').optional(),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().nonnegative().default(0),
  }),
  
  tag: z.object({
    name: commonSchemas.name,
    slug: commonSchemas.slug,
    description: z.string().max(500, 'Description too long').optional().transform(val => val ? sanitizeString(val) : val),
    color: commonSchemas.hexColor.optional(),
    is_active: z.boolean().default(true),
  }),
};

//portfolio project schemas
export const portfolioSchemas = {
  create: z.object({
    title: z.string()
      .min(1, 'Title is required')
      .max(200, 'Title too long')
      .transform(sanitizeString),
    slug: commonSchemas.slug,
    short_description: z.string()
      .min(1, 'Short description is required')
      .max(300, 'Short description too long')
      .transform(sanitizeString),
    full_description: z.string()
      .max(2000, 'Full description too long')
      .optional()
      .transform(val => val ? sanitizeString(val) : val),
    content: commonSchemas.richText.optional(),
    featured_image: commonSchemas.url,
    gallery_images: z.array(z.string().url()).max(20, 'Too many gallery images').optional(),
    demo_url: commonSchemas.url,
    source_url: commonSchemas.url,
    case_study_url: commonSchemas.url,
    status: z.enum(['planning', 'in_progress', 'completed', 'archived']).default('planning'),
    featured: z.boolean().default(false),
    difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
    estimated_hours: z.number().int().positive().max(10000, 'Estimated hours too high').optional(),
    client_name: commonSchemas.name.optional(),
    team_size: z.number().int().positive().max(100, 'Team size too large').optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    category_ids: z.array(z.number().int().positive()).min(1, 'At least one category required'),
    technology_ids: z.array(z.number().int().positive()).min(1, 'At least one technology required'),
  }),
  
  update: z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title too long').transform(sanitizeString).optional(),
    slug: commonSchemas.slug.optional(),
    short_description: z.string().min(1, 'Short description is required').max(300, 'Short description too long').transform(sanitizeString).optional(),
    full_description: z.string().max(2000, 'Full description too long').optional().transform(val => val ? sanitizeString(val) : val),
    content: commonSchemas.richText.optional(),
    featured_image: commonSchemas.url,
    gallery_images: z.array(z.string().url()).max(20, 'Too many gallery images').optional(),
    demo_url: commonSchemas.url,
    source_url: commonSchemas.url,
    case_study_url: commonSchemas.url,
    status: z.enum(['planning', 'in_progress', 'completed', 'archived']).optional(),
    featured: z.boolean().optional(),
    difficulty_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    estimated_hours: z.number().int().positive().max(10000, 'Estimated hours too high').optional(),
    client_name: commonSchemas.name.optional(),
    team_size: z.number().int().positive().max(100, 'Team size too large').optional(),
    start_date: z.string().date().optional(),
    end_date: z.string().date().optional(),
    category_ids: z.array(z.number().int().positive()).optional(),
    technology_ids: z.array(z.number().int().positive()).optional(),
  }),
  
  category: z.object({
    name: commonSchemas.name,
    slug: commonSchemas.slug,
    description: z.string().max(500, 'Description too long').optional().transform(val => val ? sanitizeString(val) : val),
    color: commonSchemas.hexColor,
    icon: z.string().max(50, 'Icon name too long').optional(),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().nonnegative().default(0),
  }),
  
  technology: z.object({
    name: commonSchemas.name,
    slug: commonSchemas.slug,
    description: z.string().max(500, 'Description too long').optional().transform(val => val ? sanitizeString(val) : val),
    icon: z.string().max(50, 'Icon name too long').optional(),
    color: commonSchemas.hexColor.optional(),
    category: z.enum(['language', 'framework', 'library', 'tool', 'platform', 'database']),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().nonnegative().default(0),
  }),
};

//flight tracking schemas
export const flightSchemas = {
  create: z.object({
    flight_number: z.string().max(20, 'Flight number too long').optional(),
    airline_code: z.string().length(2, 'Airline code must be 2 characters').optional(),
    airline_name: commonSchemas.name.optional(),
    aircraft_type: z.string().max(50, 'Aircraft type too long').optional(),
    departure_airport_id: z.number().int().positive(),
    arrival_airport_id: z.number().int().positive(),
    departure_time: z.string().datetime(),
    arrival_time: z.string().datetime(),
    seat_number: z.string().max(10, 'Seat number too long').optional(),
    class: z.enum(['economy', 'premium_economy', 'business', 'first']).optional(),
    booking_reference: z.string().max(20, 'Booking reference too long').optional(),
    ticket_price: z.number().positive().max(100000, 'Ticket price too high').optional(),
    currency: z.string().length(3, 'Currency must be 3 characters'),
    notes: z.string().max(1000, 'Notes too long').optional().transform(val => val ? sanitizeString(val) : val),
    photos: z.array(z.string().url()).max(10, 'Too many photos').optional(),
    trip_purpose: z.enum(['business', 'vacation', 'personal', 'other']).optional(),
    is_favorite: z.boolean().default(false),
  }).refine(data => new Date(data.arrival_time) > new Date(data.departure_time), {
    message: 'Arrival time must be after departure time',
    path: ['arrival_time'],
  }).refine(data => data.departure_airport_id !== data.arrival_airport_id, {
    message: 'Departure and arrival airports must be different',
    path: ['arrival_airport_id'],
  }),
  
  airport: z.object({
    iata_code: z.string().length(3, 'IATA code must be 3 characters').transform(val => val.toUpperCase()),
    icao_code: z.string().length(4, 'ICAO code must be 4 characters').optional().transform(val => val ? val.toUpperCase() : val),
    name: commonSchemas.name,
    city: commonSchemas.name,
    country: commonSchemas.name,
    country_code: z.string().length(2, 'Country code must be 2 characters').transform(val => val.toUpperCase()),
    region: commonSchemas.name.optional(),
    latitude: z.number().min(-90, 'Invalid latitude').max(90, 'Invalid latitude'),
    longitude: z.number().min(-180, 'Invalid longitude').max(180, 'Invalid longitude'),
    altitude: z.number().int().optional(),
    timezone: z.string().max(50, 'Timezone too long').optional(),
    dst_timezone: z.string().max(50, 'DST timezone too long').optional(),
    type: z.enum(['airport', 'heliport', 'seaplane_base', 'balloonport']).default('airport'),
    is_active: z.boolean().default(true),
  }),
};

//media file schemas
export const mediaSchemas = {
  upload: z.object({
    filename: z.string().min(1, 'Filename is required').max(255, 'Filename too long'),
    file_type: z.enum(['image', 'video', 'audio', 'document', 'other']),
    mime_type: z.string().min(1, 'MIME type is required').max(100, 'MIME type too long'),
    file_size: z.number().int().positive().max(100 * 1024 * 1024, 'File too large (max 100MB)'),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    duration: z.number().positive().optional(),
    alt_text: z.string().max(255, 'Alt text too long').optional().transform(val => val ? sanitizeString(val) : val),
    caption: z.string().max(500, 'Caption too long').optional().transform(val => val ? sanitizeString(val) : val),
    is_public: z.boolean().default(true),
  }),
};

//api query schemas
export const querySchemas = {
  pagination: z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100, 'Limit too high').default(20),
    sortBy: z.string().max(50, 'Sort field too long').optional(),
    sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  }),
  
  search: z.object({
    query: z.string().max(200, 'Search query too long').optional().transform(val => val ? sanitizeString(val) : val),
    category: z.string().max(50, 'Category too long').optional(),
    tag: z.string().max(50, 'Tag too long').optional(),
    status: z.string().max(20, 'Status too long').optional(),
    featured: z.boolean().optional(),
    author: z.number().int().positive().optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  }),
  
  blogSearch: z.object({
    query: z.string().max(200, 'Search query too long').optional(),
    categories: z.array(z.number().int().positive()).max(10, 'Too many categories').optional(),
    tags: z.array(z.number().int().positive()).max(20, 'Too many tags').optional(),
    status: z.enum(['draft', 'published', 'archived']).optional(),
    featured: z.boolean().optional(),
    author: z.number().int().positive().optional(),
  }),
};

//contact form schema
export const contactSchema = z.object({
  name: commonSchemas.name,
  email: commonSchemas.email,
  subject: z.string()
    .min(1, 'Subject is required')
    .max(200, 'Subject too long')
    .transform(sanitizeString),
  message: z.string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long')
    .transform(sanitizeString),
  honeypot: z.string().max(0, 'Bot detected').optional(), //spam protection
});

//newsletter schema
export const newsletterSchema = z.object({
  email: commonSchemas.email,
  name: commonSchemas.name.optional(),
  preferences: z.array(z.string()).max(10, 'Too many preferences').optional(),
});

//file upload validation
export const fileUploadSchema = z.object({
  filename: z.string().min(1, 'Filename required').max(255, 'Filename too long'),
  mimetype: z.string().min(1, 'MIME type required'),
  size: z.number().int().positive().max(50 * 1024 * 1024, 'File too large (max 50MB)'),
  buffer: z.instanceof(Buffer),
});

//validation helpers
export function validateSlugUniqueness(slug: string, existingSlugs: string[]): boolean {
  return !existingSlugs.includes(slug);
}

export function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') //remove special chars
    .replace(/[\s_-]+/g, '-') //replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); //trim hyphens from start/end
}

//api response validation
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.string().datetime(),
});