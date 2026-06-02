import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/*
 * Content collections wired directly to the iptf-map submodule at
 * ../content-source/. Upstream frontmatter is the single source of
 * truth — schemas declare every field we consume in the renderer so
 * the build catches missing or mistyped values early. Unknown extras
 * still pass through via .passthrough() for upstream additions.
 */

const EXCLUDE = ['*.md', '!_template.md', '!README.md'];

const useCases = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/use-cases' }),
  schema: z
    .object({
      title: z.string(),
      primary_domain: z.string().optional(),
      secondary_domain: z.union([z.string(), z.null()]).optional(),
      // Upstream convention: `status: stub` for entries awaiting a written
      // case study. Absence of `status` means a case study exists.
      status: z.string().optional(),
    })
    .passthrough(),
});

/*
 * Upstream uses the short-key CROPS shape across 64 of 64 patterns:
 *   cr | o (open-source) | p (privacy) | s (security)
 * The earlier schema declared the long-key shape (cr/os/privacy/security)
 * which 0 patterns actually use. Schema and source are now aligned.
 */
const cropsAxes = z
  .object({
    cr: z.string().optional(),
    o: z.string().optional(),
    p: z.string().optional(),
    s: z.string().optional(),
  })
  .passthrough();

const ossImpl = z
  .object({
    url: z.string(),
    description: z.string().optional(),
    language: z.string().optional(),
  })
  .passthrough();

const patterns = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/patterns' }),
  schema: z
    .object({
      title: z.string(),
      status: z.string().optional(),
      maturity: z.string().optional(),
      layer: z.string().optional(),
      type: z.string().optional(),
      privacy_goal: z.string().optional(),
      assumptions: z.string().optional(),
      last_reviewed: z.union([z.string(), z.date()]).optional(),
      'works-best-when': z.array(z.string()).optional(),
      'avoid-when': z.array(z.string()).optional(),
      dependencies: z.array(z.string()).optional(),
      context: z.string().optional(),
      context_differentiation: z
        .object({ i2i: z.string().optional(), i2u: z.string().optional() })
        .passthrough()
        .optional(),
      crops_profile: z.union([cropsAxes, z.string()]).optional(),
      crops_context: cropsAxes.optional(),
      post_quantum: z
        .object({
          risk: z.string().optional(),
          vector: z.string().optional(),
          mitigation: z.string().optional(),
        })
        .passthrough()
        .optional(),
      standards: z.array(z.string()).optional(),
      related_patterns: z
        .object({
          requires: z.array(z.string()).optional(),
          composes_with: z.array(z.string()).optional(),
          alternative_to: z.array(z.string()).optional(),
          see_also: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional(),
      sub_patterns: z
        .array(
          z
            .object({
              name: z.string(),
              pattern: z.string(),
              crops_summary: z.string().optional(),
            })
            .passthrough(),
        )
        .optional(),
      visibility: z
        .object({
          counterparty: z.array(z.string()).optional(),
          chain: z.array(z.string()).optional(),
          regulator: z.array(z.string()).optional(),
          public: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional(),
      open_source_implementations: z.array(ossImpl).optional(),
    })
    .passthrough(),
});

const approaches = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/approaches' }),
  schema: z
    .object({
      // All fields are optional because at least one approach in the
      // upstream repo (approach-privacy-standards-survey) currently has
      // no frontmatter and would otherwise fail validation. Renderer
      // falls back to body H1 when title is absent.
      title: z.string().optional(),
      status: z.string().optional(),
      last_reviewed: z.union([z.string(), z.date()]).optional(),
      use_case: z.string().optional(),
      related_use_cases: z.array(z.string()).optional(),
      primary_patterns: z.array(z.string()).optional(),
      supporting_patterns: z.array(z.string()).optional(),
      open_source_implementations: z.array(ossImpl).optional(),
      iptf_pocs: z
        .object({
          folder: z.string().optional(),
          requirements: z.string().optional(),
          pocs: z
            .array(
              z
                .object({
                  name: z.string(),
                  sub_approach: z.string().optional(),
                  spec: z.string().optional(),
                  status: z.string().optional(),
                })
                .passthrough(),
            )
            .optional(),
        })
        .passthrough()
        .optional(),
    })
    .passthrough(),
});

const domains = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/domains' }),
  schema: z
    .object({
      title: z.string(),
      status: z.string().optional(),
      // One-line domain summary (iptf-map PR #173). Used as the section
      // primer on the /use-cases/ and /approaches/ listings.
      description: z.string().optional(),
    })
    .passthrough(),
});

const jurisdictions = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/jurisdictions' }),
  schema: z
    .object({
      title: z.string(),
      status: z.string().optional(),
      region: z.string().optional(),
      scope: z
        .object({
          entities: z.array(z.string()).optional(),
          activities: z.array(z.string()).optional(),
        })
        .passthrough()
        .optional(),
      'key-regulations': z.array(z.string()).optional(),
    })
    .passthrough(),
});

const vendors = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/vendors' }),
  schema: z
    .object({
      title: z.string(),
      status: z.string().optional(),
      maturity: z.string().optional(),
    })
    .passthrough(),
});

const rfps = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/rfps' }),
  schema: z
    .object({
      title: z.string(),
      status: z.string().optional(),
      category: z.string().optional(),
      tier: z.number().optional(),
    })
    .passthrough(),
});

// Weekly updates have no YAML frontmatter — only an H1.
// Title is parsed from the body, date from the filename (YYYY-MM-DD.md).
const weeklyUpdates = defineCollection({
  loader: glob({ pattern: EXCLUDE, base: './content/weekly-updates' }),
  schema: z.object({}).passthrough(),
});

/*
 * Long-form posts authored upstream at ethereum/iptf-web (NOT in
 * iptf-map). Wired in via the posts-source/ submodule pinned to the
 * test_guide branch, so build-time pulls always reflect upstream and
 * we never copy markdown into this repo. Filenames follow Jekyll's
 * YYYY-MM-DD-slug.md convention.
 */
const posts = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/posts' }),
  schema: z
    .object({
      title: z.string(),
      description: z.string().optional(),
      date: z.union([z.string(), z.date()]),
      author: z.string().optional(),
      image: z.string().optional(),
      layout: z.string().optional(),
      tags: z.array(z.string()).optional(),
    })
    .passthrough(),
});

export const collections = {
  useCases,
  patterns,
  approaches,
  domains,
  jurisdictions,
  vendors,
  rfps,
  weeklyUpdates,
  posts,
};
