import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import sitemap from '@astrojs/sitemap'
import { agentic } from './agentic/integration'

// The public documentation site for the RamosLabs Design System.
// Static output, one real HTML file per clean URL. Deployed to Cloudflare Pages
// at design.ramoslabs.com. `site` is the single source of the production URL —
// the agentic layer reads it, so there is no second place to keep in sync.
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://design.ramoslabs.com',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  integrations: [
    vue(),
    sitemap(),
    agentic(),
  ],
})
