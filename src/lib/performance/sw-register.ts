// =============================================================================
// SERVICE WORKER REGISTRATION - Register and manage service worker lifecycle
// Handles service worker registration, updates, and communication
// =============================================================================

interface ServiceWorkerManager {
  register(): Promise<ServiceWorkerRegistration | null>;
  checkForUpdates(): Promise<void>;
  skipWaiting(): void;
  getCacheStats(): Promise<any>;
  clearCaches(): Promise<void>;
  addEventListener(event: string, callback: Function): void;
  removeEventListener(event: string, callback: Function): void;
}

class ServiceWorkerManagerImpl implements ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isCheckingForUpdates = false;

  async register(): Promise<ServiceWorkerRegistration | null> {
    //only register in browser environment and for production
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.log('Service Worker not supported');
      return null;
    }

    //skip service worker in development unless explicitly enabled
    if (import.meta.env.DEV && !import.meta.env.VITE_ENABLE_SW) {
      console.log('Service Worker disabled in development');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Always check for updates
      });

      this.registration = registration;
      
      console.log('Service Worker registered successfully:', registration.scope);

      //handle service worker lifecycle events
      this.setupEventListeners(registration);

      //check for updates
      this.scheduleUpdateChecks();

      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  private setupEventListeners(registration: ServiceWorkerRegistration): void {
    //handle waiting service worker (update available)
    if (registration.waiting) {
      this.emit('updateAvailable', registration.waiting);
    }

    //listen for new service worker installations
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      
      if (newWorker) {
        console.log('New Service Worker installing...');
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              //new update available
              console.log('Service Worker update available');
              this.emit('updateAvailable', newWorker);
            } else {
              //first time installation
              console.log('Service Worker installed for the first time');
              this.emit('installed', newWorker);
            }
          } else if (newWorker.state === 'activated') {
            console.log('Service Worker activated');
            this.emit('activated', newWorker);
          }
        });
      }
    });

    //listen for controller changes (when new SW takes control)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('Service Worker controller changed');
      this.emit('controllerChange');
      
      //optionally reload the page for updates
      if (this.shouldReloadOnUpdate()) {
        window.location.reload();
      }
    });

    //listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from Service Worker:', event.data);
      this.emit('message', event.data);
    });
  }

  private shouldReloadOnUpdate(): boolean {
    //check if auto-reload is enabled in settings
    try {
      const settings = localStorage.getItem('sw-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        return parsed.autoReload ?? false;
      }
    } catch (error) {
      console.warn('Failed to read SW settings:', error);
    }
    return false;
  }

  async checkForUpdates(): Promise<void> {
    if (!this.registration || this.isCheckingForUpdates) {
      return;
    }

    this.isCheckingForUpdates = true;

    try {
      console.log('Checking for Service Worker updates...');
      await this.registration.update();
      
      //emit event even if no update is found
      this.emit('updateChecked');
    } catch (error) {
      console.error('Failed to check for updates:', error);
      this.emit('updateCheckFailed', error);
    } finally {
      this.isCheckingForUpdates = false;
    }
  }

  skipWaiting(): void {
    if (this.registration?.waiting) {
      console.log('Activating new Service Worker...');
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  async getCacheStats(): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No active service worker'));
        return;
      }

      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data);
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'GET_CACHE_STATS' },
        [channel.port2]
      );

      //timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Cache stats request timed out'));
      }, 5000);
    });
  }

  async clearCaches(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('No active service worker'));
        return;
      }

      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve();
        } else {
          reject(new Error('Failed to clear caches'));
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type: 'CLEAR_CACHE' },
        [channel.port2]
      );

      //timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Clear cache request timed out'));
      }, 10000);
    });
  }

  addEventListener(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  removeEventListener(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  private scheduleUpdateChecks(): void {
    //check for updates every hour
    setInterval(() => {
      this.checkForUpdates();
    }, 60 * 60 * 1000);

    //check for updates when page becomes visible
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        //delay check by 1 second to avoid immediate check on focus
        setTimeout(() => {
          this.checkForUpdates();
        }, 1000);
      }
    });

    //check for updates when coming back online
    window.addEventListener('online', () => {
      setTimeout(() => {
        this.checkForUpdates();
      }, 2000);
    });
  }
}

//singleton instance
export const swManager = new ServiceWorkerManagerImpl();

