/**
 * Filename → display code conversion for jurisdictions and similar.
 * Examples:
 *   "us-SEC"             -> "US·SEC"
 *   "eu-MiCA"            -> "EU·MICA"
 *   "de-eWpG"            -> "DE·EWPG"
 *   "int-banking-secrecy"-> "INT·BANKING-SECRECY"
 *   "hk-crypto-licensing"-> "HK·CRYPTO-LICENSING"
 */
export function jurisdictionCode(slug: string): string {
  const [region, ...rest] = slug.split('-');
  if (!region) return slug.toUpperCase();
  const tail = rest.join('-').toUpperCase();
  return tail ? `${region.toUpperCase()}·${tail}` : region.toUpperCase();
}

/**
 * Map a region string from frontmatter to a coarser bucket for grouping.
 * Source uses values like "US", "EU", "Multi-jurisdiction (CH/DE/LU/EU context)",
 * "DE", "HK", "CN", "INT".
 */
export function regionBucket(region: string | undefined | null): string {
  if (!region) return 'Other';
  const r = region.trim();
  if (/^EU\b/i.test(r) || r === 'DE' || r === 'EU') return 'Europe';
  if (r === 'US' || r === 'Americas') return 'Americas';
  if (r === 'HK' || r === 'CN' || r === 'APAC') return 'APAC';
  if (/^Multi/i.test(r) || r === 'INT' || r === 'Multi-jurisdiction') return 'Multi-jurisdiction';
  return 'Other';
}

export const REGION_ORDER = ['Europe', 'Americas', 'APAC', 'Multi-jurisdiction', 'Other'] as const;

/**
 * Strip a leading "Pattern: " / "Vendor: " / "Domain: " / "Jurisdiction: "
 * / "RFP: " / "Approach: " prefix from a title for display contexts where
 * the type is already implied.
 */
export function stripTypePrefix(title: string): string {
  return title.replace(/^(?:Pattern|Vendor|Domain|Jurisdiction|RFP|Approach):\s*/i, '');
}
