#!/usr/bin/env node

import { generateGreatCirclePath } from './src/components/flight-map/utils.ts';

// Test LA to Tokyo with Turf
console.log('\n✈️ Testing LA to Tokyo with Turf.js:');
const laToTokyo = generateGreatCirclePath(
  [-118.2437, 34.0522], // LA
  [139.6503, 35.6762], // Tokyo
  20
);

console.log('Generated path points:', laToTokyo.length);
console.log('First point:', laToTokyo[0]);
console.log('Last point:', laToTokyo[laToTokyo.length - 1]);

// Check if any coordinates cross the date line
let maxLng = -Infinity;
let minLng = Infinity;
laToTokyo.forEach(([lng, lat], i) => {
  if (lng > maxLng) maxLng = lng;
  if (lng < minLng) minLng = lng;
  
  if (i > 0 && i < 5) {
    console.log(`Point ${i}: [${lng.toFixed(2)}, ${lat.toFixed(2)}]`);
  }
});

console.log(`\nLongitude range: ${minLng.toFixed(2)} to ${maxLng.toFixed(2)}`);
console.log('Range span:', (maxLng - minLng).toFixed(2));

if (maxLng - minLng > 180) {
  console.log('❌ Path still wraps around the wrong way!');
} else {
  console.log('✅ Path appears to take the shortest route');
}