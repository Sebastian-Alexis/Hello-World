# Plan 4: Admin Panel & Authentication System

**Session Goal**: Implement complete admin panel with authentication, content management, and dashboard  
**Estimated Time**: 4-5 hours  
**Prerequisites**: Plans 1-3 completed (foundation, layout, and blog system)  

## Development Phase: Administrative Interface

### Todo List

#### 1. Authentication System
- [ ] Implement JWT token generation and validation utilities
- [ ] Create password hashing and verification functions
- [ ] Build login/logout API endpoints with rate limiting
- [ ] Implement session management and token refresh
- [ ] Create authentication middleware for protected routes
- [ ] Set up password reset functionality via email
- [ ] Add two-factor authentication (2FA) support
- [ ] Test all authentication flows thoroughly

#### 2. Admin Dashboard Layout
- [ ] Create AdminLayout component with sidebar navigation
- [ ] Build responsive admin header with user profile
- [ ] Implement admin sidebar with collapsible sections
- [ ] Create dashboard overview with key metrics
- [ ] Build breadcrumb navigation system
- [ ] Add notification/toast system for admin actions
- [ ] Implement admin theme and dark mode support
- [ ] Test admin layout across devices

#### 3. Content Management Interface
- [ ] Build blog post creation/editing form with rich editor
- [ ] Implement image upload with drag-and-drop support
- [ ] Create category and tag management system
- [ ] Build content scheduling and publishing workflow
- [ ] Add bulk operations for content management
- [ ] Implement content preview and revision history
- [ ] Create SEO optimization tools and meta preview
- [ ] Build content analytics and performance metrics

#### 4. User Management System
- [ ] Create user creation and editing interfaces
- [ ] Implement role-based access control (RBAC)
- [ ] Build user activity logging and audit trails
- [ ] Add user profile management with avatar upload
- [ ] Create permission management interface
- [ ] Implement user session monitoring
- [ ] Add user invitation system via email
- [ ] Build user analytics and activity reports

#### 5. Media Management
- [ ] Create file upload system with progress tracking
- [ ] Implement image optimization and resizing
- [ ] Build media library with search and filtering
- [ ] Add image alt text and caption management
- [ ] Create bulk media operations (delete, organize)
- [ ] Implement CDN integration for file delivery
- [ ] Add media usage tracking across content
- [ ] Build storage quota monitoring and alerts

#### 6. Analytics Dashboard
- [ ] Create comprehensive analytics overview
- [ ] Build real-time visitor tracking dashboard
- [ ] Implement content performance metrics
- [ ] Add search analytics and keyword insights
- [ ] Create user behavior flow visualization
- [ ] Build custom date range filtering
- [ ] Implement export functionality for reports
- [ ] Add goal tracking and conversion metrics

#### 7. System Settings & Configuration
- [ ] Create site settings management interface
- [ ] Build email configuration and testing tools
- [ ] Implement backup and restore functionality
- [ ] Add security settings and monitoring
- [ ] Create API key management system
- [ ] Build integration settings (third-party services)
- [ ] Implement system health monitoring
- [ ] Add maintenance mode toggle

#### 8. Advanced Features
- [ ] Build content import/export system
- [ ] Create automated content suggestions
- [ ] Implement content collaboration features
- [ ] Add comment moderation system
- [ ] Build A/B testing framework for content
- [ ] Create content scheduling calendar view
- [ ] Implement advanced search and filtering
- [ ] Add workflow automation rules

## Detailed Implementation Steps

### Step 1: Authentication System (90 minutes)

