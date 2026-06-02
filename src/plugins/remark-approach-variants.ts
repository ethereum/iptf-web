/**
 * Remark plugin: Approach pages contain multiple design variants embedded
 * inline. Each variant is an H3 heading followed by a fenced ```yaml block
 * carrying metadata, then prose. The raw rendering ships the YAML as a
 * code fence, which signals "for machines" to institutional readers.
 *
 * This plugin transforms each variant section into a collapsible
 * <details> element:
 *   - <summary> shows the variant title, maturity, context (I2I/I2U),
 *     and a chip row of building blocks used.
 *   - <div class="variant-body"> wraps the original prose, ending with
 *     a "View PoC spec" button when `poc_spec` is present.
 *
 * Detection is structural (heading-depth 3 + adjacent yaml code block),
 * so the plugin is a no-op on documents that don't follow this pattern.
 */

import type { Root, Heading, Code, RootContent } from 'mdast';
import type { Plugin } from 'unified';
import { statusTone } from '../lib/statusTone';

interface VariantMeta {
  maturity?: string;
  context?: string;
  crops?: Record<string, string>;
  uses_patterns?: string[];
  example_vendors?: string[];
  poc_spec?: string;
}

function parseSimpleYaml(src: string): VariantMeta {
  const out: Record<string, unknown> = {};
  for (const raw of src.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const v = m[2].trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      out[key] = v
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (v.startsWith('{') && v.endsWith('}')) {
      const obj: Record<string, string> = {};
      for (const part of v.slice(1, -1).split(',')) {
        const idx = part.indexOf(':');
        if (idx < 0) continue;
        const k = part.slice(0, idx).trim();
        const vv = part.slice(idx + 1).trim();
        if (k) obj[k] = vv;
      }
      out[key] = obj;
    } else {
      out[key] = v;
    }
  }
  return out as VariantMeta;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return map[c]!;
  });
}

const CONTEXT_LABEL: Record<string, string> = {
  i2i: 'B2B',
  i2u: 'B2C',
  both: 'B2B + B2C',
};
const CONTEXT_TITLE: Record<string, string> = {
  i2i: 'Institution → Institution',
  i2u: 'Institution → User',
  both: 'Both contexts',
};

function summaryHtml(headingText: string, meta: VariantMeta): string {
  const tag = (cls: string, content: string, title?: string) =>
    `<span class="${cls}"${title ? ` title="${esc(title)}"` : ''}>${content}</span>`;

  const metaPills: string[] = [];
  if (meta.maturity) {
    metaPills.push(tag(`variant-maturity tone-${statusTone(meta.maturity)}`, esc(meta.maturity)));
  }
  if (meta.context) {
    const label = CONTEXT_LABEL[meta.context] ?? meta.context;
    const titleText = CONTEXT_TITLE[meta.context] ?? meta.context;
    metaPills.push(tag(`variant-context context-${meta.context}`, esc(label), titleText));
  }

  // Pattern chips intentionally removed from the variant summary —
  // the building blocks used by a variant are documented in the
  // expanded prose body and cross-referenced via the RailConnections
  // sidebar. A long chip list under every headline was noise.
  return `<summary class="variant-summary"><div class="variant-summary-head"><span class="variant-title">${esc(headingText)}</span><span class="variant-toggle" aria-hidden="true"></span></div>${
    metaPills.length ? `<div class="variant-pills">${metaPills.join('')}</div>` : ''
  }</summary>`;
}

function pocButtonHtml(meta: VariantMeta): string {
  const links: string[] = [];
  if (meta.poc_spec) {
    const url = `https://github.com/ethereum/iptf-pocs/blob/master/${meta.poc_spec}`;
    links.push(
      `<a href="${esc(url)}" class="variant-poc-btn" target="_blank" rel="noopener">View PoC spec <span class="arr">↗</span></a>`,
    );
  }
  if (meta.example_vendors?.length) {
    const vendorLinks = meta.example_vendors
      .map((slug) => `<a class="variant-vendor" href="/vendors/${esc(slug)}/">${esc(slug)}</a>`)
      .join('');
    links.push(`<span class="variant-vendors-line">Example vendors: ${vendorLinks}</span>`);
  }
  if (!links.length) return '';
  return `<div class="variant-foot">${links.join('')}</div>`;
}

export const remarkApproachVariants: Plugin<[], Root> = () => {
  return (tree) => {
    const children = tree.children;
    const next: RootContent[] = [];
    let i = 0;
    while (i < children.length) {
      const node = children[i];
      const peek = children[i + 1];
      const isVariantStart =
        node?.type === 'heading' &&
        (node as Heading).depth === 3 &&
        peek?.type === 'code' &&
        (peek as Code).lang === 'yaml';

      if (!isVariantStart) {
        next.push(node);
        i++;
        continue;
      }

      const heading = node as Heading;
      const yaml = peek as Code;
      const headingText = heading.children
        .map((c) => ('value' in c ? c.value : ''))
        .join('')
        .trim();
      const meta = parseSimpleYaml(yaml.value);

      // Collect variant body: from i+2 until next heading at depth ≤ 3
      // (next variant or new top-level section)
      let j = i + 2;
      while (j < children.length) {
        const c = children[j];
        if (c?.type === 'heading' && (c as Heading).depth <= 3) break;
        j++;
      }
      const body = children.slice(i + 2, j);

      next.push({
        type: 'html',
        value: `<details class="variant">${summaryHtml(headingText, meta)}\n<div class="variant-body">`,
      });
      next.push(...body);
      next.push({
        type: 'html',
        value: `${pocButtonHtml(meta)}\n</div></details>`,
      });

      i = j;
    }
    tree.children = next;
  };
};

export default remarkApproachVariants;
