# Plan 2: Core Layout System & Design Implementation

**Session Goal**: Implement the complete layout system, design tokens, and core UI components  
**Estimated Time**: 3-4 hours  
**Prerequisites**: Plan 1 completed (project foundation and database setup)  

## Development Phase: UI Foundation & Layout System

### Todo List

#### 1. Design System Setup
- [ ] Create CSS custom properties for design tokens
- [ ] Implement light/dark theme system with CSS variables
- [ ] Set up Tailwind CSS configuration with custom colors and spacing
- [ ] Create typography scale and font loading optimization
- [ ] Define animation and transition utilities
- [ ] Set up responsive breakpoint system
- [ ] Create utility classes for common patterns

#### 2. Core Layout Components
- [ ] Implement BaseLayout.astro with full SEO optimization
- [ ] Create Header component with navigation and mobile menu
- [ ] Build Footer component with social links and sitemap
- [ ] Implement responsive navigation system
- [ ] Add theme toggle functionality
- [ ] Create mobile-first menu system
- [ ] Set up accessibility features (skip links, aria labels)

#### 3. Essential UI Components
- [ ] Build Button component with variants and states
- [ ] Create Card component for content containers
- [ ] Implement Input and form components
- [ ] Build Modal/Dialog component system
- [ ] Create LoadingSpinner and skeleton states
- [ ] Implement Tag/Badge components
- [ ] Build Icon system using Lucide icons

#### 4. Analytics Integration
- [ ] Implement client-side analytics tracking
- [ ] Set up page view tracking with user sessions
- [ ] Create performance metrics collection
- [ ] Build event tracking for user interactions
- [ ] Set up error tracking and reporting
- [ ] Implement privacy-compliant analytics
- [ ] Test analytics data flow

#### 5. Performance Optimizations
- [ ] Implement critical CSS inlining
- [ ] Set up font preloading and optimization
- [ ] Create image optimization utilities
- [ ] Configure asset bundling and code splitting
- [ ] Implement service worker for caching
- [ ] Set up compression and minification
- [ ] Test Core Web Vitals metrics

#### 6. Homepage Implementation
- [ ] Create hero section with personal introduction
- [ ] Build featured blog posts section
- [ ] Implement featured projects showcase
- [ ] Add recent activity/stats overview
- [ ] Create call-to-action sections
- [ ] Implement smooth scroll and animations
- [ ] Test responsive design across devices

#### 7. Error Handling & Loading States
- [ ] Create 404 error page with navigation
- [ ] Implement 500 error page
- [ ] Build loading states for all components
- [ ] Create skeleton screens for content loading
- [ ] Set up error boundaries for graceful failures
- [ ] Implement retry mechanisms
- [ ] Test error scenarios

#### 8. Accessibility & SEO
- [ ] Implement semantic HTML structure
- [ ] Add proper ARIA labels and roles
- [ ] Create keyboard navigation support
- [ ] Set up focus management
- [ ] Implement screen reader compatibility
- [ ] Add structured data markup
- [ ] Test accessibility with tools

## Detailed Implementation Steps

### Step 1: Design System & CSS Variables (60 minutes)

