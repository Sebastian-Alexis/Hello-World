//mobile menu functionality with accessibility and smooth animations
(function() {
  'use strict';
  
  let menuButton = null;
  let mobileMenu = null;
  let isMenuOpen = false;
  let menuLinks = [];
  
  //toggle mobile menu
  function toggleMenu() {
    isMenuOpen = !isMenuOpen;
    
    if (isMenuOpen) {
      openMenu();
    } else {
      closeMenu();
    }
  }
  
  //open mobile menu
  function openMenu() {
    if (!mobileMenu || !menuButton) return;
    
    isMenuOpen = true;
    mobileMenu.classList.remove('hidden');
    menuButton.setAttribute('aria-expanded', 'true');
    
    //animate menu appearance
    requestAnimationFrame(() => {
      mobileMenu.style.maxHeight = mobileMenu.scrollHeight + 'px';
      mobileMenu.style.opacity = '1';
    });
    
    //focus first menu item
    const firstLink = mobileMenu.querySelector('a');
    if (firstLink) {
      setTimeout(() => firstLink.focus(), 150);
    }
    
    //add escape key listener
    document.addEventListener('keydown', handleEscapeKey);
    
    //add click outside listener
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 100);
    
    //prevent body scroll on mobile
    if (window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    }
    
    //track menu open
    if (window.analytics) {
      window.analytics.track('mobile_menu_open');
    }
  }
  
  //close mobile menu
  function closeMenu() {
    if (!mobileMenu || !menuButton) return;
    
    isMenuOpen = false;
    mobileMenu.style.maxHeight = '0';
    mobileMenu.style.opacity = '0';
    menuButton.setAttribute('aria-expanded', 'false');
    
    //hide menu after animation
    setTimeout(() => {
      mobileMenu.classList.add('hidden');
    }, 200);
    
    //remove event listeners
    document.removeEventListener('keydown', handleEscapeKey);
    document.removeEventListener('click', handleClickOutside);
    
    //restore body scroll
    document.body.style.overflow = '';
    
    //return focus to menu button
    menuButton.focus();
    
    //track menu close
    if (window.analytics) {
      window.analytics.track('mobile_menu_close');
    }
  }
  
  //handle escape key
  function handleEscapeKey(event) {
    if (event.key === 'Escape' && isMenuOpen) {
      closeMenu();
    }
  }
  
  //handle click outside menu
  function handleClickOutside(event) {
    if (isMenuOpen && !mobileMenu.contains(event.target) && !menuButton.contains(event.target)) {
      closeMenu();
    }
  }
  
  //handle keyboard navigation in menu
  function handleMenuKeydown(event) {
    const focusableElements = mobileMenu.querySelectorAll('a, button');
    const focusedIndex = Array.from(focusableElements).indexOf(document.activeElement);
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        const nextIndex = (focusedIndex + 1) % focusableElements.length;
        focusableElements[nextIndex].focus();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        const prevIndex = focusedIndex === 0 ? focusableElements.length - 1 : focusedIndex - 1;
        focusableElements[prevIndex].focus();
        break;
        
      case 'Home':
        event.preventDefault();
        focusableElements[0].focus();
        break;
        
      case 'End':
        event.preventDefault();
        focusableElements[focusableElements.length - 1].focus();
        break;
        
      case 'Tab':
        //allow normal tab behavior but close menu if tabbing out
        setTimeout(() => {
          if (!mobileMenu.contains(document.activeElement) && !menuButton.contains(document.activeElement)) {
            closeMenu();
          }
        }, 0);
        break;
    }
  }
  
  //set active menu item based on current page
  function setActiveMenuItem() {
    const currentPath = window.location.pathname;
    
    menuLinks.forEach(link => {
      link.classList.remove('active');
      const linkPath = new URL(link.href, window.location.origin).pathname;
      
      if (linkPath === currentPath || (currentPath === '/' && linkPath === '/')) {
        link.classList.add('active');
      }
    });
  }
  
  //handle menu item clicks
  function handleMenuItemClick(event) {
    const link = event.target.closest('a');
    if (!link) return;
    
    //track menu item click
    if (window.analytics) {
      window.analytics.track('menu_item_click', {
        item: link.textContent.trim(),
        url: link.href,
        is_mobile: true
      });
    }
    
    //close menu after short delay for internal links
    if (link.hostname === window.location.hostname) {
      setTimeout(() => {
        closeMenu();
      }, 100);
    }
  }
  
  //handle window resize
  function handleResize() {
    //close mobile menu if viewport becomes desktop size
    if (window.innerWidth >= 768 && isMenuOpen) {
      closeMenu();
    }
  }
  
  //initialize mobile menu
  function init() {
    menuButton = document.getElementById('mobile-menu-button');
    mobileMenu = document.getElementById('mobile-menu');
    
    if (!menuButton || !mobileMenu) {
      console.warn('Mobile menu elements not found');
      return;
    }
    
    menuLinks = Array.from(mobileMenu.querySelectorAll('a'));
    
    //set initial styles for animation
    mobileMenu.style.maxHeight = '0';
    mobileMenu.style.opacity = '0';
    mobileMenu.style.transition = 'max-height 0.2s ease-out, opacity 0.2s ease-out';
    mobileMenu.style.overflow = 'hidden';
    
    //add event listeners
    menuButton.addEventListener('click', toggleMenu);
    
    //keyboard support for menu button
    menuButton.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleMenu();
      }
    });
    
    //keyboard navigation in menu
    mobileMenu.addEventListener('keydown', handleMenuKeydown);
    
    //menu item clicks
    mobileMenu.addEventListener('click', handleMenuItemClick);
    
    //window resize handler
    window.addEventListener('resize', handleResize);
    
    //set active menu item
    setActiveMenuItem();
    
    //update active item on navigation (for SPA)
    window.addEventListener('popstate', setActiveMenuItem);
  }
  
  //expose mobile menu functions globally
  window.mobileMenu = {
    toggle: toggleMenu,
    open: openMenu,
    close: closeMenu,
    isOpen: () => isMenuOpen
  };
  
  //initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  //re-initialize if DOM changes (for SPA navigation)
  const observer = new MutationObserver((mutations) => {
    let shouldReinit = false;
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1 && (node.id === 'mobile-menu-button' || node.id === 'mobile-menu')) {
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