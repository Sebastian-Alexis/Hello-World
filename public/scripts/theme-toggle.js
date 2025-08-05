//theme toggle functionality with smooth transitions and system preference detection
(function() {
  'use strict';
  
  const THEME_KEY = 'preferred-theme';
  const THEME_DARK = 'dark';
  const THEME_LIGHT = 'light';
  const THEME_ATTR = 'data-theme';
  
  let currentTheme = null;
  let themeToggleButton = null;
  let darkIcon = null;
  let lightIcon = null;
  
  //get theme preference from localStorage or default to light
  function getPreferredTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    // Security: Validate theme value against allowed themes only
    if (stored === THEME_DARK || stored === THEME_LIGHT) {
      return stored;
    }
    
    // Default to light mode instead of system preference
    return THEME_LIGHT;
  }
  
  //apply theme to document
  function applyTheme(theme) {
    document.documentElement.setAttribute(THEME_ATTR, theme);
    currentTheme = theme;
    
    //update icons
    if (darkIcon && lightIcon) {
      if (theme === THEME_DARK) {
        darkIcon.classList.remove('hidden');
        lightIcon.classList.add('hidden');
      } else {
        darkIcon.classList.add('hidden');
        lightIcon.classList.remove('hidden');
      }
    }
    
    //update aria attributes for accessibility
    updateAriaLabel();
    
    //update meta theme-color
    updateThemeColor(theme);
    
    //track theme change in analytics if available
    if (window.analytics) {
      window.analytics.track('theme_change', {
        theme: theme,
        method: 'manual'
      });
    }
  }
  
  //update browser theme color
  function updateThemeColor(theme) {
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const color = theme === THEME_DARK ? '#3b82f6' : '#2563eb';
      metaThemeColor.setAttribute('content', color);
    }
  }
  
  //toggle between themes
  function toggleTheme() {
    const newTheme = currentTheme === THEME_DARK ? THEME_LIGHT : THEME_DARK;
    localStorage.setItem(THEME_KEY, newTheme);
    applyTheme(newTheme);
    
    //add brief animation feedback
    if (themeToggleButton) {
      themeToggleButton.style.transform = 'scale(0.95)';
      setTimeout(() => {
        themeToggleButton.style.transform = '';
      }, 150);
    }
  }
  
  //listen for system theme changes
  function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    mediaQuery.addEventListener('change', (e) => {
      //only auto-switch if user hasn't set a preference
      if (!localStorage.getItem(THEME_KEY)) {
        const systemTheme = e.matches ? THEME_DARK : THEME_LIGHT;
        applyTheme(systemTheme);
        
        //track system theme change
        if (window.analytics) {
          window.analytics.track('theme_change', {
            theme: systemTheme,
            method: 'system'
          });
        }
      }
    });
  }
  
  //initialize theme system
  function init() {
    //get elements
    themeToggleButton = document.getElementById('theme-toggle');
    darkIcon = document.getElementById('theme-toggle-dark-icon');
    lightIcon = document.getElementById('theme-toggle-light-icon');
    
    if (!themeToggleButton) {
      console.warn('Theme toggle button not found');
      return;
    }
    
    //apply initial theme immediately to prevent flash
    const preferredTheme = getPreferredTheme();
    applyTheme(preferredTheme);
    
    //add click listener
    themeToggleButton.addEventListener('click', toggleTheme);
    
    //add keyboard support
    themeToggleButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleTheme();
      }
    });
    
    //watch for system theme changes
    watchSystemTheme();
    
    //update aria-label based on current theme
    updateAriaLabel();
  }
  
  //update button aria-label and aria-pressed for accessibility
  function updateAriaLabel() {
    if (themeToggleButton) {
      const isDark = currentTheme === THEME_DARK;
      const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
      themeToggleButton.setAttribute('aria-label', label);
      themeToggleButton.setAttribute('title', label);
      themeToggleButton.setAttribute('aria-pressed', String(isDark));
    }
  }
  
  //security: remove global exposure - use custom events if inter-script communication needed
  
  //initialize immediately to prevent flash of wrong theme
  if (document.readyState === 'loading') {
    //apply theme immediately even before DOM is ready
    const preferredTheme = getPreferredTheme();
    document.documentElement.setAttribute(THEME_ATTR, preferredTheme);
    
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  //re-initialize if DOM changes (for SPA navigation)
  const observer = new MutationObserver((mutations) => {
    let shouldReinit = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && node.id === 'theme-toggle') {
          shouldReinit = true;
        }
      });
    });
    
    if (shouldReinit) {
      setTimeout(init, 100);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();