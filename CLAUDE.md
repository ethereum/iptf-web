# CLAUDE.md - Project Instructions

## Project Overview

This is the IPTF (Institutional Privacy Task Force) website repository. Astro static site deployed at https://iptf.ethereum.org/.

Map content (patterns, approaches, use-cases, vendors, domains, jurisdictions) is the projection of the [`iptf-map`](https://github.com/ethereum/iptf-map) repo, pinned as a submodule at `content/`. Blog writeups live in `src/posts/`.

## Tech Stack

- **Astro** (static site generator, Node 22)
- **React** islands for the `/explore/*` D3 explorer views
- **marked** for Markdown rendering
- **Tailwind CSS v4**
- **GitHub Pages** for hosting + auto-deploy from `main`

## Key Files

- `astro.config.mjs` — Astro config (site URL, integrations).
- `content/` — iptf-map submodule.
- `scripts/build-graph.mjs` — Reads iptf-map → `src/data/graph.json`.
- `src/posts/` — Blog post markdown (filename: `YYYY-MM-DD-slug.md`).
- `src/pages/` — Routes. `blog/[slug].astro` is the post detail page.
- `src/layouts/` — `Guide.astro` (default), `Post.astro` (writeups).
- `src/lib/` — Data access (`data.ts`), post loader (`posts.ts`), markdown renderer (`render.ts`).
- `public/` — Static assets served verbatim (`assets/`, `CNAME`, `robots.txt`, `tee-protocol-page.html`).
- `.github/workflows/deploy.yml` — GH Pages build + deploy.

## Development

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # → ./dist
npm test
```

Requires Node 22.

## Source-of-truth rule

iptf-map main is the only source of truth for map content. Anything sourced from the submodule renders verbatim. Render sites are marked with `SOURCE: iptf-map field — do not alter` comments.

UI chrome (landing copy, FAQ, blog index, post layout) is the site's own and stays curated.

## Commit conventions

Semantic / conventional commits:

- `feat:` new features or content
- `fix:` bug fixes
- `docs:` documentation
- `chore:` maintenance, dependencies
- `refactor:` reorganization without behaviour change

## Blog posts

### Frontmatter template

```yaml
---
title: "Post Title"
description: "Brief description (shown in social cards and the blog index)."
date: 2026-01-09
author: "Author Name"
image: /assets/images/2026-01-09-slug/hero.png
---
```

The published URL derives from the title via Jekyll-compatible slugify. Hero images live under `public/assets/images/`. Set `published: false` to keep a post out of the live site.

### Hero images

- Recommended size: 1200x600px (2:1 ratio) for OG / Twitter cards.
- Location: `public/assets/images/<date-slug>/`.
- Format: JPG, PNG, WEBP, or SVG.

## Updating iptf-map content

```bash
git submodule update --remote content
git add content
git commit -m "chore(content): bump iptf-map submodule"
```

## Deployment

- Deploy from `main` only.
- Push or merge → GitHub Actions builds Astro and deploys to GH Pages.
- Live within a few minutes.
- Don't modify `public/CNAME` unless changing the domain.

## License

CC0 1.0 Universal (Public Domain)
