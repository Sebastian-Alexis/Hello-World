// =============================================================================
// CONTENT PROCESSOR - Advanced content processing utilities
// Handles markdown conversion, sanitization, SEO optimization, and more
// =============================================================================

import { marked } from 'marked';
import sanitizeHtmlLib from 'sanitize-html';

//configure marked with enhanced options
marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: true,
  mangle: false,
});

//configure highlight.js for syntax highlighting (placeholder for now)
marked.setOptions({
  highlight: function(code: string, lang: string) {
    //will integrate with Prism.js or highlight.js later
    return `<pre class="language-${lang || 'text'}"><code class="language-${lang || 'text'}">${code}</code></pre>`;
  },
});

export interface ProcessedContent {
  html: string;
  excerpt: string;
  readingTime: number;
  wordCount: number;
  toc: TableOfContentsItem[];
  keywords: string[];
  metaDescription: string;
}

export interface TableOfContentsItem {
  level: number;
  text: string;
  id: string;
  children?: TableOfContentsItem[];
}

export class ContentProcessor {
  //processes markdown content and returns comprehensive data
  static processContent(content: string, title?: string): ProcessedContent {
    //convert markdown to HTML
    const rawHtml = marked.parse(content) as string;
    
    //sanitize HTML to prevent XSS
    const html = this.sanitizeHtml(rawHtml);
    
    //process images for optimization
    const optimizedHtml = this.processImages(html);
    
    //generate table of contents
    const { content: htmlWithToc, toc } = this.generateTableOfContents(optimizedHtml);
    
    //calculate content metrics
    const wordCount = this.countWords(content);
    const readingTime = this.calculateReadingTime(content);
    
    //generate excerpt
    const excerpt = this.generateExcerpt(content, 160);
    
    //extract keywords
    const keywords = this.extractKeywords(content, title);
    
    //generate meta description
    const metaDescription = this.generateMetaDescription(content, title);
    
    return {
      html: htmlWithToc,
      excerpt,
      readingTime,
      wordCount,
      toc,
      keywords,
      metaDescription,
    };
  }

  //sanitizes HTML content for security
  static sanitizeHtml(html: string): string {
    return sanitizeHtmlLib(html, {
      allowedTags: [
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p', 'br', 'strong', 'em', 'u', 'strike', 'del', 'ins',
        'blockquote', 'code', 'pre',
        'ul', 'ol', 'li',
        'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
        'div', 'span', 'small', 'sub', 'sup',
        'details', 'summary',
        'mark', 'kbd', 'samp', 'var',
      ],
      allowedAttributes: {
        '*': ['class', 'id'],
        'a': ['href', 'title', 'target', 'rel'],
        'img': ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
        'details': ['open'],
      },
      allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'],
      allowedSchemesAppliedToAttributes: ['href', 'src'],
    });
  }

