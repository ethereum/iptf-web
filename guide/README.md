# IPTF Guide

Astro static site that renders the [iptf-map](https://github.com/ethereum/iptf-map)
into an institutional-facing guide. The map repo is the only source of truth
for content — this app builds presentation around it.

## Layout

```
guide/
├── scripts/
│   └── build-graph.mjs       # Reads iptf-map → src/data/graph.json
├── src/
│   ├── data/
│   │   ├── graph.json        # Generated. nodes + edges from iptf-map
│   │   └── glossary.json     # Generated. parsed from iptf-map/GLOSSARY.md
│   ├── lib/
│   │   ├── data.ts           # Reads graph.json. Public query API.
│   │   ├── graph-types.ts    # TypeScript types for the graph schema.
│   │   ├── parse-sections.ts # Body-section + sub-section parsers.
│   │   └── graph-layout.ts   # D3 force layout config (explorer only).
│   ├── components/           # React components for /explore/* (D3 + islands).
│   ├── layouts/
│   │   ├── Guide.astro       # Top-level layout for the curated Guide.
│   │   └── Layout.astro      # Lighter layout for /explore/*.
│   └── pages/
│       ├── index.astro       # Landing.
│       ├── approaches/       # Case-study index + detail.
│       ├── patterns/         # Pattern index + detail.
│       ├── vendors/          # Vendor index + detail.
│       ├── domains/          # Domain index + detail.
│       ├── jurisdictions/    # Jurisdiction index + detail.
│       ├── faq.astro
│       ├── glossary.astro
│       └── explore/          # Galaxy / Tree / Browse views (legacy).
└── astro.config.mjs
```

## Content pipeline

1. `npm run build:graph` runs `scripts/build-graph.mjs`. It walks
   `$IPTF_MAP_PATH` (or the local `iptf-map` checkout, auto-detected) and
   produces `src/data/graph.json`:
   - **Nodes** — one per markdown file in `patterns/`, `approaches/`,
     `use-cases/`, `domains/`, `jurisdictions/`, `vendors/`. Frontmatter is
     parsed with `js-yaml` and passed through verbatim. The body is included
     unmodified for downstream rendering through `marked`.
   - **Edges** — first from structured frontmatter (e.g. `primary_patterns`,
     `related_patterns`, `use_case`), then from body-link extraction as a
     fallback for any cross-references not yet structured.
2. `npm run dev` / `npm run build` chains `build:graph` before Astro.

## Source-of-truth rule

iptf-map main is the only source of truth for content. Anything fetched from
the map renders verbatim — no truncation, no rewriting, no invented fields.
Pages comment each map-content render site with `SOURCE: iptf-map field — do
not alter` so the rule is visible during review.

UI chrome (FAQ, testimonials, landing copy, vendor neutrality disclaimer,
index page subtitles) is the Guide's own and stays curated.

## How to run

```bash
npm install
npm run dev    # http://localhost:4321
npm run build  # → dist/
```

To point at a non-default iptf-map checkout:

```bash
IPTF_MAP_PATH=/path/to/iptf-map npm run build
```

## How to extend

- **Add a new content type** — add an entry to `CONTENT_DIRS` in
  `build-graph.mjs`, extend `NodeType` in `graph-types.ts`, and add a
  `pages/<type>/[slug].astro` renderer.
- **Add a new pattern field** — when iptf-map adds a frontmatter key, add it
  to the `passthrough` or `structured` list in `build-graph.mjs`, then read
  `node.<field>` from the renderer. The parser passes through unknown fields
  if listed; everything else is dropped.
- **Add a new edge type** — add it to `EdgeType` in `graph-types.ts` and call
  `addEdge(...)` from `build-graph.mjs`'s structured-edge pass.

## Explorer views

`/explore/galaxy`, `/explore/tree`, `/explore/browse` are the original D3-based
map explorer views. They share `Layout.astro` and use React islands
(`components/Galaxy.tsx` etc.). Linked unobtrusively from the Guide footer;
not part of the primary nav.
