/*
 * Mixed-case → lowercase redirects for content-collection routes.
 *
 * Map filenames keep their original case (`id-OJK.md`, `de-eWpG.md`) but
 * Astro's glob loader lowercases entry ids, so pages are served at
 * `/jurisdictions/id-ojk/`. Anything that linked to the filename casing —
 * old bookmarks, external references, upstream docs — needs a hop.
 *
 * Generated from the content tree rather than hand-listed so a new
 * mixed-case upstream file cannot silently reintroduce the 404.
 */

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { toContentSlug } from './slugify';

// Content directories that have a matching `src/pages/<dir>/[slug].astro`
// route. `weekly-updates` is loaded as a collection but never routed.
const ROUTED_CONTENT_DIRS = [
  'approaches',
  'domains',
  'jurisdictions',
  'patterns',
  'rfps',
  'use-cases',
  'vendors',
] as const;

// Mirrors the `EXCLUDE` glob in src/content.config.ts — these are not entries.
const SKIP_FILES = new Set(['README.md', '_template.md']);

export function contentCaseRedirects(contentBase = 'content'): Record<string, string> {
  const redirects: Record<string, string> = {};

  for (const dir of ROUTED_CONTENT_DIRS) {
    let files: string[];
    try {
      files = readdirSync(join(contentBase, dir));
    } catch {
      // Submodule not checked out (e.g. a fresh clone without `--recursive`).
      // Skip rather than fail the config load.
      continue;
    }

    for (const name of files) {
      if (!name.endsWith('.md') || SKIP_FILES.has(name)) continue;
      const filename = name.replace(/\.md$/, '');
      const id = toContentSlug(filename);
      if (id === filename) continue;
      redirects[`/${dir}/${filename}/`] = `/${dir}/${id}/`;
    }
  }

  return redirects;
}
