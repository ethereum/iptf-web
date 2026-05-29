/**
 * Remark plugin: rewrite relative markdown cross-links from iptf-map
 * (e.g. "../approaches/approach-private-bonds.md") into internal Astro
 * routes ("/approaches/approach-private-bonds/").
 *
 * iptf-map convention (verified across the repo):
 *   - All internal links are relative paths to .md files.
 *   - Anchor fragments are not used in internal links.
 *   - Same-folder links use `filename.md` (no `./`).
 *   - Cross-folder links use `../{collection}/filename.md`.
 *   - Folder names: use-cases, patterns, approaches, domains,
 *     jurisdictions, vendors, rfps.
 *   - Special: `../GLOSSARY.md` and `../CHANGELOG.md` route to upstream
 *     GitHub blob (we don't render those locally).
 *
 * The plugin detects the source collection from the vfile path so it can
 * resolve same-folder links correctly without per-file configuration.
 */

import { visit } from 'unist-util-visit';
import type { Root, Link, Text } from 'mdast';
import type { Plugin } from 'unified';
import type { VFile } from 'vfile';

const KNOWN_COLLECTIONS = new Set([
  'use-cases',
  'patterns',
  'approaches',
  'domains',
  'jurisdictions',
  'vendors',
  'rfps',
]);

const GITHUB_BLOB = 'https://github.com/ethereum/iptf-map/blob/master';

const TYPE_PREFIXES = ['approach', 'pattern', 'rfp', 'domain', 'jurisdiction', 'vendor'];

function detectCollection(vfile: VFile): string | null {
  if (!vfile.path) return null;
  const segments = vfile.path.split('/');
  for (let i = segments.length - 2; i >= 0; i--) {
    if (KNOWN_COLLECTIONS.has(segments[i])) return segments[i];
  }
  return null;
}

/**
 * Convert a slug like "approach-private-bonds" into a readable label
 * like "Private Bonds". Strips the known type prefix and title-cases
 * the rest. Not as accurate as the actual frontmatter title, but a
 * dramatic improvement over a raw `.md` filename appearing as link
 * text in body prose.
 */
function humaniseSlug(slug: string): string {
  let s = slug;
  for (const p of TYPE_PREFIXES) {
    if (s.startsWith(`${p}-`)) {
      s = s.slice(p.length + 1);
      break;
    }
  }
  return s
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Detect the "filename as label" anti-pattern in markdown source —
 * e.g. `[approach-private-bonds.md](../approaches/approach-private-bonds.md)` —
 * and replace the visible text with a humanised slug.
 */
function rewriteFilenameLabel(node: Link): void {
  if (node.children.length !== 1 || node.children[0].type !== 'text') return;
  const text = node.children[0] as Text;
  const v = text.value;
  // Cross-folder pattern: "../folder/slug.md"
  const cross = v.match(/^\.\.\/[^/]+\/([^./]+)\.md$/);
  // Same-folder pattern: "slug.md"
  const same = v.match(/^([^./]+)\.md$/);
  const slug = cross?.[1] ?? same?.[1];
  if (!slug) return;
  text.value = humaniseSlug(slug);
}

export const remarkRewriteLinks: Plugin<[], Root> = () => {
  return (tree, vfile) => {
    const currentCollection = detectCollection(vfile as VFile);

    visit(tree, 'link', (node: Link) => {
      // Replace any "filename.md" visible text with a humanised slug
      // before we touch the URL. Operates on the text node so the
      // URL rewrite below stays independent.
      rewriteFilenameLabel(node);

      const url = node.url;
      if (!url) return;

      // External / absolute / mailto / fragment-only — leave alone
      if (/^[a-z]+:\/\//i.test(url)) return;
      if (url.startsWith('mailto:')) return;
      if (url.startsWith('#')) return;
      if (url.startsWith('/')) return;

      // Top-level repo files: `../GLOSSARY.md`, `../CHANGELOG.md`, etc.
      const topLevelMatch = url.match(/^\.\.\/([A-Z][A-Z_-]*\.md)$/);
      if (topLevelMatch) {
        node.url = `${GITHUB_BLOB}/${topLevelMatch[1]}`;
        return;
      }

      // Cross-folder: `../{collection}/{slug}.md` (optional anchor)
      const crossMatch = url.match(/^\.\.\/([^/]+)\/([^./]+)\.md(#.*)?$/);
      if (crossMatch) {
        const [, collection, slug, anchor] = crossMatch;
        if (KNOWN_COLLECTIONS.has(collection)) {
          node.url = `/${collection}/${slug}/${anchor ?? ''}`;
          return;
        }
        node.url = `${GITHUB_BLOB}/${collection}/${slug}.md${anchor ?? ''}`;
        return;
      }

      // Same-folder: `filename.md` (optional anchor)
      const sameMatch = url.match(/^([^./]+)\.md(#.*)?$/);
      if (sameMatch && currentCollection) {
        const [, slug, anchor] = sameMatch;
        node.url = `/${currentCollection}/${slug}/${anchor ?? ''}`;
        return;
      }

      // Anything else: leave untouched. Build will surface 404s in dev.
    });
  };
};

export default remarkRewriteLinks;
