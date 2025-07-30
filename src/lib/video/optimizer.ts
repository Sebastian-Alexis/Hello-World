// =============================================================================
// VIDEO OPTIMIZER - Advanced video processing and adaptive streaming
// Provides comprehensive video optimization, format selection, and streaming
// =============================================================================

//video optimization configuration
export const VIDEO_CONFIG = {
  //supported formats in order of preference
  FORMATS: ['av1', 'vp9', 'h264', 'h265'] as const,
  
  //container formats
  CONTAINERS: ['mp4', 'webm', 'mov'] as const,
  
  //quality presets
  QUALITY_PRESETS: {
    ultra: { bitrate: 8000, crf: 18, name: '4K Ultra' },
    high: { bitrate: 4000, crf: 23, name: '1080p High' },
    medium: { bitrate: 2000, crf: 28, name: '720p Medium' },
    low: { bitrate: 800, crf: 32, name: '480p Low' },
    mobile: { bitrate: 400, crf: 35, name: '360p Mobile' },
  },
  
  //adaptive streaming resolutions
  RESOLUTIONS: [
    { width: 3840, height: 2160, label: '4K', bitrate: 8000 },
    { width: 2560, height: 1440, label: '1440p', bitrate: 5000 },
    { width: 1920, height: 1080, label: '1080p', bitrate: 3000 },
    { width: 1280, height: 720, label: '720p', bitrate: 1500 },
    { width: 854, height: 480, label: '480p', bitrate: 800 },
    { width: 640, height: 360, label: '360p', bitrate: 400 },
  ],
  
  //maximum file sizes (MB)
  MAX_FILE_SIZE: {
    mobile: 50,
    desktop: 200,
    streaming: 500,
  },
  
  //CDN configurations for video
  CDN_PROVIDERS: {
    cloudflare_stream: {
      baseUrl: 'https://videodelivery.net',
      formats: ['mp4', 'webm'],
      features: ['adaptive_streaming', 'thumbnails', 'watermarks', 'trim'],
    },
    mux: {
      baseUrl: 'https://stream.mux.com',
      formats: ['mp4', 'webm', 'hls'],
      features: ['adaptive_streaming', 'analytics', 'thumbnails', 'gif_generation'],
    },
  },
} as const;

export type VideoFormat = typeof VIDEO_CONFIG.FORMATS[number];
export type VideoContainer = typeof VIDEO_CONFIG.CONTAINERS[number];
export type QualityPreset = keyof typeof VIDEO_CONFIG.QUALITY_PRESETS;
export type VideoCDNProvider = keyof typeof VIDEO_CONFIG.CDN_PROVIDERS;

//video optimization options
export interface VideoOptimizationOptions {
  width?: number;
  height?: number;
  quality?: QualityPreset | number;
  format?: VideoFormat | 'auto';
  container?: VideoContainer;
  bitrate?: number;
  framerate?: number;
  duration?: number;
  startTime?: number;
  endTime?: number;
  muted?: boolean;
  autoplay?: boolean;
  poster?: string;
  watermark?: string;
  cdnProvider?: VideoCDNProvider;
  adaptiveStreaming?: boolean;
  generateThumbnails?: boolean;
  thumbnailCount?: number;
}

//adaptive streaming configuration
export interface AdaptiveStreamingConfig {
  src: string;
  resolutions?: typeof VIDEO_CONFIG.RESOLUTIONS;
  formats?: VideoFormat[];
  autoQuality?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  fallbackSrc?: string;
  poster?: string;
  thumbnails?: string[];
}

//advanced video processor class
export class AdvancedVideoProcessor {
  private browserCapabilities: Map<string, boolean> = new Map();
  private processingQueue: Map<string, Promise<ProcessedVideo>> = new Map();
  private cache: Map<string, ProcessedVideo> = new Map();
  private qualityAdapter: QualityAdapter;

  constructor() {
    this.qualityAdapter = new QualityAdapter();
    this.detectBrowserCapabilities();
    this.initializeAdaptiveStreaming();
  }

