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
├── _config.yml    # Jekyll config (theme, title, description)
├── index.md       # Main page content
└── CNAME          # Custom domain
```

## Running Locally

1. **Install dependencies**
   ```bash
   # Create Gemfile
   cat > Gemfile << 'EOF'
   source "https://rubygems.org"
   gem "jekyll", "~> 4.3"
   gem "minima", "~> 2.5"
   gem "webrick", "~> 1.8"
   EOF

   bundle install
   ```

2. **Start server**
   ```bash
   bundle exec jekyll serve
   ```

3. **View at** `http://localhost:4000`

Note: Changes to `_config.yml` require server restart; Markdown changes rebuild automatically.

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
