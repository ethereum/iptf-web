# CLAUDE.md - Project Instructions

## Project Overview

This is the IPTF (Institutional Privacy Task Force) website repository. It's a simple Jekyll-based GitHub Pages site deployed at https://iptf.ethereum.org/.

## Tech Stack

- **Jekyll**: Static site generator
- **Minima theme**: Minimal Jekyll theme
- **GitHub Pages**: Hosting and auto-deployment
- **Markdown**: Content format

## Key Files

- `_config.yml`: Site configuration (title, description, theme)
- `index.md`: Main page content
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

- **Update content**: Edit `index.md`
- **Change site title/description**: Edit `_config.yml`
- **Add pages**: Create new `.md` files (reference Jekyll docs)

## Important Notes

- This is a public-facing website representing Ethereum Foundation
- Keep content accurate and professional
- Test locally before pushing to main
- Changes to main branch go live immediately

## License

CC0 1.0 Universal (Public Domain)
