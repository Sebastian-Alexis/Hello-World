#!/usr/bin/env node

import { generateGreatCirclePath, splitPathAtAntimeridian } from './src/components/flight-map/utils.ts';

// Test LA to Tokyo (crosses Pacific)
console.log('\n✈️ Testing LA to Tokyo (crosses Pacific):');
const laToTokyo = generateGreatCirclePath(
  [-118.2437, 34.0522], // LA
  [139.6503, 35.6762], // Tokyo
  20 // More points to see the crossing
);

console.log('Generated path points:', laToTokyo.length);
console.log('First few points:', laToTokyo.slice(0, 3).map(([lng, lat]) => 
  `[${lng.toFixed(2)}, ${lat.toFixed(2)}]`
));
console.log('Last few points:', laToTokyo.slice(-3).map(([lng, lat]) => 
  `[${lng.toFixed(2)}, ${lat.toFixed(2)}]`
));

// Check for antimeridian crossing
let crossesDateLine = false;
for (let i = 1; i < laToTokyo.length; i++) {
  if (Math.abs(laToTokyo[i][0] - laToTokyo[i-1][0]) > 180) {
    crossesDateLine = true;
    console.log(`\n⚠️ Date line crossing detected between points ${i-1} and ${i}:`);
    console.log(`  Point ${i-1}: [${laToTokyo[i-1][0].toFixed(2)}, ${laToTokyo[i-1][1].toFixed(2)}]`);
    console.log(`  Point ${i}: [${laToTokyo[i][0].toFixed(2)}, ${laToTokyo[i][1].toFixed(2)}]`);
  }
}

if (!crossesDateLine) {
  console.log('\n✅ No date line crossing detected in the path');
}

// Test splitting
console.log('\n📍 Testing path splitting:');
const segments = splitPathAtAntimeridian(laToTokyo);
console.log('Number of segments:', segments.length);
segments.forEach((segment, i) => {
  console.log(`Segment ${i + 1}: ${segment.length} points`);
  console.log(`  Start: [${segment[0][0].toFixed(2)}, ${segment[0][1].toFixed(2)}]`);
  console.log(`  End: [${segment[segment.length-1][0].toFixed(2)}, ${segment[segment.length-1][1].toFixed(2)}]`);
});

console.log('\n✅ Antimeridian handling test complete!');