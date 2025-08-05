# 🔍 Lighthouse Testing Guide

This guide shows you how to run Lighthouse performance, accessibility, SEO, and best practices audits locally.

## 🚀 Quick Start

### 1. Run Full Lighthouse CI Suite (All Pages)
```bash
npm run lighthouse
```
This runs Lighthouse on all pages defined in `lighthouserc.json` and shows detailed results.

### 2. Quick Single Page Test
```bash
npm run lighthouse:quick
```
Tests a single page (English homepage) with core metrics and opens results in browser.

### 3. Single Page with Report
```bash
npm run lighthouse:single
```
Tests a single page and saves an HTML report to `lighthouse-report.html`.

## 📊 Available Commands

| Command | Description | Best For |
|---------|-------------|----------|
| `npm run lighthouse` | Full test suite (all pages) | Complete audit before deployment |
| `npm run lighthouse:quick` | Quick single page test | Fast feedback during development |
| `npm run lighthouse:single` | Single page with HTML report | Detailed analysis of specific page |
| `npm run lighthouse:collect` | Collect data only (no assertions) | Gathering data without pass/fail |

## 🎯 Manual Lighthouse Testing

### Test Any Page Manually
```bash
# Start the preview server first
npm run build
npm run preview

# In another terminal, test any page
npx lighthouse http://localhost:4173/en/ --view
npx lighthouse http://localhost:4173/fr/about.html --view
```

### Test Specific Categories
```bash
# Performance only
npx lighthouse http://localhost:4173/en/ --only-categories=performance --view

# SEO and Accessibility
npx lighthouse http://localhost:4173/en/ --only-categories=seo,accessibility --view
```

### Save Reports
```bash
# Save as HTML
npx lighthouse http://localhost:4173/en/ --output html --output-path ./en-report.html

# Save as JSON
npx lighthouse http://localhost:4173/en/ --output json --output-path ./en-report.json

# Save both
npx lighthouse http://localhost:4173/en/ --output html,json --output-path ./en-report
```

## 🔧 Configuration

### lighthouserc.json
Your current configuration tests these pages:
- Root page (`/`)
- English pages (`/en/`, `/en/about.html`)
- French pages (`/fr/`, `/fr/about.html`)

### Thresholds
Current minimum scores required:
- **Performance**: 90%
- **Accessibility**: 90% (error if below)
- **Best Practices**: 90%
- **SEO**: 90% (error if below)

## 📈 Understanding Results

### Scores
- **90-100**: Excellent (Green)
- **50-89**: Needs improvement (Orange)
- **0-49**: Poor (Red)

### Key Metrics
- **FCP** (First Contentful Paint): How quickly content appears
- **LCP** (Largest Contentful Paint): Main content load time
- **CLS** (Cumulative Layout Shift): Visual stability
- **TTI** (Time to Interactive): When page becomes interactive

## 🛠️ Common Issues & Fixes

### SEO Issues (Currently 82% - Need to fix)
- Missing meta description
- Missing Open Graph tags
- Image alt attributes

### Best Practices Issues (Currently 89% - Warning)
- HTTPS usage in production
- Browser console errors
- Image optimization

## 💡 Tips

1. **Run before committing**: Always test performance changes
2. **Test all locales**: Make sure both English and French pages perform well
3. **Mobile vs Desktop**: Lighthouse tests mobile by default
4. **Production URLs**: Test on actual domain for full SEO audit

## 🔗 Useful Links

- [Lighthouse Scoring](https://web.dev/performance-scoring/)
- [Web Vitals](https://web.dev/vitals/)
- [Lighthouse CI Documentation](https://github.com/GoogleChrome/lighthouse-ci)