**Design Tokens** (src/styles/variables.css):
```css
:root {
  /* Font Families */
  --font-primary: 'Inter Variable', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'JetBrains Mono Variable', 'Fira Code', Consolas, monospace;
  
  /* Color Palette - Light Mode */
  --color-white: #ffffff;
  --color-black: #000000;
  --color-gray-50: #fafafa;
  --color-gray-100: #f5f5f5;
  --color-gray-200: #e5e5e5;
  --color-gray-300: #d4d4d4;
  --color-gray-400: #a3a3a3;
  --color-gray-500: #737373;
  --color-gray-600: #525252;
  --color-gray-700: #404040;
  --color-gray-800: #262626;
  --color-gray-900: #171717;
  
  /* Accent Colors */
  --color-blue-500: #3b82f6;
  --color-blue-600: #2563eb;
  --color-blue-700: #1d4ed8;
  --color-orange-500: #f97316;
  --color-green-500: #22c55e;
  --color-red-500: #ef4444;
  
  /* Semantic Colors - Light Mode */
  --bg-primary: var(--color-white);
  --bg-secondary: var(--color-gray-50);
  --bg-tertiary: var(--color-gray-100);
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-600);
  --text-tertiary: var(--color-gray-500);
  --border-primary: var(--color-gray-200);
  --border-secondary: var(--color-gray-300);
  --accent-primary: var(--color-blue-600);
  --accent-hover: var(--color-blue-700);
  --accent-light: var(--color-blue-500);
  
  /* Spacing Scale */
  --space-0: 0;
  --space-1: 0.25rem;    /* 4px */
  --space-2: 0.5rem;     /* 8px */
  --space-3: 0.75rem;    /* 12px */
  --space-4: 1rem;       /* 16px */
  --space-5: 1.25rem;    /* 20px */
  --space-6: 1.5rem;     /* 24px */
  --space-8: 2rem;       /* 32px */
  --space-10: 2.5rem;    /* 40px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */
  --space-20: 5rem;      /* 80px */
  --space-24: 6rem;      /* 96px */
  
  /* Typography Scale */
  --text-xs: 0.75rem;     /* 12px */
  --text-sm: 0.875rem;    /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */
  --text-3xl: 1.875rem;   /* 30px */
  --text-4xl: 2.25rem;    /* 36px */
  --text-5xl: 3rem;       /* 48px */
  --text-6xl: 3.75rem;    /* 60px */
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2;
  
  /* Border Radius */
  --radius-sm: 0.125rem;   /* 2px */
  --radius-md: 0.375rem;   /* 6px */
  --radius-lg: 0.5rem;     /* 8px */
  --radius-xl: 0.75rem;    /* 12px */
  --radius-2xl: 1rem;      /* 16px */
  --radius-full: 9999px;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
  
  /* Transitions */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 500ms;
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  
  /* Layout */
  --container-max-width: 1200px;
  --header-height: 4rem;
  --sidebar-width: 16rem;
  
  /* Z-Index Scale */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
  --z-toast: 1080;
}

/* Dark Mode Variables */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: var(--color-gray-900);
    --bg-secondary: var(--color-gray-800);
    --bg-tertiary: var(--color-gray-700);
    --text-primary: var(--color-gray-50);
    --text-secondary: var(--color-gray-300);
    --text-tertiary: var(--color-gray-400);
    --border-primary: var(--color-gray-700);
    --border-secondary: var(--color-gray-600);
    --accent-primary: var(--color-blue-500);
    --accent-hover: var(--color-blue-400);
    --accent-light: var(--color-blue-600);
  }
}

/* Manual Dark Mode Toggle */
[data-theme="dark"] {
  --bg-primary: var(--color-gray-900);
  --bg-secondary: var(--color-gray-800);
  --bg-tertiary: var(--color-gray-700);
  --text-primary: var(--color-gray-50);
  --text-secondary: var(--color-gray-300);
  --text-tertiary: var(--color-gray-400);
  --border-primary: var(--color-gray-700);
  --border-secondary: var(--color-gray-600);
  --accent-primary: var(--color-blue-500);
  --accent-hover: var(--color-blue-400);
  --accent-light: var(--color-blue-600);
}

[data-theme="light"] {
  --bg-primary: var(--color-white);
  --bg-secondary: var(--color-gray-50);
  --bg-tertiary: var(--color-gray-100);
  --text-primary: var(--color-gray-900);
  --text-secondary: var(--color-gray-600);
  --text-tertiary: var(--color-gray-500);
  --border-primary: var(--color-gray-200);
  --border-secondary: var(--color-gray-300);
  --accent-primary: var(--color-blue-600);
  --accent-hover: var(--color-blue-700);
  --accent-light: var(--color-blue-500);
}
```

