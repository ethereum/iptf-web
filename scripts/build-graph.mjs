#!/usr/bin/env node
/**
 * build-graph.mjs
 *
 * Parses all markdown content files in the IPTF Map repository and produces
 * a graph.json file with nodes (content items) and edges (cross-references).
 *
 * Source of truth: iptf-map main branch. All field reads pass through verbatim;
 * the only fields this script invents are derived links between nodes.
 */

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  existsSync,
  mkdirSync,
} from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Our submodule path is `content/` (upstream `iptf-web` uses `content/`).
const CONTENT_SUBMODULE = join(__dirname, "..", "content");
const candidates = [process.env.IPTF_MAP_PATH, CONTENT_SUBMODULE].filter(
  Boolean,
);
const REPO_ROOT = candidates.find((p) => existsSync(join(p, "patterns")));
if (!REPO_ROOT) {
  throw new Error(
    `No iptf-map content directory found. Tried:\n` +
      candidates.map((c) => `  - ${c}`).join("\n") +
      `\n\nIf you cloned without submodules, run:\n` +
      `  git submodule update --init --recursive\n` +
      `(or set IPTF_MAP_PATH to a local iptf-map checkout).`,
  );
}
const OUTPUT_DIR = join(__dirname, "..", "src", "data");
const OUTPUT_PATH = join(OUTPUT_DIR, "graph.json");
const GLOSSARY_OUTPUT_PATH = join(OUTPUT_DIR, "glossary.json");

const CONTENT_DIRS = [
  { dir: "patterns", type: "pattern", prefix: "pattern-" },
  { dir: "use-cases", type: "use-case", prefix: "" },
  { dir: "approaches", type: "approach", prefix: "approach-" },
  { dir: "domains", type: "domain", prefix: "" },
  { dir: "jurisdictions", type: "jurisdiction", prefix: "" },
  { dir: "vendors", type: "vendor", prefix: "" },
];

const SKIP_FILES = ["_template.md", "README.md"];

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, body: content };
  const body = content.slice(match[0].length).trim();
  let data = {};
  try {
    data = yaml.load(match[1]) || {};
  } catch (err) {
    console.warn(`YAML parse error: ${err.message}`);
  }
  return { data: normalizeDates(data), body };
}

/** Recursively convert Date instances to YYYY-MM-DD strings (js-yaml parses
 *  unquoted YAML 1.1 timestamps as Date objects; iptf-map writes them
 *  as plain dates and renders them as strings). */
