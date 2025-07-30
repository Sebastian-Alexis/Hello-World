// =============================================================================
// IMAGE PROCESSOR - Advanced image processing and optimization utilities
// Provides comprehensive image transformation, format detection, and optimization
// =============================================================================

//image processing configuration
export const IMAGE_CONFIG = {
  //supported formats in order of preference
  FORMATS: ['avif', 'webp', 'jpeg', 'png', 'gif'] as const,
  
  //quality settings by format
  QUALITY: {
    avif: 75,
    webp: 85,
    jpeg: 85,
    png: 100, //lossless
    gif: 100,  //lossless
  },
  
  //responsive breakpoints
  BREAKPOINTS: [320, 480, 640, 768, 1024, 1280, 1600, 1920, 2560],
  
  //device pixel ratios to support
  DPR_VARIANTS: [1, 1.5, 2, 3],
  
  //maximum image dimensions
  MAX_DIMENSIONS: {
    width: 3840,
    height: 2160,
  },
  
  //CDN configurations
  CDN_PROVIDERS: {
    cloudflare: {
      baseUrl: 'https://imagedelivery.net',
      transformPattern: '/{hash}/{variant}',
      formats: ['avif', 'webp', 'jpeg', 'png'],
      features: ['resize', 'quality', 'format', 'blur', 'sharpen', 'brightness', 'contrast'],
    },
    cloudinary: {
      baseUrl: 'https://res.cloudinary.com',
      transformPattern: '/{cloud}/image/upload/{transforms}/{resource}',
      formats: ['avif', 'webp', 'jpeg', 'png', 'gif'],
      features: ['resize', 'quality', 'format', 'blur', 'auto_quality', 'auto_format'],
    },
  },
} as const;

export type ImageFormat = typeof IMAGE_CONFIG.FORMATS[number];
export type CDNProvider = keyof typeof IMAGE_CONFIG.CDN_PROVIDERS;

//comprehensive image optimization interface
export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: ImageFormat | 'auto';
  aspectRatio?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'scale-down' | 'none';
  dpr?: number;
  blur?: number;
  sharpen?: number;
  brightness?: number;
  contrast?: number;
  progressive?: boolean;
  lossless?: boolean;
  stripMetadata?: boolean;
  cdnProvider?: CDNProvider;
}

//responsive image configuration
export interface ResponsiveImageConfig {
  src: string;
  sizes: string;
  breakpoints?: number[];
  formats?: ImageFormat[];
  quality?: number;
  dpr?: number[];
  lazyLoad?: boolean;
  priority?: boolean;
}

//advanced image processor class
export class AdvancedImageProcessor {
  private browserCapabilities: Map<ImageFormat, boolean> = new Map();
  private processingQueue: Map<string, Promise<ProcessedImage>> = new Map();
  private cache: Map<string, ProcessedImage> = new Map();

  constructor() {
    this.detectBrowserCapabilities();
  }

  //detect browser image format capabilities
  private async detectBrowserCapabilities(): Promise<void> {
    const testFormats = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      
      for (const format of IMAGE_CONFIG.FORMATS) {
        try {
          const dataUrl = canvas.toDataURL(`image/${format}`);
          this.browserCapabilities.set(format, dataUrl.startsWith(`data:image/${format}`));
        } catch {
          this.browserCapabilities.set(format, false);
        }
      }
    };

