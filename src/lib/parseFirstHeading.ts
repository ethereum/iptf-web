/**
 * Extract the first H1 from a markdown body. Used for entries with no
 * frontmatter title (approaches, weekly-updates).
 */
export function parseFirstHeading(body: string | undefined): string {
  if (!body) return '';
  const match = body.match(/^\s*#\s+(.+?)\s*$/m);
  return match ? match[1].trim() : '';
}