function normalizeDates(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = normalizeDates(v);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fileToSlug(filename, prefix) {
  return basename(filename, ".md").replace(new RegExp(`^${prefix}`), "");
}

export function fileToNodeId(dirType, filename, prefix) {
  return `${dirType}/${fileToSlug(filename, prefix)}`;
}

/** Strip inline markdown formatting so summary fields render as plain text
 *  wherever they're displayed (vendor list, OG description, etc.). Body
 *  content elsewhere keeps its markdown — only summaries are flattened. */
function stripInlineMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // images → alt text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links → label
    .replace(/`([^`]+)`/g, "$1") // code spans
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/__([^_]+)__/g, "$1") // bold (alt)
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/_([^_]+)_/g, "$1") // italic (alt)
    .replace(/~~([^~]+)~~/g, "$1"); // strikethrough
}

/** First paragraph from ## Intent (patterns) or first paragraph after ## section (others). */
export function extractSummary(body, type) {
  const intentMatch = body.match(/## Intent\s*\n+([\s\S]*?)(?=\n## |\n$)/);
  if (intentMatch) return stripInlineMarkdown(firstParagraph(intentMatch[1]));

  const tldrMatch = body.match(/## TLDR\s*\n+([\s\S]*?)(?=\n## |\n$)/);
  if (tldrMatch)
    return stripInlineMarkdown(firstParagraph(tldrMatch[1]).replace(/^-\s*/, ""));

  const whatMatch = body.match(/## What it is\s*\n+([\s\S]*?)(?=\n## |\n$)/);
  if (whatMatch) return stripInlineMarkdown(firstParagraph(whatMatch[1]));

  const ucMatch = body.match(/## 1\) Use Case\s*\n+([\s\S]*?)(?=\n## |\n$)/);
  if (ucMatch) return stripInlineMarkdown(firstParagraph(ucMatch[1]));

  const scenarioMatch = body.match(
    /### Scenario\s*\n+([\s\S]*?)(?=\n###|\n## |\n$)/,
  );
  if (scenarioMatch) return stripInlineMarkdown(firstParagraph(scenarioMatch[1]));

  for (const line of body.split("\n")) {
    const t = line.trim();
    if (
      t &&
      !t.startsWith("#") &&
      !t.startsWith("-") &&
      !t.startsWith("|") &&
      !t.startsWith("*")
    ) {
      return stripInlineMarkdown(t);
    }
  }
  return "";
}

function firstParagraph(text) {
  const lines = text.trim().split("\n");
  const para = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      if (para.length > 0) break;
      continue;
    }
    if (t.startsWith(">") || t.startsWith("#")) {
      if (para.length > 0) break;
      continue;
    }
    para.push(t);
  }
  return para.join(" ").trim();
}

/** Extract markdown links from body text under their ## section heading. */
export function extractLinks(body) {
  const links = [];
  let currentSection = "";

  for (const line of body.split("\n")) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      currentSection = headingMatch[1].trim();
      continue;
    }
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let m;
    while ((m = linkRegex.exec(line)) !== null) {
      const href = m[2];
      if (href.endsWith(".md") && !href.startsWith("http")) {
        links.push({ text: m[1], href, section: currentSection });
      }
    }
  }
  return links;
}

export function resolveLink(href, nodeIndex) {
  const parts = href.split("/").filter((p) => p !== ".." && p !== ".");
  if (parts.length === 0) return null;
  const filename = parts[parts.length - 1];
  const dirName = parts.length > 1 ? parts[parts.length - 2] : null;

  for (const cfg of CONTENT_DIRS) {
    if (dirName && dirName !== cfg.dir) continue;
    const candidateId = fileToNodeId(cfg.type, filename, cfg.prefix);
    if (nodeIndex.has(candidateId)) return candidateId;
  }
  return null;
}

/** Resolve a slug like "pattern-shielding" against the node index. */
export function resolveSlug(slug, type, nodeIndex) {
  const cfg = CONTENT_DIRS.find((c) => c.type === type);
  if (!cfg) return null;
  const stripped = slug.startsWith(cfg.prefix) ? slug : `${cfg.prefix}${slug}`;
  const candidateId = fileToNodeId(cfg.type, `${stripped}.md`, cfg.prefix);
  return nodeIndex.has(candidateId) ? candidateId : null;
}

export function classifyEdge(sourceType, targetType, section) {
  const s = section.toLowerCase();
  if (s.includes("see also")) return "see-also";
  if (s.includes("fits with patterns")) return "implements";
  if (s.includes("recommended approach")) return "recommends";
  if (s.includes("shortest-path") || s.includes("primary use case"))
    return "in-domain";
  if (s.includes("adjacent vendor")) return "in-domain";
  if (sourceType === "approach") return "uses-pattern";
  if (sourceType === "domain") return "in-domain";
  if (sourceType === "vendor") return "implements";
  if (targetType === "jurisdiction") return "regulated-by";
  return "see-also";
}

// ---------------------------------------------------------------------------
// Glossary parser
// ---------------------------------------------------------------------------

export function parseGlossary(repoRoot) {
  const glossaryPath = join(repoRoot, "GLOSSARY.md");
  if (!existsSync(glossaryPath)) return [];
  const content = readFileSync(glossaryPath, "utf-8");
  const terms = [];
  let currentCategory = "";

  for (const line of content.split("\n")) {
    const catMatch = line.match(/^### (.+)/);
    if (catMatch) {
      currentCategory = catMatch[1].trim();
      continue;
    }
    const termMatch = line.match(
      /^\*\*\[?([^\]*]+)\]?\s*(?:\([^)]*\))?\*\*:\s*(.*)/,
    );
    if (termMatch) {
      terms.push({
        term: termMatch[1].trim().replace(/\[|\]/g, ""),
        definition: termMatch[2].trim(),
        category: currentCategory,
      });
    }
  }
  return terms;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

export function buildGraph(repoRoot = REPO_ROOT) {
  const nodes = [];
  const edges = [];
  const nodeIndex = new Set();
  const edgeSet = new Set();

  const addEdge = (source, target, type) => {
    if (!source || !target || source === target) return;
    const key = `${source}|${target}|${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ source, target, type });
  };

  // Pass 1: Create all nodes
  for (const cfg of CONTENT_DIRS) {
    const dirPath = join(repoRoot, cfg.dir);
    if (!existsSync(dirPath)) continue;

    const files = readdirSync(dirPath).filter(
      (f) => f.endsWith(".md") && !SKIP_FILES.includes(f),
    );

    for (const file of files) {
      const content = readFileSync(join(dirPath, file), "utf-8");
      const { data, body } = parseFrontmatter(content);

      const id = fileToNodeId(cfg.type, file, cfg.prefix);
      nodeIndex.add(id);

      let title = data.title;
      if (!title) {
        const headingMatch = body.match(/^# (?:Approach:\s*)?(.+)/m);
        title = headingMatch ? headingMatch[1].trim() : basename(file, ".md");
      }
      title = title
        .replace(/^(Pattern|Vendor|Domain|Jurisdiction|Approach):\s*/i, "")
        .replace(/^(RFP):\s*/i, "");

      const node = {
        id,
        type: cfg.type,
        title,
        slug: fileToSlug(file, cfg.prefix),
        file: `${cfg.dir}/${file}`,
        summary: extractSummary(body, cfg.type),
        content: body,
      };

      // Pass-through scalar fields (from iptf-map frontmatter, verbatim)
      const passthrough = [
        "layer",
        "maturity",
        "status",
        "context",
        "last_reviewed",
        "website",
        "category",
        "region",
        "primary_domain",
        "secondary_domain",
        "privacy_goal",
        "use_case",
      ];
      for (const key of passthrough) {
        if (data[key] !== undefined && data[key] !== null && data[key] !== "") {
          node[key] = data[key];
        }
      }
      // Pattern's `type: standard | meta` — rename to `kind` to avoid
      // colliding with our node-type discriminator.
      if (data.type !== undefined && data.type !== null && data.type !== "") {
        node.kind = data.type;
      }

      // Pass-through structured fields
      const structured = [
        "works-best-when",
        "avoid-when",
        "crops_profile",
        "crops_context",
        "post_quantum",
        "visibility",
        "standards",
        "related_patterns",
        "open_source_implementations",
        "iptf_pocs",
        "primary_patterns",
        "supporting_patterns",
        "related_use_cases",
        "context_differentiation",
        "sub_patterns",
      ];
      for (const key of structured) {
        if (data[key] !== undefined && data[key] !== null) {
          // Normalize hyphenated keys to underscored
          const k = key.replace(/-/g, "_");
          node[k] = data[key];
        }
      }

      nodes.push(node);
    }
  }

  // Pass 2: Generate edges
  // 2a — Structured edges from frontmatter (preferred when available)
  for (const node of nodes) {
    if (node.type === "approach") {
      // approach → use-case
      if (node.use_case) {
        const ucId = resolveSlug(node.use_case, "use-case", nodeIndex);
        if (ucId) addEdge(node.id, ucId, "addresses");
      }
      // approach → related use-cases
      if (Array.isArray(node.related_use_cases)) {
        for (const uc of node.related_use_cases) {
          const ucId = resolveSlug(uc, "use-case", nodeIndex);
          if (ucId) addEdge(node.id, ucId, "see-also");
        }
      }
      // approach → primary/supporting patterns
      const allPatterns = [
        ...(Array.isArray(node.primary_patterns) ? node.primary_patterns : []),
        ...(Array.isArray(node.supporting_patterns)
          ? node.supporting_patterns
          : []),
      ];
      for (const p of allPatterns) {
        const pId = resolveSlug(p, "pattern", nodeIndex);
        if (pId) addEdge(node.id, pId, "uses-pattern");
      }
    }

    if (
      node.type === "pattern" &&
      node.related_patterns &&
      typeof node.related_patterns === "object"
    ) {
      const rel = node.related_patterns;
      const relMap = [
        ["requires", "requires"],
        ["composes_with", "composes-with"],
        ["alternative_to", "alternative-to"],
        ["see_also", "see-also"],
      ];
      for (const [key, edgeType] of relMap) {
        if (Array.isArray(rel[key])) {
          for (const slug of rel[key]) {
            const pId = resolveSlug(slug, "pattern", nodeIndex);
            if (pId) addEdge(node.id, pId, edgeType);
          }
        }
      }
    }

    // Meta pattern → sub-patterns
    if (node.type === "pattern" && Array.isArray(node.sub_patterns)) {
      for (const sub of node.sub_patterns) {
        if (sub && typeof sub === "object" && sub.pattern) {
          const pId = resolveSlug(sub.pattern, "pattern", nodeIndex);
          if (pId) addEdge(node.id, pId, "composes-with");
        }
      }
    }
  }

  // 2b — Fallback link extraction from body markdown (for any links not
  // captured by structured frontmatter, e.g. domain → patterns lists)
  for (const cfg of CONTENT_DIRS) {
    const dirPath = join(repoRoot, cfg.dir);
    if (!existsSync(dirPath)) continue;
    const files = readdirSync(dirPath).filter(
      (f) => f.endsWith(".md") && !SKIP_FILES.includes(f),
    );

    for (const file of files) {
      const content = readFileSync(join(dirPath, file), "utf-8");
      const { body } = parseFrontmatter(content);
      const sourceId = fileToNodeId(cfg.type, file, cfg.prefix);
      const links = extractLinks(body);

      for (const link of links) {
        const targetId = resolveLink(link.href, nodeIndex);
        if (!targetId) continue;
        const targetNode = nodes.find((n) => n.id === targetId);
        const targetType = targetNode ? targetNode.type : "pattern";
        const edgeType = classifyEdge(cfg.type, targetType, link.section);
        addEdge(sourceId, targetId, edgeType);
      }
    }
  }

  return {
    nodes,
    edges,
    meta: {
      generated_at: new Date().toISOString(),
      node_count: nodes.length,
      edge_count: edges.length,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

const isMain = process.argv[1] && __filename === process.argv[1];
if (isMain) {
  console.log(`Using content from: ${REPO_ROOT}`);
  const graph = buildGraph();
  if (graph.meta.node_count === 0) {
    throw new Error(
      `Graph built 0 nodes from ${REPO_ROOT}.\n` +
        `The directory exists but contains no markdown content.\n` +
        `The iptf-map submodule may be empty/uninitialized — run:\n` +
        `  git submodule update --init --recursive`,
    );
  }
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(graph, null, 2));
  console.log(
    `Graph built: ${graph.meta.node_count} nodes, ${graph.meta.edge_count} edges`,
  );

  const glossary = parseGlossary(REPO_ROOT);
  writeFileSync(GLOSSARY_OUTPUT_PATH, JSON.stringify(glossary, null, 2));
  console.log(`Glossary built: ${glossary.length} terms`);
}
