/**
 * Inline SVG icons used by anchor-nav and section headings.
 * Each is a string of the inner SVG markup (without outer attributes).
 * The component supplies viewBox, fill, stroke, etc.
 */

const wrap = (inner: string): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">${inner}</svg>`;

/** Keyed by domain ID (stable filename slug), NOT display name, so a
 *  renamed domain title keeps its icon. A new domain id with no entry
 *  here falls back to ICON_DOMAIN_DEFAULT via domainIcon(). */
const ICON_DOMAIN_BY_ID: Record<string, string> = {
  payments: wrap('<rect x="2" y="6" width="20" height="13" rx="2"/><line x1="2" y1="11" x2="22" y2="11"/>'),
  'funds-assets': wrap('<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
  trading: wrap('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
  'identity-compliance': wrap('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  governance: wrap('<polygon points="12 2 21 7 3 7"/><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="10"/><line x1="10" y1="18" x2="10" y2="10"/><line x1="14" y1="18" x2="14" y2="10"/><line x1="18" y1="18" x2="18" y2="10"/>'),
  'data-oracles': wrap('<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>'),
  custody: wrap('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  'post-quantum': wrap('<circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20"/>'),
};

/** Generic fallback for any domain id without a dedicated icon. */
const ICON_DOMAIN_DEFAULT = wrap('<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>');

/** Icon for a domain by its id (slug). Always returns something. */
export function domainIcon(id: string | undefined): string {
  if (id && ICON_DOMAIN_BY_ID[id]) return ICON_DOMAIN_BY_ID[id];
  return ICON_DOMAIN_DEFAULT;
}

export const ICON_CROSS_CUTTING: string = wrap(
  '<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z"/><line x1="10" y1="6.5" x2="14" y2="6.5"/><line x1="6.5" y1="10" x2="6.5" y2="14"/><line x1="17.5" y1="10" x2="17.5" y2="14"/><line x1="10" y1="17.5" x2="14" y2="17.5"/>',
);

export const ICON_REGION: Record<string, string> = {
  Europe: wrap('<circle cx="12" cy="12" r="10"/><path d="M12 4l1.18 3.64L17 8.6l-3 2.16.94 3.64L12 12.5l-2.94 1.9L10 10.76 7 8.6l3.82-.96z"/>'),
  Americas: wrap('<path d="M9.5 2A7.5 7.5 0 0117 9.5c0 4.142-7.5 12.5-7.5 12.5S2 13.642 2 9.5A7.5 7.5 0 019.5 2z"/><circle cx="9.5" cy="9.5" r="2.5"/>'),
  APAC: wrap('<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>'),
  'Multi-jurisdiction': wrap('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>'),
  Other: wrap('<circle cx="12" cy="12" r="10"/>'),
};

export const ICON_LAYER: Record<string, string> = {
  L1: wrap('<rect x="3" y="14" width="18" height="7" rx="1"/><rect x="6" y="9" width="12" height="3"/><rect x="9" y="4" width="6" height="3"/>'),
  L2: wrap('<rect x="3" y="14" width="18" height="7" rx="1"/><rect x="3" y="3" width="18" height="9" rx="1"/>'),
  hybrid: wrap('<circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/>'),
  unknown: wrap('<circle cx="12" cy="12" r="9"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.6"/>'),
};

export const ARROW = '→';