**JWT Utilities** (lib/auth/jwt.ts):
```typescript
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { User } from '../db/types';

interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private static readonly JWT_SECRET = import.meta.env.ADMIN_JWT_SECRET;
  private static readonly JWT_EXPIRES_IN = '7d';
  private static readonly REFRESH_EXPIRES_IN = '30d';
  
  // Generate access token
  static generateAccessToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });
  }
  
  // Generate refresh token
  static generateRefreshToken(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };
    
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.REFRESH_EXPIRES_IN
    });
  }
  
  // Verify token
  static verifyToken(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      return null;
    }
  }
  
  // Hash password
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  }
  
  // Verify password
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
  
  // Generate secure random token
  static generateSecureToken(length = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Authentication middleware
export async function requireAuth(request: Request): Promise<{ user: User | null; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'No authorization token provided' };
  }
  
  const token = authHeader.substring(7);
  const payload = AuthService.verifyToken(token);
  
  if (!payload) {
    return { user: null, error: 'Invalid or expired token' };
  }
  
  // Get fresh user data from database
  const user = await DatabaseQueries.getUserById(payload.userId);
  
  if (!user) {
    return { user: null, error: 'User not found' };
  }
  
  return { user };
}

// Role-based access control
export function requireRole(allowedRoles: string[]) {
  return async (request: Request): Promise<{ user: User | null; error?: string }> => {
    const { user, error } = await requireAuth(request);
    
    if (error || !user) {
      return { user: null, error: error || 'Authentication required' };
    }
    
    if (!allowedRoles.includes(user.role)) {
      return { user: null, error: 'Insufficient permissions' };
    }
    
    return { user };
  };
}
```

**Login API** (src/pages/api/auth/login.ts):
```typescript
import type { APIRoute } from 'astro';
import { AuthService } from '../../../lib/auth/jwt';
import { DatabaseQueries } from '../../../lib/db/queries';

// Rate limiting storage (in production, use Redis)
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();

function getRateLimitKey(ip: string, email?: string): string {
  return email ? `${ip}:${email}` : ip;
}

function isRateLimited(key: string): boolean {
  const attempt = loginAttempts.get(key);
  if (!attempt) return false;
  
  const now = Date.now();
  const timeDiff = now - attempt.lastAttempt;
  
  // Reset after 15 minutes
  if (timeDiff > 15 * 60 * 1000) {
    loginAttempts.delete(key);
    return false;
  }
  
  // Allow 5 attempts per 15 minutes
  return attempt.count >= 5;
}

function recordLoginAttempt(key: string): void {
  const attempt = loginAttempts.get(key) || { count: 0, lastAttempt: 0 };
  attempt.count++;
  attempt.lastAttempt = Date.now();
  loginAttempts.set(key, attempt);
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json();
    const { email, password, rememberMe } = body;
    
    // Validation
    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email and password are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Rate limiting
    const clientIP = clientAddress || 'unknown';
    const rateLimitKey = getRateLimitKey(clientIP, email);
    
    if (isRateLimited(rateLimitKey)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many login attempts. Please try again later.'
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Find user
    const user = await DatabaseQueries.getUserByEmail(email);
    
    if (!user) {
      recordLoginAttempt(rateLimitKey);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Verify password
    const isValidPassword = await AuthService.verifyPassword(password, user.password_hash);
    
    if (!isValidPassword) {
      recordLoginAttempt(rateLimitKey);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email or password'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Clear rate limiting on successful login
    clearLoginAttempts(rateLimitKey);
    
    // Update last login
    await DatabaseQueries.updateUserLastLogin(user.id);
    
    // Generate tokens
    const accessToken = AuthService.generateAccessToken(user);
    const refreshToken = rememberMe ? AuthService.generateRefreshToken(user) : null;
    
    // Set secure cookies
    const cookieOptions = [
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/'
    ];
    
    const headers = new Headers({
      'Content-Type': 'application/json'
    });
    
    headers.set('Set-Cookie', [
      `access_token=${accessToken}; ${cookieOptions.join('; ')}; Max-Age=${7 * 24 * 60 * 60}`,
      refreshToken ? `refresh_token=${refreshToken}; ${cookieOptions.join('; ')}; Max-Age=${30 * 24 * 60 * 60}` : null
    ].filter(Boolean).join(', '));
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar_url: user.avatar_url
        },
        accessToken,
        refreshToken
      }
    }), {
      status: 200,
      headers
    });
    
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Login failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

### Step 2: Admin Layout System (75 minutes)

**Admin Layout** (src/layouts/AdminLayout.astro):
```astro
---
export interface Props {
  title: string;
  description?: string;
  showSidebar?: boolean;
}

