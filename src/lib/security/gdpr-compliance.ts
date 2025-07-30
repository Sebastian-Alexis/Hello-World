//gdpr compliance system with cookie management
import type { APIContext } from 'astro';

//gdpr configuration
const GDPR_CONFIG = {
  //cookie categories
  COOKIE_CATEGORIES: {
    NECESSARY: 'necessary',
    FUNCTIONAL: 'functional',
    ANALYTICS: 'analytics',
    MARKETING: 'marketing',
  },
  
  //consent storage configuration
  CONSENT_COOKIE: {
    NAME: 'gdpr-consent',
    MAX_AGE: 365 * 24 * 60 * 60, //1 year
    PATH: '/',
    SECURE: !import.meta.env.DEV,
    SAME_SITE: 'strict' as const,
  },
  
  //data retention periods (in days)
  RETENTION_PERIODS: {
    USER_DATA: 2555, //7 years for legal compliance
    ANALYTICS_DATA: 26 * 30, //26 months (google analytics default)
    LOG_DATA: 90, //3 months
    SESSION_DATA: 30, //1 month
    MARKETING_DATA: 365, //1 year
  },
  
  //personal data categories
  PERSONAL_DATA_TYPES: {
    IDENTITY: 'identity', //name, email, username
    CONTACT: 'contact', //email, phone
    TECHNICAL: 'technical', //ip, browser, device
    BEHAVIORAL: 'behavioral', //clicks, views, preferences
    FINANCIAL: 'financial', //payment info
    LOCATION: 'location', //ip-based or gps
  },
};

//cookie definition interface
interface CookieDefinition {
  name: string;
  category: string;
  purpose: string;
  duration: string;
  necessary: boolean;
  thirdParty?: boolean;
  domain?: string;
}

//consent preferences
interface ConsentPreferences {
  necessary: boolean; //always true
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
  version: string; //consent version for tracking changes
}

//data processing record
interface DataProcessingRecord {
  userId: string;
  dataType: string;
  purpose: string;
  legalBasis: string;
  collected: Date;
  retentionPeriod: number;
  status: 'active' | 'deleted' | 'anonymized';
}

//cookie registry - all cookies used by the application
const COOKIE_REGISTRY: CookieDefinition[] = [
  //necessary cookies
  {
    name: 'auth-token',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.NECESSARY,
    purpose: 'Authentication and session management',
    duration: '7 days',
    necessary: true,
  },
  {
    name: 'csrf-token',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.NECESSARY,
    purpose: 'Security - prevent cross-site request forgery',
    duration: '1 hour',
    necessary: true,
  },
  {
    name: 'gdpr-consent',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.NECESSARY,
    purpose: 'Store GDPR consent preferences',
    duration: '1 year',
    necessary: true,
  },
  
  //functional cookies
  {
    name: 'theme-preference',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.FUNCTIONAL,
    purpose: 'Remember dark/light mode preference',
    duration: '1 year',
    necessary: false,
  },
  {
    name: 'language-preference',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.FUNCTIONAL,
    purpose: 'Remember language preference',
    duration: '1 year',
    necessary: false,
  },
  
  //analytics cookies
  {
    name: '_ga',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.ANALYTICS,
    purpose: 'Google Analytics - distinguish users',
    duration: '2 years',
    necessary: false,
    thirdParty: true,
    domain: '.google.com',
  },
  {
    name: '_ga_*',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.ANALYTICS,
    purpose: 'Google Analytics - session tracking',
    duration: '2 years',
    necessary: false,
    thirdParty: true,
    domain: '.google.com',
  },
  
  //marketing cookies (if used)
  {
    name: '_fbp',
    category: GDPR_CONFIG.COOKIE_CATEGORIES.MARKETING,
    purpose: 'Facebook Pixel - track conversions',
    duration: '3 months',
    necessary: false,
    thirdParty: true,
    domain: '.facebook.com',
  },
];

