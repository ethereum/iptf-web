// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkRewriteLinks } from './src/plugins/remark-rewrite-links.ts';
import { remarkApproachVariants } from './src/plugins/remark-approach-variants.ts';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.OVERRIDE_URL || 'https://ethsystems.org',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  // Legacy Jekyll URLs (permalink: /:title/, slug from filename) → new
  // title-derived slugs under /writeups/. Keeps inbound links alive
  // post-migration. Points straight at /writeups/ rather than hopping
  // through /blog/, so these stay single-hop.
  redirects: {
    // Galaxy explorer view relocated from /explore/galaxy/ to /map/.
    '/explore/galaxy/': '/map/',
    '/map/tree/': '/map/',
    // /blog/ renamed to /writeups/. The per-post redirects are generated from
    // the posts collection by src/pages/blog/[slug].astro.
    '/blog/': '/writeups/',
    '/cypherpunk-institutional-privacy': '/writeups/cypherpunk-x-institutional-privacy/',
    '/building-private-bonds-on-ethereum': '/writeups/building-private-bonds-on-ethereum/',
    '/public-rails-vs-private-ledgers': '/writeups/public-rails-vs-private-ledgers/',
    '/private-bonds-on-privacy-l2s': '/writeups/building-private-bonds-on-ethereum-part-2/',
    '/private-bonds-with-fhe': '/writeups/building-private-bonds-on-ethereum-part-3/',
    '/building-private-transfers-on-ethereum': '/writeups/building-private-transfers-on-ethereum-with-shielded-pools/',
    '/private-stablecoins-with-plasma': '/writeups/building-private-transfers-on-ethereum-with-plasma/',
    '/private-crosschain-atomic-swap-part-1': '/writeups/private-crosschain-atomic-swaps-part-1-of-2/',
    '/diy-validium': '/writeups/diy-validium-private-logic-on-public-rails/',
    '/private-crosschain-atomic-swap-part-2': '/writeups/private-crosschain-atomic-swaps-part-2-of-2/',
    '/resilient-plural-identity': '/writeups/resilient-plural-identity/',
    '/resilient-disbursement-rails': '/writeups/resilient-disbursement-rails/',
    '/resilient-civic-participation': '/writeups/resilient-civic-participation/',
    // Map jurisdiction filenames keep mixed case (id-OJK.md). Astro glob
    // ids are lowercase, so inbound mixed-case URLs need a hop.
    '/jurisdictions/id-OJK/': '/jurisdictions/id-ojk/',
    '/jurisdictions/sg-MAS/': '/jurisdictions/sg-mas/',
    '/jurisdictions/eu-EUDR/': '/jurisdictions/eu-eudr/',
    '/jurisdictions/eu-MiCA/': '/jurisdictions/eu-mica/',
    '/jurisdictions/us-SEC/': '/jurisdictions/us-sec/',
    '/jurisdictions/de-eWpG/': '/jurisdictions/de-ewpg/',
  },
  markdown: {
    remarkPlugins: [remarkRewriteLinks, remarkApproachVariants],
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
  integrations: [
    mdx(),
    react(),
    // The /blog/{slug}/ pages are redirect stubs to /writeups/{slug}/, not
    // content. Config-level redirects are already excluded by the integration;
    // page-based ones aren't, so keep them out of the sitemap explicitly.
    sitemap({ filter: (page) => !/\/blog\//.test(page) }),
  ],
});