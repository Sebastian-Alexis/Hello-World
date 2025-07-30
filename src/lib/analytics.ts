//client-side analytics tracking utility
//lightweight and privacy-focused analytics for portfolio tracking

class AnalyticsClient {
  private sessionId: string;
  private isEnabled: boolean;
  private queue: any[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 2000; // 2 seconds
  private readonly MAX_BATCH_SIZE = 10;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isEnabled = this.checkAnalyticsEnabled();
    
    // Process any queued events on load
    if (typeof window !== 'undefined') {
      this.processQueue();
    }
  }

  private generateSessionId(): string {
    if (typeof window === 'undefined') return '';
    
    // Check if session ID exists in sessionStorage
    let sessionId = sessionStorage.getItem('analytics_session_id');
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    
    return sessionId;
  }

  private checkAnalyticsEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check for Do Not Track
    if (navigator.doNotTrack === '1') return false;
    
    // Check localStorage for user preference
    const userPreference = localStorage.getItem('analytics_enabled');
    if (userPreference === 'false') return false;
    
    return true;
  }

  private async sendEvent(eventData: any): Promise<void> {
    if (!this.isEnabled) return;
    
    try {
      const response = await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData)
      });
      
      if (!response.ok) {
        console.warn('Analytics tracking failed:', response.statusText);
      }
    } catch (error) {
      console.warn('Analytics tracking error:', error);
    }
  }

  private processQueue(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }

    this.batchTimer = setTimeout(() => {
      if (this.queue.length > 0) {
        this.flushQueue();
      }
    }, this.BATCH_DELAY);
  }

  private async flushQueue(): Promise<void> {
    if (this.queue.length === 0) return;
    
    const events = this.queue.splice(0, this.MAX_BATCH_SIZE);
    
    for (const event of events) {
      await this.sendEvent(event);
    }
    
    // If there are more events, schedule another flush
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  private addToQueue(eventData: any): void {
    this.queue.push(eventData);
    
    if (this.queue.length >= this.MAX_BATCH_SIZE) {
      // Immediately flush if batch is full
      this.flushQueue();
    } else {
      this.processQueue();
    }
  }

  private getPageData(): { path: string; title: string; referrer: string; userAgent: string } {
    if (typeof window === 'undefined') {
      return { path: '', title: '', referrer: '', userAgent: '' };
    }

    return {
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent
    };
  }

  //track page view
  trackPageView(customPath?: string): void {
    if (!this.isEnabled) return;
    
    const pageData = this.getPageData();
    
    const eventData = {
      type: 'page_view',
      data: {
        path: customPath || pageData.path,
        title: pageData.title,
        referrer: pageData.referrer,
        userAgent: pageData.userAgent,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      }
    };
    
    this.addToQueue(eventData);
  }

  //track project view
  trackProjectView(projectId: number, slug: string): void {
    if (!this.isEnabled) return;
    
    const pageData = this.getPageData();
    
    const eventData = {
      type: 'project_view',
      data: {
        projectId,
        slug,
        referrer: pageData.referrer,
        userAgent: pageData.userAgent,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      }
    };
    
    this.addToQueue(eventData);
  }

  //track skill interaction
  trackSkillInteraction(action: string, skillId?: number, category?: string): void {
    if (!this.isEnabled) return;
    
    const eventData = {
      type: 'skill_interaction',
      data: {
        skillId,
        action, // 'view', 'expand', 'chart_toggle', 'category_expand', etc.
        category,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      }
    };
    
    this.addToQueue(eventData);
  }

  //track custom event
  trackEvent(eventType: string, eventData: any): void {
    if (!this.isEnabled) return;
    
    const event = {
      type: eventType,
      data: {
        ...eventData,
        sessionId: this.sessionId,
        timestamp: new Date().toISOString()
      }
    };
    
    this.addToQueue(event);
  }

  //enable or disable analytics
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('analytics_enabled', enabled.toString());
    }
    
    if (!enabled) {
      // Clear the queue if disabled
      this.queue = [];
      if (this.batchTimer) {
        clearTimeout(this.batchTimer);
        this.batchTimer = null;
      }
    }
  }

  //check if analytics is enabled
  isAnalyticsEnabled(): boolean {
    return this.isEnabled;
  }

  //manually flush all queued events
  async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    
    await this.flushQueue();
  }
}

// Create singleton instance
export const analytics = new AnalyticsClient();

// Auto-track page views for SPA navigation
if (typeof window !== 'undefined') {
  // Track initial page load
  window.addEventListener('load', () => {
    analytics.trackPageView();
  });

  // Track navigation changes (for SPA)
  let currentPath = window.location.pathname;
  
  const checkPathChange = () => {
    if (window.location.pathname !== currentPath) {
      currentPath = window.location.pathname;
      analytics.trackPageView();
    }
  };
  
  // Listen for browser navigation
  window.addEventListener('popstate', checkPathChange);
  
  // Listen for programmatic navigation (pushState/replaceState)
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(checkPathChange, 0);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(checkPathChange, 0);
  };

  // Flush analytics before page unload
  window.addEventListener('beforeunload', () => {
    analytics.flush();
  });
}

export default analytics;