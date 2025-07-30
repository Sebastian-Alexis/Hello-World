// =============================================================================
// CLOUDFLARE CDN INTEGRATION - Global image and video distribution
// Provides Cloudflare Images and Stream integration with automatic optimization
// =============================================================================

//cloudflare configuration
export const CLOUDFLARE_CONFIG = {
  //cloudflare Images configuration
  IMAGES: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_IMAGES_API_TOKEN || '',
    baseUrl: 'https://imagedelivery.net',
    uploadUrl: 'https://api.cloudflare.com/client/v4/accounts',
    
    //supported variants
    VARIANTS: {
      thumbnail: 'w=150,h=150,fit=cover,q=85',
      small: 'w=400,h=300,fit=cover,q=85',
      medium: 'w=800,h=600,fit=cover,q=85',
      large: 'w=1600,h=1200,fit=cover,q=85',
      xlarge: 'w=2400,h=1800,fit=cover,q=85',
      hero: 'w=1920,h=1080,fit=cover,q=90',
      avatar: 'w=200,h=200,fit=crop,q=90,gravity=face',
      banner: 'w=1200,h=400,fit=cover,q=85',
    },
    
    //format priorities
    FORMAT_PRIORITY: ['avif', 'webp', 'jpeg', 'png'],
    
    //quality settings
    QUALITY_PRESETS: {
      low: 60,
      medium: 85,
      high: 95,
      lossless: 100,
    },
  },
  
  //cloudflare Stream configuration
  STREAM: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
    baseUrl: 'https://videodelivery.net',
    uploadUrl: 'https://api.cloudflare.com/client/v4/accounts',
    
    //supported resolutions
    RESOLUTIONS: {
      '360p': { width: 640, height: 360, bitrate: 400 },
      '480p': { width: 854, height: 480, bitrate: 800 },
      '720p': { width: 1280, height: 720, bitrate: 1500 },
      '1080p': { width: 1920, height: 1080, bitrate: 3000 },
      '1440p': { width: 2560, height: 1440, bitrate: 5000 },
      '4k': { width: 3840, height: 2160, bitrate: 8000 },
    },
  },
} as const;

//image transformation options
export interface CloudflareImageOptions {
  width?: number;
  height?: number;
  quality?: number | keyof typeof CLOUDFLARE_CONFIG.IMAGES.QUALITY_PRESETS;
  format?: 'avif' | 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
  gravity?: 'auto' | 'side' | 'face' | 'entropy' | 'top' | 'bottom' | 'left' | 'right';
  blur?: number;
  brightness?: number;
  contrast?: number;
  sharpen?: number;
  rotate?: number;
  trim?: boolean;
  background?: string;
  dpr?: number;
}

//video transformation options
export interface CloudflareVideoOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'low' | 'medium' | 'high';
  fps?: number;
  startTime?: number;
  endTime?: number;
  poster?: boolean;
  thumbnails?: boolean;
}

//cloudflare CDN manager class
export class CloudflareCDNManager {
  private accountId: string;
  private imagesApiToken: string;
  private streamApiToken: string;
  private cache: Map<string, any> = new Map();

  constructor() {
    this.accountId = CLOUDFLARE_CONFIG.IMAGES.accountId;
    this.imagesApiToken = CLOUDFLARE_CONFIG.IMAGES.apiToken;
    this.streamApiToken = CLOUDFLARE_CONFIG.STREAM.apiToken;
  }

  //upload image to Cloudflare Images
  async uploadImage(file: File | Blob, options: { 
    id?: string; 
    metadata?: Record<string, any>;
    requireSignedURLs?: boolean;
  } = {}): Promise<CloudflareImageUploadResult> {
    if (!this.imagesApiToken) {
      throw new Error('Cloudflare Images API token not configured');
    }

    const formData = new FormData();
    formData.append('file', file);
    
    if (options.id) {
      formData.append('id', options.id);
    }
    
    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }
    
    if (options.requireSignedURLs) {
      formData.append('requireSignedURLs', 'true');
    }

