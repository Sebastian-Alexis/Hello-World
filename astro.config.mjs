import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';

export default defineConfig({
  site: 'https://yoursite.com',
  output: 'server',
  integrations: [
    svelte(),
    tailwind({
      applyBaseStyles: false
    }),
    sitemap(),
    compress({
      CSS: true,
      HTML: {
        removeAttributeQuotes: false,
        collapseWhitespace: true,
        removeComments: true
      },
      JavaScript: true,
      SVG: true
    })
  ],
  build: {
    inlineStylesheets: 'auto',
    splitting: true,
    assets: 'assets'
  },
  vite: {
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'flight-map': ['@deck.gl/core', '@deck.gl/layers'],
            'admin': ['@libsql/client']
          }
        }
      }
    }
  }
});