  //detect browser video capabilities
  private async detectBrowserCapabilities(): Promise<void> {
    if (typeof window === 'undefined') return;

    const video = document.createElement('video');
    
    //test codec support
    const codecs = {
      'av1': 'video/mp4; codecs="av01.0.08M.08"',
      'vp9': 'video/webm; codecs="vp9"',
      'h264': 'video/mp4; codecs="avc1.42E01E"',
      'h265': 'video/mp4; codecs="hev1.1.6.L93.B0"',
    };

    for (const [format, codec] of Object.entries(codecs)) {
      const support = video.canPlayType(codec);
      this.browserCapabilities.set(format, support === 'probably' || support === 'maybe');
    }

    //test container support
    const containers = {
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mov': 'video/quicktime',
    };

    for (const [container, mimeType] of Object.entries(containers)) {
      const support = video.canPlayType(mimeType);
      this.browserCapabilities.set(container, support === 'probably' || support === 'maybe');
    }
  }

  //get optimal video format for current browser
  getOptimalFormat(requestedFormat: VideoFormat | 'auto' = 'auto'): VideoFormat {
    if (requestedFormat !== 'auto') {
      return requestedFormat;
    }

    //prefer formats in order of compression efficiency
    for (const format of VIDEO_CONFIG.FORMATS) {
      if (this.browserCapabilities.get(format)) {
        return format;
      }
    }

    //fallback to H.264
    return 'h264';
  }

  //process single video with comprehensive options
  async processVideo(src: string, options: VideoOptimizationOptions = {}): Promise<ProcessedVideo> {
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
    const processingPromise = this.performVideoProcessing(src, options);
    this.processingQueue.set(cacheKey, processingPromise);

    try {
      const result = await processingPromise;
      this.cache.set(cacheKey, result);
      return result;
    } finally {
      this.processingQueue.delete(cacheKey);
    }
  }

  //perform actual video processing
  private async performVideoProcessing(src: string, options: VideoOptimizationOptions): Promise<ProcessedVideo> {
    const {
      width,
      height,
      quality = 'medium',
      format = 'auto',
      container = 'mp4',
      bitrate,
      framerate,
      duration,
      startTime,
      endTime,
      muted = false,
      autoplay = false,
      poster,
      watermark,
      cdnProvider = 'cloudflare_stream',
      adaptiveStreaming = true,
      generateThumbnails = true,
      thumbnailCount = 10,
    } = options;

    const optimalFormat = this.getOptimalFormat(format);
    const qualitySettings = typeof quality === 'string' ? 
      VIDEO_CONFIG.QUALITY_PRESETS[quality] : 
      { bitrate: bitrate || 2000, crf: 28, name: 'Custom' };

    //build optimized video URL
    const optimizedUrl = this.buildOptimizedVideoUrl(src, {
      width,
      height,
      format: optimalFormat,
      container,
      bitrate: qualitySettings.bitrate,
      framerate,
      startTime,
      endTime,
      cdnProvider,
    });

    //generate adaptive streaming manifest
    const adaptiveManifest = adaptiveStreaming ? 
      await this.generateAdaptiveManifest(src, optimalFormat, cdnProvider) : 
      null;

    //generate poster image if not provided
    const posterUrl = poster || await this.generatePosterImage(src, {
      width: width || 1280,
      height: height || 720,
      timeOffset: duration ? duration * 0.1 : 5, //10% into video or 5 seconds
      cdnProvider,
    });

    //generate thumbnails for scrubbing
    const thumbnails = generateThumbnails ? 
      await this.generateThumbnailStrip(src, thumbnailCount, cdnProvider) : 
      [];

    //estimate file size and compression
    const originalSize = this.estimateVideoSize(width || 1280, height || 720, duration || 60, 'h264', 3000);
    const optimizedSize = this.estimateVideoSize(width || 1280, height || 720, duration || 60, optimalFormat, qualitySettings.bitrate);
    const compressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;

    return {
      optimizedUrl,
      adaptiveManifest,
      posterUrl,
      thumbnails,
      format: optimalFormat,
      container,
      width: width || 1280,
      height: height || 720,
      bitrate: qualitySettings.bitrate,
      framerate: framerate || 30,
      duration: duration || 0,
      estimatedSize: optimizedSize,
      compressionRatio,
      playbackOptions: {
        muted,
        autoplay,
        preload: 'metadata',
        controls: true,
        playsInline: true,
      },
      metadata: {
        originalSrc: src,
        processingTime: Date.now(),
        cdnProvider,
        qualitySettings,
        adaptiveStreaming,
      },
    };
  }

