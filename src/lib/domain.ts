/**
 * Domains are DATA-DRIVEN from the `domains` content collection (one
 * markdown file per domain in iptf-map). A domain's canonical name is
 * its title minus the "Domain: " prefix; its stable id is the filename
 * slug (e.g. `funds-assets`).
 *
 * Listing pages build a DomainIndex from the collection they already
 * load, so a domain ADDED or REMOVED upstream is reflected on the site
 * with no code change here. The only hand-maintained pieces are:
 *   - DISPLAY_ORDER: a SOFT ordering hint (unknown domains sort last,
 *     so a new domain still appears — just at the end until ordered).
 *   - PRIMARY_DOMAIN_ALIASES: a tiny map for abbreviations in use-case
 *     `primary_domain` values that don't normalise to a domain id/title
 *     by punctuation-stripping alone (e.g. "identity" → identity-compliance).
 *
 * Source `primary_domain` values are inconsistent ("Payments",
 * "Data Oracles", "governance", "identity"), so resolution strips all
 * non-alphanumerics before matching against each domain's id and title.
 */

/** A canonical domain display name (e.g. "Funds & Assets"). */
export type Domain = string;

/** Soft display order, keyed by domain id. Domains not listed sort to
 *  the end (alphabetically) — so new upstream domains never vanish. */
const DISPLAY_ORDER: string[] = [
  'payments',
  'funds-assets',
  'trading',
  'identity-compliance',
  'governance',
  'data-oracles',
  'custody',
  'post-quantum',
];

/** Abbreviations / messy primary_domain values whose normalised form
 *  doesn't match a domain id or title. Maps to a domain id. */
const PRIMARY_DOMAIN_ALIASES: Record<string, string> = {
  identity: 'identity-compliance',
  compliance: 'identity-compliance',
  funds: 'funds-assets',
  civic: 'governance',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export interface DomainEntryLike {
  id: string;
  data: { title?: string };
}

export interface DomainIndex {
  /** Canonical display names present in the collection, ordered. */
  names: Domain[];
  /** Resolve a raw primary_domain value to a canonical name, or null. */
  resolve(raw: string | undefined | null): Domain | null;
  /** Stable id (slug) for a canonical name — used for /domains/{id}/ links + icons. */
  idFor(name: Domain): string | undefined;
  /** Collection entry for a canonical name. */
  entryFor(name: Domain): DomainEntryLike | undefined;
}

const displayName = (d: DomainEntryLike) =>
  (d.data.title ?? d.id).replace(/^Domain:\s*/i, '').trim();

/**
 * Build a resolver/index from the `domains` collection. Callers pass
 * the already-loaded collection (await getCollection('domains')).
 */
export function buildDomainIndex(domains: DomainEntryLike[]): DomainIndex {
  const entries = domains.filter((d) => d.id.toLowerCase() !== 'readme');

  const nameById = new Map<string, Domain>();
  const idByName = new Map<Domain, string>();
  const entryByName = new Map<Domain, DomainEntryLike>();
  const idByKey = new Map<string, string>(); // normalised key -> domain id

  for (const d of entries) {
    const name = displayName(d);
    nameById.set(d.id, name);
    idByName.set(name, d.id);
    entryByName.set(name, d);
    idByKey.set(norm(d.id), d.id);
    idByKey.set(norm(name), d.id);
  }

  const orderIdx = (id: string) => {
    const i = DISPLAY_ORDER.indexOf(id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const names = entries
    .map((d) => d.id)
    .sort((a, b) => orderIdx(a) - orderIdx(b) || a.localeCompare(b))
    .map((id) => nameById.get(id)!);

  function resolveId(raw: string | undefined | null): string | null {
    if (!raw) return null;
    const k = norm(raw);
    if (idByKey.has(k)) return idByKey.get(k)!;
    const aliasId = PRIMARY_DOMAIN_ALIASES[k];
    if (aliasId && nameById.has(aliasId)) return aliasId;
    return null;
  }

  return {
    names,
    resolve(raw) {
      const id = resolveId(raw);
      return id ? nameById.get(id) ?? null : null;
    },
    idFor(name) {
      return idByName.get(name);
    },
    entryFor(name) {
      return entryByName.get(name);
    },
  };
}