//get user's consent preferences
export function getConsentPreferences(context: APIContext): ConsentPreferences | null {
  const cookies = context.request.headers.get('Cookie') || '';
  const consentMatch = cookies.match(new RegExp(`${GDPR_CONFIG.CONSENT_COOKIE.NAME}=([^;]+)`));
  
  if (!consentMatch) {
    return null;
  }
  
  try {
    const decoded = decodeURIComponent(consentMatch[1]);
    return JSON.parse(decoded);
  } catch (error) {
    console.error('Failed to parse consent preferences:', error);
    return null;
  }
}

//save consent preferences
export function saveConsentPreferences(preferences: Partial<ConsentPreferences>): string {
  const consent: ConsentPreferences = {
    necessary: true, //always required
    functional: preferences.functional || false,
    analytics: preferences.analytics || false,
    marketing: preferences.marketing || false,
    timestamp: Date.now(),
    version: '1.0', //increment when privacy policy changes
  };
  
  const encoded = encodeURIComponent(JSON.stringify(consent));
  
  const cookieOptions = [
    `${GDPR_CONFIG.CONSENT_COOKIE.NAME}=${encoded}`,
    `Max-Age=${GDPR_CONFIG.CONSENT_COOKIE.MAX_AGE}`,
    `Path=${GDPR_CONFIG.CONSENT_COOKIE.PATH}`,
    `SameSite=${GDPR_CONFIG.CONSENT_COOKIE.SAME_SITE}`,
  ];
  
  if (GDPR_CONFIG.CONSENT_COOKIE.SECURE) {
    cookieOptions.push('Secure');
  }
  
  return cookieOptions.join('; ');
}

//check if cookie is allowed based on consent
export function isCookieAllowed(cookieName: string, consent: ConsentPreferences | null): boolean {
  if (!consent) {
    //no consent given - only allow necessary cookies
    const cookieDef = COOKIE_REGISTRY.find(c => c.name === cookieName || cookieName.match(c.name));
    return cookieDef?.necessary || false;
  }
  
  const cookieDef = COOKIE_REGISTRY.find(c => c.name === cookieName || cookieName.match(c.name));
  if (!cookieDef) {
    //unknown cookie - block by default
    return false;
  }
  
  switch (cookieDef.category) {
    case GDPR_CONFIG.COOKIE_CATEGORIES.NECESSARY:
      return true;
    case GDPR_CONFIG.COOKIE_CATEGORIES.FUNCTIONAL:
      return consent.functional;
    case GDPR_CONFIG.COOKIE_CATEGORIES.ANALYTICS:
      return consent.analytics;
    case GDPR_CONFIG.COOKIE_CATEGORIES.MARKETING:
      return consent.marketing;
    default:
      return false;
  }
}

