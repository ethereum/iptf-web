import { describe, it, expect } from 'vitest';
import { contentCaseRedirects } from '../src/lib/content-redirects';

/*
 * Guards the mixed-case → lowercase hop. Astro's glob loader lowercases
 * entry ids, so `content/jurisdictions/id-OJK.md` is served at
 * `/jurisdictions/id-ojk/` and the filename-cased URL must redirect.
 */
describe('contentCaseRedirects', () => {
  const redirects = contentCaseRedirects();

  it('redirects mixed-case jurisdiction filenames to their lowercase route', () => {
    expect(redirects['/jurisdictions/id-OJK/']).toBe('/jurisdictions/id-ojk/');
    expect(redirects['/jurisdictions/eu-MiCA/']).toBe('/jurisdictions/eu-mica/');
    expect(redirects['/jurisdictions/de-eWpG/']).toBe('/jurisdictions/de-ewpg/');
  });

  it('covers every mixed-case entry in the routed content tree', () => {
    for (const [from, to] of Object.entries(redirects)) {
      expect(from).not.toBe(to);
      expect(to).toBe(from.toLowerCase());
    }
  });

  it('does not emit no-op redirects for already-lowercase entries', () => {
    expect(redirects['/jurisdictions/eu-data-protection/']).toBeUndefined();
    expect(redirects['/jurisdictions/id-ojk/']).toBeUndefined();
  });

  it('skips README and template files that are not collection entries', () => {
    expect(redirects['/patterns/README/']).toBeUndefined();
    expect(redirects['/use-cases/README/']).toBeUndefined();
  });

  it('returns an empty map when the content submodule is absent', () => {
    expect(contentCaseRedirects('does-not-exist')).toEqual({});
  });
});
