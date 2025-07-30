// =============================================================================
// IMAGE OPTIMIZATION PIPELINE - Automated build-time and runtime optimization
// Provides comprehensive image processing pipeline with intelligent optimization
// =============================================================================

import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { cloudflareCDN, type CloudflareImageOptions } from '../cdn/cloudflare';

//pipeline configuration
export const PIPELINE_CONFIG = {
  //supported input formats
  INPUT_FORMATS: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.avif', '.svg'],
  
  //output formats in order of preference
  OUTPUT_FORMATS: ['avif', 'webp', 'jpeg', 'png'] as const,
  
  //quality settings by format
  QUALITY_SETTINGS: {
    avif: { quality: 75, effort: 4 },
    webp: { quality: 85, effort: 4 },
    jpeg: { quality: 85, progressive: true, mozjpeg: true },
    png: { quality: 95, progressive: false },
  },
  
  //responsive breakpoints
  BREAKPOINTS: [320, 480, 640, 768, 1024, 1280, 1600, 1920, 2560],
  
  //device pixel ratios
  DPR_VARIANTS: [1, 1.5, 2],
  
  //optimization thresholds
  THRESHOLDS: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    minCompressionRatio: 0.1, // 10% minimum savings
    maxDimensions: { width: 3840, height: 2160 },
    minDimensions: { width: 32, height: 32 },
  },
  
  //processing options
  PROCESSING: {
    stripMetadata: true,
    progressive: true,
    interlace: true,
    optimizeScans: true,
    trellis: true,
    overshoot: true,
    optimize: true,
  },
} as const;

export type OutputFormat = typeof PIPELINE_CONFIG.OUTPUT_FORMATS[number];

//pipeline processing options
export interface PipelineOptions {
  inputDir: string;
  outputDir: string;
  formats?: OutputFormat[];
  breakpoints?: number[];
  dprVariants?: number[];
  quality?: Partial<typeof PIPELINE_CONFIG.QUALITY_SETTINGS>;
  cloudflareUpload?: boolean;
  generateManifest?: boolean;
  preserveOriginal?: boolean;
  overwrite?: boolean;
  verbose?: boolean;
}

//optimization result
export interface OptimizationResult {
  originalPath: string;
  originalSize: number;
  optimizedVariants: OptimizedVariant[];
  totalSavings: number;
  compressionRatio: number;
  metadata: ImageMetadata;
  cloudflareId?: string;
  processingTime: number;
  errors: string[];
}

//optimized variant info
export interface OptimizedVariant {
  path: string;
  format: OutputFormat;
  width: number;
  height: number;
  dpr: number;
  size: number;
  url?: string;
  savings: number;
}

//image metadata
export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  space: string;
  channels: number;
  depth: string;
  density: number;
  hasAlpha: boolean;
  isAnimated: boolean;
  pages: number;
}

//advanced image optimization pipeline
export class ImageOptimizationPipeline {
  private options: Required<PipelineOptions>;
  private processingQueue: Map<string, Promise<OptimizationResult>> = new Map();
  private results: OptimizationResult[] = [];
  private totalSavings = 0;

  constructor(options: PipelineOptions) {
    this.options = {
      formats: PIPELINE_CONFIG.OUTPUT_FORMATS,
      breakpoints: PIPELINE_CONFIG.BREAKPOINTS,
      dprVariants: PIPELINE_CONFIG.DPR_VARIANTS,
      quality: PIPELINE_CONFIG.QUALITY_SETTINGS,
      cloudflareUpload: false,
      generateManifest: true,
      preserveOriginal: true,
      overwrite: false,
      verbose: false,
      ...options,
    };
  }

