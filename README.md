# EthSystems Website

Static website for EthSystems, live at [https://ethsystems.org/](https://ethsystems.org/).

Astro static site. Content for patterns, approaches, use-cases, vendors, domains, and jurisdictions is sourced from the [`map`](https://github.com/ethsystems/map) repo via a git submodule at `content/`. Writeups live in `src/posts/`.

## How it works

- **Astro** generates every page at build time from data in `content/` (the map submodule) and `src/posts/` (writeups).
- **GitHub Pages** auto-deploys from `main` via `.github/workflows/deploy.yml`. Changes go live within a few minutes.
- **CNAME** (`public/CNAME`) points the deployment at `ethsystems.org`.

## Repository layout

```
web/
├── astro.config.mjs       Astro configuration (site URL, integrations)
├── content/               map submodule (patterns, approaches, etc.)
├── public/                Static assets served verbatim
│   ├── assets/images/     Post hero images, diagrams
│   ├── assets/css/
│   ├── assets/js/
│   ├── tee-protocol-page.html  Standalone interactive whiteboard
│   ├── CNAME
│   └── robots.txt
├── scripts/
│   └── build-graph.mjs    Reads the map submodule → src/data/graph.json
├── src/
│   ├── data/              Generated at build (graph.json, glossary.json)
│   ├── posts/             Writeup markdown
│   ├── lib/               Data access, markdown rendering, post loader
│   ├── layouts/           Guide.astro (default), Post.astro (writeups)
│   ├── components/        React islands for /explore/* (D3, Galaxy)
│   ├── pages/
│   │   ├── index.astro    Landing
│   │   ├── about.astro
│   │   ├── writeups/index.astro   /writeups
│   │   ├── [slug].astro           /<post-slug>/ (writeups)
│   │   ├── approaches/            Case studies
│   │   ├── use-cases/
│   │   ├── patterns/
│   │   ├── vendors/
│   │   ├── domains/
│   │   ├── jurisdictions/
│   │   ├── explore/{galaxy,tree,browse}.astro   D3 explorer
│   │   ├── faq.astro
│   │   ├── glossary.astro
│   │   └── feed.xml.js    RSS feed
│   └── styles/
└── tests/                 vitest suite
```

## Running locally

Requires Node 22.

```bash
npm install
npm run dev    # http://localhost:4321
npm run build  # → ./dist
npm test
```

## Writing a writeup

Drop a file into `src/posts/` named `YYYY-MM-DD-slug.md` with frontmatter:

```yaml
---
title: "Post Title"
description: "Brief description (shown in social cards and the writeups index)."
date: 2026-01-09
author: "Author Name"
image: /assets/images/2026-01-09-slug/hero.png   # optional, hero image
---
```

The published URL is derived from the title (`/<title-slugified>/`). Hero images live under `public/assets/images/`.

Set `published: false` in frontmatter to keep a post out of the deployed site.

## Updating the map content

```bash
git submodule update --remote content
git add content
git commit -m "chore(content): bump map submodule"
```

## Source-of-truth rule

The map repo (`ethsystems/map`) main is the only source of truth for patterns, approaches, vendors, etc. Anything sourced from the submodule renders verbatim. Pages that emit map content mark each render site with `SOURCE: map field — do not alter`.

UI chrome (landing copy, FAQ, writeups index, post layout) is the site's own and stays curated here.

## Contributing

1. Branch from `main`.
2. Run `npm install && npm run dev`, verify your change.
3. Open a PR. Once merged, GH Pages redeploys within a few minutes.

## Contact

- Email: [hello@ethsystems.org](mailto:hello@ethsystems.org)
- [Book a call](https://calendar.app.google/yFK6o5Mzk7fKuu91A)

## License

All website content, writeups, pages, RFPs, writeups, and documentation are made available under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) unless otherwise stated.

Third-party dependencies retain their own licenses.
