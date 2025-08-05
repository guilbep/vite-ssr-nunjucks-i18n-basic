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
- 📱 **SEO optimized** - Static HTML generation with hreflang tags and localized sitemaps
- 🔥 **Hot reloading** - Real-time updates during development with incremental rebuilds
- 🗜️ **Production ready** - HTML minification and optimization
- 🧭 **Smart routing** - Automatic browser language detection with cookie persistence
- 🎯 **Zero config** - Works out of the box with sensible defaults
- 📄 **Co-located variants** - Support for page-specific locale variants (`about.fr.njk`)
- 🌐 **Fallback system** - Automatic fallback to default locale for missing translations
- 🔗 **Smart link rewriting** - Automatic locale-aware link conversion
- 📊 **Advanced SEO** - Localized sitemaps, 404 pages, and canonical URLs
- 🍪 **User preference** - Cookie-based language preference with query override

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
<h1>{{ t("contact.title") }}</h1>
<p>{{ t("contact.description") }}</p>
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

### Co-located Page Variants

Create locale-specific versions of pages when you need different content:

```bash
# Default page (fallback for all locales)
src/pages/about.njk

# French-specific version
src/pages/about.fr.njk

# German-specific version  
src/pages/about.de.njk
```

The plugin will:
- Use the locale-specific version if available
- Fall back to the default version for missing locales
- Include all available variants in `alternates` for hreflang tags

### Adding New Locales

1. Create a new translation file:
```bash
touch src/data/de.json
```

2. Add the locale to your Vite config:
```javascript
// vite.config.js
locales: ['en', 'fr', 'de'],
localesMeta: {
  en: { name: 'English', rtl: false },
  fr: { name: 'Français', rtl: false },
  de: { name: 'Deutsch', rtl: false }
}
```

3. Your site will now generate German pages automatically!

### Template Features

#### Translation Function
```html
{{ t("homepage.title") }}               <!-- Function call with nested keys -->
{{ t("homepage.greeting", { name: "John" }) }}  <!-- With parameters -->
{{ t("missing.key") }}                  <!-- Fallback to key if not found -->
```

#### Locale Helpers
```html
{{ locale }}                    <!-- Current locale (en, fr, etc.) -->
{{ currentLocale }}             <!-- Same as locale -->
{{ defaultLocale }}             <!-- Default locale -->
{{ locales }}                   <!-- Array of all locales -->
{{ alternates }}                <!-- Array of available locales for this page -->
{{ rtl }}                       <!-- Boolean: is right-to-left language -->
```

#### Helper Functions
```html
<!-- Check if locale is current -->
{% if isCurrentLocale('en') %}class="active"{% endif %}

<!-- Generate localized URLs -->
<a href="{{ getLocalizedUrl('/about.html', 'fr') }}">French About</a>

<!-- Nunjucks conditionals (not JavaScript syntax) -->
{% if locale == 'fr' %}Bonjour{% else %}Hello{% endif %}
```

#### SEO and Navigation
```html
<!-- In your layout template -->
{% for l in alternates %}
<link rel="alternate" hreflang="{{ l }}" href="{{ getLocalizedUrl(currentPage, l) }}">
{% endfor %}
<link rel="alternate" hreflang="x-default" href="{{ getLocalizedUrl(currentPage, defaultLocale) }}">

<!-- Language switcher -->
{% for loc in alternates %}
<a href="{{ getLocalizedUrl(currentPage, loc) }}" 
   {% if locale == loc %}class="active"{% endif %}>
  {{ loc | upper }}
</a>
{% endfor %}
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
  locales: ['en', 'fr'],      // Supported languages
  siteUrl: 'https://example.com', // For sitemaps and canonicals
  localesMeta: {              // Locale metadata
    en: { name: 'English', rtl: false },
    fr: { name: 'Français', rtl: false },
    ar: { name: 'العربية', rtl: true }
  },
  emitSitemaps: true,         // Generate localized sitemaps
  emit404s: true,             // Generate localized 404 pages
  linkRewrite: 'safety-net'   // Auto-rewrite root-relative links
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
- Incremental rebuilds for changed files
- Unminified HTML for debugging
- Instant updates on file changes

### Production (`npm run build`)
```
dist/
├── index.html          # Root redirect (minified, with cookie support)
├── en/
│   ├── index.html      # English home (minified)
│   ├── about.html      # English about (minified)
│   └── 404.html        # English 404 page
├── fr/
│   ├── index.html      # French home (minified)
│   ├── about.html      # French about (minified)
│   └── 404.html        # French 404 page
├── sitemap-en.xml      # English sitemap
├── sitemap-fr.xml      # French sitemap
└── sitemap-index.xml   # Sitemap index
```

## 🌐 Browser Language Detection

The root `index.html` automatically redirects users to their preferred language with enhanced features:

```javascript
// Enhanced language detection with cookie persistence
const qs = new URLSearchParams(location.search);
const forced = qs.get('lang');           // Query parameter override (?lang=fr)
const supported = ["en", "fr"];
const COOKIE = 'lang=';
const getCookie = () => document.cookie.split('; ').find(c => c.startsWith(COOKIE))?.slice(COOKIE.length);

