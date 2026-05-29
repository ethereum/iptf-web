/**
 * Detail-page "Related" data: outgoing markdown links from a body,
 * grouped by collection, plus sibling-in-same-domain helpers.
 *
 * iptf-map cross-link conventions (verified):
 *   - `../{collection}/{slug}.md` for cross-folder
 *   - `{slug}.md` for same-folder (no `./`)
 *   - No anchor fragments are used in internal links
 *
 * The remark plugin already rewrites these to internal Astro routes at
 * render time. This module reads the *raw* body before rendering, so
 * it can independently surface the same edges in the sidebar.
 */

import { getCollection } from 'astro:content';

export type RelatedKey =
  | 'useCases'
  | 'patterns'
  | 'approaches'
  | 'jurisdictions'
  | 'vendors'
  | 'rfps';

export const RELATED_KEYS: readonly RelatedKey[] = [
  'useCases',
  'patterns',
  'approaches',
  'jurisdictions',
  'vendors',
  'rfps',
];

const FOLDER_TO_KEY: Record<string, RelatedKey> = {
  'use-cases': 'useCases',
  patterns: 'patterns',
  approaches: 'approaches',
  jurisdictions: 'jurisdictions',
  vendors: 'vendors',
  rfps: 'rfps',
};

const KEY_TO_FOLDER: Record<RelatedKey, string> = {
  useCases: 'use-cases',
  patterns: 'patterns',
  approaches: 'approaches',
  jurisdictions: 'jurisdictions',
  vendors: 'vendors',
  rfps: 'rfps',
};

const KEY_LABEL: Record<RelatedKey, string> = {
  useCases: 'Related use cases',
  patterns: 'Building blocks referenced',
  approaches: 'Approaches',
  jurisdictions: 'Jurisdictions touched',
  vendors: 'Vendors mentioned',
  rfps: 'Open RFPs',
};

export interface RelatedItem {
  label: string;
  href: string;
}

export interface RelatedGroup {
  heading: string;
  items: RelatedItem[];
}

interface Maps {
  useCases: Map<string, string>;       // slug → display title
  patterns: Map<string, string>;
  approaches: Map<string, string>;
  jurisdictions: Map<string, string>;
  vendors: Map<string, string>;
  rfps: Map<string, string>;
}

let cachedMaps: Promise<Maps> | null = null;

/**
 * Resolve a slug list into renderable {label, href} items. Unknown
 * slugs are dropped (rather than rendered as broken links) and reported
 * via the optional `unresolved` collector so detail pages can flag
 * dangling references during development.
 */
export async function resolveSlugs(
  collection: RelatedKey,
  slugs: string[] | undefined,
  unresolved?: string[],
): Promise<RelatedItem[]> {
  if (!slugs || slugs.length === 0) return [];
  const maps = await loadCollectionMaps();
  const folder = KEY_TO_FOLDER[collection];
  const out: RelatedItem[] = [];
  for (const slug of slugs) {
    const title = maps[collection].get(slug);
    if (!title) {
      unresolved?.push(slug);
      continue;
    }
    out.push({ label: title, href: `/${folder}/${slug}/` });
  }
  return out;
}

/**
 * Build a slug → title lookup across all linked collections. Cached
 * across a single build invocation. Approaches have no frontmatter title
 * so we parse the first H1 from the body; everything else uses
 * frontmatter.title with the typed-prefix stripped (e.g. "Pattern: X").
 */
