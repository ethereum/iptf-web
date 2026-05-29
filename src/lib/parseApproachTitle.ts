/**
 * Approaches markdown files have no YAML frontmatter — only an H1
 * (e.g. `# Approach: Private Bonds`). Extract the title from the body.
 */
export function parseApproachTitle(body: string | undefined): string {
  if (!body) return '';
  const match = body.match(/^\s*#\s+(.+?)\s*$/m);
  if (!match) return '';
  return match[1]
    .replace(/^Approach:\s*/i, '')
    .trim();
}