**Global Styles** (src/styles/global.css):
```css
@import './variables.css';

/* Font Loading */
@font-face {
  font-family: 'Inter Variable';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url('/fonts/Inter-Variable.woff2') format('woff2');
}

@font-face {
  font-family: 'JetBrains Mono Variable';
  font-style: normal;
  font-weight: 100 800;
  font-display: swap;
  src: url('/fonts/JetBrains-Mono-Variable.woff2') format('woff2');
}

/* Reset & Base Styles */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-family: var(--font-primary);
  line-height: var(--leading-normal);
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  scroll-behavior: smooth;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  transition: background-color var(--duration-normal) var(--ease-out),
              color var(--duration-normal) var(--ease-out);
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: var(--leading-tight);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

h1 { font-size: var(--text-4xl); }
h2 { font-size: var(--text-3xl); }
h3 { font-size: var(--text-2xl); }
h4 { font-size: var(--text-xl); }
h5 { font-size: var(--text-lg); }
h6 { font-size: var(--text-base); }

p {
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  margin-bottom: var(--space-4);
}

a {
  color: var(--accent-primary);
  text-decoration: none;
  transition: color var(--duration-fast) var(--ease-out);
}

a:hover {
  color: var(--accent-hover);
}

a:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Lists */
ul, ol {
  padding-left: var(--space-6);
  margin-bottom: var(--space-4);
}

li {
  line-height: var(--leading-relaxed);
  margin-bottom: var(--space-2);
}

/* Code */
code {
  font-family: var(--font-mono);
  font-size: 0.875em;
  background-color: var(--bg-tertiary);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-primary);
}

pre {
  font-family: var(--font-mono);
  background-color: var(--bg-tertiary);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-primary);
  overflow-x: auto;
  margin-bottom: var(--space-4);
}

pre code {
  background: none;
  padding: 0;
  border: none;
  border-radius: 0;
}

/* Images */
img, video {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
}

/* Form Elements */
input, textarea, select {
  font-family: inherit;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-primary);
  background-color: var(--bg-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  transition: border-color var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
}

/* Buttons */
button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-out);
}

button:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Utility Classes */
.container {
  max-width: var(--container-max-width);
  margin: 0 auto;
  padding: 0 var(--space-4);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: var(--space-2) var(--space-4);
  margin: 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-md);
}

/* Loading States */
.loading {
  opacity: 0.7;
  pointer-events: none;
}

.loading-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Animations */
.fade-in {
  animation: fadeIn var(--duration-normal) var(--ease-out);
}

@keyframes fadeIn {
  from { 
    opacity: 0; 
    transform: translateY(var(--space-4)); 
  }
  to { 
    opacity: 1; 
    transform: translateY(0); 
  }
}

.slide-in-left {
  animation: slideInLeft var(--duration-normal) var(--ease-out);
}

@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Responsive Design */
@media (max-width: 640px) {
  .container {
    padding: 0 var(--space-4);
  }
  
  h1 { font-size: var(--text-3xl); }
  h2 { font-size: var(--text-2xl); }
  h3 { font-size: var(--text-xl); }
}

@media (max-width: 480px) {
  .container {
    padding: 0 var(--space-3);
  }
  
  h1 { font-size: var(--text-2xl); }
  h2 { font-size: var(--text-xl); }
  h3 { font-size: var(--text-lg); }
}

/* Print Styles */
@media print {
  *, *:before, *:after {
    background: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
  
  a, a:visited {
    text-decoration: underline;
  }
  
  a[href]:after {
    content: " (" attr(href) ")";
  }
  
  img {
    page-break-inside: avoid;
  }
  
  p, h2, h3 {
    orphans: 3;
    widows: 3;
  }
  
  h2, h3 {
    page-break-after: avoid;
  }
}

/* Motion Preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Step 2: BaseLayout Implementation (75 minutes)

**Complete Base Layout** (src/layouts/BaseLayout.astro):
```astro
---
export interface Props {
  title: string;
  description?: string;
  keywords?: string;
  image?: string;
  type?: 'website' | 'article';
  canonicalUrl?: string;
  noindex?: boolean;
  structuredData?: Record<string, any>;
}

const {
  title,
  description = 'Personal website showcasing blog, portfolio, credentials, and travel experiences.',
  keywords = 'blog, portfolio, travel, software development, credentials',
  image = '/images/og-default.jpg',
  type = 'website',
  canonicalUrl,
  noindex = false,
  structuredData
} = Astro.props;

const siteUrl = Astro.site?.toString() || 'https://yoursite.com';
const fullTitle = title === 'Home' ? 'Your Name' : `${title} | Your Name`;
const canonical = canonicalUrl || new URL(Astro.url.pathname, siteUrl).toString();
const imageUrl = new URL(image, siteUrl).toString();

// Default structured data
const defaultStructuredData = {
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Your Name",
  "url": siteUrl,
  "sameAs": [
    "https://github.com/yourusername",
    "https://linkedin.com/in/yourusername",
    "https://twitter.com/yourusername"
  ],
  "jobTitle": "Software Developer",
  "worksFor": {
    "@type": "Organization",
    "name": "Your Company"
  }
};

const finalStructuredData = structuredData || defaultStructuredData;
---