let lang = forced || getCookie() || (navigator.language||'').toLowerCase().slice(0,2);
if (!supported.includes(lang)) lang = "en";
document.cookie = `lang=${lang}; path=/; max-age=${60*60*24*365}`;  // Remember for 1 year
location.replace('/' + lang + '/');
```

### Language Preference Features
- **Query Override**: `?lang=fr` forces French
- **Cookie Persistence**: Remembers user's choice for 1 year
- **Browser Detection**: Falls back to browser language
- **Graceful Fallback**: Uses default locale if unsupported

## 🚀 Advanced Features

### Translation System
The plugin provides a powerful translation system with:
- **Nested key support**: `t("homepage.greeting")`
- **Parameter interpolation**: `t("welcome", { name: "John" })`
- **Automatic fallback**: Missing translations fall back to default locale
- **Global Nunjucks function**: Available in all templates

### SEO Optimization
- **Localized sitemaps**: Separate sitemaps per locale + sitemap index
- **hreflang tags**: Automatic alternate language declarations
- **Canonical URLs**: Proper SEO structure for each locale
- **404 pages**: Localized error pages with template support

### Development Experience
- **Incremental rebuilds**: Only rebuild changed pages in development
- **Hot reloading**: Instant updates with Vite HMR
- **File watching**: Automatic detection of template, layout, and data changes
- **Error handling**: Clear error messages for template issues

### Link Management
- **Smart rewriting**: Automatic conversion of root-relative links (`/about/` → `/fr/about/`)
- **Helper functions**: `getLocalizedUrl()` for manual link generation
- **Safety net**: Optional automatic link rewriting for legacy content

## 📊 Performance

- ⚡ **Build time**: ~70ms for 4 pages + sitemaps + 404s
- 🗜️ **HTML compression**: ~40-60% size reduction in production
- 🚀 **HMR**: Instant hot reloading with incremental rebuilds
- 📦 **Bundle size**: Zero JavaScript in final output (pure static HTML)
- 🔄 **Smart caching**: File modification time tracking for efficient rebuilds
- 🎯 **Selective updates**: Only rebuild affected pages on template changes

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

## 📚 Examples

### Creating a Contact Page with Form
```html
<!-- src/pages/contact.njk -->
{% extends "main.njk" %}

{% block content %}
<h1>{{ t("contact.title") }}</h1>
<p>{{ t("contact.description") }}</p>

<form action="/{{ locale }}/submit" method="post">
  <label for="email">{{ t("contact.email") }}</label>
  <input type="email" id="email" name="email" required>
  
  <label for="message">{{ t("contact.message") }}</label>
  <textarea id="message" name="message" required></textarea>
  
  <button type="submit">{{ t("contact.send") }}</button>
</form>
{% endblock %}
```

### Adding RTL Language Support
```javascript
// vite.config.js
localesMeta: {
  en: { name: 'English', rtl: false },
  fr: { name: 'Français', rtl: false },
  ar: { name: 'العربية', rtl: true }
}
```

```html
<!-- Layout automatically handles RTL -->
<html lang="{{ locale }}" dir="{% if rtl %}rtl{% else %}ltr{% endif %}">
```

### Custom 404 Pages
```html
<!-- src/pages/404.njk -->
{% extends "main.njk" %}

{% block content %}
<h1>{{ t("error.404.title") }}</h1>
<p>{{ t("error.404.description") }}</p>
<a href="/{{ locale }}/">{{ t("navigation.home") }}</a>
{% endblock %}
```

## 🔧 Troubleshooting

### Common Issues

**Template Syntax Errors**
- Use Nunjucks syntax: `{% if locale == 'en' %}` not `{{ locale === 'en' }}`
- Function calls: `{{ t("key") }}` not `{{ t.key }}`

**Missing Translations**
- Check file encoding (UTF-8)
- Verify JSON syntax in translation files
- Use nested keys: `"homepage": { "title": "..." }`

**Module Import Issues**
- Ensure `"type": "module"` is in package.json
- Use ES6 import syntax consistently

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
- [Eleventy Plus Vite](https://github.com/matthiasott/eleventy-plus-vite) - Inspiration for SSG + Vite integration

## 📚 Related Projects

- [Vite](https://github.com/vitejs/vite) - Build tool
- [Nunjucks](https://github.com/mozilla/nunjucks) - Template engine
- [Chokidar](https://github.com/paulmillr/chokidar) - File watching

---

<div align="center">

**[⭐ Star this repo](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic)** • **[🐛 Report Bug](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/issues)** • **[✨ Request Feature](https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/issues)**

Made with ❤️ for the multi-locale web

</div>
