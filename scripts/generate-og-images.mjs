#!/usr/bin/env node
/**
 * generate-og-images.mjs
 *
 * Produces one per-section OG/Twitter card per PAGE below by compositing a
 * divider rule + page label onto the existing public/og.png (logo, wordmark,
 * tagline, and top/bottom rules are reused pixel-for-pixel, not redrawn).
 *
 * One-time / re-run-on-copy-change generator, not part of the Astro build —
 * same pattern as public/og.png itself, which is a committed static asset.
 *
 * Usage:
 *   node scripts/generate-og-images.mjs            # all pages
 *   node scripts/generate-og-images.mjs join map    # only these slugs
 */

import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const BASE_OG = join(ROOT, "public", "og.png");
const OUT_DIR = join(ROOT, "public", "og");
const FONT_PATH = join(
  ROOT,
  "node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
);
const FONT_FAMILY = "Geist Mono";

const PAGES = [
  { slug: "join", label: "Join Us" },
  { slug: "offerings", label: "Offerings" },
  { slug: "writeups", label: "Writeups" },
  { slug: "domains", label: "Domains" },
  { slug: "approaches", label: "Approaches" },
  { slug: "jurisdictions", label: "Jurisdictions" },
  { slug: "patterns", label: "Patterns" },
  { slug: "use-cases", label: "Use Cases" },
  { slug: "vendors", label: "Vendors" },
  { slug: "faq", label: "FAQ" },
  { slug: "glossary", label: "Glossary" },
  { slug: "map", label: "Map" },
];

// Measured off public/og.png: tagline glyphs end ~y409, bottom rule at
// y545-546. Divider + label sit centered in that ~136px gap.
const DIVIDER = { width: 140, height: 2, y: 445, color: "#E7E4D9" };
const LABEL = { y: 492, size: 22, letterSpacing: 3, color: "#0A0A0A" };

function drawSpacedText(ctx, text, centerX, y, spacingPx) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) + spacingPx * (chars.length - 1);
  let x = centerX - totalWidth / 2;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x, y);
    x += widths[i] + spacingPx;
  }
  ctx.textAlign = prevAlign;
}

async function main() {
  const requested = process.argv.slice(2);
  const pages = requested.length
    ? PAGES.filter((p) => requested.includes(p.slug))
    : PAGES;
  if (requested.length && pages.length !== requested.length) {
    const known = new Set(PAGES.map((p) => p.slug));
    const unknown = requested.filter((s) => !known.has(s));
    throw new Error(`Unknown slug(s): ${unknown.join(", ")}`);
  }

  const registered = GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
  if (!registered) {
    throw new Error(`Failed to register font from ${FONT_PATH}`);
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const base = await loadImage(BASE_OG);

  for (const { slug, label } of pages) {
    const canvas = createCanvas(base.width, base.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(base, 0, 0);

    const centerX = base.width / 2;

    ctx.fillStyle = DIVIDER.color;
    ctx.fillRect(
      centerX - DIVIDER.width / 2,
      DIVIDER.y,
      DIVIDER.width,
      DIVIDER.height,
    );

    ctx.fillStyle = LABEL.color;
    ctx.font = `600 ${LABEL.size}px "${FONT_FAMILY}"`;
    ctx.textBaseline = "alphabetic";
    drawSpacedText(
      ctx,
      label.toUpperCase(),
      centerX,
      LABEL.y,
      LABEL.letterSpacing,
    );

    const outPath = join(OUT_DIR, `${slug}.png`);
    writeFileSync(outPath, canvas.toBuffer("image/png"));
    console.log(`wrote ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