export function loadCollectionMaps(): Promise<Maps> {
  if (cachedMaps) return cachedMaps;
  cachedMaps = (async () => {
    const [useCases, patterns, approaches, jurisdictions, vendors, rfps] = await Promise.all([
      getCollection('useCases'),
      getCollection('patterns'),
      getCollection('approaches'),
      getCollection('jurisdictions'),
      getCollection('vendors'),
      getCollection('rfps'),
    ]);

    function strip(t: string): string {
      return t.replace(/^(?:Pattern|Vendor|Domain|Jurisdiction|RFP|Approach):\s*/i, '');
    }
    function firstH1(body: string | undefined): string {
      if (!body) return '';
      const m = body.match(/^\s*#\s+(.+?)\s*$/m);
      return m ? m[1].replace(/^Approach:\s*/i, '').trim() : '';
    }

    return {
      useCases: new Map(useCases.map((e) => [e.id, strip(e.data.title ?? e.id)])),
      patterns: new Map(patterns.map((e) => [e.id, strip(e.data.title ?? e.id)])),
      approaches: new Map(approaches.map((e) => [e.id, firstH1(e.body) || e.id])),
      jurisdictions: new Map(jurisdictions.map((e) => [e.id, strip(e.data.title ?? e.id)])),
      vendors: new Map(vendors.map((e) => [e.id, strip(e.data.title ?? e.id)])),
      rfps: new Map(rfps.map((e) => [e.id, strip(e.data.title ?? e.id)])),
    };
  })();
  return cachedMaps;
}

/**
 * Walk a markdown body AND the entry's frontmatter cross-reference
 * fields, pull every reachable slug, resolve its display title, and
 * group by destination collection. Items unknown in the collection
 * maps are dropped silently (the build-time validator in
 * scripts/validate-content-refs.ts surfaces dangling slugs).
 *
 * Order: body links first (in appearance order), then frontmatter
 * slugs in the order FRONTMATTER_RULES declares them. Dedupes across
 * both sources so a slug that appears in both shows up once.
 */
export async function extractRelated(
  body: string | undefined,
  currentCollection?: RelatedKey,
  currentSlug?: string,
  currentData?: Record<string, unknown>,
): Promise<RelatedGroup[]> {
  if (!body && !currentData) return [];
  const maps = await loadCollectionMaps();

  const seen = new Set<string>();
  const buckets: Record<RelatedKey, RelatedItem[]> = {
    useCases: [],
    patterns: [],
    approaches: [],
    jurisdictions: [],
    vendors: [],
    rfps: [],
  };

  function tryAdd(key: RelatedKey, slug: string): void {
    if (key === currentCollection && slug === currentSlug) return;
    const dedupeKey = `${key}:${slug}`;
    if (seen.has(dedupeKey)) return;
    const title = maps[key].get(slug);
    if (!title) return; // unknown slug — skip rather than render a broken link
    seen.add(dedupeKey);
    buckets[key].push({
      label: title,
      href: `/${KEY_TO_FOLDER[key]}/${slug}/`,
    });
  }

  // (1) Body markdown links — same shape as the upstream cross-link
  // convention: [text](../folder/slug.md) for cross-folder; (slug.md)
  // for same-folder.
  if (body) {
    const linkRe = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(body)) !== null) {
      const url = m[2];
      if (!url) continue;
      if (/^[a-z]+:\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('#')) continue;
      if (url.startsWith('/')) continue;

      let folder: string | null = null;
      let slug: string | null = null;

      const cross = url.match(/^\.\.\/([^/]+)\/([^./]+)\.md(?:#.*)?$/);
      const same = url.match(/^([^./]+)\.md(?:#.*)?$/);
      if (cross) {
        [, folder, slug] = cross;
      } else if (same && currentCollection) {
        folder = KEY_TO_FOLDER[currentCollection];
        slug = same[1];
      }

      if (!folder || !slug) continue;
      const key = FOLDER_TO_KEY[folder];
      if (!key) continue;
      tryAdd(key, slug);
    }
  }

  // (2) Frontmatter cross-link fields — the structured graph the
  // upstream content team authors. This is where the connection edges
  // actually live for approaches and patterns; the body-link scan
  // above only catches whatever happened to be cited in prose.
  if (currentCollection && currentData) {
    const rules = FRONTMATTER_RULES[currentCollection] ?? [];
    for (const rule of rules) {
      for (const slug of toSlugList(getPath(currentData, rule.path))) {
        tryAdd(rule.target, slug);
      }
    }
  }

  const order: RelatedKey[] = ['approaches', 'useCases', 'patterns', 'jurisdictions', 'vendors', 'rfps'];
  const groups: RelatedGroup[] = [];
  for (const key of order) {
    if (key === currentCollection) continue;
    // Case studies (approaches) are the destination content type and
    // already appear in the highlighted "Referenced by" rail via the
    // back-reference index. Suppressing them in the outgoing rail
    // avoids the same entry appearing twice in the sidebar.
    if (key === 'approaches') continue;
    if (buckets[key].length === 0) continue;
    groups.push({ heading: KEY_LABEL[key], items: buckets[key] });
  }
  return groups;
}

/**
 * Find sibling entries (same primary_domain or same region) excluding
 * the current entry. Used for "Other use cases in {domain}" / "Other
 * jurisdictions in {region}" rails.
 */
export interface Sibling {
  label: string;
  href: string;
}

export function getSiblings<T extends { id: string }>(
  current: T,
  all: T[],
  getKey: (e: T) => string | undefined | null,
  getTitle: (e: T) => string,
  hrefBase: string,
  limit = 6,
): Sibling[] {
  const k = getKey(current);
  if (!k) return [];
  return all
    .filter((e) => e.id !== current.id && getKey(e) === k)
    .slice(0, limit)
    .map((e) => ({ label: getTitle(e), href: `${hrefBase}${e.id}/` }));
}

/*
 * Back-references / "Referenced by" — the inverse of extractRelated.
 *
 * Build a reverse index once per build: for each (target collection,
 * target slug), the list of source entries whose body links to it.
 * Then a detail template asks "who points at me?" and gets a grouped
 * list back, mirroring the outgoing-link grouping in extractRelated.
 *
 * Per the IA spec this is the single highest-leverage navigation move:
 * it turns a flat catalogue of patterns/vendors/jurisdictions into a
 * graph the reader can traverse upward (Pattern → Approaches using it,
 * Vendor → Patterns it implements, etc.).
 */

export interface BackrefItem {
  label: string;
  href: string;
}

export interface BackrefGroup {
  heading: string;
  items: BackrefItem[];
}

type BackrefKey = `${RelatedKey}:${string}`;
type RawIndex = Map<BackrefKey, BackrefItem[]>;

const BACKREF_LABEL: Record<RelatedKey, string> = {
  useCases: 'Referenced by use cases',
  approaches: 'Referenced by approaches',
  patterns: 'Referenced by building blocks',
  vendors: 'Referenced by vendors',
  jurisdictions: 'Referenced by jurisdictions',
  rfps: 'Referenced by RFPs',
};

let cachedIndex: Promise<RawIndex> | null = null;

/*
 * Per-collection frontmatter conventions for cross-links, as observed
 * in iptf-map's authored content. Each entry tells us which keys on
 * `entry.data` carry slug references to which target collection.
 */
interface FmRefRule {
  /** Path on entry.data, supports dotted notation for nested objects. */
  path: string;
  /** Target collection the slug refers to. */
  target: RelatedKey;
}

/*
 * Path notation:
 *   "use_case"                          → entry.data.use_case
 *   "related_patterns.composes_with"    → entry.data.related_patterns.composes_with
 *   "sub_patterns[].pattern"            → entry.data.sub_patterns[*].pattern
 *                                         (collects from every item)
 */
const FRONTMATTER_RULES: Partial<Record<RelatedKey, FmRefRule[]>> = {
  approaches: [
    { path: 'use_case', target: 'useCases' },
    { path: 'related_use_cases', target: 'useCases' },
    { path: 'primary_patterns', target: 'patterns' },
    { path: 'supporting_patterns', target: 'patterns' },
  ],
  patterns: [
    { path: 'related_patterns.requires', target: 'patterns' },
    { path: 'related_patterns.composes_with', target: 'patterns' },
    { path: 'related_patterns.alternative_to', target: 'patterns' },
    { path: 'related_patterns.see_also', target: 'patterns' },
    { path: 'sub_patterns[].pattern', target: 'patterns' },
  ],
};

/**
 * Resolve a dotted path against an object. Supports the `[].key`
 * suffix for collecting a property across every element of an array.
 * Returns the leaf value (string / array / object / undefined).
 */
function getPath(obj: unknown, path: string): unknown {
  // Handle the array-collection case: foo.bar[].key
  const arrIdx = path.indexOf('[].');
  if (arrIdx >= 0) {
    const head = path.slice(0, arrIdx);
    const tail = path.slice(arrIdx + 3);
    const arr = getPath(obj, head);
    if (!Array.isArray(arr)) return undefined;
    return arr.map((item) => getPath(item, tail));
  }
  let cur: unknown = obj;
  for (const segment of path.split('.')) {
    if (cur && typeof cur === 'object' && segment in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cur;
}

function toSlugList(v: unknown): string[] {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[];
  return [];
}

async function buildBackrefIndex(): Promise<RawIndex> {
  if (cachedIndex) return cachedIndex;
  cachedIndex = (async () => {
    const maps = await loadCollectionMaps();

    const [useCases, approaches, patterns, jurisdictions, vendors, rfps] = await Promise.all([
      getCollection('useCases'),
      getCollection('approaches'),
      getCollection('patterns'),
      getCollection('jurisdictions'),
      getCollection('vendors'),
      getCollection('rfps'),
    ]);

    type Src = { key: RelatedKey; id: string; body: string | undefined; data: Record<string, unknown>; title: string };
    const sources: Src[] = [];
    function push(key: RelatedKey, entries: { id: string; body: string | undefined; data: Record<string, unknown> }[]) {
      for (const e of entries) {
        sources.push({ key, id: e.id, body: e.body, data: e.data, title: maps[key].get(e.id) ?? e.id });
      }
    }
    push('useCases', useCases as unknown as Src[]);
    push('approaches', approaches as unknown as Src[]);
    push('patterns', patterns as unknown as Src[]);
    push('jurisdictions', jurisdictions as unknown as Src[]);
    push('vendors', vendors as unknown as Src[]);
    push('rfps', rfps as unknown as Src[]);

    const idx: RawIndex = new Map();

    function record(targetKey: RelatedKey, targetSlug: string, src: Src, perSrcSeen: Set<string>): void {
      // Skip self-reference
      if (targetKey === src.key && targetSlug === src.id) return;
      // Skip unknown targets (slugs that don't resolve)
      if (!maps[targetKey].has(targetSlug)) return;

      const dedupeKey = `${targetKey}:${targetSlug}`;
      if (perSrcSeen.has(dedupeKey)) return;
      perSrcSeen.add(dedupeKey);

      const bucketKey: BackrefKey = `${targetKey}:${targetSlug}`;
      if (!idx.has(bucketKey)) idx.set(bucketKey, []);
      const sourceFolder = KEY_TO_FOLDER[src.key];
      idx.get(bucketKey)!.push({
        label: src.title,
        href: `/${sourceFolder}/${src.id}/`,
      });
    }

    const linkRe = /\[[^\]]+\]\(([^)\s]+)\)/g;

    for (const src of sources) {
      const perSrcSeen = new Set<string>();

      // (1) Markdown body links: [text](../folder/slug.md) or (slug.md)
      if (src.body) {
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(src.body)) !== null) {
          const url = m[1];
          if (!url || /^[a-z]+:\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('#') || url.startsWith('/')) continue;
          const cross = url.match(/^\.\.\/([^/]+)\/([^./]+)\.md(?:#.*)?$/);
          const same = url.match(/^([^./]+)\.md(?:#.*)?$/);
          let folder: string | null = null;
          let slug: string | null = null;
          if (cross) {
            [, folder, slug] = cross;
          } else if (same) {
            folder = KEY_TO_FOLDER[src.key];
            slug = same[1];
          }
          if (!folder || !slug) continue;
          const targetKey = FOLDER_TO_KEY[folder];
          if (!targetKey) continue;
          record(targetKey, slug, src, perSrcSeen);
        }
      }

      // (2) Frontmatter cross-link fields (where the connection graph
      // actually lives for approaches/patterns — see FRONTMATTER_RULES).
      const rules = FRONTMATTER_RULES[src.key] ?? [];
      for (const rule of rules) {
        const slugs = toSlugList(getPath(src.data, rule.path));
        for (const slug of slugs) {
          record(rule.target, slug, src, perSrcSeen);
        }
      }
    }

    return idx;
  })();
  return cachedIndex;
}

/**
 * Get incoming references to a given entry, grouped by the kind of
 * source. Returns an empty array if nothing references it (so the
 * sidebar simply hides the section).
 */
export async function getReferencedBy(
  targetCollection: RelatedKey,
  targetSlug: string,
): Promise<BackrefGroup[]> {
  const idx = await buildBackrefIndex();
  const items = idx.get(`${targetCollection}:${targetSlug}`) ?? [];
  if (items.length === 0) return [];

  // Bucket by source-collection
  const buckets: Record<RelatedKey, BackrefItem[]> = {
    useCases: [],
    approaches: [],
    patterns: [],
    jurisdictions: [],
    vendors: [],
    rfps: [],
  };
  for (const it of items) {
    // Derive source collection from the href (`/{folder}/{slug}/`)
    const m = it.href.match(/^\/([^/]+)\//);
    const folder = m?.[1];
    const key = folder ? FOLDER_TO_KEY[folder] : null;
    if (!key) continue;
    buckets[key].push(it);
  }

  // Dedupe each bucket by href, sort by label
  for (const k of Object.keys(buckets) as RelatedKey[]) {
    const seen = new Set<string>();
    buckets[k] = buckets[k]
      .filter((i) => (seen.has(i.href) ? false : (seen.add(i.href), true)))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Same surface order as outgoing rail for consistency
  const order: RelatedKey[] = ['approaches', 'useCases', 'patterns', 'jurisdictions', 'vendors', 'rfps'];
  const groups: BackrefGroup[] = [];
  for (const key of order) {
    if (buckets[key].length === 0) continue;
    groups.push({ heading: BACKREF_LABEL[key], items: buckets[key] });
  }
  return groups;
}
