import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { jekyllSlugify } from '../lib/jekyllSlug';
import { isPublished } from '../lib/posts';
import { site } from '../lib/site';

/*
 * /rss.xml — feed for the long-form writeups at /writeups/.
 *
 * Mirrors the writeups index exactly: same `posts` collection, same
 * isPublished date gate, same title-derived slugs, newest-first.
 * Discovered via the <link rel="alternate"> tag in BaseLayout.
 */

function escapeXml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export async function GET(context: APIContext) {
  const all = await getCollection('posts');
  const posts = all
    .filter((p) => isPublished(p))
    .map((p) => ({
      title: p.data.title,
      description: p.data.description ?? '',
      link: `/writeups/${jekyllSlugify(p.data.title)}/`,
      pubDate:
        p.data.date instanceof Date ? p.data.date : new Date(p.data.date),
      author: p.data.author,
    }))
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: `${site.name} · Writeups`,
    description:
      'Field notes from EthSystems on building privacy on Ethereum for institutional use cases.',
    site: context.site ?? site.domain,
    // dc:creator carries the author name; the RSS <author> element
    // requires an email address, which posts don't have.
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    items: posts.map((p) => ({
      title: p.title,
      description: p.description,
      link: p.link,
      pubDate: p.pubDate,
      ...(p.author
        ? { customData: `<dc:creator>${escapeXml(p.author)}</dc:creator>` }
        : {}),
    })),
  });
}
