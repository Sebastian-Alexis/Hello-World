//enhanced slug handling utilities for blog posts
//ensures all blog posts always have valid, unique slugs

import { executeQuery } from './connection';
import { generateSlugFromTitle } from '../validation/schemas';

export interface SlugGenerationOptions {
  maxLength?: number;
  allowDuplicates?: boolean;
  fallbackPrefix?: string;
}

//generates a unique slug for a blog post, checking database for conflicts
export async function generateUniqueSlug(
  title: string, 
  excludeId?: number,
  options: SlugGenerationOptions = {}
): Promise<string> {
  const { maxLength = 100, allowDuplicates = false, fallbackPrefix = 'post' } = options;
  
  //generate base slug from title
  let baseSlug = generateSlugFromTitle(title);
  
  //handle edge cases where title might generate empty slug
  if (!baseSlug || baseSlug.trim() === '') {
    baseSlug = `${fallbackPrefix}-${Date.now()}`;
  }
  
  //truncate if too long
  if (baseSlug.length > maxLength) {
    baseSlug = baseSlug.substring(0, maxLength - 10); //leave room for counter
    baseSlug = baseSlug.replace(/-[^-]*$/, ''); //remove partial word at end
  }
  
  if (allowDuplicates) {
    return baseSlug;
  }
  
  //check for existing slugs in database
  const existingQuery = excludeId 
    ? 'SELECT slug FROM blog_posts WHERE slug LIKE ? AND id != ?'
    : 'SELECT slug FROM blog_posts WHERE slug LIKE ?';
  
  const searchPattern = `${baseSlug}%`;
  const params = excludeId 
    ? [searchPattern, excludeId]  
    : [searchPattern];
  
  const result = await executeQuery<{ slug: string }>(existingQuery, params);
  const existingSlugs = new Set(result.rows.map(row => row.slug));
  
  //if base slug is available, use it
  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }
  
  //find the next available numbered variant
  let counter = 1;
  let candidateSlug: string;
  
  do {
    candidateSlug = `${baseSlug}-${counter}`;
    counter++;
  } while (existingSlugs.has(candidateSlug) && counter < 1000); //safety limit
  
  if (counter >= 1000) {
    //fallback to timestamp-based slug if too many conflicts
    candidateSlug = `${baseSlug}-${Date.now()}`;
  }
  
  return candidateSlug;
}

//validates a slug format and uniqueness
export async function validateSlug(
  slug: string, 
  excludeId?: number
): Promise<{ isValid: boolean; error?: string; suggestion?: string }> {
  //basic format validation
  if (!slug || typeof slug !== 'string') {
    return { isValid: false, error: 'Slug is required' };
  }
  
  const trimmedSlug = slug.trim();
  
  if (trimmedSlug.length === 0) {
    return { isValid: false, error: 'Slug cannot be empty' };
  }
  
  if (trimmedSlug.length < 3) {
    return { isValid: false, error: 'Slug must be at least 3 characters long' };
  }
  
  if (trimmedSlug.length > 100) {
    return { isValid: false, error: 'Slug must be less than 100 characters' };
  }
  
  //check format using regex from schemas
  const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  if (!SLUG_REGEX.test(trimmedSlug)) {
    const suggestion = generateSlugFromTitle(trimmedSlug);
    return { 
      isValid: false, 
      error: 'Slug must contain only lowercase letters, numbers, and hyphens',
      suggestion 
    };
  }
  
  //check uniqueness in database
  const existingQuery = excludeId 
    ? 'SELECT id FROM blog_posts WHERE slug = ? AND id != ? LIMIT 1'
    : 'SELECT id FROM blog_posts WHERE slug = ? LIMIT 1';
    
  const params = excludeId ? [trimmedSlug, excludeId] : [trimmedSlug];
  const result = await executeQuery<{ id: number }>(existingQuery, params);
  
  if (result.rows.length > 0) {
    const suggestion = await generateUniqueSlug(trimmedSlug, excludeId);
    return { 
      isValid: false, 
      error: 'Slug already exists', 
      suggestion 
    };
  }
  
  return { isValid: true };
}

