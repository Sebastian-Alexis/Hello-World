// =============================================================================
// PERFORMANCE BASELINE API - Plan 7 Implementation
// Manages performance baselines for regression detection
// =============================================================================

import type { APIRoute } from 'astro';

//baseline storage (in production, use database)
const performanceBaselines = new Map<string, {
  value: number;
  updatedAt: number;
  sampleCount: number;
  confidence: number;
}>();

//default baselines based on Core Web Vitals thresholds
const DEFAULT_BASELINES = {
  LCP: 2500,     // ms
  FID: 100,      // ms  
  CLS: 0.1,      // unitless
  TTFB: 800,     // ms
  FCP: 1800,     // ms
  INP: 200,      // ms
  MEMORY_USAGE: 70,  // percentage
  RESOURCE_SIZE: 2048,  // KB
  JS_BUNDLE_SIZE: 100,  // KB
};

//initialize with defaults
Object.entries(DEFAULT_BASELINES).forEach(([key, value]) => {
  performanceBaselines.set(key, {
    value,
    updatedAt: Date.now(),
    sampleCount: 0,
    confidence: 0.5 // medium confidence for defaults
  });
});

export const GET: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const metric = searchParams.get('metric');
    
    if (metric) {
      //return specific metric baseline
      const baseline = performanceBaselines.get(metric);
      
      if (!baseline) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Metric not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: {
          metric,
          ...baseline
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300'
        }
      });
    }
    
    //return all baselines
    const baselines = Object.fromEntries(
      Array.from(performanceBaselines.entries()).map(([key, data]) => [
        key,
        data
      ])
    );
    
    return new Response(JSON.stringify({
      success: true,
      data: baselines,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    });
    
  } catch (error) {
    console.error('Error fetching baselines:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch baselines'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const { metrics, updateMethod = 'exponential' } = await request.json();
    
    if (!metrics || typeof metrics !== 'object') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid metrics data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const updatedMetrics: string[] = [];
    
    //update baselines
    Object.entries(metrics).forEach(([metric, newValue]) => {
      if (typeof newValue !== 'number') return;
      
      const existing = performanceBaselines.get(metric);
      let updatedBaseline;
      
      if (existing) {
        //update existing baseline
        if (updateMethod === 'exponential') {
          //exponential moving average
          const alpha = Math.min(0.2, 1 / Math.max(existing.sampleCount, 5));
          const value = alpha * newValue + (1 - alpha) * existing.value;
          
          updatedBaseline = {
            value,
            updatedAt: Date.now(),
            sampleCount: existing.sampleCount + 1,
            confidence: Math.min(1.0, existing.confidence + 0.01)
          };
        } else if (updateMethod === 'replace') {
          //direct replacement
          updatedBaseline = {
            value: newValue,
            updatedAt: Date.now(),
            sampleCount: existing.sampleCount + 1,
            confidence: 0.8 // high confidence for manual updates
          };
        }
      } else {
        //create new baseline
        updatedBaseline = {
          value: newValue,
          updatedAt: Date.now(),
          sampleCount: 1,
          confidence: 0.6
        };
      }
      
      if (updatedBaseline) {
        performanceBaselines.set(metric, updatedBaseline);
        updatedMetrics.push(metric);
      }
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: `Updated ${updatedMetrics.length} baseline metrics`,
      updatedMetrics,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error updating baselines:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update baselines'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  try {
    const { baselines } = await request.json();
    
    if (!baselines || typeof baselines !== 'object') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid baselines data'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    //replace all baselines
    performanceBaselines.clear();
    
    Object.entries(baselines).forEach(([metric, value]) => {
      if (typeof value === 'number') {
        performanceBaselines.set(metric, {
          value,
          updatedAt: Date.now(),
          sampleCount: 0,
          confidence: 0.8
        });
      }
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: `Replaced all baselines with ${performanceBaselines.size} metrics`,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error replacing baselines:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to replace baselines'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const DELETE: APIRoute = async ({ url }) => {
  try {
    const searchParams = new URL(url).searchParams;
    const metric = searchParams.get('metric');
    
    if (metric) {
      //delete specific metric
      if (performanceBaselines.has(metric)) {
        performanceBaselines.delete(metric);
        
        return new Response(JSON.stringify({
          success: true,
          message: `Deleted baseline for ${metric}`,
          timestamp: new Date().toISOString()
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'Metric not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    //reset to defaults
    performanceBaselines.clear();
    Object.entries(DEFAULT_BASELINES).forEach(([key, value]) => {
      performanceBaselines.set(key, {
        value,
        updatedAt: Date.now(),
        sampleCount: 0,
        confidence: 0.5
      });
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Reset all baselines to defaults',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error deleting baselines:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to delete baselines'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};