const { 
  title, 
  description = 'Admin Panel', 
  showSidebar = true 
} = Astro.props;

// Check authentication on server-side
import { requireAuth } from '../lib/auth/jwt';

const authResult = await requireAuth(Astro.request);
if (!authResult.user) {
  // Redirect to login if not authenticated
  return Astro.redirect('/admin/login');
}

const user = authResult.user;
---

<!DOCTYPE html>
<html lang="en" class="h-full">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} | Admin Panel</title>
  <meta name="description" content={description}>
  <meta name="robots" content="noindex, nofollow">
  
  <!-- Admin-specific styles -->
  <link rel="stylesheet" href="/styles/variables.css">
  <link rel="stylesheet" href="/styles/global.css">
  <link rel="stylesheet" href="/styles/admin.css">
  
  <!-- Prevent admin pages from being cached -->
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <meta http-equiv="Pragma" content="no-cache">
  <meta http-equiv="Expires" content="0">
</head>

<body class="h-full bg-secondary" data-theme="admin">
  <div class="flex h-full">
    <!-- Sidebar -->
    {showSidebar && (
      <aside 
        id="admin-sidebar" 
        class="fixed inset-y-0 left-0 z-50 w-64 bg-primary border-r border-primary transform -translate-x-full lg:translate-x-0 lg:static lg:inset-0 transition-transform duration-200 ease-in-out"
      >
        <!-- Sidebar Header -->
        <div class="flex items-center justify-between h-16 px-6 border-b border-primary">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 bg-accent-primary rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
            </div>
            <span class="text-lg font-semibold text-primary">Admin</span>
          </div>
          
          <!-- Mobile close button -->
          <button 
            id="sidebar-close" 
            class="lg:hidden p-2 rounded-md hover:bg-secondary transition-colors"
            aria-label="Close sidebar"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        
        <!-- Navigation -->
        <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <!-- Dashboard -->
          <a 
            href="/admin" 
            class="admin-nav-link"
            data-page="dashboard"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
            Dashboard
          </a>
          
          <!-- Content Section -->
          <div class="nav-section">
            <h3 class="nav-section-title">Content</h3>
            <a href="/admin/blog" class="admin-nav-link" data-page="blog">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/>
              </svg>
              Blog Posts
            </a>
            <a href="/admin/categories" class="admin-nav-link" data-page="categories">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"/>
              </svg>
              Categories
            </a>
            <a href="/admin/portfolio" class="admin-nav-link" data-page="portfolio">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15.586 13H14a1 1 0 01-1-1z" clip-rule="evenodd"/>
              </svg>
              Portfolio
            </a>
          </div>
          
          <!-- Travel Section -->
          <div class="nav-section">
            <h3 class="nav-section-title">Travel</h3>
            <a href="/admin/flights" class="admin-nav-link" data-page="flights">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
              </svg>
              Flights
            </a>
            <a href="/admin/countries" class="admin-nav-link" data-page="countries">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clip-rule="evenodd"/>
              </svg>
              Countries
            </a>
          </div>
          
          <!-- System Section -->
          <div class="nav-section">
            <h3 class="nav-section-title">System</h3>
            <a href="/admin/media" class="admin-nav-link" data-page="media">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
              </svg>
              Media Library
            </a>
            <a href="/admin/analytics" class="admin-nav-link" data-page="analytics">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
              </svg>
              Analytics
            </a>
            <a href="/admin/settings" class="admin-nav-link" data-page="settings">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd"/>
              </svg>
              Settings
            </a>
          </div>
        </nav>
        
        <!-- User Menu -->
        <div class="border-t border-primary p-4">
          <div class="flex items-center space-x-3">
            <img 
              src={user.avatar_url || '/images/default-avatar.svg'} 
              alt={user.name}
              class="w-8 h-8 rounded-full"
            >
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-primary truncate">{user.name}</p>
              <p class="text-xs text-secondary truncate">{user.role}</p>
            </div>
            <button 
              id="user-menu-button" 
              class="p-1 rounded-md hover:bg-secondary transition-colors"
              aria-label="User menu"
            >
              <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
              </svg>
            </button>
          </div>
          
          <!-- User Dropdown Menu -->
          <div 
            id="user-menu" 
            class="hidden absolute bottom-16 left-4 right-4 bg-primary border border-primary rounded-lg shadow-lg py-2 z-50"
          >
            <a href="/admin/profile" class="block px-4 py-2 text-sm text-primary hover:bg-secondary transition-colors">
              Profile Settings
            </a>
            <a href="/" target="_blank" class="block px-4 py-2 text-sm text-primary hover:bg-secondary transition-colors">
              View Site
            </a>
            <hr class="my-2 border-primary">
            <button 
              id="logout-button" 
              class="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-secondary transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </aside>
    )}
    
    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Top Header -->
      <header class="bg-primary border-b border-primary px-6 py-4 flex items-center justify-between">
        <!-- Mobile sidebar toggle -->
        <button 
          id="sidebar-toggle" 
          class="lg:hidden p-2 rounded-md hover:bg-secondary transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
          </svg>
        </button>
        
        <!-- Page Title -->
        <div class="flex-1">
          <h1 class="text-2xl font-semibold text-primary">{title}</h1>
          {description && (
            <p class="text-sm text-secondary mt-1">{description}</p>
          )}
        </div>
        
        <!-- Header Actions -->
        <div class="flex items-center space-x-4">
          <!-- Notifications -->
          <button class="p-2 rounded-md hover:bg-secondary transition-colors relative">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
            </svg>
            <span class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
          
          <!-- Theme Toggle -->
          <button 
            id="admin-theme-toggle" 
            class="p-2 rounded-md hover:bg-secondary transition-colors"
            aria-label="Toggle theme"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" clip-rule="evenodd"/>
            </svg>
          </button>
        </div>
      </header>
      
      <!-- Main Content -->
      <main class="flex-1 overflow-auto bg-secondary">
        <div class="max-w-7xl mx-auto px-6 py-8">
          <slot />
        </div>
      </main>
    </div>
  </div>
  
  <!-- Overlay for mobile sidebar -->
  <div 
    id="sidebar-overlay" 
    class="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden hidden"
  ></div>
  
  <!-- Admin Scripts -->
  <script src="/scripts/admin.js"></script>
  
  <!-- Toast Container -->
  <div id="toast-container" class="fixed top-4 right-4 z-50 space-y-2"></div>
