//mobile responsiveness testing utilities for admin interface
export interface BreakpointConfig {
  mobile: number;
  tablet: number;
  desktop: number;
  large: number;
}

export const BREAKPOINTS: BreakpointConfig = {
  mobile: 640,   // sm
  tablet: 768,   // md  
  desktop: 1024, // lg
  large: 1280    // xl
};

export class ResponsiveChecker {
  private breakpoints: BreakpointConfig;
  
  constructor(breakpoints: BreakpointConfig = BREAKPOINTS) {
    this.breakpoints = breakpoints;
  }
  
  getCurrentBreakpoint(): keyof BreakpointConfig {
    const width = window.innerWidth;
    
    if (width < this.breakpoints.mobile) return 'mobile';
    if (width < this.breakpoints.tablet) return 'tablet';
    if (width < this.breakpoints.desktop) return 'desktop';
    return 'large';
  }
  
  isMobile(): boolean {
    return window.innerWidth < this.breakpoints.mobile;
  }
  
  isTablet(): boolean {
    const width = window.innerWidth;
    return width >= this.breakpoints.mobile && width < this.breakpoints.desktop;
  }
  
  isDesktop(): boolean {
    return window.innerWidth >= this.breakpoints.desktop;
  }
  
  //test admin interface responsiveness
  testAdminResponsiveness(): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    
    //check if admin sidebar is collapsible on mobile
    const sidebar = document.getElementById('admin-sidebar');
    if (sidebar && this.isMobile()) {
      const isHidden = sidebar.classList.contains('-translate-x-full') || 
                     sidebar.classList.contains('hidden');
      if (!isHidden) {
        issues.push('Admin sidebar should be hidden on mobile by default');
      }
    }
    
    //check if tables are horizontally scrollable
    const tables = document.querySelectorAll('.overflow-x-auto table');
    tables.forEach((table, index) => {
      const container = table.parentElement;
      if (container && table.scrollWidth > container.clientWidth) {
        if (!container.classList.contains('overflow-x-auto')) {
          issues.push(`Table ${index + 1} needs horizontal scroll on mobile`);
        }
      }
    });
    
    //check if forms stack properly on mobile
    const formGrids = document.querySelectorAll('.grid.grid-cols-2, .grid.grid-cols-3, .grid.grid-cols-4');
    formGrids.forEach((grid, index) => {
      if (this.isMobile()) {
        if (!grid.classList.contains('md:grid-cols-2') && 
            !grid.classList.contains('sm:grid-cols-1')) {
          issues.push(`Form grid ${index + 1} should stack on mobile`);
        }
      }
    });
    
    //check if buttons wrap properly
    const buttonGroups = document.querySelectorAll('.flex.space-x-3, .flex.space-x-2');
    buttonGroups.forEach((group, index) => {
      if (this.isMobile()) {
        const rect = group.getBoundingClientRect();
        if (rect.width > window.innerWidth - 32) { // accounting for padding
          if (!group.classList.contains('flex-wrap') && 
              !group.classList.contains('flex-col')) {
            issues.push(`Button group ${index + 1} should wrap or stack on mobile`);
          }
        }
      }
    });
    
    //check if modals are properly sized
    const modals = document.querySelectorAll('[class*="fixed"][class*="inset-0"]');
    modals.forEach((modal, index) => {
      const content = modal.querySelector('[class*="mx-auto"]');
      if (content && this.isMobile()) {
        const rect = content.getBoundingClientRect();
        if (rect.width > window.innerWidth - 32) {
          issues.push(`Modal ${index + 1} content too wide for mobile`);
        }
      }
    });
    
    return {
      passed: issues.length === 0,
      issues
    };
  }
  
  //listen for viewport changes
  onBreakpointChange(callback: (breakpoint: keyof BreakpointConfig) => void): () => void {
    let currentBreakpoint = this.getCurrentBreakpoint();
    
    const handler = (): void => {
      const newBreakpoint = this.getCurrentBreakpoint();
      if (newBreakpoint !== currentBreakpoint) {
        currentBreakpoint = newBreakpoint;
        callback(newBreakpoint);
      }
    };
    
    window.addEventListener('resize', handler);
    
    //return cleanup function
    return () => window.removeEventListener('resize', handler);
  }
  
  //test specific component responsiveness
  testComponentResponsiveness(selector: string): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    const elements = document.querySelectorAll(selector);
    
    elements.forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      
      //check if element overflows viewport
      if (rect.width > window.innerWidth) {
        issues.push(`Element ${index + 1} (${selector}) overflows viewport width`);
      }
      
      if (rect.height > window.innerHeight) {
        issues.push(`Element ${index + 1} (${selector}) overflows viewport height`);
      }
      
      //check if text is readable (not too small)
      const computedStyle = window.getComputedStyle(element);
      const fontSize = parseFloat(computedStyle.fontSize);
      if (fontSize < 14 && this.isMobile()) {
        issues.push(`Element ${index + 1} (${selector}) text too small for mobile`);
      }
      
      //check if interactive elements are large enough for touch
      if (element.matches('button, a, input, select, textarea')) {
        const minTouchSize = 44; // iOS/Android recommendation
        if ((rect.width < minTouchSize || rect.height < minTouchSize) && this.isMobile()) {
          issues.push(`Interactive element ${index + 1} (${selector}) too small for touch`);
        }
      }
    });
    
    return {
      passed: issues.length === 0,
      issues
    };
  }
}

//utility functions
export function createResponsiveChecker(): ResponsiveChecker {
  return new ResponsiveChecker();
}

export function isViewportSize(breakpoint: keyof BreakpointConfig): boolean {
  const checker = new ResponsiveChecker();
  return checker.getCurrentBreakpoint() === breakpoint;
}

//run comprehensive responsiveness test
export function runResponsivenessTest(): { 
  overall: { passed: boolean; issues: string[] };
  components: Array<{ selector: string; passed: boolean; issues: string[] }>;
} {
  const checker = new ResponsiveChecker();
  
  const overall = checker.testAdminResponsiveness();
  
  //test key admin components
  const componentSelectors = [
    '.data-table',
    '.form-field',
    '.admin-nav-link',
    '.upload-area',
    '[class*="modal"]',
    '.editor-container'
  ];
  
  const components = componentSelectors.map(selector => ({
    selector,
    ...checker.testComponentResponsiveness(selector)
  }));
  
  return {
    overall,
    components
  };
}

//export for browser usage
if (typeof window !== 'undefined') {
  (window as any).ResponsiveChecker = ResponsiveChecker;
  (window as any).runResponsivenessTest = runResponsivenessTest;
}