<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{fullTitle}</title>
  
  <!-- Preload critical resources -->
  <link rel="preload" href="/fonts/Inter-Variable.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/JetBrains-Mono-Variable.woff2" as="font" type="font/woff2" crossorigin>
  
  <!-- Critical CSS -->
  <link rel="stylesheet" href="/styles/variables.css">
  <link rel="stylesheet" href="/styles/global.css">
  
  <!-- Meta tags -->
  <meta name="description" content={description}>
  <meta name="keywords" content={keywords}>
  <link rel="canonical" href={canonical}>
  {noindex && <meta name="robots" content="noindex, nofollow">}
  
  <!-- Open Graph -->
  <meta property="og:title" content={fullTitle}>
  <meta property="og:description" content={description}>
  <meta property="og:image" content={imageUrl}>
  <meta property="og:url" content={canonical}>
  <meta property="og:type" content={type}>
  <meta property="og:site_name" content="Your Name">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content={fullTitle}>
  <meta name="twitter:description" content={description}>
  <meta name="twitter:image" content={imageUrl}>
  
  <!-- Favicons -->
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.json">
  
  <!-- Theme colors -->
  <meta name="theme-color" content="#2563eb" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#3b82f6" media="(prefers-color-scheme: dark)">
  
  <!-- DNS prefetch -->
  <link rel="dns-prefetch" href="//api.mapbox.com">
  <link rel="dns-prefetch" href="//tiles.mapbox.com">
  
  <!-- Structured data -->
  <script type="application/ld+json" set:html={JSON.stringify(finalStructuredData)} />
  
  <!-- Performance monitoring -->
  <script>
    // Initialize performance monitoring
    if ('performance' in window && 'PerformanceObserver' in window) {
      // Mark page start
      performance.mark('page-start');
      
      // Measure Core Web Vitals
      const vitalsScript = document.createElement('script');
      vitalsScript.src = '/scripts/core-web-vitals.js';
      vitalsScript.async = true;
      document.head.appendChild(vitalsScript);
    }
  </script>
</head>

<body class="min-h-screen bg-primary text-primary font-primary antialiased">
  <!-- Skip to main content -->
  <a 
    href="#main-content" 
    class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-accent-primary text-white px-4 py-2 rounded-md transition-all duration-fast"
  >
    Skip to main content
  </a>
  
  <!-- Header -->
  <header class="sticky top-0 z-40 bg-primary/95 backdrop-blur-sm border-b border-primary shadow-sm">
    <nav class="container mx-auto" aria-label="Main navigation">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <div class="flex-shrink-0">
          <a href="/" class="flex items-center space-x-3 group">
            <div class="w-10 h-10 bg-accent-primary rounded-full flex items-center justify-center transition-transform duration-fast group-hover:scale-105">
              <span class="text-white font-bold text-lg">YN</span>
            </div>
            <span class="hidden sm:block font-semibold text-xl text-primary">Your Name</span>
          </a>
        </div>
        
        <!-- Desktop Navigation -->
        <div class="hidden md:block">
          <div class="ml-10 flex items-baseline space-x-8">
            <a href="/" class="nav-link" data-page="home">Home</a>
            <a href="/blog" class="nav-link" data-page="blog">Blog</a>
            <a href="/portfolio" class="nav-link" data-page="portfolio">Portfolio</a>
            <a href="/flights" class="nav-link" data-page="flights">Flights</a>
            <a href="/credentials" class="nav-link" data-page="credentials">Credentials</a>
            <a href="/resume/download" class="nav-link" data-page="resume">Resume</a>
          </div>
        </div>
        
        <!-- Theme toggle and mobile menu -->
        <div class="flex items-center space-x-2">
          <!-- Theme Toggle -->
          <button
            id="theme-toggle"
            type="button"
            class="p-2 rounded-lg hover:bg-tertiary transition-colors duration-fast"
            aria-label="Toggle dark mode"
            title="Toggle theme"
          >
            <svg id="theme-toggle-dark-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>
            </svg>
            <svg id="theme-toggle-light-icon" class="hidden w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clip-rule="evenodd"></path>
            </svg>
          </button>
          
          <!-- Mobile menu button -->
          <button
            id="mobile-menu-button"
            type="button"
            class="md:hidden p-2 rounded-lg hover:bg-tertiary transition-colors duration-fast"
            aria-label="Toggle mobile menu"
            aria-expanded="false"
            aria-controls="mobile-menu"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <!-- Mobile Navigation -->
      <div id="mobile-menu" class="md:hidden hidden border-t border-primary">
        <div class="px-2 pt-2 pb-3 space-y-1">
          <a href="/" class="mobile-nav-link" data-page="home">Home</a>
          <a href="/blog" class="mobile-nav-link" data-page="blog">Blog</a>
          <a href="/portfolio" class="mobile-nav-link" data-page="portfolio">Portfolio</a>
          <a href="/flights" class="mobile-nav-link" data-page="flights">Flights</a>
          <a href="/credentials" class="mobile-nav-link" data-page="credentials">Credentials</a>
          <a href="/resume/download" class="mobile-nav-link" data-page="resume">Resume</a>
        </div>
      </div>
    </nav>
  </header>
  
  <!-- Main content -->
  <main id="main-content" class="flex-1">
    <slot />
  </main>
  
  <!-- Footer -->
  <footer class="bg-secondary border-t border-primary mt-20">
    <div class="container mx-auto py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <!-- About -->
        <div class="col-span-1 md:col-span-2">
          <h3 class="text-lg font-semibold mb-4 text-primary">About</h3>
          <p class="text-secondary mb-6 leading-relaxed">
            Software developer passionate about creating efficient, user-friendly applications and sharing knowledge through writing and travel.
          </p>
          <div class="flex space-x-4">
            <a 
              href="https://github.com/yourusername" 
              class="text-secondary hover:text-accent-primary transition-colors duration-fast" 
              aria-label="GitHub Profile"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            <a 
              href="https://linkedin.com/in/yourusername" 
              class="text-secondary hover:text-accent-primary transition-colors duration-fast" 
              aria-label="LinkedIn Profile"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
            </a>
            <a 
              href="https://twitter.com/yourusername" 
              class="text-secondary hover:text-accent-primary transition-colors duration-fast" 
              aria-label="Twitter Profile"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
              </svg>
            </a>
          </div>
        </div>
        
        <!-- Quick Links -->
        <div>
          <h3 class="text-lg font-semibold mb-4 text-primary">Quick Links</h3>
          <ul class="space-y-3">
            <li><a href="/blog" class="text-secondary hover:text-accent-primary transition-colors duration-fast">Recent Posts</a></li>
            <li><a href="/portfolio" class="text-secondary hover:text-accent-primary transition-colors duration-fast">Featured Projects</a></li>
            <li><a href="/flights" class="text-secondary hover:text-accent-primary transition-colors duration-fast">Travel Map</a></li>
            <li><a href="/credentials" class="text-secondary hover:text-accent-primary transition-colors duration-fast">Credentials</a></li>
          </ul>
        </div>
        
        <!-- Contact -->
        <div>
          <h3 class="text-lg font-semibold mb-4 text-primary">Contact</h3>
          <ul class="space-y-3">
            <li>
              <a 
                href="mailto:hello@yoursite.com" 
                class="text-secondary hover:text-accent-primary transition-colors duration-fast"
              >
                hello@yoursite.com
              </a>
            </li>
            <li>
              <a 
                href="/resume/download" 
                class="text-secondary hover:text-accent-primary transition-colors duration-fast"
              >
                Download Resume
              </a>
            </li>
          </ul>
        </div>
      </div>
      
      <div class="border-t border-primary mt-8 pt-8 text-center">
        <p class="text-secondary">
          &copy; {new Date().getFullYear()} Your Name. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
  
  <!-- Analytics & Scripts -->
  <script src="/scripts/analytics.js"></script>
  <script src="/scripts/theme-toggle.js"></script>
  <script src="/scripts/mobile-menu.js"></script>
