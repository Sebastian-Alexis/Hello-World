import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock browser APIs
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock performance API
Object.defineProperty(window, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
    getEntriesByType: vi.fn(() => []),
    getEntriesByName: vi.fn(() => []),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    memory: {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    },
  },
});

// Mock fetch API
global.fetch = vi.fn();

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
});

// Mock navigator
Object.defineProperty(window, 'navigator', {
  value: {
    userAgent: 'test-user-agent',
    connection: {
      effectiveType: '4g',
      downlink: 10,
    },
    sendBeacon: vi.fn(),
  },
});

// Setup database connection for testing
let testDb: any;

beforeAll(async () => {
  // Mock database setup for testing
  testDb = {
    initialized: true,
    close: async () => {}
  };
});

afterAll(async () => {
  if (testDb && testDb.close) {
    await testDb.close();
  }
});

// Export test utilities
export const createMockFetch = (mockResponse: any) => {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue(mockResponse),
    text: vi.fn().mockResolvedValue(JSON.stringify(mockResponse)),
  });
};

export const createMockPerformanceEntry = (name: string, startTime: number, duration: number) => ({
  name,
  startTime,
  duration,
  entryType: 'measure',
  toJSON: () => ({ name, startTime, duration }),
});

export { testDb };