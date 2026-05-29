/**
 * Extract a short gloss from a markdown body. Strategy:
 *   1. If the file has `## 1) Use Case` (or similar numbered section),
 *      take the first non-empty prose paragraph after it.
 *   2. Else, take the first non-empty prose paragraph in the body that
 *      isn't a heading or list.
 *   3. Truncate to ~200 characters at a word boundary.
 *
 * Pure string operations — no markdown AST. Good enough for card glosses.
 */

const MAX_LEN = 220;

export function bodyExcerpt(body: string | undefined, anchorHeading?: string): string {
  if (!body) return '';

  let segment = body;
  if (anchorHeading) {
    const re = new RegExp(`^##\\s+${escapeReg(anchorHeading)}\\s*$`, 'mi');
    const match = body.match(re);
    if (match && match.index !== undefined) {
      segment = body.slice(match.index + match[0].length);
    }
  }

  const lines = segment.split('\n');
  let para: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (para.length > 0) break;
      continue;
    }
    if (line.startsWith('#') || line.startsWith('-') || line.startsWith('*') ||
        line.startsWith('>') || /^\d+[).]/.test(line) || line.startsWith('```')) {
      if (para.length > 0) break;
      continue;
    }
    para.push(line);
  }

  let text = para.join(' ').replace(/\s+/g, ' ').trim();
  // Strip simple markdown formatting
  text = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  if (text.length <= MAX_LEN) return text;
  const cut = text.lastIndexOf(' ', MAX_LEN);
  return (cut > 0 ? text.slice(0, cut) : text.slice(0, MAX_LEN)).replace(/[.,;:]$/, '') + '…';
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract top-level bullet items from the markdown section under
 * `anchorHeading`. Returns plain-text items with inline markdown
 * (links, bold, italic, code) stripped. Returns [] if the section
 * doesn't exist or has no bullets.
 *
 * Used by /domains/ where every `## TLDR` is authored as a bullet
 * list — `bodyExcerpt` skips bullets, so it would return ''.
 */
export function bodyBulletList(
  body: string | undefined,
  anchorHeading: string,
): string[] {
  if (!body) return [];
  const re = new RegExp(`^##\\s+${escapeReg(anchorHeading)}\\s*$`, 'mi');
  const match = body.match(re);
  if (!match || match.index === undefined) return [];
  const segment = body.slice(match.index + match[0].length);
  const items: string[] = [];
  for (const raw of segment.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('## ')) break;
    if (!/^[-*]\s+/.test(line)) continue;
    const text = line
      .replace(/^[-*]\s+/, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    items.push(text);
  }
  return items;
}

/**
 * Extract a full markdown section (between the anchor H2 and the next H2,
 * non-inclusive on both sides). Returns null if the anchor heading isn't
 * present in the body. Used by listing pages to surface a domain's
 * ## TLDR / a jurisdiction's ## At a Glance / etc. without fabricating
 * primer copy.
 */
export function bodySection(body: string | undefined, anchorHeading: string): string | null {
  if (!body) return null;
  const startRe = new RegExp(`^##\\s+${escapeReg(anchorHeading)}\\s*$`, 'mi');
  const startMatch = body.match(startRe);
  if (!startMatch || startMatch.index === undefined) return null;
  const afterHeading = body.slice(startMatch.index + startMatch[0].length);
  const endMatch = afterHeading.match(/^##\s+/m);
  const slice = endMatch && endMatch.index !== undefined
    ? afterHeading.slice(0, endMatch.index)
    : afterHeading;
  return slice.trim() || null;
}

/**
 * Pop a section out of the markdown body. Returns:
 *   - content: the section's first paragraph as plain text, with
 *     inline markdown (links, bold, italic, code) stripped — ready
 *     to use as a page lede without rendering raw `[text](url)`
 *   - bodyWithout: the original markdown with the entire section
 *     (heading + all paragraphs inside it) removed, so it can be
 *     rendered without showing the same prose twice
 *
 * Used on detail pages to lift the leading anchor section
 * (## Intent / ## 1) Use Case / ## TLDR / ## At a Glance / etc.)
 * into the hero lede without duplicating it inside the body.
 */
export function popSection(
  body: string | undefined,
  anchorHeading: string,
): { content: string; bodyWithout: string } {
  if (!body) return { content: '', bodyWithout: '' };
  const startRe = new RegExp(`^##\\s+${escapeReg(anchorHeading)}\\s*$`, 'mi');
  const startMatch = body.match(startRe);
  if (!startMatch || startMatch.index === undefined) {
    return { content: '', bodyWithout: body };
  }
  const sectionStart = startMatch.index;
  const afterHeading = body.slice(sectionStart + startMatch[0].length);
  const endMatch = afterHeading.match(/^##\s+/m);
  const sectionEnd = endMatch && endMatch.index !== undefined
    ? sectionStart + startMatch[0].length + endMatch.index
    : body.length;
  const rawSection = body.slice(sectionStart + startMatch[0].length, sectionEnd);

  // Pull just the first paragraph of the section for the lede —
  // multi-paragraph sections (use-case "1) Use Case" often has a
  // descriptive paragraph followed by a "See also" paragraph) shouldn't
  // dump the whole thing under the title.
  const lines = rawSection.split('\n');
  const para: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (para.length > 0) break;
      continue;
    }
    if (line.startsWith('#') || line.startsWith('-') || line.startsWith('*') ||
        line.startsWith('>') || /^\d+[).]/.test(line) || line.startsWith('```')) {
      if (para.length > 0) break;
      continue;
    }
    para.push(line);
  }
  const text = para.join(' ').replace(/\s+/g, ' ').trim();
  const content = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  const bodyWithout = (body.slice(0, sectionStart) + body.slice(sectionEnd))
    .replace(/^\n+/, '')
    .trim();
  return { content, bodyWithout };
}