//utility functions for common service worker operations
export const serviceWorkerUtils = {
  /**
   * Initialize service worker with default configuration
   */
  async initialize(): Promise<void> {
    try {
      const registration = await swManager.register();
      
      if (registration) {
        //show update notification when available
        swManager.addEventListener('updateAvailable', (worker) => {
          this.showUpdateNotification(worker);
        });

        //log installation events
        swManager.addEventListener('installed', () => {
          console.log('App is ready for offline use');
          this.showInstallNotification();
        });

        swManager.addEventListener('activated', () => {
          console.log('App updated to latest version');
        });

        //handle messages from service worker
        swManager.addEventListener('message', (data) => {
          if (data.type === 'CACHE_UPDATED') {
            console.log('Content has been cached for offline use');
          }
        });

        return;
      }
    } catch (error) {
      console.error('Service Worker initialization failed:', error);
    }
  },

  /**
   * Show update notification to user
   */
  showUpdateNotification(worker: ServiceWorker): void {
    //create notification banner
    const notification = this.createNotificationBanner(
      'A new version is available!',
      'Click to update and restart the app.',
      [
        {
          text: 'Update',
          action: () => {
            swManager.skipWaiting();
            this.hideNotification(notification);
          }
        },
        {
          text: 'Later',
          action: () => {
            this.hideNotification(notification);
          }
        }
      ]
    );

    document.body.appendChild(notification);
  },

  /**
   * Show installation notification
   */
  showInstallNotification(): void {
    const notification = this.createNotificationBanner(
      'App installed successfully!',
      'Content is now cached for offline use.',
      [{
        text: 'Got it',
        action: (notification: HTMLElement) => {
          this.hideNotification(notification);
        }
      }]
    );

    document.body.appendChild(notification);
    
    //auto-hide after 5 seconds
    setTimeout(() => {
      this.hideNotification(notification);
    }, 5000);
  },

  /**
   * Create notification banner element
   */
  createNotificationBanner(
    title: string, 
    message: string, 
    actions: Array<{ text: string; action: (notification?: HTMLElement) => void }>
  ): HTMLElement {
    const notification = document.createElement('div');
    notification.className = 'sw-notification';
    notification.innerHTML = `
      <div class="sw-notification-content">
        <div class="sw-notification-text">
          <h4>${title}</h4>
          <p>${message}</p>
        </div>
        <div class="sw-notification-actions">
          ${actions.map(action => 
            `<button class="sw-btn" data-action="${action.text}">${action.text}</button>`
          ).join('')}
        </div>
      </div>
    `;

    //add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      max-width: 400px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      border-left: 4px solid #3b82f6;
      padding: 16px;
      z-index: 10000;
      font-family: system-ui, sans-serif;
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    //add event listeners
    actions.forEach((action, index) => {
      const button = notification.querySelector(`[data-action="${action.text}"]`) as HTMLButtonElement;
      if (button) {
        button.addEventListener('click', () => action.action(notification));
        
        //style buttons
        button.style.cssText = `
          background: ${index === 0 ? '#3b82f6' : '#6b7280'};
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          margin-left: 8px;
          cursor: pointer;
          font-size: 14px;
        `;
      }
    });

    //animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    return notification;
  },

  /**
   * Hide notification banner
   */
  hideNotification(notification: HTMLElement): void {
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  },

  /**
   * Get service worker status
   */
  async getStatus(): Promise<{
    registered: boolean;
    active: boolean;
    updateAvailable: boolean;
    cacheStats?: any;
  }> {
    const status = {
      registered: false,
      active: false,
      updateAvailable: false,
      cacheStats: undefined,
    };

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      
      if (registration) {
        status.registered = true;
        status.active = !!registration.active;
        status.updateAvailable = !!registration.waiting;

        try {
          status.cacheStats = await swManager.getCacheStats();
        } catch (error) {
          console.warn('Could not get cache stats:', error);
        }
      }
    }

    return status;
  },

  /**
   * Manually trigger service worker update check
   */
  async checkForUpdates(): Promise<void> {
    return swManager.checkForUpdates();
  },

  /**
   * Clear all caches
   */
  async clearCaches(): Promise<void> {
    return swManager.clearCaches();
  },
};

//auto-initialize service worker when this module is imported
if (typeof window !== 'undefined') {
  //wait for page load to avoid interfering with initial page performance
  if (document.readyState === 'complete') {
    serviceWorkerUtils.initialize();
  } else {
    window.addEventListener('load', () => {
      serviceWorkerUtils.initialize();
    });
  }
}