</body>
</html>

<style>
  /* Admin-specific styles */
  .admin-nav-link {
    @apply flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200;
    @apply text-secondary hover:text-primary hover:bg-secondary;
  }
  
  .admin-nav-link.active {
    @apply text-accent-primary bg-accent-primary bg-opacity-10;
  }
  
  .nav-section {
    @apply mt-6;
  }
  
  .nav-section-title {
    @apply px-3 text-xs font-semibold text-tertiary uppercase tracking-wider mb-2;
  }
  
  /* Toast styles */
  .toast {
    @apply bg-primary border border-primary rounded-lg shadow-lg p-4 min-w-80 max-w-md;
  }
  
  .toast.success {
    @apply border-green-500 bg-green-50 text-green-800;
  }
  
  .toast.error {
    @apply border-red-500 bg-red-50 text-red-800;
  }
  
  .toast.warning {
    @apply border-orange-500 bg-orange-50 text-orange-800;
  }
  
  .toast.info {
    @apply border-blue-500 bg-blue-50 text-blue-800;
  }
</style>
```

### Step 3: Admin Dashboard Components (90 minutes)

**Dashboard Overview** (src/pages/admin/index.astro):
```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
import { DatabaseQueries } from '../../lib/db/queries';

// Get dashboard statistics
const [blogStats, analyticsStats, systemStats] = await Promise.all([
  DatabaseQueries.getBlogStatistics(),
  DatabaseQueries.getAnalyticsOverview(),
  DatabaseQueries.getSystemStatistics()
]);

const recentPosts = await DatabaseQueries.getBlogPosts({ 
  page: 1, 
  limit: 5, 
  sortBy: 'date' 
});

const topPosts = await DatabaseQueries.getBlogPosts({ 
  page: 1, 
  limit: 5, 
  sortBy: 'views' 
});
---

