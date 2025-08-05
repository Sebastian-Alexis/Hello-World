import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';
import cloudflare from '@astrojs/cloudflare';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: 'https://personal-website-production.sebastianralexis.workers.dev',
  output: 'server',
  adapter: cloudflare({
    mode: 'directory',
    routes: {
      exclude: []
    }
  }),
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
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
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
