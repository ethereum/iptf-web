/**
 * Post markdown renderer.
 *
 * Separate from `render.ts` (which is iptf-map-specific and rewrites .md links):
 * posts don't link to map nodes, but they DO contain fenced code blocks that
 * deserve syntax highlighting. Wires shiki into a dedicated marked instance.
 */
import { Marked } from 'marked';
import markedShiki from 'marked-shiki';
import { codeToHtml } from 'shiki';

const marked = new Marked();

marked.use(
  markedShiki({
    async highlight(code, lang) {
      return await codeToHtml(code, {
        lang: lang || 'text',
        theme: 'vitesse-dark',
      });
    },
  }),
);

export async function renderPost(md: string): Promise<string> {
  return (await marked.parse(md)) as string;
}