</body>
</html>

<style>
  /* Navigation styles */
  .nav-link {
    @apply relative text-secondary hover:text-primary transition-colors duration-200 font-medium py-2;
  }
  
  .nav-link::after {
    @apply absolute -bottom-1 left-0 w-0 h-0.5 bg-accent-primary transition-all duration-200;
    content: '';
  }
  
  .nav-link:hover::after,
  .nav-link.active::after {
    @apply w-full;
  }
  
  .mobile-nav-link {
    @apply block px-3 py-3 text-base font-medium text-secondary hover:text-primary hover:bg-tertiary rounded-lg transition-all duration-200;
  }
  
  .mobile-nav-link.active {
    @apply text-accent-primary bg-tertiary;
  }
  
  /* Page-specific active states will be handled by JavaScript */
</style>
```

### Step 3: Essential UI Components (90 minutes)

**Button Component** (src/components/ui/Button.astro):
```astro
---
export interface Props {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  loading?: boolean;
  href?: string;
  target?: string;
  class?: string;
}

const {
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  loading = false,
  href,
  target,
  class: className = '',
  ...props
} = Astro.props;

const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const variantClasses = {
  primary: 'bg-accent-primary text-white hover:bg-accent-hover focus:ring-accent-primary',
  secondary: 'bg-secondary text-primary hover:bg-tertiary focus:ring-accent-primary',
  outline: 'border border-primary text-primary hover:bg-secondary focus:ring-accent-primary',
  ghost: 'text-primary hover:bg-secondary focus:ring-accent-primary',
  danger: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500'
};

const sizeClasses = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg'
};

const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

const Element = href ? 'a' : 'button';
const elementProps = href 
  ? { href, target, ...props }
  : { type, disabled: disabled || loading, ...props };
