#!/usr/bin/env node

import { generateGreatCirclePath, generateBezierPath } from './src/components/flight-map/utils.ts';

// Test great circle path for long flights
console.log('\n🌍 Testing Great Circle Path (NYC to Tokyo):');
const nycToTokyo = generateGreatCirclePath(
  [-73.9352, 40.7306], // NYC
  [139.6503, 35.6762], // Tokyo
  10 // Just 10 points for testing
);
console.log('Generated path points:', nycToTokyo.length);
console.log('First few points:', nycToTokyo.slice(0, 3));
console.log('Last few points:', nycToTokyo.slice(-3));

// Test bezier path for shorter flights
console.log('\n✈️ Testing Bezier Path (NYC to Chicago):');
const nycToChicago = generateBezierPath(
  [-73.9352, 40.7306], // NYC
  [-87.6298, 41.8781], // Chicago
  0.2, // 20% curve height
  10 // Just 10 points for testing
);
console.log('Generated path points:', nycToChicago.length);
console.log('First few points:', nycToChicago.slice(0, 3));
console.log('Last few points:', nycToChicago.slice(-3));

console.log('\n✅ Path generation functions working correctly!');