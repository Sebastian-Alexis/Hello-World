# Project Memory

## Blog Posts

### Location & Structure
- Blog posts live in `src/content/blog/` as `.md` files (Astro content collection)
- Blog images go in `public/images/blog/`
- Schema defined in `src/content/config.ts`: title, excerpt, status, featured, published_at, reading_time, featured_image_url
- `src/content/` is not tracked in git; it exists only locally and is included in build output

### Frontmatter Template
```yaml
---
title: "Post Title"
excerpt: "One-sentence summary."
status: "published"
featured: true
featured_image_url: "/images/blog/thumbnail.png"
published_at: "2026-04-15T12:00:00.000Z"
reading_time: 12
---
```

### Thumbnail & Image Guidelines
- The blog listing page (index.astro) displays thumbnails at `sm:w-56 sm:h-56` with `object-cover` -- roughly square crop
- Use a **square-aspect thumbnail** (~1200x1200) for `featured_image_url` so text/details don't get clipped on the listing page
- For wide hero images, place them inline in the post body rather than as the featured image
- Prefer real photos (Unsplash, etc.) over AI-generated graphics for thumbnails
- When compositing text onto photos, ensure it's visible even after square cropping

### Charts & Data Visualizations
- Use **Liberation Sans** (Bold) for chart text -- closest available match to Calibri on Linux
- Clean, minimal styling: no decorative arrows, no gradients, no 3D effects
- Horizontal bar charts work well for comparisons; line charts for time-series consistency
- Terminal-style screenshots (dark bg, monospace font) are good for showing command output
- Generate with matplotlib, save to `public/images/blog/`

### Writing Style (learned from Omarchy post)
- **Casual, personal tone**: write like explaining to a friend, not a product pitch
- Use first person, share genuine reactions and specific details
- Structure: personal motivation -> setup -> results -> what I actually use it for -> verdict
- Numbered lists with bold headers work well for "reasons" sections
- Avoid AI-sounding patterns:
  - No "criminally underused", "blew me away", "game-changer", "deep dive"
  - No promotional superlatives or breathless enthusiasm
  - No smooth algorithmic transitions between paragraphs
  - No negative parallelisms ("it's not X, it's Y")
  - No bold inline headers used as emphasis crutches
  - No "kind of amazing" or hedged-then-revealed constructions
- Run the **humanizer** skill as a final pass to catch remaining AI writing patterns
- Keep backtick code references working in markdown (no literal backtick rendering)
- Numbered list items: bold header on its own line, blank line before body text

### Workflow
1. Research the topic, run actual tests/benchmarks if applicable
2. Write the post matching the casual personal style above
3. Generate charts/images with matplotlib
4. Create square thumbnail for featured_image_url, wide hero inline
5. Run humanizer skill for final tone pass
6. Build with `npx astro build` to verify
7. Deploy with `npx astro build && npx wrangler pages deploy dist/ --project-name personal-website-production`
