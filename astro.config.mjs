// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkRewriteLinks } from './src/plugins/remark-rewrite-links.ts';
import { remarkApproachVariants } from './src/plugins/remark-approach-variants.ts';

import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://iptf.ethereum.org',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  // Legacy Jekyll URLs (permalink: /:title/, slug from filename) → new
  // title-derived slugs under /blog/. Keeps inbound links alive post-migration.
  redirects: {
    '/cypherpunk-institutional-privacy': '/blog/cypherpunk-x-institutional-privacy/',
    '/building-private-bonds-on-ethereum': '/blog/building-private-bonds-on-ethereum/',
    '/public-rails-vs-private-ledgers': '/blog/public-rails-vs-private-ledgers/',
    '/private-bonds-on-privacy-l2s': '/blog/building-private-bonds-on-ethereum-part-2/',
    '/private-bonds-with-fhe': '/blog/building-private-bonds-on-ethereum-part-3/',
    '/building-private-transfers-on-ethereum': '/blog/building-private-transfers-on-ethereum-with-shielded-pools/',
    '/private-stablecoins-with-plasma': '/blog/building-private-transfers-on-ethereum-with-plasma/',
    '/private-crosschain-atomic-swap-part-1': '/blog/private-crosschain-atomic-swaps-part-1-of-2/',
    '/diy-validium': '/blog/diy-validium-private-logic-on-public-rails/',
    '/private-crosschain-atomic-swap-part-2': '/blog/private-crosschain-atomic-swaps-part-2-of-2/',
    '/resilient-plural-identity': '/blog/resilient-plural-identity/',
    '/resilient-disbursement-rails': '/blog/resilient-disbursement-rails/',
    '/resilient-civic-participation': '/blog/resilient-civic-participation/',
  },
  markdown: {
    remarkPlugins: [remarkRewriteLinks, remarkApproachVariants],
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
  integrations: [mdx(), react(), sitemap()],
});