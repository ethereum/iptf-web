#!/usr/bin/env node
/**
 * Build-time validator for frontmatter cross-reference fields.
 *
 * For every approach / pattern markdown in content/, parses the
 * YAML frontmatter and checks that every slug referenced via the
 * known cross-ref paths actually resolves to an existing entry. Dangling
 * slugs are reported with file + field + slug context so the content
 * team can fix or remove them.
 *
 * Usage:
 *   node scripts/validate-content-refs.mjs           # warn, exit 0
 *   node scripts/validate-content-refs.mjs --strict  # warn, exit 1 on dangling
 *
 * Wired into `npm run prebuild` so every build prints warnings, and
 * `npm run lint:refs` runs in strict mode for CI.
 *
 * Source of truth for the cross-ref paths is FRONTMATTER_RULES in
 * src/lib/related.ts — keep this script's `RULES` in sync if more
 * fields get wired up there.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', 'content');

const COLLECTIONS = [
  'approaches',
  'patterns',
  'use-cases',
  'vendors',
  'jurisdictions',
  'rfps',
  'domains',
  'weekly-updates',
];

const SKIP_FILES = new Set(['_template.md', 'README.md']);

/*
 * Mirror of FRONTMATTER_RULES in src/lib/related.ts. Source collection
 * key → list of { path, target }. Path notation supports `foo.bar` for
 * nested objects and `foo[].bar` for collecting from arrays of objects.
 *
 * Folder names (use-cases / patterns) are used here instead of the
 * camelCase collection keys (useCases / patterns) to match the
 * filesystem layout this script walks.
 */
