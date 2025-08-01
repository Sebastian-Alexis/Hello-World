//enhanced database queries with automatic slug generation
//this file contains patches to ensure all blog posts have valid slugs

import { executeQuery, executeTransaction } from './connection';
import { ensureValidSlug, validateSlug } from './slug-helpers';
import type { BlogPost, BlogPostForm } from './types';

//enhanced createBlogPost with automatic slug generation
export async function createBlogPostWithSlug(postData: BlogPostForm, authorId: number): Promise<BlogPost> {
  const { ContentProcessor } = await import('../content/processor');
  
  //ensure we have a valid slug
  const validSlug = await ensureValidSlug(postData.title, postData.slug);
  
  //process content for HTML, SEO, and metadata
  const processed = ContentProcessor.processContent(postData.content, postData.title);
  
  const queries = [
    {
      query: `
        INSERT INTO blog_posts (
          title, slug, excerpt, content, content_html, status, featured,
          featured_image_url, meta_title, meta_description, meta_keywords,
          og_title, og_description, og_image_url, canonical_url,
          reading_time, word_count, author_id, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        postData.title,
        validSlug, //use validated slug instead of postData.slug
        postData.excerpt || processed.excerpt,
        postData.content,
        processed.html,
        postData.status,
        postData.featured,
        postData.featured_image || null,
        postData.meta_title || postData.title,
        postData.meta_description || processed.metaDescription,
        processed.keywords.join(', ') || null,
        postData.title, //og_title
        processed.metaDescription, //og_description
        postData.og_image || postData.featured_image || null,
        postData.canonical_url || null,
        processed.readingTime,
        processed.wordCount,
        authorId,
        postData.status === 'published' ? (postData.published_at || new Date().toISOString()) : null,
      ],
    },
  ];
  
  await executeTransaction(queries);
  
  //get the inserted post
  const result = await executeQuery<BlogPost>(
    'SELECT * FROM blog_posts WHERE slug = ? LIMIT 1',
    [validSlug]
  );
  
  const post = result.rows[0];
  
  if (!post) {
    throw new Error(`Failed to create blog post with slug: ${validSlug}`);
  }
  
  //handle categories and tags if provided
  if (postData.categories && postData.categories.length > 0) {
    const categoryQueries = postData.categories.map(categoryId => ({
      query: 'INSERT INTO blog_post_categories (post_id, category_id) VALUES (?, ?)',
      params: [post.id, categoryId]
    }));
    await executeTransaction(categoryQueries);
  }
  
  if (postData.tags && postData.tags.length > 0) {
    const tagQueries = postData.tags.map(tagId => ({
      query: 'INSERT INTO blog_post_tags (post_id, tag_id) VALUES (?, ?)',
      params: [post.id, tagId]
    }));
    await executeTransaction(tagQueries);
  }
  
  console.log(`✅ Created blog post "${post.title}" with slug "${validSlug}"`);
  return post;
}

//enhanced updateBlogPost with slug validation
export async function updateBlogPostWithSlug(
  id: number, 
  postData: Partial<BlogPostForm>
): Promise<BlogPost> {
  const { ContentProcessor } = await import('../content/processor');
  
  //get existing post to check current slug
  const existingResult = await executeQuery<BlogPost>(
    'SELECT * FROM blog_posts WHERE id = ? LIMIT 1',
    [id]
  );
  
  const existingPost = existingResult.rows[0];
  if (!existingPost) {
    throw new Error(`Blog post with id ${id} not found`);
  }
  
  //handle slug updates
  let finalSlug = existingPost.slug;
  
  if (postData.slug !== undefined) {
    //slug is being explicitly updated
    if (postData.slug && postData.slug.trim()) {
      const validation = await validateSlug(postData.slug.trim(), id);
      if (validation.isValid) {
        finalSlug = postData.slug.trim();
      } else {
        console.warn(`Invalid slug "${postData.slug}" for post ${id}: ${validation.error}`);
        finalSlug = validation.suggestion || await ensureValidSlug(postData.title || existingPost.title, undefined, id);
      }
    } else {
      //slug is being cleared, regenerate from title
      finalSlug = await ensureValidSlug(postData.title || existingPost.title, undefined, id);
    }
  } else if (postData.title && postData.title !== existingPost.title && (!existingPost.slug || existingPost.slug.trim() === '')) {
    //title is being updated and current slug is missing, generate new slug
    finalSlug = await ensureValidSlug(postData.title, undefined, id);
  }
  
  let processedContent;
  if (postData.content) {
    processedContent = ContentProcessor.processContent(postData.content, postData.title || existingPost.title);
  }
  
  //build update query dynamically based on provided fields
  const updateFields: string[] = [];
  const updateParams: any[] = [];
  
  if (postData.title !== undefined) {
    updateFields.push('title = ?');
    updateParams.push(postData.title);
  }
  
  if (finalSlug !== existingPost.slug) {
    updateFields.push('slug = ?');
    updateParams.push(finalSlug);
  }
  
  if (postData.excerpt !== undefined) {
    updateFields.push('excerpt = ?');
    updateParams.push(postData.excerpt || (processedContent?.excerpt || null));
  }
  
  if (postData.content !== undefined) {
    updateFields.push('content = ?', 'content_html = ?');
    updateParams.push(postData.content, processedContent?.html || '');
  }
  
  if (postData.status !== undefined) {
    updateFields.push('status = ?');
    updateParams.push(postData.status);
  }
  
  if (postData.featured !== undefined) {
    updateFields.push('featured = ?');
    updateParams.push(postData.featured);
  }
  
  if (postData.featured_image !== undefined) {
    updateFields.push('featured_image_url = ?');
    updateParams.push(postData.featured_image);
  }
  
  if (postData.meta_title !== undefined) {
    updateFields.push('meta_title = ?');
    updateParams.push(postData.meta_title);
  }
  
  if (postData.meta_description !== undefined) {
    updateFields.push('meta_description = ?');
    updateParams.push(postData.meta_description || (processedContent?.metaDescription || null));
  }
  
  if (processedContent) {
    updateFields.push('reading_time = ?', 'word_count = ?');
    updateParams.push(processedContent.readingTime, processedContent.wordCount);
    
    if (processedContent.keywords.length > 0) {
      updateFields.push('meta_keywords = ?');
      updateParams.push(processedContent.keywords.join(', '));
    }
  }
  
  //handle publication status
  if (postData.status === 'published' && existingPost.status !== 'published') {
    updateFields.push('published_at = ?');
    updateParams.push(postData.published_at || new Date().toISOString());
  } else if (postData.status === 'draft' && existingPost.status === 'published') {
    updateFields.push('published_at = ?');
    updateParams.push(null);
  }
  
  //add timestamp and ID for WHERE clause
  updateFields.push('updated_at = CURRENT_TIMESTAMP');
  updateParams.push(id);
  
  if (updateFields.length === 1) {
    //only timestamp was added, no real updates
    console.log(`No changes detected for blog post ${id}`);
    return existingPost;
  }
  
  const updateQuery = `
    UPDATE blog_posts 
    SET ${updateFields.join(', ')} 
    WHERE id = ?
  `;
  
  await executeQuery(updateQuery, updateParams);
  
  //get updated post
  const updatedResult = await executeQuery<BlogPost>(
    'SELECT * FROM blog_posts WHERE id = ? LIMIT 1',
    [id]
  );
  
  const updatedPost = updatedResult.rows[0];
  if (!updatedPost) {
    throw new Error(`Failed to retrieve updated blog post with id: ${id}`);
  }
  
  console.log(`✅ Updated blog post "${updatedPost.title}" (slug: "${finalSlug}")`);
  return updatedPost;
}

//utility function to fix a specific post's slug
export async function fixPostSlug(postId: number): Promise<{ oldSlug: string | null; newSlug: string }> {
  //get the post
  const result = await executeQuery<BlogPost>(
    'SELECT id, title, slug FROM blog_posts WHERE id = ? LIMIT 1',
    [postId]
  );
  
  const post = result.rows[0];
  if (!post) {
    throw new Error(`Blog post with id ${postId} not found`);
  }
  
  const oldSlug = post.slug;
  
  //generate new slug if needed
  const newSlug = await ensureValidSlug(post.title, post.slug, postId);
  
  //update if different
  if (newSlug !== oldSlug) {
    await executeQuery(
      'UPDATE blog_posts SET slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newSlug, postId]
    );
    
    console.log(`Fixed slug for post ${postId}: "${oldSlug}" → "${newSlug}"`);
    return { oldSlug, newSlug };
  }
  
  console.log(`Post ${postId} already has valid slug: "${oldSlug}"`);
  return { oldSlug, newSlug: oldSlug || '' };
}