    const response = await fetch(
      `${CLOUDFLARE_CONFIG.IMAGES.uploadUrl}/${this.accountId}/images/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.imagesApiToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare Images upload failed: ${error}`);
    }

    const result = await response.json();
    
    return {
      id: result.result.id,
      filename: result.result.filename,
      uploaded: result.result.uploaded,
      requireSignedURLs: result.result.requireSignedURLs,
      variants: this.generateImageVariants(result.result.id),
      metadata: result.result.meta,
    };
  }

  //upload video to Cloudflare Stream
  async uploadVideo(file: File | Blob, options: {
    id?: string;
    metadata?: Record<string, any>;
    allowedOrigins?: string[];
    thumbnailTimestampPct?: number;
    watermark?: string;
  } = {}): Promise<CloudflareVideoUploadResult> {
    if (!this.streamApiToken) {
      throw new Error('Cloudflare Stream API token not configured');
    }

    const formData = new FormData();
    formData.append('file', file);
    
    if (options.metadata) {
      formData.append('meta', JSON.stringify(options.metadata));
    }
    
    if (options.allowedOrigins) {
      formData.append('allowedOrigins', JSON.stringify(options.allowedOrigins));
    }
    
    if (options.thumbnailTimestampPct) {
      formData.append('thumbnailTimestampPct', options.thumbnailTimestampPct.toString());
    }

    const response = await fetch(
      `${CLOUDFLARE_CONFIG.STREAM.uploadUrl}/${this.accountId}/stream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.streamApiToken}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Cloudflare Stream upload failed: ${error}`);
    }

    const result = await response.json();
    
    return {
      uid: result.result.uid,
      status: result.result.status,
      thumbnail: result.result.thumbnail,
      playback: result.result.playback,
      preview: result.result.preview,
      duration: result.result.duration,
      input: {
        width: result.result.input?.width,
        height: result.result.input?.height,
      },
      uploaded: result.result.uploaded,
      metadata: result.result.meta,
    };
  }

  //generate optimized image URL
  generateImageUrl(imageId: string, options: CloudflareImageOptions = {}): string {
    const {
      width,
      height,
      quality = 85,
      format = 'auto',
      fit = 'cover',
      gravity = 'auto',
      blur,
      brightness,
      contrast,
      sharpen,
      rotate,
      trim,
      background,
      dpr = 1,
    } = options;

    const transformations: string[] = [];

    //dimensions
    if (width) transformations.push(`w=${width}`);
    if (height) transformations.push(`h=${height}`);
    
    //quality
    const qualityValue = typeof quality === 'string' ? 
      CLOUDFLARE_CONFIG.IMAGES.QUALITY_PRESETS[quality] : 
      quality;
    transformations.push(`q=${qualityValue}`);
    
    //format
    if (format !== 'auto') {
      transformations.push(`f=${format}`);
    }
    
    //fit and gravity
    transformations.push(`fit=${fit}`);
    if (gravity !== 'auto') {
      transformations.push(`gravity=${gravity}`);
    }
    
    //device pixel ratio
    if (dpr !== 1) {
      transformations.push(`dpr=${dpr}`);
    }
    
    //effects
    if (blur !== undefined) transformations.push(`blur=${blur}`);
    if (brightness !== undefined) transformations.push(`brightness=${brightness}`);
    if (contrast !== undefined) transformations.push(`contrast=${contrast}`);
    if (sharpen !== undefined) transformations.push(`sharpen=${sharpen}`);
    if (rotate !== undefined) transformations.push(`rotate=${rotate}`);
    if (trim) transformations.push('trim=auto');
    if (background) transformations.push(`background=${background}`);
    
    //additional optimizations
    transformations.push('metadata=none'); //strip metadata for smaller files
    transformations.push('onerror=redirect'); //fallback handling

    return `${CLOUDFLARE_CONFIG.IMAGES.baseUrl}/${imageId}/${transformations.join(',')}`;
  }

  //generate responsive image set
  generateResponsiveImageSet(imageId: string, options: {
    breakpoints?: number[];
    formats?: ('avif' | 'webp' | 'jpeg')[];
    quality?: number;
    fit?: CloudflareImageOptions['fit'];
    dpr?: number[];
  } = {}): ResponsiveImageSet {
    const {
      breakpoints = [320, 640, 768, 1024, 1280, 1600, 1920],
      formats = ['avif', 'webp', 'jpeg'],
      quality = 85,
      fit = 'cover',
      dpr = [1, 2],
    } = options;

    const sourceSets: Record<string, string> = {};

    //generate source sets for each format
    for (const format of formats) {
      const sources: string[] = [];
      
      for (const breakpoint of breakpoints) {
        for (const devicePixelRatio of dpr) {
          const effectiveWidth = breakpoint * devicePixelRatio;
          const url = this.generateImageUrl(imageId, {
            width: effectiveWidth,
            quality,
            format,
            fit,
            dpr: devicePixelRatio,
          });
          
          const descriptor = dpr.length > 1 ? 
            `${url} ${effectiveWidth}w ${devicePixelRatio}x` :
            `${url} ${effectiveWidth}w`;
          
          sources.push(descriptor);
        }
      }
      
      sourceSets[format] = sources.join(', ');
    }

    //generate primary and LQIP URLs
    const primaryUrl = this.generateImageUrl(imageId, {
      width: breakpoints[Math.floor(breakpoints.length / 2)],
      quality,
      format: 'webp',
      fit,
    });

    const lqipUrl = this.generateImageUrl(imageId, {
      width: 40,
      quality: 10,
      format: 'jpeg',
      fit,
      blur: 5,
    });

    return {
      sourceSets,
      primaryUrl,
      lqipUrl,
      baseUrl: `${CLOUDFLARE_CONFIG.IMAGES.baseUrl}/${imageId}`,
      metadata: {
        imageId,
        breakpoints,
        formats,
        quality,
        generatedAt: Date.now(),
      },
    };
  }

  //generate video streaming URLs
  generateVideoUrl(videoId: string, options: CloudflareVideoOptions = {}): string {
    const {
      width,
      height,
      quality = 'auto',
      fps,
      startTime,
      endTime,
    } = options;

    const transformations: string[] = [];

    //dimensions
    if (width && height) {
      transformations.push(`${width}x${height}`);
    }
    
    //quality/bitrate
    if (quality !== 'auto') {
      const resolution = Object.entries(CLOUDFLARE_CONFIG.STREAM.RESOLUTIONS)
        .find(([, config]) => config.width === width);
      
      if (resolution) {
        transformations.push(`br=${resolution[1].bitrate}`);
      }
    }
    
    //frame rate
    if (fps) transformations.push(`fps=${fps}`);
    
    //time range
    if (startTime !== undefined) transformations.push(`start=${startTime}`);
    if (endTime !== undefined) transformations.push(`end=${endTime}`);

    const transformString = transformations.length > 0 ? 
      `/${transformations.join(',')}` : '';

    return `${CLOUDFLARE_CONFIG.STREAM.baseUrl}/${videoId}${transformString}/mp4`;
  }

  //generate video poster/thumbnail
  generateVideoPoster(videoId: string, options: {
    time?: number | string;
    width?: number;
    height?: number;
    fit?: 'crop' | 'scale' | 'pad';
  } = {}): string {
    const {
      time = '5s',
      width = 1280,
      height = 720,
      fit = 'crop',
    } = options;

    const params = new URLSearchParams({
      time: time.toString(),
      width: width.toString(),
      height: height.toString(),
      fit,
    });

    return `${CLOUDFLARE_CONFIG.STREAM.baseUrl}/${videoId}/thumbnails/thumbnail.jpg?${params}`;
  }

  //generate all image variants
  private generateImageVariants(imageId: string): Record<string, string> {
    const variants: Record<string, string> = {};
    
    for (const [variantName, transformation] of Object.entries(CLOUDFLARE_CONFIG.IMAGES.VARIANTS)) {
      variants[variantName] = `${CLOUDFLARE_CONFIG.IMAGES.baseUrl}/${imageId}/${transformation}`;
    }
    
    return variants;
  }

  //batch optimize images
  async batchOptimizeImages(imageIds: string[], options: CloudflareImageOptions = {}): Promise<BatchOptimizationResult[]> {
    const results: BatchOptimizationResult[] = [];
    
    //process in chunks to avoid rate limiting
    const chunks = this.chunkArray(imageIds, 10);
    
    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (imageId) => {
        try {
          const responsiveSet = this.generateResponsiveImageSet(imageId, options);
          const optimizedUrl = this.generateImageUrl(imageId, options);
          
          //estimate file size savings
          const originalSize = await this.estimateImageSize(imageId, { width: 1920, quality: 100 });
          const optimizedSize = await this.estimateImageSize(imageId, options);
          const savings = ((originalSize - optimizedSize) / originalSize) * 100;
          
          return {
            imageId,
            success: true,
            optimizedUrl,
            responsiveSet,
            estimatedSavings: savings,
            originalSize,
            optimizedSize,
          };
        } catch (error) {
          return {
            imageId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
      
      //rate limiting delay
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  //estimate image file size
  private async estimateImageSize(imageId: string, options: CloudflareImageOptions): Promise<number> {
    const cacheKey = `size-${imageId}-${JSON.stringify(options)}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }
    
    //make HEAD request to get content-length
    try {
      const url = this.generateImageUrl(imageId, options);
      const response = await fetch(url, { method: 'HEAD' });
      const contentLength = parseInt(response.headers.get('content-length') || '0');
      
      this.cache.set(cacheKey, contentLength);
      return contentLength;
    } catch {
      //fallback estimation based on dimensions and quality
      const { width = 800, height = 600, quality = 85 } = options;
      const pixels = width * height;
      const qualityFactor = (typeof quality === 'number' ? quality : 85) / 100;
      const estimatedSize = Math.round(pixels * qualityFactor * 0.75);
      
      this.cache.set(cacheKey, estimatedSize);
      return estimatedSize;
    }
  }

  //utility method to chunk arrays
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  //get analytics for images
  async getImageAnalytics(imageId?: string, timeframe: 'day' | 'week' | 'month' = 'day'): Promise<ImageAnalytics> {
    if (!this.imagesApiToken) {
      throw new Error('Cloudflare Images API token not configured');
    }

    const params = new URLSearchParams({ timeframe });
    if (imageId) params.append('imageId', imageId);

    const response = await fetch(
      `${CLOUDFLARE_CONFIG.IMAGES.uploadUrl}/${this.accountId}/images/v1/stats?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.imagesApiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch image analytics');
    }

    const result = await response.json();
    return result.result;
  }

  //get video analytics
  async getVideoAnalytics(videoId?: string, timeframe: 'day' | 'week' | 'month' = 'day'): Promise<VideoAnalytics> {
    if (!this.streamApiToken) {
      throw new Error('Cloudflare Stream API token not configured');
    }

    const params = new URLSearchParams({ timeframe });
    if (videoId) params.append('videoId', videoId);

    const response = await fetch(
      `${CLOUDFLARE_CONFIG.STREAM.uploadUrl}/${this.accountId}/stream/analytics?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.streamApiToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch video analytics');
    }

    const result = await response.json();
    return result.result;
  }

  //purge CDN cache
  async purgeCache(urls: string[]): Promise<boolean> {
    //cloudflare Images and Stream handle caching automatically
    //this would be implemented if using Cloudflare's general CDN
    return true;
  }

  //clear local cache
  clearLocalCache(): void {
    this.cache.clear();
  }
}

//interfaces
export interface CloudflareImageUploadResult {
  id: string;
  filename: string;
  uploaded: string;
  requireSignedURLs: boolean;
  variants: Record<string, string>;
  metadata: Record<string, any>;
}

export interface CloudflareVideoUploadResult {
  uid: string;
  status: string;
  thumbnail: string;
  playback: {
    hls: string;
    dash: string;
  };
  preview: string;
  duration: number;
  input: {
    width?: number;
    height?: number;
  };
  uploaded: string;
  metadata: Record<string, any>;
}

export interface ResponsiveImageSet {
  sourceSets: Record<string, string>;
  primaryUrl: string;
  lqipUrl: string;
  baseUrl: string;
  metadata: {
    imageId: string;
    breakpoints: number[];
    formats: string[];
    quality: number;
    generatedAt: number;
  };
}

export interface BatchOptimizationResult {
  imageId: string;
  success: boolean;
  optimizedUrl?: string;
  responsiveSet?: ResponsiveImageSet;
  estimatedSavings?: number;
  originalSize?: number;
  optimizedSize?: number;
  error?: string;
}

export interface ImageAnalytics {
  requests: number;
  bandwidthBytes: number;
  cacheCoverage: number;
  countries: Record<string, number>;
  formats: Record<string, number>;
  variants: Record<string, number>;
}

export interface VideoAnalytics {
  views: number;
  minutes: number;
  bandwidth: number;
  countries: Record<string, number>;
  qualities: Record<string, number>;
  devices: Record<string, number>;
}

//singleton instance
export const cloudflareCDN = new CloudflareCDNManager();

//utility functions
export const CloudflareUtils = {
  //quick image optimization
  optimizeImage: (imageId: string, options?: CloudflareImageOptions) =>
    cloudflareCDN.generateImageUrl(imageId, options),
  
  //generate responsive images
  responsive: (imageId: string, options?: any) =>
    cloudflareCDN.generateResponsiveImageSet(imageId, options),
  
  //optimize video
  optimizeVideo: (videoId: string, options?: CloudflareVideoOptions) =>
    cloudflareCDN.generateVideoUrl(videoId, options),
  
  //video poster
  poster: (videoId: string, options?: any) =>
    cloudflareCDN.generateVideoPoster(videoId, options),
  
  //batch optimization
  batch: (imageIds: string[], options?: CloudflareImageOptions) =>
    cloudflareCDN.batchOptimizeImages(imageIds, options),
  
  //upload image
  uploadImage: (file: File | Blob, options?: any) =>
    cloudflareCDN.uploadImage(file, options),
  
  //upload video
  uploadVideo: (file: File | Blob, options?: any) =>
    cloudflareCDN.uploadVideo(file, options),
};