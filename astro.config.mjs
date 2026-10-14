import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Local dev/preview keeps the loopback origin so nothing changes for daily work.
// Publishing (e.g. GitHub Pages) sets SITE_URL and, for project sites, BASE_PATH.
// The build then rewrites every asset URL to a relative path (scripts/make-portable.mjs),
// so the output works from any folder without hard-coding an origin.
const site = process.env.SITE_URL ?? 'http://127.0.0.1:4321';
const base = process.env.BASE_PATH || undefined;

export default defineConfig({
  site,
  base,
  output: 'static',
  devToolbar: { enabled: false },
  integrations: [mdx(), sitemap()],
  server: { host: '127.0.0.1', port: 4321 },
  vite: { server: { strictPort: true } },
});
