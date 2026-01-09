# IPTF Website

Static website for the Institutional Privacy Task Force (IPTF), live at [https://iptf.ethereum.org/](https://iptf.ethereum.org/).

## About

The IPTF helps onboard institutions and enterprises onto Ethereum, focusing on privacy needs that are performant, secure, usable, and accessible.

## How It Works

This is a Jekyll-based GitHub Pages site:

- **Jekyll** with **Minima theme** processes Markdown to HTML
- **GitHub Pages** auto-deploys on push to `main`
- **Custom domain** via CNAME file

### Structure

```
iptf-web/
├── _config.yml       # Jekyll config (theme, title, description)
├── _posts/           # Published blog posts (YYYY-MM-DD-title.md)
├── _drafts/          # Draft posts (not published)
├── _layouts/         # Custom page layouts
├── _includes/        # Reusable components (head, header, footer)
├── assets/images/    # Images and media files
├── blog.html         # Blog index page
├── index.md          # Homepage content
└── CNAME             # Custom domain
```

## Running Locally

### Prerequisites

This site requires Ruby 3.0+. macOS system Ruby (2.6) is too old. Install via Homebrew:

```bash
brew install ruby
```

### Setup

1. **Install dependencies**
   ```bash
   /opt/homebrew/opt/ruby/bin/bundle install
   ```

2. **Start server**

   Option A - Use helper script:
   ```bash
   ./serve.sh
   ```

   Option B - Direct command:
   ```bash
   /opt/homebrew/opt/ruby/bin/bundle exec jekyll serve
   ```

3. **View at** `http://localhost:4000`

Note: Changes to `_config.yml` require server restart; Markdown changes rebuild automatically.

### Preview Drafts

To preview draft posts locally:
```bash
./serve.sh --drafts
```

## Blog Posts

### Creating a New Post

1. Create a new file in `_posts/` with the format: `YYYY-MM-DD-title.md`
2. Add YAML frontmatter:

```yaml
---
layout: post
title: "Your Post Title"
date: 2026-01-09
author: "Author Name"
hero_image: /assets/images/your-hero.jpg
description: "Brief description for previews and social cards"
---
```

3. Write content in Markdown below the frontmatter

### Hero Images

- Recommended size: 1200x600px (2:1 ratio for Twitter/X cards)
- Place images in `assets/images/`
- Reference in frontmatter: `hero_image: /assets/images/filename.jpg`

### Draft Posts

Two ways to create drafts:

1. **Using _drafts folder**: Create file in `_drafts/` (no date in filename)
2. **Using frontmatter**: Add `published: false` to any post

Drafts won't appear on live site but can be previewed locally with `--drafts` flag.

## Contributing

1. Create branch from `main`
2. Make changes and test locally
3. Create pull request

## Contact

- Email: [iptf@ethereum.org](mailto:iptf@ethereum.org)
- [Institutions form](https://forms.gle/6Za8suF5QHyRamcW7)
- [Vendors form](https://forms.gle/znifD8h9Uw6VEX6Q9)

## License

[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)