  //generate adaptive streaming manifest
  private async generateAdaptiveManifest(src: string, format: VideoFormat, cdnProvider: VideoCDNProvider): Promise<AdaptiveManifest> {
    const variants: AdaptiveVariant[] = [];

    for (const resolution of VIDEO_CONFIG.RESOLUTIONS) {
      const variantUrl = this.buildOptimizedVideoUrl(src, {
        width: resolution.width,
        height: resolution.height,
        format,
        bitrate: resolution.bitrate,
        cdnProvider,
      });

      variants.push({
        url: variantUrl,
        width: resolution.width,
        height: resolution.height,
        bitrate: resolution.bitrate,
        label: resolution.label,
        codecs: this.getCodecString(format),
      });
    }

    return {
      type: 'adaptive',
      format: format === 'h264' ? 'hls' : 'dash',
      variants,
      defaultVariant: variants.find(v => v.label === '720p') || variants[0],
    };
  }

  //build optimized video URL for various CDN providers
  private buildOptimizedVideoUrl(src: string, options: {
    width?: number;
    height?: number;
    format: VideoFormat;
    container?: VideoContainer;
    bitrate?: number;
    framerate?: number;
    startTime?: number;
    endTime?: number;
    cdnProvider: VideoCDNProvider;
  }): string {
    if (src.includes('videodelivery.net')) {
      return this.buildCloudflareStreamUrl(src, options);
    } else if (src.includes('stream.mux.com')) {
      return this.buildMuxUrl(src, options);
    }

    //fallback for other sources
    return src;
  }

  //build Cloudflare Stream URL
  private buildCloudflareStreamUrl(src: string, options: any): string {
    const params: string[] = [];
    
    if (options.width && options.height) {
      params.push(`${options.width}x${options.height}`);
    }
    if (options.bitrate) params.push(`br=${options.bitrate}`);
    if (options.framerate) params.push(`fps=${options.framerate}`);
    if (options.startTime) params.push(`start=${options.startTime}`);
    if (options.endTime) params.push(`end=${options.endTime}`);
    
    return `${src}/${params.join(',')}/${options.container || 'mp4'}`;
  }

  //build Mux URL
  private buildMuxUrl(src: string, options: any): string {
    const url = new URL(src);
    
    if (options.width) url.searchParams.set('width', options.width.toString());
    if (options.height) url.searchParams.set('height', options.height.toString());
    if (options.bitrate) url.searchParams.set('bitrate', options.bitrate.toString());
    if (options.framerate) url.searchParams.set('fps', options.framerate.toString());
    if (options.startTime) url.searchParams.set('start', options.startTime.toString());
    if (options.endTime) url.searchParams.set('end', options.endTime.toString());
    
    return url.toString();
  }

  //generate poster image from video
  private async generatePosterImage(src: string, options: {
    width: number;
    height: number;
    timeOffset: number;
    cdnProvider: VideoCDNProvider;
  }): Promise<string> {
    if (src.includes('videodelivery.net')) {
      return `${src}/thumbnails/thumbnail.jpg?time=${options.timeOffset}s&width=${options.width}&height=${options.height}`;
    } else if (src.includes('stream.mux.com')) {
      return `${src}/thumbnail.jpg?time=${options.timeOffset}&width=${options.width}&height=${options.height}`;
    }

    //fallback poster generation would require server-side processing
    return '/images/video-poster-placeholder.jpg';
  }

  //generate thumbnail strip for video scrubbing
  private async generateThumbnailStrip(src: string, count: number, cdnProvider: VideoCDNProvider): Promise<string[]> {
    const thumbnails: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const timeOffset = (i / count) * 100; //percentage through video
      
      if (src.includes('videodelivery.net')) {
        thumbnails.push(`${src}/thumbnails/thumbnail.jpg?time=${timeOffset}%&width=160&height=90`);
      } else if (src.includes('stream.mux.com')) {
        thumbnails.push(`${src}/thumbnail.jpg?time=${timeOffset}%&width=160&height=90`);
      }
    }

