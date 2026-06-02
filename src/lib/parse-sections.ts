/**
 * Parse markdown body into named sections split by ## headings.
 * Returns a map of section name → content lines.
 */
export interface Section {
  heading: string;       // Raw heading text, e.g. "Protocol (concise)"
  key: string;           // Normalized key, e.g. "protocol"
  content: string;       // Markdown content under this heading
  items: string[];       // List items extracted (for bullet/step sections)
}

export function parseSections(body: string): Section[] {
  const sections: Section[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of body.split('\n')) {
    const match = line.match(/^## (.+)/);
    if (match) {
      if (current) {
        sections.push(buildSection(current.heading, current.lines));
      }
      current = { heading: match[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) {
    sections.push(buildSection(current.heading, current.lines));
  }

  return sections;
}

function buildSection(heading: string, lines: string[]): Section {
  const content = lines.join('\n').trim();

  // Extract list items (lines starting with - or numbered), strip markdown bold
  const items = lines
    .map(l => l.trim())
    .filter(l => l.startsWith('- ') || l.match(/^\d+\.\s/))
    .map(l => l.replace(/^-\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*/g, ''));

  // Normalize heading to a key
  const key = heading
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')  // strip parenthetical like "(concise)"
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return { heading, key, content, items };
}

/** Get a section by key, returns undefined if not found */
export function getSection(sections: Section[], key: string): Section | undefined {
  return sections.find(s => s.key === key || s.key.startsWith(key));
}

export interface SubSection {
  heading: string;
  key: string;
  content: string;
}

/** Split a section's content by ### subheadings. */
export function parseSubSections(content: string): SubSection[] {
  const subs: SubSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of content.split('\n')) {
    const match = line.match(/^### (.+)/);
    if (match) {
      if (current) subs.push(buildSub(current.heading, current.lines));
      current = { heading: match[1].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) subs.push(buildSub(current.heading, current.lines));
  return subs;
}

function buildSub(heading: string, lines: string[]): SubSection {
  const key = heading
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { heading, key, content: lines.join('\n').trim() };
}

/** Extract a labelled paragraph block like "**Summary:** text..." up to the next
 *  bold label or blank-line gap. Returns the text after the label, or empty. */
export function extractLabelledBlock(content: string, label: string): string {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\s*\\n\\*\\*[A-Z]|\\n#|$)`, 'i');
  const m = content.match(re);
  return m ? m[1].trim() : '';
}

/** Pull a fenced ```yaml ... ``` block (first match). */
export function extractYamlBlock(content: string): string {
  const m = content.match(/```yaml\s*\n([\s\S]*?)\n```/);
  return m ? m[1] : '';
}