    if (typeof window !== 'undefined') {
      await testFormats();
    }
  }

  //get optimal format for current browser
  getOptimalFormat(requestedFormat: ImageFormat | 'auto' = 'auto'): ImageFormat {
    if (requestedFormat !== 'auto') {
      return requestedFormat;
    }

    //prefer formats in order of compression efficiency
    for (const format of IMAGE_CONFIG.FORMATS) {
      if (this.browserCapabilities.get(format)) {
        return format;
      }
    }

    //fallback to JPEG
    return 'jpeg';
  }

  //process single image with comprehensive options
  async processImage(src: string, options: ImageOptimizationOptions = {}): Promise<ProcessedImage> {
    const cacheKey = this.generateCacheKey(src, options);
    
    //return cached result if available
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    //return existing promise if already processing
    if (this.processingQueue.has(cacheKey)) {
      return this.processingQueue.get(cacheKey)!;
    }

    //start processing
    const processingPromise = this.performImageProcessing(src, options);
    this.processingQueue.set(cacheKey, processingPromise);

    try {
      const result = await processingPromise;
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      this.processingQueue.delete(cacheKey);
    }
  }

  //perform actual image processing
  private async performImageProcessing(src: string, options: ImageOptimizationOptions): Promise<ProcessedImage> {
    const {
      width,
      height,
      quality = IMAGE_CONFIG.QUALITY.jpeg,
      format = 'auto',
      dpr = 1,
      blur,
      sharpen,
      brightness,
      contrast,
      progressive = true,
      stripMetadata = true,
      cdnProvider = 'cloudflare',
    } = options;

    const optimalFormat = this.getOptimalFormat(format);
    const finalWidth = width ? Math.min(width * dpr, IMAGE_CONFIG.MAX_DIMENSIONS.width) : undefined;
    const finalHeight = height ? Math.min(height * dpr, IMAGE_CONFIG.MAX_DIMENSIONS.height) : undefined;

    //detect CDN and build optimized URL
    const optimizedUrl = this.buildOptimizedUrl(src, {
      width: finalWidth,
      height: finalHeight,
      quality: quality,
      format: optimalFormat,
      blur,
      sharpen,
      brightness,
      contrast,
      progressive,
      stripMetadata,
      cdnProvider,
    });

    //generate LQIP (Low Quality Image Placeholder)
    const lqipUrl = this.generateLQIP(src, {
      width: 40,
      quality: 10,
      format: 'jpeg',
      cdnProvider,
    });

    //estimate file size reduction
    const sizeEstimate = this.estimateFileSize(finalWidth || 800, finalHeight || 600, optimalFormat, quality);
    const originalSizeEstimate = this.estimateFileSize(finalWidth || 800, finalHeight || 600, 'jpeg', 75);
    const compressionRatio = ((originalSizeEstimate - sizeEstimate) / originalSizeEstimate) * 100;

    return {
      optimizedUrl,
      lqipUrl,
      format: optimalFormat,
      width: finalWidth,
      height: finalHeight,
      quality,
      estimatedSize: sizeEstimate,
      compressionRatio,
      dpr,
      metadata: {
        originalSrc: src,
        processingTime: Date.now(),
        cdnProvider,
        optimizations: {
          blur: blur || 0,
          sharpen: sharpen || 0,
          brightness: brightness || 0,
          contrast: contrast || 0,
          progressive,
          stripMetadata,
        },
      },
    };
  }

  //generate responsive image set
  generateResponsiveImageSet(config: ResponsiveImageConfig): ResponsiveImageSet {
    const {
      src,
      sizes,
      breakpoints = IMAGE_CONFIG.BREAKPOINTS,
      formats = ['avif', 'webp', 'jpeg'],
      quality = 85,
      dpr = [1, 2],
      lazyLoad = true,
      priority = false,
    } = config;

    const sourceSets: Record<ImageFormat, string> = {} as Record<ImageFormat, string>;

    //generate source sets for each format
    for (const format of formats) {
      const sources: string[] = [];
      
      for (const breakpoint of breakpoints) {
        for (const devicePixelRatio of dpr) {
          const effectiveWidth = breakpoint * devicePixelRatio;
          const optimizedUrl = this.buildOptimizedUrl(src, {
            width: effectiveWidth,
            quality,
            format,
          });
          
          const descriptor = dpr.length > 1 ? 
            `${optimizedUrl} ${effectiveWidth}w ${devicePixelRatio}x` :
            `${optimizedUrl} ${effectiveWidth}w`;
          
          sources.push(descriptor);
        }
      }
      
      sourceSets[format] = sources.join(', ');
    }

    //generate primary image URL
    const primaryFormat = this.getOptimalFormat('auto');
    const primaryUrl = this.buildOptimizedUrl(src, {
      width: breakpoints[Math.floor(breakpoints.length / 2)],
      quality,
      format: primaryFormat,
    });

    //generate LQIP
    const lqipUrl = this.generateLQIP(src, {
      width: 40,
      quality: 10,
      format: 'jpeg',
    });

    return {
      sourceSets,
      primaryUrl,
      lqipUrl,
      sizes,
      formats,
      lazyLoad,
      priority,
      metadata: {
        originalSrc: src,
        breakpoints,
        dpr,
        quality,
        generatedAt: Date.now(),
      },
    };
  }

  //build optimized URL for various CDN providers
  private buildOptimizedUrl(src: string, options: ImageOptimizationOptions): string {
    const { cdnProvider = 'cloudflare' } = options;

    //detect CDN from URL
    if (src.includes('imagedelivery.net')) {
      return this.buildCloudflareUrl(src, options);
    } else if (src.includes('cloudinary.com')) {
      return this.buildCloudinaryUrl(src, options);
    } else if (src.includes('unsplash.com')) {
      return this.buildUnsplashUrl(src, options);
    }

    //fallback for local or unknown sources
    return src;
  }

  //build Cloudflare Images URL
  private buildCloudflareUrl(src: string, options: ImageOptimizationOptions): string {
    const params: string[] = [];
    
    if (options.width) params.push(`w=${options.width}`);
    if (options.height) params.push(`h=${options.height}`);
    if (options.quality) params.push(`q=${options.quality}`);
    if (options.format && options.format !== 'auto') params.push(`f=${options.format}`);
    if (options.blur) params.push(`blur=${options.blur}`);
    if (options.sharpen) params.push(`sharpen=${options.sharpen}`);
    if (options.brightness) params.push(`brightness=${options.brightness}`);
    if (options.contrast) params.push(`contrast=${options.contrast}`);
    if (options.stripMetadata) params.push('metadata=none');
    
    //add fit parameter for proper cropping
    if (options.width && options.height) {
      params.push('fit=crop');
    }

    return `${src}/${params.join(',')}`;
  }

  //build Cloudinary URL
  private buildCloudinaryUrl(src: string, options: ImageOptimizationOptions): string {
    const transforms: string[] = [];
    
    if (options.width) transforms.push(`w_${options.width}`);
    if (options.height) transforms.push(`h_${options.height}`);
    if (options.quality) transforms.push(`q_${options.quality}`);
    if (options.format && options.format !== 'auto') transforms.push(`f_${options.format}`);
    if (options.blur) transforms.push(`e_blur:${options.blur * 100}`);
    if (options.sharpen) transforms.push(`e_sharpen:${options.sharpen * 100}`);
    if (options.brightness) transforms.push(`e_brightness:${(options.brightness - 1) * 100}`);
    if (options.contrast) transforms.push(`e_contrast:${(options.contrast - 1) * 100}`);
    if (options.progressive) transforms.push('fl_progressive');
    if (options.stripMetadata) transforms.push('fl_strip_profile');
    
    //add crop mode for proper sizing
    if (options.width && options.height) {
      transforms.push('c_fill');
    }

    const uploadIndex = src.indexOf('/upload/');
    if (uploadIndex === -1) return src;

    return src.replace('/upload/', `/upload/${transforms.join(',')}/`);
  }

  //build Unsplash URL with optimization parameters
  private buildUnsplashUrl(src: string, options: ImageOptimizationOptions): string {
    const url = new URL(src);
    
    if (options.width) url.searchParams.set('w', options.width.toString());
    if (options.height) url.searchParams.set('h', options.height.toString());
    if (options.quality) url.searchParams.set('q', options.quality.toString());
    if (options.format && options.format !== 'auto') url.searchParams.set('fm', options.format);
    if (options.blur) url.searchParams.set('blur', (options.blur * 10).toString());
    
    //add fit parameter
    if (options.width && options.height) {
      url.searchParams.set('fit', 'crop');
    }

    return url.toString();
  }

  //generate Low Quality Image Placeholder
  private generateLQIP(src: string, options: { width: number; quality: number; format: ImageFormat; cdnProvider?: CDNProvider }): string {
    return this.buildOptimizedUrl(src, {
      width: options.width,
      quality: options.quality,
      format: options.format,
      blur: 0.5,
      stripMetadata: true,
      cdnProvider: options.cdnProvider,
    });
  }

  //estimate file size for given parameters
  private estimateFileSize(width: number, height: number, format: ImageFormat, quality: number): number {
    const pixels = width * height;
    
    //compression ratios based on format and quality
    const baseRatios = {
      avif: 0.3,
      webp: 0.6,
      jpeg: 1.0,
      png: 2.5,
      gif: 1.8,
    };

    //quality adjustment factor
    const qualityFactor = (quality / 100) ** 1.5;
    
    //calculate estimated size in bytes
    const estimatedSize = pixels * baseRatios[format] * qualityFactor * 0.75;
    
    return Math.round(estimatedSize);
  }

  //generate cache key for processed images
  private generateCacheKey(src: string, options: ImageOptimizationOptions): string {
    const keyData = {
      src,
      ...options,
    };
    
    return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '');
  }

  //batch process multiple images
  async processImageBatch(images: Array<{ src: string; options: ImageOptimizationOptions }>): Promise<ProcessedImage[]> {
    const promises = images.map(({ src, options }) => this.processImage(src, options));
    
    return Promise.all(promises);
  }

  //preload critical images
  async preloadCriticalImages(images: string[], options: ImageOptimizationOptions = {}): Promise<void> {
    const preloadPromises = images.map(async (src) => {
      const processed = await this.processImage(src, { ...options, priority: true });
      
      //create preload link
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = processed.optimizedUrl;
      
      //add format-specific type
      if (processed.format === 'webp') {
        link.type = 'image/webp';
      } else if (processed.format === 'avif') {
        link.type = 'image/avif';
      }
      
      document.head.appendChild(link);
    });

    await Promise.all(preloadPromises);
  }

  //get processing statistics
  getProcessingStats(): ProcessingStats {
    const cacheSize = this.cache.size;
    const queueSize = this.processingQueue.size;
    
    //analyze cached images
    const formatDistribution = new Map<ImageFormat, number>();
    let totalCompressionRatio = 0;
    let totalEstimatedSize = 0;

    for (const processed of this.cache.values()) {
      const count = formatDistribution.get(processed.format) || 0;
      formatDistribution.set(processed.format, count + 1);
      
      totalCompressionRatio += processed.compressionRatio;
      totalEstimatedSize += processed.estimatedSize;
    }

    return {
      cacheSize,
      queueSize,
      formatDistribution: Object.fromEntries(formatDistribution),
      averageCompressionRatio: cacheSize > 0 ? totalCompressionRatio / cacheSize : 0,
      totalEstimatedSavings: totalEstimatedSize,
      browserCapabilities: Object.fromEntries(this.browserCapabilities),
    };
  }

  //clear processing cache
  clearCache(): void {
    this.cache.clear();
  }
}

