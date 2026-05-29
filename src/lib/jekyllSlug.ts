/*
 * Jekyll-compatible title slugifier — matches `:title` permalink output
 * used by upstream ethereum/iptf-web so existing public URLs (e.g.
 * /cypherpunk-x-institutional-privacy/) stay valid on our side.
 */
export function jekyllSlugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
