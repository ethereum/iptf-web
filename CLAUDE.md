# CLAUDE.md - Project Instructions

## Project Overview

This is the IPTF (Institutional Privacy Task Force) website repository. It's a simple Jekyll-based GitHub Pages site deployed at https://iptf.ethereum.org/.

## Tech Stack

- **Jekyll**: Static site generator
- **Minima theme**: Minimal Jekyll theme
- **GitHub Pages**: Hosting and auto-deployment
- **Markdown**: Content format

## Key Files

- `_config.yml`: Site configuration (title, description, theme, blog settings)
- `index.md`: Homepage content
- `blog.html`: Blog index page
- `_posts/`: Published blog posts (filename: `YYYY-MM-DD-title.md`)
- `_drafts/`: Draft posts not published to live site
- `_layouts/`: Custom page layouts (post.html, default.html)
- `_includes/`: Reusable components (head.html with Twitter cards)
- `assets/images/`: Hero images and media
- `CNAME`: Custom domain configuration (iptf.ethereum.org)

## Development Guidelines

### Content Editing

- Main content is in `index.md` (Markdown format)
- Keep content focused on IPTF mission and contact information
- Maintain professional, concise tone

### Configuration

- Site settings in `_config.yml`
- Changes require Jekyll server restart when testing locally
- Do not modify `CNAME` unless changing domain

### Testing Locally

Run Jekyll server before committing changes:
```bash
bundle exec jekyll serve
```
View at `http://localhost:4000`

### Commit Conventions

Use semantic commit messages following conventional commits format:

- `feat:` New features or content additions
- `fix:` Bug fixes or corrections
- `docs:` Documentation changes
- `chore:` Maintenance tasks, dependencies
- `refactor:` Code restructuring without behavior changes
- `style:` Formatting, whitespace changes

Examples:
- `docs: add README and CLAUDE.md`
- `feat: add new initiative section`
- `fix: correct contact email`

### Deployment

- Auto-deploys on push to `main` branch via GitHub Pages
- No manual deployment steps needed
- Changes go live within 1-2 minutes

## Typical Tasks

- **Update homepage**: Edit `index.md`
- **Create blog post**: Add `YYYY-MM-DD-title.md` to `_posts/`
- **Create draft**: Add to `_drafts/` or use `published: false` frontmatter
- **Add hero image**: Place in `assets/images/`, reference in post frontmatter
- **Change site settings**: Edit `_config.yml`

## Blog Post Guidelines

### Frontmatter Template

```yaml
---
layout: post
title: "Post Title"
date: YYYY-MM-DD
author: "Author Name"
hero_image: /assets/images/hero-name.jpg
description: "Brief description for SEO and social cards"
---
```

### Hero Images

- **Size**: 1200x600px (2:1 ratio) for optimal Twitter/X card display
- **Location**: `assets/images/`
- **Format**: JPG, PNG, or SVG
- Always include alt text consideration in design

### Draft Workflow

1. Create draft in `_drafts/` folder (no date in filename)
2. Preview locally: `bundle exec jekyll serve --drafts`
3. When ready to publish: Move to `_posts/` with date prefix
4. Alternatively: Use `published: false` in frontmatter

## Important Notes

- This is a public-facing website representing Ethereum Foundation
- Keep content accurate and professional
- Test locally before pushing to main
- Changes to main branch go live immediately

## License

CC0 1.0 Universal (Public Domain)