  //run the complete optimization pipeline
  async run(): Promise<PipelineResults> {
    const startTime = Date.now();
    
    if (this.options.verbose) {
      console.log('🚀 Starting image optimization pipeline...');
    }

    try {
      //ensure output directory exists
      await this.ensureDirectory(this.options.outputDir);

      //discover images
      const imagePaths = await this.discoverImages();
      
      if (this.options.verbose) {
        console.log(`📸 Found ${imagePaths.length} images to process`);
      }

      //process images in batches
      const batchSize = 5; //prevent overwhelming the system
      const batches = this.chunkArray(imagePaths, batchSize);
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        if (this.options.verbose) {
          console.log(`⚙️  Processing batch ${i + 1}/${batches.length} (${batch.length} images)`);
        }

        const batchPromises = batch.map(imagePath => this.processImage(imagePath));
        const batchResults = await Promise.allSettled(batchPromises);
        
        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            this.results.push(result.value);
            this.totalSavings += result.value.totalSavings;
          } else {
            console.error('❌ Image processing failed:', result.reason);
          }
        });
      }

      //generate optimization manifest
      const manifest = this.options.generateManifest ? 
        await this.generateManifest() : 
        null;

      //generate summary
      const summary = this.generateSummary();
      const totalTime = Date.now() - startTime;

      if (this.options.verbose) {
        console.log('✅ Pipeline completed successfully!');
        console.log(`📊 Processed ${this.results.length} images in ${totalTime}ms`);
        console.log(`💾 Total savings: ${this.formatBytes(this.totalSavings)}`);
      }

      return {
        results: this.results,
        manifest,
        summary,
        totalTime,
        success: true,
      };

    } catch (error) {
      console.error('💥 Pipeline failed:', error);
      return {
        results: this.results,
        manifest: null,
        summary: this.generateSummary(),
        totalTime: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  //discover images in input directory
  private async discoverImages(): Promise<string[]> {
    const extensions = PIPELINE_CONFIG.INPUT_FORMATS.join('|');
    const pattern = `${this.options.inputDir}/**/*{${extensions}}`;
    
    const files = await glob(pattern, {
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    });

    return files.filter(file => {
      const stats = require('fs').statSync(file);
      return stats.size <= PIPELINE_CONFIG.THRESHOLDS.maxFileSize;
    });
  }

  //process single image
  private async processImage(imagePath: string): Promise<OptimizationResult> {
    const cacheKey = imagePath;
    
    //return cached promise if already processing
    if (this.processingQueue.has(cacheKey)) {
      return this.processingQueue.get(cacheKey)!;
    }

    //start processing
    const processingPromise = this.performImageProcessing(imagePath);
    this.processingQueue.set(cacheKey, processingPromise);

    try {
      const result = await processingPromise;
      return result;
    } finally {
      this.processingQueue.delete(cacheKey);
    }
  }

  //perform actual image processing
  private async performImageProcessing(imagePath: string): Promise<OptimizationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      //get original image info
      const originalStats = await fs.stat(imagePath);
      const originalSize = originalStats.size;
      
      //load and analyze image
      const image = sharp(imagePath);
      const metadata = await this.extractMetadata(image);
      
      if (this.options.verbose) {
        console.log(`🔍 Processing: ${path.basename(imagePath)} (${this.formatBytes(originalSize)})`);
      }

      //validate image dimensions
      if (!this.validateDimensions(metadata)) {
        throw new Error(`Image dimensions out of range: ${metadata.width}x${metadata.height}`);
      }

      //generate optimized variants
      const optimizedVariants: OptimizedVariant[] = [];
      let cloudflareId: string | undefined;

      //upload to Cloudflare if enabled
      if (this.options.cloudflareUpload) {
        try {
          const fileBuffer = await fs.readFile(imagePath);
          const blob = new Blob([fileBuffer]);
          const uploadResult = await cloudflareCDN.uploadImage(blob, {
            metadata: { originalPath: imagePath },
          });
          cloudflareId = uploadResult.id;
        } catch (error) {
          errors.push(`Cloudflare upload failed: ${error}`);
        }
      }

      //generate variants for each format and breakpoint
      for (const format of this.options.formats) {
        for (const breakpoint of this.options.breakpoints) {
          //skip if breakpoint is larger than original
          if (breakpoint > metadata.width) continue;

          for (const dpr of this.options.dprVariants) {
            const targetWidth = Math.min(breakpoint * dpr, metadata.width);
            const targetHeight = Math.round((targetWidth / metadata.width) * metadata.height);

            try {
              const variant = await this.generateVariant(
                image,
                imagePath,
                format,
                targetWidth,
                targetHeight,
                dpr
              );
              
              optimizedVariants.push(variant);
            } catch (error) {
              errors.push(`Failed to generate ${format} variant (${targetWidth}x${targetHeight}@${dpr}x): ${error}`);
            }
          }
        }
      }

      //calculate total savings
      const totalOptimizedSize = optimizedVariants.reduce((sum, v) => sum + v.size, 0);
      const totalSavings = originalSize - totalOptimizedSize;
      const compressionRatio = totalSavings / originalSize;

      //validate compression ratio
      if (compressionRatio < PIPELINE_CONFIG.THRESHOLDS.minCompressionRatio) {
        if (this.options.verbose) {
          console.log(`⚠️  Low compression ratio for ${path.basename(imagePath)}: ${(compressionRatio * 100).toFixed(1)}%`);
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        originalPath: imagePath,
        originalSize,
        optimizedVariants,
        totalSavings,
        compressionRatio,
        metadata,
        cloudflareId,
        processingTime,
        errors,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        originalPath: imagePath,
        originalSize: 0,
        optimizedVariants: [],
        totalSavings: 0,
        compressionRatio: 0,
        metadata: {} as ImageMetadata,
        processingTime,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
      };
    }
  }

  //generate optimized variant
  private async generateVariant(
    image: sharp.Sharp,
    originalPath: string,
    format: OutputFormat,
    width: number,
    height: number,
    dpr: number
  ): Promise<OptimizedVariant> {
    const outputPath = this.generateOutputPath(originalPath, format, width, height, dpr);
    
    //check if file already exists and overwrite is disabled
    if (!this.options.overwrite) {
      try {
        await fs.access(outputPath);
        const stats = await fs.stat(outputPath);
        
        return {
          path: outputPath,
          format,
          width,
          height,
          dpr,
          size: stats.size,
          savings: 0, //would need original to calculate
        };
      } catch {
        //file doesn't exist, continue with generation
      }
    }

    //ensure output directory exists
    await this.ensureDirectory(path.dirname(outputPath));

    //create processing pipeline
    let pipeline = image.clone().resize(width, height, {
      fit: 'inside',
      withoutEnlargement: true,
    });

    //apply format-specific optimizations
    const qualitySettings = this.options.quality[format];
    
    switch (format) {
      case 'avif':
        pipeline = pipeline.avif({
          quality: qualitySettings.quality,
          effort: qualitySettings.effort,
        });
        break;
        
      case 'webp':
        pipeline = pipeline.webp({
          quality: qualitySettings.quality,
          effort: qualitySettings.effort,
          progressive: PIPELINE_CONFIG.PROCESSING.progressive,
        });
        break;
        
      case 'jpeg':
        pipeline = pipeline.jpeg({
          quality: qualitySettings.quality,
          progressive: qualitySettings.progressive,
          mozjpeg: qualitySettings.mozjpeg,
          optimizeScans: PIPELINE_CONFIG.PROCESSING.optimizeScans,
          trellis: PIPELINE_CONFIG.PROCESSING.trellis,
          overshoot: PIPELINE_CONFIG.PROCESSING.overshoot,
        });
        break;
        
      case 'png':
        pipeline = pipeline.png({
          quality: qualitySettings.quality,
          progressive: PIPELINE_CONFIG.PROCESSING.progressive,
          compressionLevel: 9,
          adaptiveFiltering: true,
        });
        break;
    }

    //strip metadata if enabled
    if (PIPELINE_CONFIG.PROCESSING.stripMetadata) {
      pipeline = pipeline.withMetadata({ exif: {}, icc: 'srgb' });
    }

    //write optimized image
    const info = await pipeline.toFile(outputPath);
    const stats = await fs.stat(outputPath);

    return {
      path: outputPath,
      format,
      width: info.width,
      height: info.height,
      dpr,
      size: stats.size,
      savings: 0, //calculated later in batch
    };
  }

  //extract comprehensive image metadata
  private async extractMetadata(image: sharp.Sharp): Promise<ImageMetadata> {
    const metadata = await image.metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      space: metadata.space || 'unknown',
      channels: metadata.channels || 0,
      depth: metadata.depth || 'unknown',
      density: metadata.density || 72,
      hasAlpha: metadata.hasAlpha || false,
      isAnimated: (metadata.pages || 1) > 1,
      pages: metadata.pages || 1,
    };
  }

  //validate image dimensions
  private validateDimensions(metadata: ImageMetadata): boolean {
    const { width, height } = metadata;
    const { maxDimensions, minDimensions } = PIPELINE_CONFIG.THRESHOLDS;
    
    return (
      width >= minDimensions.width &&
      height >= minDimensions.height &&
      width <= maxDimensions.width &&
      height <= maxDimensions.height
    );
  }

  //generate output file path
  private generateOutputPath(
    originalPath: string,
    format: OutputFormat,
    width: number,
    height: number,
    dpr: number
  ): string {
    const parsed = path.parse(originalPath);
    const relativePath = path.relative(this.options.inputDir, path.dirname(originalPath));
    
    const dprSuffix = dpr !== 1 ? `@${dpr}x` : '';
    const sizeSuffix = `_${width}x${height}${dprSuffix}`;
    const filename = `${parsed.name}${sizeSuffix}.${format}`;
    
    return path.join(this.options.outputDir, relativePath, filename);
  }

  //generate optimization manifest
  private async generateManifest(): Promise<OptimizationManifest> {
    const manifest: OptimizationManifest = {
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
      totalImages: this.results.length,
      totalSavings: this.totalSavings,
      images: {},
    };

    for (const result of this.results) {
      const key = path.relative(this.options.inputDir, result.originalPath);
      
      manifest.images[key] = {
        originalSize: result.originalSize,
        metadata: result.metadata,
        variants: result.optimizedVariants.map(variant => ({
          path: path.relative(this.options.outputDir, variant.path),
          format: variant.format,
          width: variant.width,
          height: variant.height,
          dpr: variant.dpr,
          size: variant.size,
          url: variant.url,
        })),
        cloudflareId: result.cloudflareId,
        compressionRatio: result.compressionRatio,
        processingTime: result.processingTime,
      };
    }

    const manifestPath = path.join(this.options.outputDir, 'optimization-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    return manifest;
  }

  //generate processing summary
  private generateSummary(): ProcessingSummary {
    const successfulResults = this.results.filter(r => r.errors.length === 0);
    const failedResults = this.results.filter(r => r.errors.length > 0);
    
    const formatDistribution = new Map<OutputFormat, number>();
    let totalVariants = 0;
    let totalProcessingTime = 0;

    for (const result of successfulResults) {
      totalProcessingTime += result.processingTime;
      totalVariants += result.optimizedVariants.length;
      
      for (const variant of result.optimizedVariants) {
        const count = formatDistribution.get(variant.format) || 0;
        formatDistribution.set(variant.format, count + 1);
      }
    }

    return {
      totalImages: this.results.length,
      successfulImages: successfulResults.length,
      failedImages: failedResults.length,
      totalVariants,
      totalSavings: this.totalSavings,
      averageCompressionRatio: successfulResults.length > 0 ? 
        successfulResults.reduce((sum, r) => sum + r.compressionRatio, 0) / successfulResults.length : 0,
      formatDistribution: Object.fromEntries(formatDistribution),
      averageProcessingTime: successfulResults.length > 0 ? totalProcessingTime / successfulResults.length : 0,
      errors: failedResults.map(r => ({ path: r.originalPath, errors: r.errors })),
    };
  }

  //utility methods
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

//interfaces
export interface PipelineResults {
  results: OptimizationResult[];
  manifest: OptimizationManifest | null;
  summary: ProcessingSummary;
  totalTime: number;
  success: boolean;
  error?: string;
}

export interface OptimizationManifest {
  version: string;
  generatedAt: string;
  totalImages: number;
  totalSavings: number;
  images: Record<string, ManifestImage>;
}

export interface ManifestImage {
  originalSize: number;
  metadata: ImageMetadata;
  variants: ManifestVariant[];
  cloudflareId?: string;
  compressionRatio: number;
  processingTime: number;
}

export interface ManifestVariant {
  path: string;
  format: OutputFormat;
  width: number;
  height: number;
  dpr: number;
  size: number;
  url?: string;
}

export interface ProcessingSummary {
  totalImages: number;
  successfulImages: number;
  failedImages: number;
  totalVariants: number;
  totalSavings: number;
  averageCompressionRatio: number;
  formatDistribution: Record<OutputFormat, number>;
  averageProcessingTime: number;
  errors: Array<{ path: string; errors: string[] }>;
}

//CLI integration for build-time optimization
export async function runOptimizationPipeline(options: PipelineOptions): Promise<PipelineResults> {
  const pipeline = new ImageOptimizationPipeline(options);
  return pipeline.run();
}

//utility function for runtime optimization
export async function optimizeImageRuntime(
  imagePath: string,
  outputDir: string,
  options: Partial<PipelineOptions> = {}
): Promise<OptimizationResult> {
  const pipeline = new ImageOptimizationPipeline({
    inputDir: path.dirname(imagePath),
    outputDir,
    ...options,
  });

  return pipeline['processImage'](imagePath);
}

//export for external usage
export { ImageOptimizationPipeline };