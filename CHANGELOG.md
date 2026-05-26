# Changelog

All notable changes to this project are documented in this file. Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows [Semantic Versioning](https://semver.org/).

## [2.2.0] – 2026-05-26

### Added
- New Nunjucks global `data_uri(logicalPath)` — returns the asset as a `data:` URI. Inferred MIME type from the file extension; SVG is URL-encoded (smaller and still human-readable), everything else is base64. Lets templates inline small images (avatars, logos) so the LCP image arrives in the first network round-trip alongside the HTML:

  ```njk
  <img src="{{ data_uri('/assets/images/avatar.webp') }}" alt="…">
  ```

## [2.1.0] – 2026-05-26

### Added
- New Nunjucks global `inline_asset(logicalPath)` — resolves the path through the asset manifest and returns the file contents as a `SafeString`. Lets templates inline processed (minified, hashed) CSS/JS straight into the document for critical-path optimisation:

  ```njk
  <style>{{ inline_asset('/assets/styles/main.css') }}</style>
  ```

## [2.0.1] – 2026-05-26

### Fixed
- `NotFoundGenerator` was emitting `dist/404.html` instead of `dist/<locale>/404.html` when the `landing_page` route used `path: "/"`. The locale directory is now derived by taking the first non-empty segment of the resolved path (matching `WebmanifestGenerator`'s behaviour) — `dirname("en/")` returns `"."`, which collapsed all locales into a single file.

## [2.0.0] – 2026-05-26

### Added
- Initial npm release. Extracted the plugin from the [INPLUGS-CO2](https://github.com/EPFL-ENAC/INPLUGS-CO2) repo and packaged it for distribution.
- Modular structure under `plugins/`:
  - `utils/locale-utils.js` — shared route/locale/translator helpers.
  - `utils/asset-processor.js` — CSS/JS/image pipeline with cache-busting hashes and optional WebP conversion via [sharp](https://sharp.pixelplumbing.com/).
  - `utils/page-renderer.js` — per-locale page rendering with hreflang `alternates`, route-based output paths, and link rewriting.
  - `generators/sitemap-generator.js` — per-locale sitemaps + sitemap-index.
  - `generators/notfound-generator.js` — per-locale `404.html` generation.
  - `generators/webmanifest-generator.js` — per-locale `site.webmanifest`.
  - `generators/root-redirect-generator.js` — root `index.html` with cookie-based language detection.
- Bundled Nunjucks templates for the four generators (`templates/*.njk`). Loaded via `import.meta.url` so the plugin works regardless of consumer CWD.
- Each generator uses an isolated `nunjucks.Environment` to avoid mutating the user's global env.
- `package.json` exposes `main`/`exports`/`files` for installable npm distribution. `vite` is a `peerDependency`; `sharp` is an `optionalDependency`.

[2.2.0]: https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/releases/tag/v2.2.0
[2.1.0]: https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/releases/tag/v2.1.0
[2.0.1]: https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/releases/tag/v2.0.1
[2.0.0]: https://github.com/guilbep/vite-ssr-nunjucks-i18n-basic/releases/tag/v2.0.0