---

<Element class={classes} {...elementProps}>
  {loading && (
    <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  )}
  <slot />
</Element>
```

**Card Component** (src/components/ui/Card.astro):
```astro
---
export interface Props {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  class?: string;
}

const {
  variant = 'default',
  padding = 'md',
  class: className = '',
  ...props
} = Astro.props;

const baseClasses = 'bg-primary rounded-lg transition-all duration-fast';

const variantClasses = {
  default: 'border border-primary',
  elevated: 'shadow-lg hover:shadow-xl',
  outlined: 'border-2 border-primary'
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8'
};

const classes = `${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`;
---

<div class={classes} {...props}>
  <slot />
</div>
```

**Input Component** (src/components/ui/Input.astro):
```astro
---
export interface Props {
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  name?: string;
  id?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  readonly?: boolean;
  error?: string;
  label?: string;
  hint?: string;
  class?: string;
}

const {
  type = 'text',
  name,
  id,
  placeholder,
  value,
  required = false,
  disabled = false,
  readonly = false,
  error,
  label,
  hint,
  class: className = '',
  ...props
} = Astro.props;

const inputId = id || name || `input-${Math.random().toString(36).substr(2, 9)}`;

const baseClasses = 'w-full px-4 py-3 text-base rounded-lg border transition-all duration-fast focus:outline-none focus:ring-2 focus:ring-offset-1';
const stateClasses = error 
  ? 'border-red-500 focus:border-red-500 focus:ring-red-500' 
  : 'border-primary focus:border-accent-primary focus:ring-accent-primary';
const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';

const classes = `${baseClasses} ${stateClasses} ${disabledClasses} ${className}`;
---

<div class="space-y-2">
  {label && (
    <label 
      for={inputId} 
      class="block text-sm font-medium text-primary"
    >
      {label}
      {required && <span class="text-red-500 ml-1">*</span>}
    </label>
  )}
  
  <input
    type={type}
    id={inputId}
    name={name}
    placeholder={placeholder}
    value={value}
    required={required}
    disabled={disabled}
    readonly={readonly}
    class={classes}
    {...props}
  />
  
  {hint && !error && (
    <p class="text-sm text-secondary">{hint}</p>
  )}
  
  {error && (
    <p class="text-sm text-red-500" role="alert">{error}</p>
  )}
</div>
```

**Modal Component** (src/components/ui/Modal.svelte):
```svelte
<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let open = false;
  export let title = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  export let closeOnOverlay = true;
  export let closeOnEscape = true;
  
  const dispatch = createEventDispatcher<{
    close: void;
    open: void;
  }>();
  
  let dialog: HTMLDialogElement;
  let previousActiveElement: HTMLElement | null = null;
  
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  $: if (dialog) {
    if (open) {
      previousActiveElement = document.activeElement as HTMLElement;
      dialog.showModal();
      dispatch('open');
    } else {
      dialog.close();
      previousActiveElement?.focus();
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape) {
      close();
    }
  }
  
  function handleOverlayClick(event: MouseEvent) {
    if (event.target === dialog && closeOnOverlay) {
      close();
    }
  }
  
  function close() {
    open = false;
    dispatch('close');
  }
  
  onMount(() => {
    // Trap focus within modal
    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstFocusable = focusableElements[0] as HTMLElement;
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    });
  });
</script>

<dialog
  bind:this={dialog}
  on:keydown={handleKeydown}
  on:click={handleOverlayClick}
  class="backdrop:bg-black backdrop:bg-opacity-50 backdrop:backdrop-blur-sm bg-transparent border-none outline-none p-0 max-h-screen overflow-y-auto"
