/**
 * Tiny inline-markdown renderer for short frontmatter strings.
 *
 * Upstream frontmatter routinely uses Markdown inline syntax inside
 * single-line YAML strings (`code` spans, occasional links). The full
 * Astro markdown renderer is overkill for these — and would handle
 * block elements that don't apply. This converts:
 *
 *   `code` → <code>code</code>
 *   [text](url) → <a href="url">text</a>
 *
 * HTML-escapes raw input before applying. Anything else passes through
 * as plain text. If frontmatter starts using more inline features
 * (bold, italics), extend here rather than reaching for a full parser.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function inlineMd(s: string | undefined | null): string {
  if (!s) return '';
  let html = escapeHtml(s);
  // [text](url) — emit before code so code in link text isn't double-processed
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) =>
    `<a href="${url}" target="_blank" rel="noopener">${text}</a>`,
  );
  // `code` spans
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}

/**
 * Renders a small block-level markdown subset to HTML — just enough
 * to lift the bullet lists used in domain ## TLDR / pattern frontmatter
 * arrays into something compositable. Anything that isn't a `- ` line
 * becomes a `<p>` of inline-rendered text.
 *
 * Not a full markdown parser. If upstream starts using nested lists,
 * tables, or other block features, switch to a real parser.
 */
export function blockMd(s: string | undefined | null): string {
  if (!s) return '';
  const lines = s.split('\n');
  const out: string[] = [];
  let listOpen = false;
  let paraBuf: string[] = [];

  function flushPara(): void {
    if (paraBuf.length === 0) return;
    out.push(`<p>${inlineMd(paraBuf.join(' '))}</p>`);
    paraBuf = [];
  }
  function closeList(): void {
    if (listOpen) {
      out.push('</ul>');
      listOpen = false;
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      closeList();
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (!listOpen) {
        out.push('<ul>');
        listOpen = true;
      }
      out.push(`<li>${inlineMd(bullet[1])}</li>`);
      continue;
    }
    closeList();
    paraBuf.push(line);
  }
  flushPara();
  closeList();
  return out.join('');
}
