import type { CollectionEntry } from 'astro:content';

/*
 * Date gating for the `posts` collection, matching Jekyll's `future: false`:
 * a post whose `date` is in the future is hidden until the site is rebuilt at
 * or after that moment (GH Pages rebuilds on push/merge).
 *
 * Shared by every consumer of getCollection('posts') so the writeups index, the
 * homepage latest-posts list, and static path generation all agree.
 *
 * The comparison is on the full timestamp, not just the calendar day, so a
 * post can be scheduled to the hour. Give `date` a time and offset to pin a
 * release (e.g. `2026-06-11T07:00:00-04:00` for 7am ET). A bare `YYYY-MM-DD`
 * is parsed as midnight UTC, which keeps day-granular scheduling working.
 * Note this only gates the static output: a future-dated post still appears
 * only once a build actually runs at or after its `date`.
 */
export function isPublished(
  post: CollectionEntry<'posts'>,
  now: Date = new Date(),
): boolean {
  const date =
    post.data.date instanceof Date ? post.data.date : new Date(post.data.date);
  return date.getTime() <= now.getTime();
}