>
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="bg-primary rounded-lg shadow-xl border border-primary w-full {sizeClasses[size]} max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      {#if title || $$slots.header}
        <div class="flex items-center justify-between p-6 border-b border-primary">
          <div class="flex-1">
            {#if title}
              <h2 class="text-xl font-semibold text-primary">{title}</h2>
            {:else}
              <slot name="header" />
            {/if}
          </div>
          <button
            on:click={close}
            class="p-2 hover:bg-secondary rounded-lg transition-colors duration-fast"
            aria-label="Close modal"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
      {/if}
      
      <!-- Content -->
      <div class="p-6">
        <slot />
      </div>
      
      <!-- Footer -->
      {#if $$slots.footer}
        <div class="flex items-center justify-end space-x-3 p-6 border-t border-primary">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
</dialog>

<style>
  dialog[open] {
    animation: fade-in 0.2s ease-out;
  }
  
  dialog[open] > div > div {
    animation: slide-in 0.2s ease-out;
  }
  
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slide-in {
    from { 
      opacity: 0;
      transform: translateY(-1rem) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
```

### Step 4: Analytics Implementation (45 minutes)

**Analytics Script** (public/scripts/analytics.js):
```javascript
// Analytics tracking system
(function() {
  'use strict';
  
  if (typeof window === 'undefined') return;
  
  // Configuration
  const ANALYTICS_CONFIG = {
    endpoint: '/api/analytics/track',
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    maxRetries: 3,
    retryDelay: 1000,
  };
  
  // Event queue for batching
  let eventQueue = [];
  let flushTimeout;
  
  // User identification
  let userId = localStorage.getItem('analytics_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('analytics_user_id', userId);
  }
  
  // Session identification
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = 'session_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  
  // Device information
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let deviceType = 'desktop';
    
    if (/Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
      deviceType = /iPad/.test(ua) ? 'tablet' : 'mobile';
    }
    
    return {
      deviceType,
      userAgent: ua,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1
    };
  }
  
  // Connection information
  function getConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    return {
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || null,
      rtt: connection?.rtt || null,
      saveData: connection?.saveData || false
    };
  }
  
  // UTM parameter extraction
  function getUTMParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const utmParams = {};
    
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(param => {
      const value = urlParams.get(param);
      if (value) utmParams[param] = value;
    });
    
    return utmParams;
  }
  
  // Event tracking function
  function trackEvent(eventType, properties = {}) {
    const event = {
      event_type: eventType,
      page_path: window.location.pathname,
      page_url: window.location.href,
      referrer: document.referrer,
      user_id: userId,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      properties: {
        ...getDeviceInfo(),
        ...getConnectionInfo(),
        ...getUTMParameters(),
        ...properties
      }
    };
    
    // Add to queue
    eventQueue.push(event);
    
    // Flush if batch size reached
    if (eventQueue.length >= ANALYTICS_CONFIG.batchSize) {
      flushEvents();
    } else {
      // Schedule flush
      scheduleFlush();
    }
  }
  
  // Schedule event flushing
  function scheduleFlush() {
    if (flushTimeout) return;
    
    flushTimeout = setTimeout(() => {
      flushEvents();
    }, ANALYTICS_CONFIG.flushInterval);
  }
  
  // Flush events to server
  async function flushEvents(retryCount = 0) {
    if (eventQueue.length === 0) return;
    
    const events = [...eventQueue];
    eventQueue = [];
    
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    
    try {
      const response = await fetch(ANALYTICS_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
        keepalive: true
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      console.warn('Analytics flush failed:', error);
      
      // Retry logic
      if (retryCount < ANALYTICS_CONFIG.maxRetries) {
        setTimeout(() => {
          eventQueue.unshift(...events);
          flushEvents(retryCount + 1);
        }, ANALYTICS_CONFIG.retryDelay * Math.pow(2, retryCount));
      }
    }
  }
  
  // Page view tracking
  function trackPageView() {
    trackEvent('page_view', {
      title: document.title,
      path: window.location.pathname,
      search: window.location.search,
      hash: window.location.hash
    });
  }
  
  // Scroll tracking
  let maxScrollDepth = 0;
  let scrollTimeouts = {};
  
  function trackScroll() {
    const scrollPercent = Math.round(
      (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
    );
    
    if (scrollPercent > maxScrollDepth) {
      maxScrollDepth = scrollPercent;
      
      // Track scroll depth milestones
      const milestones = [25, 50, 75, 90, 100];
      const milestone = milestones.find(m => scrollPercent >= m && maxScrollDepth < m);
      
      if (milestone && !scrollTimeouts[milestone]) {
        scrollTimeouts[milestone] = setTimeout(() => {
          trackEvent('scroll_depth', {
            depth_percent: milestone,
            max_depth: maxScrollDepth
          });
        }, 1000);
      }
    }
  }
  
  // Click tracking
  function trackClick(event) {
    const element = event.target.closest('a, button, [data-track]');
    if (!element) return;
    
    const properties = {
      element_type: element.tagName.toLowerCase(),
      element_text: element.textContent?.trim().substring(0, 100) || '',
      element_id: element.id || null,
      element_class: element.className || null
    };
    
    // Track external links
    if (element.tagName === 'A' && element.hostname !== window.location.hostname) {
      properties.external_url = element.href;
      trackEvent('external_link_click', properties);
    }
    // Track internal navigation
    else if (element.tagName === 'A' && element.hostname === window.location.hostname) {
      properties.internal_url = element.href;
      trackEvent('internal_link_click', properties);
    }
    // Track button clicks
    else if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      trackEvent('button_click', properties);
    }
    // Track custom tracked elements
    else if (element.hasAttribute('data-track')) {
      properties.track_id = element.getAttribute('data-track');
      trackEvent('custom_click', properties);
    }
  }
  
  // Form tracking
  function trackFormSubmit(event) {
    const form = event.target;
    if (!form || form.tagName !== 'FORM') return;
    
    trackEvent('form_submit', {
      form_id: form.id || null,
      form_name: form.name || null,
      form_action: form.action || null,
      form_method: form.method || 'get'
    });
  }
  
  // Search tracking
  function trackSearch(query, results = null) {
    trackEvent('search', {
      query: query.trim().substring(0, 100),
      results_count: results,
      search_location: window.location.pathname
    });
  }
  
  // Time on page tracking
  let timeOnPageStart = Date.now();
  let isPageVisible = !document.hidden;
  
  function trackTimeOnPage() {
    if (!isPageVisible) return;
    
    const timeSpent = Math.round((Date.now() - timeOnPageStart) / 1000);
    
    if (timeSpent >= 10) { // Only track if at least 10 seconds
      trackEvent('time_on_page', {
        seconds: timeSpent,
        minutes: Math.round(timeSpent / 60)
      });
    }
  }
  
  // Visibility change tracking
  function handleVisibilityChange() {
    if (document.hidden) {
      isPageVisible = false;
      trackTimeOnPage();
    } else {
      isPageVisible = true;
      timeOnPageStart = Date.now();
    }
  }
  
  // Performance tracking
  function trackPerformance() {
    if (!('performance' in window)) return;
    
    // Wait for page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        
        if (navigation) {
          trackEvent('page_performance', {
            dns_time: Math.round(navigation.domainLookupEnd - navigation.domainLookupStart),
            connect_time: Math.round(navigation.connectEnd - navigation.connectStart),
            response_time: Math.round(navigation.responseEnd - navigation.responseStart),
            dom_load_time: Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart),
            load_time: Math.round(navigation.loadEventEnd - navigation.navigationStart),
            first_paint: paint.find(p => p.name === 'first-paint')?.startTime || null,
            first_contentful_paint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || null
          });
        }
      }, 1000);
    });
  }
  
  // Error tracking
  function trackError(error, source = 'javascript') {
    trackEvent('error', {
      message: error.message || 'Unknown error',
      source: source,
      filename: error.filename || null,
      line_number: error.lineno || null,
      column_number: error.colno || null,
      stack: error.error?.stack?.substring(0, 1000) || null
    });
  }
  
  // Initialize analytics
  function init() {
    // Track initial page view
    trackPageView();
    
    // Set up event listeners
    document.addEventListener('click', trackClick);
    document.addEventListener('submit', trackFormSubmit);
    window.addEventListener('scroll', debounce(trackScroll, 250));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', () => {
      trackTimeOnPage();
      flushEvents();
    });
    
    // Error tracking
    window.addEventListener('error', trackError);
    window.addEventListener('unhandledrejection', (event) => {
      trackError({ message: event.reason }, 'promise');
    });
    
    // Performance tracking
    trackPerformance();
    
    // SPA navigation tracking
    let currentPath = window.location.pathname;
    const observer = new MutationObserver(() => {
      if (window.location.pathname !== currentPath) {
        currentPath = window.location.pathname;
        trackPageView();
        timeOnPageStart = Date.now();
        maxScrollDepth = 0;
        scrollTimeouts = {};
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Utility function for debouncing
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  
  // Expose public API
  window.analytics = {
    track: trackEvent,
    trackPageView,
    trackSearch,
    flush: flushEvents
  };
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

## Testing & Validation

### Final Checklist
- [ ] All CSS variables are properly defined and scoped
- [ ] Light/dark theme toggle works correctly
- [ ] BaseLayout renders with proper SEO tags
- [ ] Navigation works on desktop and mobile
- [ ] All UI components render without errors
- [ ] Modal component traps focus correctly
- [ ] Analytics tracking fires for page views
- [ ] Performance metrics are collected
- [ ] All animations respect reduced motion preferences
- [ ] Components are accessible with keyboard navigation
- [ ] Responsive design works across all breakpoints

## Success Criteria
✅ Complete design system is implemented  
✅ All core UI components are functional  
✅ Layout system works across all devices  
✅ Analytics tracking is operational  
✅ Performance optimizations are in place  
✅ Accessibility standards are met  
✅ Theme system works correctly  

## Next Session
Plan 3 will focus on implementing the blog system with full content management capabilities.