    return thumbnails;
  }

  //get codec string for format
  private getCodecString(format: VideoFormat): string {
    const codecStrings = {
      'av1': 'av01.0.08M.08',
      'vp9': 'vp9',
      'h264': 'avc1.42E01E',
      'h265': 'hev1.1.6.L93.B0',
    };

    return codecStrings[format];
  }

  //estimate video file size
  private estimateVideoSize(width: number, height: number, duration: number, format: VideoFormat, bitrate: number): number {
    //compression efficiency factors
    const compressionFactors = {
      'av1': 0.5,   //50% more efficient than H.264
      'vp9': 0.7,   //30% more efficient than H.264
      'h264': 1.0,  //baseline
      'h265': 0.6,  //40% more efficient than H.264
    };

    //calculate size in megabytes
    const baseSizeMB = (bitrate * duration) / (8 * 1000); //convert kbps to MB
    const compressionFactor = compressionFactors[format];
    
    return Math.round(baseSizeMB * compressionFactor);
  }

  //generate cache key for processed videos
  private generateCacheKey(src: string, options: VideoOptimizationOptions): string {
    const keyData = { src, ...options };
    return btoa(JSON.stringify(keyData)).replace(/[+/=]/g, '');
  }

  //initialize adaptive streaming quality selection
  private initializeAdaptiveStreaming(): void {
    if (typeof window === 'undefined') return;

    //monitor network conditions for quality adaptation
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      connection.addEventListener('change', () => {
        this.qualityAdapter.updateNetworkConditions({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
        });
      });
    }
  }

  //batch process multiple videos
  async processVideoBatch(videos: Array<{ src: string; options: VideoOptimizationOptions }>): Promise<ProcessedVideo[]> {
    const promises = videos.map(({ src, options }) => this.processVideo(src, options));
    return Promise.all(promises);
  }

  //get processing statistics
  getProcessingStats(): VideoProcessingStats {
    const cacheSize = this.cache.size;
    const queueSize = this.processingQueue.size;
    
    //analyze cached videos
    const formatDistribution = new Map<VideoFormat, number>();
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
      networkConditions: this.qualityAdapter.getCurrentConditions(),
    };
  }

  //clear processing cache
  clearCache(): void {
    this.cache.clear();
  }
}

//quality adapter for adaptive streaming
class QualityAdapter {
  private networkConditions: NetworkConditions = {
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
  };

  updateNetworkConditions(conditions: Partial<NetworkConditions>): void {
    this.networkConditions = { ...this.networkConditions, ...conditions };
  }

  getCurrentConditions(): NetworkConditions {
    return this.networkConditions;
  }

  getRecommendedQuality(): QualityPreset {
    const { effectiveType, downlink } = this.networkConditions;

    if (effectiveType === 'slow-2g' || downlink < 0.5) return 'mobile';
    if (effectiveType === '2g' || downlink < 1.5) return 'low';
    if (effectiveType === '3g' || downlink < 5) return 'medium';
    if (downlink >= 10) return 'high';
    
    return 'medium';
  }
}

//interfaces
export interface ProcessedVideo {
  optimizedUrl: string;
  adaptiveManifest: AdaptiveManifest | null;
  posterUrl: string;
  thumbnails: string[];
  format: VideoFormat;
  container: VideoContainer;
  width: number;
  height: number;
  bitrate: number;
  framerate: number;
  duration: number;
  estimatedSize: number;
  compressionRatio: number;
  playbackOptions: {
    muted: boolean;
    autoplay: boolean;
    preload: 'none' | 'metadata' | 'auto';
    controls: boolean;
    playsInline: boolean;
  };
  metadata: {
    originalSrc: string;
    processingTime: number;
    cdnProvider: VideoCDNProvider;
    qualitySettings: any;
    adaptiveStreaming: boolean;
  };
}

export interface AdaptiveManifest {
  type: 'adaptive';
  format: 'hls' | 'dash';
  variants: AdaptiveVariant[];
  defaultVariant: AdaptiveVariant;
}

export interface AdaptiveVariant {
  url: string;
  width: number;
  height: number;
  bitrate: number;
  label: string;
  codecs: string;
}

export interface NetworkConditions {
  effectiveType: '4g' | '3g' | '2g' | 'slow-2g';
  downlink: number;
  rtt: number;
}

export interface VideoProcessingStats {
  cacheSize: number;
  queueSize: number;
  formatDistribution: Record<VideoFormat, number>;
  averageCompressionRatio: number;
  totalEstimatedSavings: number;
  browserCapabilities: Record<string, boolean>;
  networkConditions: NetworkConditions;
}

//singleton instance
export const videoProcessor = new AdvancedVideoProcessor();

//utility functions for easy usage
export const VideoUtils = {
  //quick video optimization
  optimize: (src: string, options?: VideoOptimizationOptions) => 
    videoProcessor.processVideo(src, options),
  
  //batch processing
  batch: (videos: Array<{ src: string; options: VideoOptimizationOptions }>) =>
    videoProcessor.processVideoBatch(videos),
  
  //get optimal format
  getFormat: (format: VideoFormat | 'auto' = 'auto') =>
    videoProcessor.getOptimalFormat(format),
  
  //get processing stats
  getStats: () => videoProcessor.getProcessingStats(),
  
  //clear cache
  clearCache: () => videoProcessor.clearCache(),
};