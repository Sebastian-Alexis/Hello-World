import { spawn } from 'child_process';
import fetch from 'node-fetch';
import chalk from 'chalk';

console.log(chalk.blue.bold('\n🚀 Astro Routing Test Suite\n'));

const testUrls = [
  { url: 'http://localhost:4321/blog', name: 'Blog Index' },
  { url: 'http://localhost:4321/blog/testpublish', name: 'Blog Post (testpublish)' },
  { url: 'http://localhost:4321/blog/debug-testpublish', name: 'Debug Page' },
  { url: 'http://localhost:4321/blog/debug-full-testpublish', name: 'Full Debug Page' },
  { url: 'http://localhost:4321/api/debug/check-slugs', name: 'Check Slugs API' },
  { url: 'http://localhost:4321/api/debug/test-query?slug=testpublish', name: 'Test Query API' },
];

async function checkUrl(url, name) {
  try {
    console.log(chalk.yellow(`\nTesting: ${name}`));
    console.log(chalk.gray(`URL: ${url}`));
    
    const response = await fetch(url, {
      redirect: 'manual', // Don't follow redirects automatically
      headers: {
        'User-Agent': 'BlogTestSuite/1.0'
      }
    });
    
    const result = {
      url,
      name,
      status: response.status,
      statusText: response.statusText,
      redirected: response.status >= 300 && response.status < 400,
      location: response.headers.get('location'),
      contentType: response.headers.get('content-type'),
    };
    
    // Check for redirects
    if (result.redirected) {
      console.log(chalk.red(`❌ REDIRECT: ${response.status} -> ${result.location}`));
      
      // Special check for blog post redirect
      if (url.includes('/blog/testpublish') && result.location === '/blog') {
        console.log(chalk.red('   ⚠️  Blog post is redirecting to /blog - this is the issue!'));
      }
    } else if (response.status === 200) {
      console.log(chalk.green(`✅ SUCCESS: ${response.status} ${response.statusText}`));
      
      // For HTML pages, check if content contains error messages
      if (result.contentType?.includes('text/html')) {
        const text = await response.text();
        if (text.includes('redirect') || text.includes('error')) {
          console.log(chalk.yellow('   ⚠️  Page contains "redirect" or "error" text'));
        }
      }
    } else {
      console.log(chalk.red(`❌ ERROR: ${response.status} ${response.statusText}`));
    }
    
    return result;
  } catch (error) {
    console.log(chalk.red(`❌ FETCH ERROR: ${error.message}`));
    return {
      url,
      name,
      error: error.message,
      status: 0
    };
  }
}

// Check if server is running
console.log(chalk.yellow('Checking if Astro server is running...'));
try {
  const response = await fetch('http://localhost:4321/', { timeout: 5000 });
  console.log(chalk.green('✅ Server is running'));
} catch (error) {
  console.log(chalk.red('❌ Server is not running!'));
  console.log(chalk.yellow('\nPlease start the Astro dev server with: npm run dev'));
  process.exit(1);
}

// Run all tests
console.log(chalk.blue.bold('\n🧪 Running URL Tests...\n'));
const results = [];

for (const test of testUrls) {
  const result = await checkUrl(test.url, test.name);
  results.push(result);
  
  // Add a small delay between requests
  await new Promise(resolve => setTimeout(resolve, 500));
}

// Summary
console.log(chalk.blue.bold('\n📊 Test Summary\n'));

const redirects = results.filter(r => r.redirected);
const successes = results.filter(r => r.status === 200);
const errors = results.filter(r => r.status !== 200 && !r.redirected);

console.log(chalk.green(`✅ Successful: ${successes.length}`));
console.log(chalk.yellow(`↪️  Redirects: ${redirects.length}`));
console.log(chalk.red(`❌ Errors: ${errors.length}`));

// Detailed redirect analysis
if (redirects.length > 0) {
  console.log(chalk.yellow.bold('\n🔄 Redirect Details:\n'));
  redirects.forEach(r => {
    console.log(chalk.yellow(`${r.name}:`));
    console.log(`  From: ${r.url}`);
    console.log(`  To: ${r.location}`);
    console.log(`  Status: ${r.status}`);
  });
}

// Diagnosis
console.log(chalk.blue.bold('\n🔍 Diagnosis\n'));

const blogPostRedirect = results.find(r => 
  r.url.includes('/blog/testpublish') && 
  !r.url.includes('debug') && 
  r.redirected
);

if (blogPostRedirect) {
  console.log(chalk.red.bold('❌ CONFIRMED: Blog post is redirecting!'));
  console.log(chalk.yellow('\nPossible causes:'));
  console.log('1. Error in blog/[slug].astro page during rendering');
  console.log('2. Import resolution issues with @/ alias');
  console.log('3. Missing or misconfigured dependencies');
  console.log('4. Server-side rendering error');
  
  console.log(chalk.yellow('\nNext steps:'));
  console.log('1. Check server console for error messages');
  console.log('2. Visit /blog/debug-full-testpublish for detailed diagnostics');
  console.log('3. Check if ContentProcessor is throwing errors');
  console.log('4. Verify all imports are resolving correctly');
} else if (successes.length === testUrls.length) {
  console.log(chalk.green('✅ All URLs are accessible!'));
  console.log(chalk.yellow('If you still see issues, try:'));
  console.log('1. Clear browser cache');
  console.log('2. Test in incognito mode');
  console.log('3. Check browser console for client-side errors');
}

// Export results for further analysis
console.log(chalk.gray('\n💾 Full results saved to test-results.json'));
import { writeFileSync } from 'fs';
writeFileSync('test-results.json', JSON.stringify(results, null, 2));