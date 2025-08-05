# 🌍 Vite SSR Nunjucks i18n Basic

[![Vite](https://img.shields.io/badge/Vite-5.0+-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Nunjucks](https://img.shields.io/badge/Nunjucks-3.2+-1C4913?style=for-the-badge&logo=nunjucks&logoColor=white)](https://mozilla.github.io/nunjucks/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg?style=flat-square)](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/graphs/commit-activity)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)

> A modern, fast, and SEO-friendly multi-locale static site generator powered by Vite and Nunjucks

## ✨ Features

- 🌍 **Multi-locale support** - Generate static sites in multiple languages
- ⚡ **Lightning fast** - Powered by Vite for instant HMR and fast builds
- 🎨 **Template inheritance** - Clean Nunjucks templating system
- 📱 **SEO optimized** - Static HTML generation for perfect SEO
- 🔥 **Hot reloading** - Real-time updates during development
- 🗜️ **Production ready** - HTML minification and optimization
- 🧭 **Smart routing** - Automatic browser language detection
- 🎯 **Zero config** - Works out of the box with sensible defaults

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic.git
cd vite-ssr-nunjucks-i18n-basic

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📁 Project Structure

```
├── src/
│   ├── data/              # Translation files
│   │   ├── en.json        # English translations
│   │   └── fr.json        # French translations
│   ├── layouts/           # Page layouts
│   │   └── main.njk       # Main layout template
│   ├── pages/             # Page templates (edit these!)
│   │   ├── index.njk      # Home page
│   │   └── about.njk      # About page
│   └── partials/          # Reusable components
│       ├── header.njk     # Navigation with language switcher
│       └── footer.njk     # Site footer
├── dist/                  # Generated output (production)
│   ├── index.html         # Root redirect page
│   ├── en/                # English pages
│   └── fr/                # French pages
├── plugins/
│   └── multi-locale-plugin.js  # Custom Vite plugin
├── vite.config.js         # Vite configuration
└── package.json
```

## 🎯 Usage

### Adding New Pages

1. Create a new template in `src/pages/`:
```bash
touch src/pages/contact.njk
```

2. Add the page content:
```html
{% extends "main.njk" %}

{% block content %}
<h1>{{ t.contact.title }}</h1>
<p>{{ t.contact.description }}</p>
{% endblock %}
```

3. Add translations to your locale files:
```json
// src/data/en.json
{
  "contact": {
    "title": "Contact Us",
    "description": "Get in touch with our team"
  }
}
```

4. The page will automatically generate as:
   - `/en/contact.html`
   - `/fr/contact.html`

### Adding New Locales

1. Create a new translation file:
```bash
touch src/data/de.json
```

2. Add the locale to your Vite config:
```javascript
// vite.config.js
locales: ['en', 'fr', 'de']
```

3. Your site will now generate German pages automatically!

### Template Features

#### Translation Variables
```html
{{ t.homepage.title }}          <!-- Access nested translations -->
{{ t.navigation.home }}         <!-- Navigation items -->
```

#### Locale Helpers
```html
{{ locale }}                    <!-- Current locale (en, fr, etc.) -->
{{ currentLocale }}             <!-- Same as locale -->
{{ defaultLocale }}             <!-- Default locale -->
{{ locales }}                   <!-- Array of all locales -->
```

#### Helper Functions
```html
<!-- Check if locale is current -->
{% if isCurrentLocale('en') %}class="active"{% endif %}

<!-- Generate localized URLs -->
<a href="{{ getLocalizedUrl('/about.html', 'fr') }}">French About</a>
```

## ⚙️ Configuration

### Plugin Options

```javascript
// vite.config.js
createMultiLocalePlugin({
  srcDir: 'src',              // Source directory
  pagesDir: 'src/pages',      // Page templates
  layoutsDir: 'src/layouts',  // Layout templates
  partialsDir: 'src/partials', // Partial templates
  dataDir: 'src/data',        // Translation files
  outputDir: 'dist',          // Output directory
  defaultLocale: 'en',        // Default language
  locales: ['en', 'fr']       // Supported languages
})
```

### HTML Minification

In production builds, HTML is automatically minified with:
- ✅ Comment removal
- ✅ Whitespace collapse
- ✅ CSS minification
- ✅ JS minification
- ✅ Attribute optimization

## 🏗️ Build Output

### Development (`npm run dev`)
- Hot reloading with file watching
- Unminified HTML for debugging
- Instant updates on file changes

### Production (`npm run build`)
```
dist/
├── index.html          # Root redirect (minified)
├── en/
│   ├── index.html      # English home (minified)
│   └── about.html      # English about (minified)
└── fr/
    ├── index.html      # French home (minified)
    └── about.html      # French about (minified)
```

## 🌐 Browser Language Detection

The root `index.html` automatically redirects users to their preferred language:

```javascript
// Automatic language detection
const userLang = navigator.language.substring(0, 2);
const supportedLocales = ["en", "fr"];
const locale = supportedLocales.includes(userLang) ? userLang : "en";
window.location.href = "/" + locale + "/";
```

## 📊 Performance

- ⚡ **Build time**: ~70ms for 4 pages
- 🗜️ **HTML compression**: ~40-60% size reduction
- 🚀 **HMR**: Instant hot reloading
- 📦 **Bundle size**: Zero JavaScript in final output

## 🛠️ Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reloading |
| `npm run build` | Build for production with minification |
| `npm run preview` | Preview production build locally |
| `npm run serve` | Alias for preview |
| `npm run lighthouse` | Run full Lighthouse audit on all pages |
| `npm run lighthouse:quick` | Quick Lighthouse test on single page |
| `npm test` | Run build test to verify everything works |

## 🔍 Performance Testing

This project includes comprehensive Lighthouse testing for performance, accessibility, SEO, and best practices:

```bash
# Run full audit on all pages
npm run lighthouse

# Quick test on single page
npm run lighthouse:quick

# Manual test any page
./lighthouse-test.sh /en/about.html
```

See [LIGHTHOUSE.md](LIGHTHOUSE.md) for detailed testing guide.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Vite](https://vitejs.dev/) - Next generation frontend tooling
- [Nunjucks](https://mozilla.github.io/nunjucks/) - Rich templating language
- [html-minifier-terser](https://github.com/terser/html-minifier-terser) - HTML minification

## 📚 Related Projects

- [Vite](https://github.com/vitejs/vite) - Build tool
- [Nunjucks](https://github.com/mozilla/nunjucks) - Template engine
- [Chokidar](https://github.com/paulmillr/chokidar) - File watching

---

<div align="center">

**[⭐ Star this repo](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic)** • **[🐛 Report Bug](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/issues)** • **[✨ Request Feature](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/issues)**

Made with ❤️ for the multi-locale web

</div>
