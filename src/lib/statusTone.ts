/**
 * Single source of tone classification for status / maturity labels.
 *
 * The chip-vocabulary used on listing cards (ApproachCard, PatternCard,
 * UseCaseCard) and on page-header pills maps the same status word to
 * the same colour everywhere. Three tones:
 *
 *   strong — shipped / production / pilot / implemented / published
 *   mid    — pre-shipping signal: prototype, benchmarked, testnet, PoC
 *   plain  — neutral default (draft, no value, unknown)
 *
 * Note: `draft` deliberately maps to `plain`, not `mid`. Most approach
 * frontmatter currently carries `status: draft`; styling them all amber
 * would be visually noisy and inaccurate. Once frontmatter starts
 * distinguishing "draft" from richer states (e.g., "review"), revisit.
 */

export type StatusTone = 'strong' | 'mid' | 'plain';

export function statusTone(s?: string): StatusTone {
  if (!s) return 'plain';
  const v = s.toLowerCase();
  if (
    v.includes('production') ||
    v.includes('publish') ||
    v.includes('pilot') ||
    v.includes('implement') ||
    v.includes('ready')
  ) return 'strong';
  if (
    v.includes('prototyp') ||
    v.includes('testnet') ||
    v.includes('poc') ||
    v.includes('benchmark') ||
    v.includes('review')
  ) return 'mid';
  return 'plain';
}