  //generates excerpt from content
  static generateExcerpt(content: string, maxLength = 160): string {
    //strip markdown and HTML tags
    const textOnly = content
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[.*?\]\(.*?\)/g, '$1') // Remove links but keep text
      .replace(/[#*_`~]/g, '') // Remove markdown formatting
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (textOnly.length <= maxLength) {
      return textOnly;
    }

    //find last complete sentence within limit
    const truncated = textOnly.substring(0, maxLength);
    const lastSentence = truncated.lastIndexOf('.');
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSentence > maxLength * 0.7) {
      return truncated.substring(0, lastSentence + 1);
    } else if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + '...';
    } else {
      return truncated + '...';
    }
  }

  //calculates reading time in minutes
  static calculateReadingTime(content: string): number {
    const wordsPerMinute = 200; // Average reading speed
    const wordCount = this.countWords(content);
    return Math.ceil(wordCount / wordsPerMinute);
  }

  //counts words in content
  static countWords(content: string): number {
    //strip markdown and count words
    const textOnly = content
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[.*?\]\(.*?\)/g, '$1') // Remove links but keep text
      .replace(/[#*_`~]/g, '') // Remove markdown formatting
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .trim();

    if (!textOnly) return 0;
    return textOnly.split(/\s+/).length;
  }

  //generates SEO meta description
  static generateMetaDescription(content: string, title?: string): string {
    const excerpt = this.generateExcerpt(content, 140);

    if (excerpt.length < 100 && title) {
      const combined = `${title} - ${excerpt}`;
      return combined.length <= 160 ? combined : excerpt;
    }

    return excerpt;
  }

  //extracts keywords from content
  static extractKeywords(content: string, title?: string): string[] {
    const text = `${title || ''} ${content}`.toLowerCase();
    
    //extract words (3+ characters)
    const words = text.match(/\b[a-z]{3,}\b/g) || [];

    //count word frequency
    const wordCount = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    //filter out common stop words
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
      'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
      'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'who', 'boy',
      'did', 'man', 'men', 'she', 'use', 'way', 'were', 'with', 'this',
      'that', 'have', 'from', 'they', 'know', 'want', 'been', 'good',
      'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just',
      'like', 'long', 'make', 'over', 'such', 'take', 'than', 'them',
      'well', 'will', 'what', 'would', 'there', 'could', 'other', 'into',
      'more', 'also', 'only', 'first', 'after', 'where', 'should', 'being',
      'through', 'about', 'before', 'because', 'between', 'during', 'without',
    ]);

    return Object.entries(wordCount)
      .filter(([word, count]) => !stopWords.has(word) && count > 1 && word.length > 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  //generates unique slug from title
  static generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  //processes and optimizes images in content
  static processImages(content: string): string {
    return content.replace(
      /<img([^>]+)>/g,
      (match, attributes) => {
        //add loading="lazy" for performance
        const hasLoading = /loading=/.test(attributes);
        const hasAlt = /alt=/.test(attributes);
        const hasDecoding = /decoding=/.test(attributes);

        let processedAttributes = attributes;

        if (!hasLoading) {
          processedAttributes += ' loading="lazy"';
        }

        if (!hasDecoding) {
          processedAttributes += ' decoding="async"';
        }

        if (!hasAlt) {
          processedAttributes += ' alt=""';
        }

        return `<img${processedAttributes}>`;
      }
    );
  }

  //generates table of contents from HTML headings
  static generateTableOfContents(content: string): { content: string; toc: TableOfContentsItem[] } {
    const toc: TableOfContentsItem[] = [];
    const tocMap = new Map<string, number>(); // Track duplicate IDs

    const processedContent = content.replace(
      /<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/g,
      (match, level, attributes, text) => {
        //clean text for ID generation
        const cleanText = text.replace(/<[^>]*>/g, ''); // Strip HTML from text
        let id = this.generateSlug(cleanText);

        //handle duplicate IDs
        if (tocMap.has(id)) {
          const count = tocMap.get(id)! + 1;
          tocMap.set(id, count);
          id = `${id}-${count}`;
        } else {
          tocMap.set(id, 1);
        }

        //add to TOC
        toc.push({
          level: parseInt(level),
          text: cleanText,
          id,
        });

        //add id to heading if not already present
        const hasId = /id=/.test(attributes);
        const finalAttributes = hasId ? attributes : `${attributes} id="${id}"`;

        return `<h${level}${finalAttributes}>${text}</h${level}>`;
      }
    );

    //organize TOC into hierarchical structure
    const hierarchicalToc = this.organizeTocHierarchy(toc);

    return { content: processedContent, toc: hierarchicalToc };
  }

  //organizes flat TOC into hierarchical structure
  private static organizeTocHierarchy(flatToc: TableOfContentsItem[]): TableOfContentsItem[] {
    const hierarchical: TableOfContentsItem[] = [];
    const stack: TableOfContentsItem[] = [];

    for (const item of flatToc) {
      //find the correct parent level
      while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        //top level item
        hierarchical.push(item);
      } else {
        //nested item
        const parent = stack[stack.length - 1];
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(item);
      }

      stack.push(item);
    }

    return hierarchical;
  }

  //adds internal links and cross-references
  static addInternalLinks(content: string, linkMap: Map<string, string>): string {
    //find internal link patterns like [[link-text]] or [[slug|display-text]]
    return content.replace(
      /\[\[([^\]]+)\]\]/g,
      (match, linkContent) => {
        const [slug, displayText] = linkContent.split('|').map((s: string) => s.trim());
        const url = linkMap.get(slug);
        
        if (url) {
          const text = displayText || slug;
          return `<a href="${url}" class="internal-link">${text}</a>`;
        }
        
        return match; // Return original if no mapping found
      }
    );
  }

  //generates RSS feed compatible excerpt
  static generateRssExcerpt(content: string): string {
    return this.sanitizeHtml(
      this.generateExcerpt(content, 300)
    );
  }

  //converts relative URLs to absolute for RSS feeds
  static convertToAbsoluteUrls(content: string, baseUrl: string): string {
    return content
      .replace(/src="\/([^"]+)"/g, `src="${baseUrl}/$1"`)
      .replace(/href="\/([^"]+)"/g, `href="${baseUrl}/$1"`);
  }

  //validates and cleans markdown content
  static validateAndCleanMarkdown(content: string): { 
    content: string; 
    warnings: string[]; 
    isValid: boolean; 
  } {
    const warnings: string[] = [];
    let cleanContent = content;

    //check for common markdown issues
    if (content.includes('](')) {
      //validate links
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let match;
      while ((match = linkPattern.exec(content)) !== null) {
        const [, linkText, url] = match;
        if (!linkText.trim()) {
          warnings.push(`Empty link text found: ${match[0]}`);
        }
        if (!url.trim()) {
          warnings.push(`Empty URL found: ${match[0]}`);
        }
      }
    }

    //check for unmatched code blocks
    const codeBlockMatches = content.match(/```/g);
    if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
      warnings.push('Unmatched code block delimiters found');
    }

    //clean up extra whitespace
    cleanContent = content
      .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
      .replace(/[ \t]+$/gm, '') // Remove trailing whitespace
      .trim();

    return {
      content: cleanContent,
      warnings,
      isValid: warnings.length === 0,
    };
  }

  //estimates content difficulty/complexity
  static analyzeContentComplexity(content: string): {
    score: number; // 1-10 scale
    factors: {
      averageSentenceLength: number;
      averageWordLength: number;
      technicalTerms: number;
      codeBlocks: number;
      readingLevel: 'elementary' | 'middle' | 'high' | 'college';
    };
  } {
    const words = this.countWords(content);
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const averageSentenceLength = words / sentences;
    
    const allWords = content.match(/\b[a-zA-Z]+\b/g) || [];
    const averageWordLength = allWords.reduce((sum, word) => sum + word.length, 0) / allWords.length;
    
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    const technicalTerms = (content.match(/\b(?:API|SDK|HTTP|JSON|XML|CSS|HTML|JavaScript|TypeScript|React|Vue|Angular|Node|npm|Git|GitHub|Docker|AWS|GCP|Azure)\b/gi) || []).length;
    
    //simple readability score calculation
    let score = 1;
    if (averageSentenceLength > 20) score += 2;
    if (averageWordLength > 5) score += 2;
    if (technicalTerms > 10) score += 2;
    if (codeBlocks > 5) score += 2;
    if (words > 2000) score += 1;
    
    score = Math.min(10, score);
    
    let readingLevel: 'elementary' | 'middle' | 'high' | 'college' = 'elementary';
    if (score >= 7) readingLevel = 'college';
    else if (score >= 5) readingLevel = 'high';
    else if (score >= 3) readingLevel = 'middle';
    
    return {
      score,
      factors: {
        averageSentenceLength,
        averageWordLength,
        technicalTerms,
        codeBlocks,
        readingLevel,
      },
    };
  }
}

//utility functions for content processing
export function slugify(text: string): string {
  return ContentProcessor.generateSlug(text);
}

export function processMarkdown(content: string, title?: string): ProcessedContent {
  return ContentProcessor.processContent(content, title);
}

export function sanitizeHtml(html: string): string {
  return ContentProcessor.sanitizeHtml(html);
}

export function generateExcerpt(content: string, maxLength?: number): string {
  return ContentProcessor.generateExcerpt(content, maxLength);
}

export function calculateReadingTime(content: string): number {
  return ContentProcessor.calculateReadingTime(content);
}