const RULES = {
  approaches: [
    { path: 'use_case', target: 'use-cases' },
    { path: 'related_use_cases', target: 'use-cases' },
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

function getPath(obj, p) {
  const arrIdx = p.indexOf('[].');
  if (arrIdx >= 0) {
    const head = p.slice(0, arrIdx);
    const tail = p.slice(arrIdx + 3);
    const arr = getPath(obj, head);
    if (!Array.isArray(arr)) return undefined;
    return arr.map((item) => getPath(item, tail));
  }
  let cur = obj;
  for (const segment of p.split('.')) {
    if (cur && typeof cur === 'object' && segment in cur) {
      cur = cur[segment];
    } else {
      return undefined;
    }
  }
  return cur;
}

function toSlugList(v) {
  if (!v) return [];
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  return [];
}

async function parseFrontmatter(filePath) {
  const text = await fs.readFile(filePath, 'utf-8');
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 4);
  if (end < 0) return null;
  const raw = text.slice(4, end).trim();
  try {
    const data = yaml.load(raw);
    return data && typeof data === 'object' ? data : null;
  } catch (err) {
    return { __yamlError: err.message };
  }
}

async function walkCollection(collection) {
  const dir = path.join(ROOT, collection);
  let files;
  try {
    files = await fs.readdir(dir);
  } catch {
    return [];
  }
  const entries = [];
  for (const name of files) {
    if (!name.endsWith('.md') || SKIP_FILES.has(name)) continue;
    const filePath = path.join(dir, name);
    const fm = await parseFrontmatter(filePath);
    entries.push({
      collection,
      id: name.replace(/\.md$/, ''),
      filePath: path.relative(process.cwd(), filePath),
      fm: fm ?? {},
    });
  }
  return entries;
}

async function main() {
  const strict = process.argv.includes('--strict');
  const allEntries = (await Promise.all(COLLECTIONS.map(walkCollection))).flat();

  // Build slug-set per collection
  const slugs = new Map();
  for (const c of COLLECTIONS) slugs.set(c, new Set());
  for (const e of allEntries) slugs.get(e.collection).add(e.id);

  const yamlErrors = [];
  const dangling = [];

  for (const entry of allEntries) {
    if (entry.fm.__yamlError) {
      yamlErrors.push({ file: entry.filePath, error: entry.fm.__yamlError });
      continue;
    }
    const rules = RULES[entry.collection] ?? [];
    for (const rule of rules) {
      const list = toSlugList(getPath(entry.fm, rule.path));
      for (const slug of list) {
        if (!slugs.get(rule.target).has(slug)) {
          dangling.push({
            file: entry.filePath,
            field: rule.path,
            slug,
            target: rule.target,
          });
        }
      }
    }
  }

  // Domain-resolution guard. Mirrors src/lib/domain.ts: a use-case's
  // `primary_domain` must resolve to a domain that exists in domains/.
  // Without this, an unrecognised value is silently dropped from the
  // /use-cases/ and /approaches/ listings (the original Governance bug).
  const PRIMARY_DOMAIN_ALIASES = {
    identity: 'identity-compliance',
    compliance: 'identity-compliance',
    funds: 'funds-assets',
    civic: 'governance',
  };
  const normKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const domainIds = new Set();
  const domainKeyToId = new Map();
  for (const e of allEntries) {
    if (e.collection !== 'domains' || e.fm.__yamlError) continue;
    domainIds.add(e.id);
    domainKeyToId.set(normKey(e.id), e.id);
    const title = String(e.fm.title ?? '').replace(/^Domain:\s*/i, '').trim();
    if (title) domainKeyToId.set(normKey(title), e.id);
  }
  function resolveDomain(raw) {
    if (!raw) return null;
    const k = normKey(raw);
    if (domainKeyToId.has(k)) return domainKeyToId.get(k);
    const aliasId = PRIMARY_DOMAIN_ALIASES[k];
    if (aliasId && domainIds.has(aliasId)) return aliasId;
    return null;
  }
  const unresolvedDomains = [];
  for (const e of allEntries) {
    if (e.collection !== 'use-cases' || e.fm.__yamlError) continue;
    const pd = e.fm.primary_domain;
    if (!pd || pd === '<Domain>') continue; // unset / template placeholder
    if (!resolveDomain(pd)) {
      unresolvedDomains.push({ file: e.filePath, value: pd });
    }
  }

  if (yamlErrors.length === 0 && dangling.length === 0 && unresolvedDomains.length === 0) {
    console.log('✓ content-refs validation: no dangling slugs, unresolved domains, or YAML errors');
    return;
  }

  if (yamlErrors.length > 0) {
    console.error(`\n✗ YAML parse errors (${yamlErrors.length}):`);
    for (const e of yamlErrors) {
      console.error(`  ${e.file}`);
      console.error(`    ${e.error.split('\n')[0]}`);
    }
  }

  if (dangling.length > 0) {
    console.error(`\n${strict ? '✗' : '⚠'} dangling cross-reference slugs (${dangling.length}):`);
    for (const d of dangling) {
      console.error(`  ${d.file}`);
      console.error(`    field: ${d.field}`);
      console.error(`    slug:  '${d.slug}' — not found in ${d.target}/`);
    }
    console.error(
      '\n  These slugs point at entries that don\'t exist in content/.',
    );
    console.error(
      '  Fix upstream by correcting the slug, removing the reference,',
    );
    console.error(
      '  or adding the missing entry.',
    );
  }

  if (unresolvedDomains.length > 0) {
    console.error(`\n${strict ? '✗' : '⚠'} unresolved primary_domain values (${unresolvedDomains.length}):`);
    for (const u of unresolvedDomains) {
      console.error(`  ${u.file}`);
      console.error(`    primary_domain: '${u.value}' — no matching domain in domains/`);
    }
    console.error(
      '\n  This use case will be DROPPED from /use-cases/ and /approaches/.',
    );
    console.error(
      '  Fix by aligning primary_domain to a domains/*.md id or title, or',
    );
    console.error(
      '  add an alias in PRIMARY_DOMAIN_ALIASES (src/lib/domain.ts + this script).',
    );
  }

  if (strict && (yamlErrors.length > 0 || dangling.length > 0 || unresolvedDomains.length > 0)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('content-refs validation crashed:', err);
  process.exit(2);
});