//processed image result interface
export interface ProcessedImage {
  optimizedUrl: string;
  lqipUrl: string;
  format: ImageFormat;
  width?: number;
  height?: number;
  quality: number;
  estimatedSize: number;
  compressionRatio: number;
  dpr: number;
  metadata: {
    originalSrc: string;
    processingTime: number;
    cdnProvider: CDNProvider;
    optimizations: {
      blur: number;
      sharpen: number;
      brightness: number;
      contrast: number;
      progressive: boolean;
      stripMetadata: boolean;
    };
  };
}

//responsive image set interface
export interface ResponsiveImageSet {
  sourceSets: Record<ImageFormat, string>;
  primaryUrl: string;
  lqipUrl: string;
  sizes: string;
  formats: ImageFormat[];
  lazyLoad: boolean;
  priority: boolean;
  metadata: {
    originalSrc: string;
    breakpoints: number[];
    dpr: number[];
    quality: number;
    generatedAt: number;
  };
}

//processing statistics interface
export interface ProcessingStats {
  cacheSize: number;
  queueSize: number;
  formatDistribution: Record<ImageFormat, number>;
  averageCompressionRatio: number;
  totalEstimatedSavings: number;
  browserCapabilities: Record<ImageFormat, boolean>;
}

//singleton instance
export const imageProcessor = new AdvancedImageProcessor();

//utility functions for easy usage
export const ImageUtils = {
  //quick image optimization
  optimize: (src: string, options?: ImageOptimizationOptions) => 
    imageProcessor.processImage(src, options),
  
  //generate responsive images
  responsive: (config: ResponsiveImageConfig) => 
    imageProcessor.generateResponsiveImageSet(config),
  
  //batch processing
  batch: (images: Array<{ src: string; options: ImageOptimizationOptions }>) =>
    imageProcessor.processImageBatch(images),
  
  //preload critical images
  preload: (images: string[], options?: ImageOptimizationOptions) =>
    imageProcessor.preloadCriticalImages(images, options),
  
  //get optimal format
  getFormat: (format: ImageFormat | 'auto' = 'auto') =>
    imageProcessor.getOptimalFormat(format),
  
  //get processing stats
  getStats: () => imageProcessor.getProcessingStats(),
  
  //clear cache
  clearCache: () => imageProcessor.clearCache(),
};