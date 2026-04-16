# Deployment

This site is deployed to **Cloudflare Pages** (project: `personal-website-production`).

Custom domain: `sebastianalexis.com`

## Deploy

```bash
npx astro build && npx wrangler pages deploy dist/ --project-name personal-website-production
```

## Notes

- Output mode is `static` (no SSR/Workers adapter needed)
- DNS is managed via Cloudflare (zone on Cloudflare, CNAME to `personal-website-production.pages.dev`)
- Wrangler OAuth token does not have DNS write access; DNS changes must be done in the Cloudflare dashboard
- `src/content/` and `src/data/` are not tracked in git; they exist only locally and are included in the build output when deploying from this machine

## Adding Projects to My Work

Projects are defined in the `projects` array in `src/pages/work.astro`. Each entry has this shape:

```ts
{
  title: string;           // Project name
  description: string;     // 1-2 sentence blurb
  tags: string[];          // e.g. ['Web', 'Hardware', 'Research']
  youtubeId?: string;      // YouTube video ID (used instead of thumbnail)
  thumbnail?: string;      // Path to image in public/ (e.g. '/images/foo.png')
  thumbnailBg?: string;    // Optional background color for non-rectangular images (e.g. '#f5f0e1')
  links: { label: string; url: string }[];  // Action links (Visit Site, GitHub, Paper, etc.)
  awards?: string[];       // Optional awards/accolades shown below title
}
```

### Steps

1. **Image**: Place the thumbnail in `public/images/`. For websites, take a screenshot with `agent-browser`. For YouTube videos, use `youtubeId` instead of `thumbnail`. For pixel art or logos, set `thumbnailBg` to a background color so the image displays with `object-contain` + padding.
2. **PDFs/papers**: Place in `public/papers/` and link as `/papers/filename.pdf`.
3. **Entry**: Add a new object to the `projects` array in `src/pages/work.astro`. Order in the array = order on the page.
4. **Build**: Run `npx astro build` to verify.