//ensures a blog post has a valid slug, generating one if missing
export async function ensureValidSlug(
  title: string, 
  providedSlug?: string, 
  postId?: number
): Promise<string> {
  //if slug is provided, validate it
  if (providedSlug && providedSlug.trim()) {
    const validation = await validateSlug(providedSlug.trim(), postId);
    if (validation.isValid) {
      return providedSlug.trim();
    }
    
    //if provided slug is invalid, log warning but continue with generation
    console.warn(`Invalid slug "${providedSlug}" for post "${title}": ${validation.error}`);
  }
  
  //generate a unique slug from title
  return await generateUniqueSlug(title, postId);
}

//batch validate multiple slugs (useful for migration/validation scripts)
export async function batchValidateSlugs(
  posts: Array<{ id: number; title: string; slug: string | null }>
): Promise<Array<{ id: number; title: string; currentSlug: string | null; suggestedSlug: string; needsUpdate: boolean }>> {
  const results: Array<{ id: number; title: string; currentSlug: string | null; suggestedSlug: string; needsUpdate: boolean }> = [];
  
  for (const post of posts) {
    let needsUpdate = false;
    let suggestedSlug = post.slug || '';
    
    //check if slug is missing or empty
    if (!post.slug || post.slug.trim() === '') {
      needsUpdate = true;
      suggestedSlug = await generateUniqueSlug(post.title, post.id);
    } else {
      //validate existing slug
      const validation = await validateSlug(post.slug, post.id);
      if (!validation.isValid) {
        needsUpdate = true;
        suggestedSlug = validation.suggestion || await generateUniqueSlug(post.title, post.id);
      }
    }
    
    results.push({
      id: post.id,
      title: post.title,
      currentSlug: post.slug,
      suggestedSlug,
      needsUpdate
    });
  }
  
  return results;
}

//database health check specifically for slug issues  
export async function checkSlugHealth(): Promise<{
  totalPosts: number;
  postsWithoutSlugs: number;
  duplicateSlugs: number;
  invalidSlugs: number;
  issues: Array<{ type: string; description: string; count: number }>;
}> {
  try {
    const [totalResult, missingResult, duplicateResult, invalidResult] = await Promise.all([
      executeQuery<{ count: number }>('SELECT COUNT(*) as count FROM blog_posts'),
      executeQuery<{ count: number }>(`
        SELECT COUNT(*) as count 
        FROM blog_posts 
        WHERE slug IS NULL OR slug = '' OR TRIM(slug) = ''
      `),
      executeQuery<{ count: number }>(`
        SELECT COUNT(*) - COUNT(DISTINCT slug) as count
        FROM blog_posts 
        WHERE slug IS NOT NULL AND TRIM(slug) != ''
      `),
      executeQuery<{ count: number }>(`
        SELECT COUNT(*) as count
        FROM blog_posts 
        WHERE slug IS NOT NULL 
          AND TRIM(slug) != ''
          AND (
            LENGTH(TRIM(slug)) < 3 
            OR slug LIKE '% %' 
            OR slug LIKE '%  %'
            OR slug NOT GLOB '[a-z0-9]*'
            OR slug GLOB '*[^a-z0-9-]*'
          )
      `)
    ]);
    
    const totalPosts = totalResult.rows[0]?.count || 0;
    const postsWithoutSlugs = missingResult.rows[0]?.count || 0;
    const duplicateSlugs = Math.max(0, duplicateResult.rows[0]?.count || 0);
    const invalidSlugs = invalidResult.rows[0]?.count || 0;
    
    const issues: Array<{ type: string; description: string; count: number }> = [];
    
    if (postsWithoutSlugs > 0) {
      issues.push({
        type: 'missing_slugs',
        description: 'Posts without slugs',
        count: postsWithoutSlugs
      });
    }
    
    if (duplicateSlugs > 0) {
      issues.push({
        type: 'duplicate_slugs',
        description: 'Duplicate slugs found',
        count: duplicateSlugs
      });
    }
    
    if (invalidSlugs > 0) {
      issues.push({
        type: 'invalid_slugs', 
        description: 'Slugs with invalid format',
        count: invalidSlugs
      });
    }
    
    return {
      totalPosts,
      postsWithoutSlugs,
      duplicateSlugs,
      invalidSlugs,
      issues
    };
    
  } catch (error) {
    console.error('Slug health check failed:', error);
    throw error;
  }
}