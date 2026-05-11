/**
 * Shared markdown renderer for iptf-map content.
 *
 * Map authors write portable Markdown with relative GitHub-style links
 * (e.g. `../patterns/pattern-foo.md`). When rendered through marked() the
 * source hrefs leak into the static site as broken paths. This module
 * normalises those `.md` links to Guide routes at render time, leaving the
 * source content untouched.
 *
 * Two exports cover every call site in the Guide:
 *   - renderMarkdown(md)        — block-level (marked.parse)
 *   - renderMarkdownInline(md)  — inline-only  (marked.parseInline)
 *
 * Unresolved links are warned once at build time and passed through unchanged
 * so the page still renders; the warning surfaces real data drift in iptf-map.
 *
 * IMPORTANT: This file must stay browser-safe (no `fs` / `path` imports). It
 * ships to the client via DetailPanel.tsx (React island).
 */
import { marked } from 'marked';
import type { Tokens } from 'marked';
import graphData from '../data/graph.json';
import type { GraphData } from './graph-types';

// ─────────────────────────────────────────────────────────────────────────────
// CONTENT_DIRS — must agree with guide/scripts/build-graph.mjs#CONTENT_DIRS.
// One Node, one Vite; shared via duplication (six rows, not worth a runtime
// import boundary). If you change one, change the other.
// ─────────────────────────────────────────────────────────────────────────────
const CONTENT_DIRS = [
  { dir: 'patterns',      type: 'pattern',      route: '/patterns',      prefix: 'pattern-' },
  { dir: 'use-cases',     type: 'use-case',     route: '/use-cases',     prefix: '' },
  { dir: 'approaches',    type: 'approach',     route: '/approaches',    prefix: 'approach-' },
  { dir: 'domains',       type: 'domain',       route: '/domains',       prefix: '' },
  { dir: 'jurisdictions', type: 'jurisdiction', route: '/jurisdictions', prefix: '' },
  { dir: 'vendors',       type: 'vendor',       route: '/vendors',       prefix: '' },
] as const;

const graph = graphData as GraphData;
const nodeIds = new Set(graph.nodes.map(n => n.id));

// Dedup unresolved-link warnings across the build.
const warnedHrefs = new Set<string>();

function fileToSlug(filename: string, prefix: string): string {
  const base = filename.replace(/\.md$/, '');
  return prefix && base.startsWith(prefix) ? base.slice(prefix.length) : base;
}

interface ResolvedLink {
  route: string;     // e.g. '/patterns/foo'
  exists: boolean;   // true if the resolved node ID is in the current graph
}

/**
 * Resolve a relative .md href to a Guide route. Mirrors resolveLink() in
 * build-graph.mjs but works without a separately-passed nodeIndex.
 *
 * Returns null if the path doesn't match any known content directory.
 */
function resolveMdHref(href: string): ResolvedLink | null {
  // Strip any fragment/query so we can re-attach after route mapping.
  const hashIdx = href.indexOf('#');
  const queryIdx = href.indexOf('?');
  const cutIdx = [hashIdx, queryIdx].filter(i => i >= 0).sort((a, b) => a - b)[0];
  const suffix = cutIdx !== undefined ? href.slice(cutIdx) : '';
  const path = cutIdx !== undefined ? href.slice(0, cutIdx) : href;

  const parts = path.split('/').filter(p => p && p !== '..' && p !== '.');
  if (parts.length === 0) return null;

  const filename = parts[parts.length - 1];
  const dirName = parts.length > 1 ? parts[parts.length - 2] : null;

  // Collect every structurally plausible candidate, then prefer one that
  // resolves to a real node. Multiple dirs can share prefix='' (use-cases,
  // domains, jurisdictions, vendors) so first-match-wins gives wrong answers
  // for dir-less hrefs like `aztec.md`.
  const candidates: ResolvedLink[] = [];
  for (const cfg of CONTENT_DIRS) {
    if (dirName && dirName !== cfg.dir) continue;
    if (!dirName && cfg.prefix && !filename.startsWith(cfg.prefix)) continue;

    const slug = fileToSlug(filename, cfg.prefix);
    const id = `${cfg.type}/${slug}`;
    candidates.push({
      route: `${cfg.route}/${slug}${suffix}`,
      exists: nodeIds.has(id),
    });
  }
  if (candidates.length === 0) return null;
  return candidates.find(c => c.exists) ?? candidates[0];
}

function isAbsoluteOrAnchor(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('//') ||
    href.startsWith('#') ||
    href.startsWith('/')
  );
}

// Minimal HTML-attribute escape for href/title pass-through.
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Configure the renderer once at module load.
// ─────────────────────────────────────────────────────────────────────────────
marked.use({
  renderer: {
    link(this: any, { href, title, tokens }: Tokens.Link): string {
      const innerHtml: string = this?.parser
        ? this.parser.parseInline(tokens)
        : tokens.map((t: any) => t.raw ?? '').join('');

      let finalHref = href;

      if (!isAbsoluteOrAnchor(href)) {
        if (href.endsWith('.md') || href.includes('.md#') || href.includes('.md?')) {
          const resolved = resolveMdHref(href);
          if (resolved) {
            finalHref = resolved.route;
            if (!resolved.exists && !warnedHrefs.has(href)) {
              warnedHrefs.add(href);
              console.warn(`[render] unresolved iptf-map link: ${href} → ${resolved.route} (node not in graph)`);
            }
          } else if (!warnedHrefs.has(href)) {
            warnedHrefs.add(href);
            console.warn(`[render] unknown iptf-map link shape: ${href}`);
          }
        }
      }

      const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
      return `<a href="${escapeAttr(finalHref)}"${titleAttr}>${innerHtml}</a>`;
    },
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function renderMarkdown(md: string): string {
  return marked.parse(md) as string;
}

export function renderMarkdownInline(md: string): string {
  return marked.parseInline(md) as string;
}
