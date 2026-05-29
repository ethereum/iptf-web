// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { remarkRewriteLinks } from './src/plugins/remark-rewrite-links.ts';
import { remarkApproachVariants } from './src/plugins/remark-approach-variants.ts';

import react from '@astrojs/react';

export default defineConfig({
  site: 'https://iptf.netlify.app',
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  markdown: {
    remarkPlugins: [remarkRewriteLinks, remarkApproachVariants],
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
  integrations: [mdx(), react()],
});