//filter response cookies based on consent
export function filterCookiesByConsent(
  response: Response, 
  consent: ConsentPreferences | null
): Response {
  const setCookieHeaders = response.headers.getSetCookie?.() || [];
  if (setCookieHeaders.length === 0) {
    return response;
  }
  
  const allowedCookies = setCookieHeaders.filter(cookieHeader => {
    const cookieName = cookieHeader.split('=')[0];
    return isCookieAllowed(cookieName, consent);
  });
  
  //create new response with filtered cookies
  const newHeaders = new Headers(response.headers);
  newHeaders.delete('set-cookie');
  
  allowedCookies.forEach(cookie => {
    newHeaders.append('set-cookie', cookie);
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

//generate cookie consent banner html
export function generateConsentBanner(currentConsent?: ConsentPreferences): string {
  const checked = (category: keyof ConsentPreferences, defaultValue = false) => {
    if (currentConsent) {
      return currentConsent[category] ? 'checked' : '';
    }
    return defaultValue ? 'checked' : '';
  };
  
  return `
    <div id="cookie-consent-banner" class="cookie-consent-banner" ${currentConsent ? 'style="display: none;"' : ''}>
      <div class="consent-content">
        <h3>Cookie Preferences</h3>
        <p>We use cookies to enhance your experience. Please choose which cookies you accept:</p>
        
        <div class="consent-categories">
          <div class="consent-category">
            <label>
              <input type="checkbox" name="necessary" checked disabled>
              <strong>Necessary</strong> - Required for basic functionality
            </label>
          </div>
          
          <div class="consent-category">
            <label>
              <input type="checkbox" name="functional" ${checked('functional')}>
              <strong>Functional</strong> - Remember your preferences
            </label>
          </div>
          
          <div class="consent-category">
            <label>
              <input type="checkbox" name="analytics" ${checked('analytics')}>
              <strong>Analytics</strong> - Help us improve our site
            </label>
          </div>
          
          <div class="consent-category">
            <label>
              <input type="checkbox" name="marketing" ${checked('marketing')}>
              <strong>Marketing</strong> - Personalized content and ads
            </label>
          </div>
        </div>
        
        <div class="consent-actions">
          <button type="button" onclick="acceptAllCookies()">Accept All</button>
          <button type="button" onclick="saveConsentPreferences()">Save Preferences</button>
          <button type="button" onclick="rejectNonEssential()">Reject Non-Essential</button>
        </div>
        
        <p class="consent-links">
          <a href="/privacy-policy" target="_blank">Privacy Policy</a> | 
          <a href="/cookie-policy" target="_blank">Cookie Policy</a>
        </p>
      </div>
    </div>
    
    <style>
      .cookie-consent-banner {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #fff;
        border-top: 2px solid #e2e8f0;
        padding: 1rem;
        box-shadow: 0 -4px 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 9999;
        max-height: 80vh;
        overflow-y: auto;
      }
      
      .consent-content {
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .consent-categories {
        margin: 1rem 0;
        display: grid;
        gap: 0.5rem;
      }
      
      .consent-category label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        cursor: pointer;
      }
      
      .consent-actions {
        margin: 1rem 0;
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      
      .consent-actions button {
        padding: 0.5rem 1rem;
        border: 1px solid #d1d5db;
        background: #f9fafb;
        border-radius: 0.375rem;
        cursor: pointer;
      }
      
      .consent-actions button:hover {
        background: #e5e7eb;
      }
      
      .consent-links {
        font-size: 0.875rem;
        color: #6b7280;
      }
      
      .consent-links a {
        color: #3b82f6;
        text-decoration: none;
      }
      
      @media (prefers-color-scheme: dark) {
        .cookie-consent-banner {
          background: #1f2937;
          color: #f9fafb;
          border-color: #374151;
        }
        
        .consent-actions button {
          background: #374151;
          border-color: #4b5563;
          color: #f9fafb;
        }
        
        .consent-actions button:hover {
          background: #4b5563;
        }
      }
    </style>
    
    <script>
      function acceptAllCookies() {
        const consent = {
          necessary: true,
          functional: true,
          analytics: true,
          marketing: true
        };
        saveConsent(consent);
      }
      
      function rejectNonEssential() {
        const consent = {
          necessary: true,
          functional: false,
          analytics: false,
          marketing: false
        };
        saveConsent(consent);
      }
      
      function saveConsentPreferences() {
        const banner = document.getElementById('cookie-consent-banner');
        const consent = {
          necessary: true,
          functional: banner.querySelector('input[name="functional"]').checked,
          analytics: banner.querySelector('input[name="analytics"]').checked,
          marketing: banner.querySelector('input[name="marketing"]').checked
        };
        saveConsent(consent);
      }
      
      function saveConsent(consent) {
        // save consent via api
        fetch('/api/gdpr/consent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(consent)
        }).then(() => {
          document.getElementById('cookie-consent-banner').style.display = 'none';
          
          // reload page to apply consent changes
          if (window.gtag && consent.analytics) {
            // initialize analytics if consented
            gtag('consent', 'update', {
              'analytics_storage': 'granted'
            });
          }
          
          location.reload();
        }).catch(console.error);
      }
      
      // show preferences modal
      function showCookiePreferences() {
        document.getElementById('cookie-consent-banner').style.display = 'block';
      }
      
      // expose function globally for cookie preferences link
      window.showCookiePreferences = showCookiePreferences;
    </script>
  `;
}

//data subject rights implementation
export interface DataSubjectRequest {
  type: 'access' | 'rectification' | 'erasure' | 'portability' | 'restriction' | 'objection';
  userId: string;
  email: string;
  requestDate: Date;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  reason?: string;
}

//handle data subject access request
export async function handleDataAccessRequest(userId: string): Promise<{
  personalData: any;
  processingRecords: DataProcessingRecord[];
  retentionInfo: any;
}> {
  //collect all personal data for the user
  const personalData = {
    profile: {
      //user profile data
      id: userId,
      // other profile fields...
    },
    sessions: {
      //session data
    },
    analytics: {
      //analytics data if consented
    },
  };
  
  //processing records
  const processingRecords: DataProcessingRecord[] = [
    //would be fetched from database
  ];
  
  //retention information
  const retentionInfo = {
    categories: GDPR_CONFIG.RETENTION_PERIODS,
    //specific retention dates for this user's data
  };
  
  return {
    personalData,
    processingRecords,
    retentionInfo
  };
}

//handle data erasure request (right to be forgotten)
export async function handleDataErasureRequest(userId: string): Promise<{
  deleted: string[];
  anonymized: string[];
  retained: Array<{ data: string; reason: string }>;
}> {
  const deleted: string[] = [];
  const anonymized: string[] = [];
  const retained: Array<{ data: string; reason: string }> = [];
  
  //delete or anonymize personal data
  //some data may need to be retained for legal compliance
  
  return { deleted, anonymized, retained };
}

//generate privacy policy
export function generatePrivacyPolicy(): string {
  return `
    <h1>Privacy Policy</h1>
    
    <h2>Data Controller</h2>
    <p>Information about who controls your data...</p>
    
    <h2>Personal Data We Collect</h2>
    <ul>
      <li><strong>Identity Data:</strong> Name, username, email address</li>
      <li><strong>Technical Data:</strong> IP address, browser information, device information</li>
      <li><strong>Usage Data:</strong> How you interact with our website</li>
    </ul>
    
    <h2>Legal Basis for Processing</h2>
    <p>We process your personal data based on:</p>
    <ul>
      <li><strong>Contract:</strong> To provide our services</li>
      <li><strong>Legitimate Interests:</strong> To improve our services</li>
      <li><strong>Consent:</strong> For marketing and analytics (where required)</li>
    </ul>
    
    <h2>Data Retention</h2>
    <p>We retain your data for the following periods:</p>
    <ul>
      <li>User account data: ${GDPR_CONFIG.RETENTION_PERIODS.USER_DATA} days</li>
      <li>Analytics data: ${GDPR_CONFIG.RETENTION_PERIODS.ANALYTICS_DATA} days</li>
      <li>Log data: ${GDPR_CONFIG.RETENTION_PERIODS.LOG_DATA} days</li>
    </ul>
    
    <h2>Your Rights</h2>
    <p>Under GDPR, you have the right to:</p>
    <ul>
      <li>Access your personal data</li>
      <li>Rectify inaccurate data</li>
      <li>Erase your data (right to be forgotten)</li>
      <li>Restrict processing</li>
      <li>Data portability</li>
      <li>Object to processing</li>
    </ul>
    
    <h2>Cookies</h2>
    <p>We use the following types of cookies:</p>
    ${COOKIE_REGISTRY.map(cookie => `
      <div>
        <strong>${cookie.name}</strong> (${cookie.category}): ${cookie.purpose}
        <br>Duration: ${cookie.duration}
        ${cookie.thirdParty ? '<br><em>Third-party cookie</em>' : ''}
      </div>
    `).join('')}
    
    <h2>Contact</h2>
    <p>For privacy-related questions, contact us at: [contact information]</p>
  `;
}

//cleanup expired data based on retention policies
export function cleanupExpiredData(): void {
  const now = Date.now();
  
  //implement data cleanup based on retention periods
  //this would typically run as a scheduled job
  
  console.log('GDPR data cleanup started at', new Date().toISOString());
  
  //cleanup would happen here based on GDPR_CONFIG.RETENTION_PERIODS
}