<AdminLayout 
  title="Dashboard" 
  description="Overview of your website's performance and content"
>
  <!-- Stats Cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    <!-- Total Posts -->
    <div class="bg-primary rounded-lg border border-primary p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-secondary">Total Posts</p>
          <p class="text-3xl font-bold text-primary">{blogStats.totalPosts}</p>
        </div>
        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clip-rule="evenodd"/>
          </svg>
        </div>
      </div>
      <div class="mt-4 flex items-center">
        <span class="text-green-600 text-sm font-medium">
          +{blogStats.postsThisMonth}
        </span>
        <span class="text-secondary text-sm ml-2">this month</span>
      </div>
    </div>
    
    <!-- Total Views -->
    <div class="bg-primary rounded-lg border border-primary p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-secondary">Total Views</p>
          <p class="text-3xl font-bold text-primary">{analyticsStats.totalViews.toLocaleString()}</p>
        </div>
        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
            <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
          </svg>
        </div>
      </div>
      <div class="mt-4 flex items-center">
        <span class="text-green-600 text-sm font-medium">
          +{((analyticsStats.viewsThisMonth / analyticsStats.viewsLastMonth - 1) * 100).toFixed(1)}%
        </span>
        <span class="text-secondary text-sm ml-2">vs last month</span>
      </div>
    </div>
    
    <!-- Unique Visitors -->
    <div class="bg-primary rounded-lg border border-primary p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-secondary">Visitors</p>
          <p class="text-3xl font-bold text-primary">{analyticsStats.uniqueVisitors.toLocaleString()}</p>
        </div>
        <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
          </svg>
        </div>
      </div>
      <div class="mt-4 flex items-center">
        <span class="text-purple-600 text-sm font-medium">
          {analyticsStats.visitorsToday}
        </span>
        <span class="text-secondary text-sm ml-2">today</span>
      </div>
    </div>
    
    <!-- Storage Used -->
    <div class="bg-primary rounded-lg border border-primary p-6">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-secondary">Storage</p>
          <p class="text-3xl font-bold text-primary">{systemStats.storageUsedGB.toFixed(1)}GB</p>
        </div>
        <div class="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
          </svg>
        </div>
      </div>
      <div class="mt-4">
        <div class="w-full bg-secondary rounded-full h-2">
          <div 
            class="bg-orange-600 h-2 rounded-full" 
            style={`width: ${(systemStats.storageUsedGB / systemStats.storageLimitGB) * 100}%`}
          ></div>
        </div>
        <span class="text-secondary text-sm mt-1">
          {systemStats.storageUsedGB.toFixed(1)}GB of {systemStats.storageLimitGB}GB used
        </span>
      </div>
    </div>
  </div>
  
  <!-- Main Content Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
    <!-- Recent Activity -->
    <div class="lg:col-span-2">
      <div class="bg-primary rounded-lg border border-primary">
        <div class="px-6 py-4 border-b border-primary">
          <h3 class="text-lg font-semibold text-primary">Recent Posts</h3>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            {recentPosts.data.map(post => (
              <div class="flex items-center justify-between p-4 bg-secondary rounded-lg">
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-primary truncate">
                    {post.title}
                  </h4>
                  <p class="text-xs text-secondary mt-1">
                    {new Date(post.published_at || post.created_at).toLocaleDateString()} • 
                    {post.view_count} views
                  </p>
                </div>
                <div class="flex items-center space-x-2 ml-4">
                  <span class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    post.status === 'published' ? 'bg-green-100 text-green-800' :
                    post.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {post.status}
                  </span>
                  <a 
                    href={`/admin/blog/${post.id}`}
                    class="text-accent-primary hover:text-accent-hover text-sm font-medium"
                  >
                    Edit
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div class="mt-6">
            <a 
              href="/admin/blog" 
              class="text-accent-primary hover:text-accent-hover font-medium text-sm"
            >
              View all posts →
            </a>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Quick Actions & Top Posts -->
    <div class="space-y-8">
      <!-- Quick Actions -->
      <div class="bg-primary rounded-lg border border-primary">
        <div class="px-6 py-4 border-b border-primary">
          <h3 class="text-lg font-semibold text-primary">Quick Actions</h3>
        </div>
        <div class="p-6 space-y-3">
          <a 
            href="/admin/blog/new" 
            class="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary transition-colors"
          >
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
              </svg>
            </div>
            <span class="font-medium text-primary">New Blog Post</span>
          </a>
          
          <a 
            href="/admin/portfolio/new" 
            class="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary transition-colors"
          >
            <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15.586 13H14a1 1 0 01-1-1z" clip-rule="evenodd"/>
              </svg>
            </div>
            <span class="font-medium text-primary">New Project</span>
          </a>
          
          <a 
            href="/admin/flights/new" 
            class="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary transition-colors"
          >
            <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/>
              </svg>
            </div>
            <span class="font-medium text-primary">Add Flight</span>
          </a>
          
          <a 
            href="/admin/media" 
            class="flex items-center space-x-3 p-3 rounded-lg hover:bg-secondary transition-colors"
          >
            <div class="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clip-rule="evenodd"/>
              </svg>
            </div>
            <span class="font-medium text-primary">Upload Media</span>
          </a>
        </div>
      </div>
      
      <!-- Top Posts -->
      <div class="bg-primary rounded-lg border border-primary">
        <div class="px-6 py-4 border-b border-primary">
          <h3 class="text-lg font-semibold text-primary">Top Posts</h3>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            {topPosts.data.map((post, index) => (
              <div class="flex items-center space-x-3">
                <div class="flex-shrink-0 w-6 h-6 bg-accent-primary text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </div>
                <div class="flex-1 min-w-0">
                  <h4 class="text-sm font-medium text-primary truncate">
                    {post.title}
                  </h4>
                  <p class="text-xs text-secondary">
                    {post.view_count} views
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Recent Activity Chart -->
  <div class="mt-8">
    <div class="bg-primary rounded-lg border border-primary">
      <div class="px-6 py-4 border-b border-primary">
        <h3 class="text-lg font-semibold text-primary">Activity Overview</h3>
      </div>
      <div class="p-6">
        <div id="activity-chart" class="h-64">
          <!-- Chart will be rendered here via JavaScript -->
        </div>
      </div>
    </div>
  </div>
</AdminLayout>

<script>
  // Initialize dashboard
  document.addEventListener('DOMContentLoaded', function() {
    // Set active navigation
    const navLinks = document.querySelectorAll('.admin-nav-link');
    navLinks.forEach(link => {
      if (link.getAttribute('data-page') === 'dashboard') {
        link.classList.add('active');
      }
    });
    
    // Initialize activity chart (placeholder)
    // In a real implementation, you would use a charting library like Chart.js
    const chartContainer = document.getElementById('activity-chart');
    if (chartContainer) {
      chartContainer.innerHTML = `
        <div class="flex items-center justify-center h-full text-secondary">
          <div class="text-center">
            <svg class="w-12 h-12 mx-auto mb-4 text-tertiary" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
            </svg>
            <p class="text-sm">Activity chart will be displayed here</p>
          </div>
        </div>
      `;
    }
  });
</script>
```

## Testing & Validation

### Final Checklist
- [ ] Authentication system securely handles login/logout
- [ ] JWT tokens are properly generated and validated
- [ ] Admin layout renders correctly across devices
- [ ] Navigation system works with active states
- [ ] Dashboard displays accurate statistics
- [ ] User management interface is functional
- [ ] Role-based access control works correctly
- [ ] Password hashing and verification is secure
- [ ] Rate limiting prevents brute force attacks
- [ ] Session management handles token refresh
- [ ] Admin interface is mobile-responsive
- [ ] All API endpoints return proper responses

## Success Criteria
✅ Complete authentication system with JWT tokens  
✅ Responsive admin layout with navigation  
✅ Dashboard with real-time statistics  
✅ User management with role-based access  
✅ Secure session management  
✅ Rate limiting and security measures  
✅ Mobile-responsive admin interface  

## Next Session
Plan 5 will focus on implementing the interactive flight map with deck.gl and comprehensive travel tracking features.