import { getCollection } from 'astro:content';

export interface Stats {
  useCases: number;
  approaches: number;
  patterns: number;
  jurisdictions: number;
  domains: number;
  vendors: number;
  rfps: number;
  totalEntries: number;
}

/**
 * Compute live counts from content collections at build time.
 * Replaces the prototype's hardcoded "21 / 10 / 62 / 7 / 139" string literals.
 */
export async function getStats(): Promise<Stats> {
  const [useCases, approaches, patterns, jurisdictions, domains, vendors, rfps] = await Promise.all([
    getCollection('useCases'),
    getCollection('approaches'),
    getCollection('patterns'),
    getCollection('jurisdictions'),
    getCollection('domains'),
    getCollection('vendors'),
    getCollection('rfps'),
  ]);

  const totalEntries =
    useCases.length +
    approaches.length +
    patterns.length +
    jurisdictions.length +
    domains.length +
    vendors.length +
    rfps.length;

  return {
    useCases: useCases.length,
    approaches: approaches.length,
    patterns: patterns.length,
    jurisdictions: jurisdictions.length,
    domains: domains.length,
    vendors: vendors.length,
    rfps: rfps.length,
    totalEntries,
  };
}
