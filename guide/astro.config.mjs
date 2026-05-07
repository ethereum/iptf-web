import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  integrations: [react()],
  build: {
    assets: 'astro',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
