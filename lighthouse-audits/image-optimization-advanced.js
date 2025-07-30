//custom lighthouse audit for advanced image optimization
const Audit = require('lighthouse').Audit;

class ImageOptimizationAdvancedAudit extends Audit {
  static get meta() {
    return {
      id: 'image-optimization-advanced',
      title: 'Advanced Image Optimization',
      failureTitle: 'Images could be better optimized',
      description: 'Analyzes image optimization beyond basic formats, including lazy loading, responsive images, and preloading strategies.',
      supportedModes: ['navigation'],
      requiredArtifacts: ['ImageElements', 'NetworkRecords', 'traces']
    };
  }

  static audit(artifacts, context) {
    const images = artifacts.ImageElements || [];
    const networkRecords = artifacts.NetworkRecords[Audit.DEFAULT_PASS] || [];
    const trace = artifacts.traces[Audit.DEFAULT_PASS];

    if (images.length === 0) {
      return {
        score: 1,
        numericValue: 0,
        displayValue: 'No images found'
      };
    }

    const issues = [];
    let score = 100;
    let optimizedImages = 0;

    images.forEach((image, index) => {
      const imageIssues = [];
      
      //check for modern formats
      const isModernFormat = image.src && (
        image.src.includes('.webp') || 
        image.src.includes('.avif') ||
        image.mimeType === 'image/webp' ||
        image.mimeType === 'image/avif'
      );

      if (!isModernFormat) {
        imageIssues.push('Not using modern format (WebP/AVIF)');
      }

      //check for lazy loading
      const hasLazyLoading = image.loading === 'lazy' || 
                            image.dataset?.lazy !== undefined ||
                            image.classList?.contains('lazy');

      if (!hasLazyLoading && index > 2) { //first 3 images can be eager
        imageIssues.push('Missing lazy loading attribute');
      }

      //check for responsive images
      const hasResponsive = image.srcset || 
                           image.sizes ||
                           image.dataset?.srcset;

      if (!hasResponsive && image.naturalWidth > 400) {
        imageIssues.push('Missing responsive image attributes (srcset/sizes)');
      }

      //check for explicit dimensions
      const hasDimensions = (image.width && image.height) ||
                           (image.style?.width && image.style?.height) ||
                           (image.dataset?.width && image.dataset?.height);

      if (!hasDimensions) {
        imageIssues.push('Missing explicit width/height attributes');
      }

      //check for optimization markers
      const hasOptimizationMarkers = image.dataset?.optimized === 'true' ||
                                    image.classList?.contains('optimized') ||
                                    image.src?.includes('/_image/');

      if (hasOptimizationMarkers) {
        optimizedImages++;
      }

      //check for preload hints for above-the-fold images
      if (index < 2) { //first 2 images should be preloaded
        const preloadExists = document.querySelector(`link[rel="preload"][href="${image.src}"]`) ||
                             document.querySelector(`link[rel="preload"][imagesrcset*="${image.src}"]`);
        
        if (!preloadExists) {
          imageIssues.push('Missing preload hint for above-the-fold image');
        }
      }

      if (imageIssues.length > 0) {
        issues.push({
          src: image.src || 'Unknown source',
          issues: imageIssues,
          width: image.naturalWidth,
          height: image.naturalHeight,
          format: image.mimeType || 'Unknown'
        });
      }
    });

    //calculate score based on optimization level
    const optimizationRatio = optimizedImages / images.length;
    const issueRatio = issues.length / images.length;
    
    score = Math.max(0, 100 - (issueRatio * 60) - ((1 - optimizationRatio) * 40));

    //analyze network requests for image efficiency
    const imageRequests = networkRecords.filter(record => 
      record.mimeType?.startsWith('image/') || 
      /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(record.url)
    );

    const oversizedImages = imageRequests.filter(request => 
      request.transferSize > 100000 // >100KB
    );

    if (oversizedImages.length > 0) {
      score -= Math.min(20, oversizedImages.length * 5);
      issues.push({
        src: 'Multiple images',
        issues: [`${oversizedImages.length} images over 100KB detected`],
        width: 'Various',
        height: 'Various',
        format: 'Various'
      });
    }

    const passed = score >= 80;

    return {
      score: Math.max(0, score) / 100,
      numericValue: issues.length,
      numericUnit: 'count',
      displayValue: passed ? 
        `${optimizedImages}/${images.length} images optimized` :
        `${issues.length} image optimization issues found`,
      details: {
        type: 'table',
        headings: [
          {key: 'src', itemType: 'url', text: 'Image'},
          {key: 'issues', itemType: 'text', text: 'Optimization Issues'},
          {key: 'dimensions', itemType: 'text', text: 'Dimensions'},
          {key: 'format', itemType: 'text', text: 'Format'}
        ],
        items: issues.map(issue => ({
          src: issue.src,
          issues: issue.issues.join(', '),
          dimensions: `${issue.width}×${issue.height}`,
          format: issue.format
        }))
      }
    };
  }
}

module.exports = ImageOptimizationAdvancedAudit;