/**
 * Multi-Locale Vite Plugin
 *
 * A comprehensive static site generator with internationalization support.
 * Refactored into modular components for better maintainability:
 *
 * Utils:
 * - locale-utils.js: Core locale utilities and functions
 * - asset-processor.js: Handles CSS, JS, and image assets with cache busting
 * - page-renderer.js: Template rendering and page generation
 *
 * Generators (using Nunjucks templates from plugins/templates/):
 * - sitemap-generator.js: XML sitemap generation
 * - notfound-generator.js: 404 page generation
 * - webmanifest-generator.js: Localized PWA manifests
 * - root-redirect-generator.js: Root index.html with language detection
 *
 * Templates:
 * - sitemap.xml.njk: Sitemap template with hreflang support
 * - sitemap-index.xml.njk: Sitemap index template
 * - 404.html.njk: 404 error page template
 * - manifest.json.njk: PWA manifest template
 * - root-redirect.html.njk: Root redirect page template
 */

import { resolve, join, dirname, basename, extname } from "path";
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
  rmSync,
} from "fs";
import { glob } from "glob";
import nunjucks from "nunjucks";
import chokidar from "chokidar";

// Import refactored modules
import { AssetProcessor } from "./utils/asset-processor.js";
import { PageRenderer } from "./utils/page-renderer.js";
import { SitemapGenerator } from "./generators/sitemap-generator.js";
import { NotFoundGenerator } from "./generators/notfound-generator.js";
import { WebmanifestGenerator } from "./generators/webmanifest-generator.js";
import { RootRedirectGenerator } from "./generators/root-redirect-generator.js";
import {
  LOCALE_RE,
  loadRoutesConfig,
  loadLocaleData,
  loadMetaData,
  getRoutePath,
} from "./utils/locale-utils.js";

export function multiLocalePlugin(options = {}) {
  const {
    srcDir = "src",
    pagesDir = "src/pages",
    layoutsDir = "src/layouts",
    partialsDir = "src/partials",
    dataDir = "src/data",
    outputDir = "dist",
    devOutputDir = ".tmp", // Separate directory for development
    defaultLocale = "en",
    locales = ["en", "fr"],
    siteUrl = "https://example.com",
    localesMeta = {},
    emitSitemaps = true,
    emit404s = true,
    linkRewrite = "safety-net",
    copyPublic = true, // Option to disable public directory copying
  } = options;

  // Validate required directories exist
  const requiredDirs = [srcDir, pagesDir, layoutsDir, partialsDir, dataDir];
  for (const dir of requiredDirs) {
    if (!existsSync(dir)) {
      throw new Error(
        `Required directory "${dir}" does not exist. Please create it or adjust your plugin configuration.`,
      );
    }
  }

  // Validate locales configuration
  if (!Array.isArray(locales) || locales.length === 0) {
    throw new Error("locales must be a non-empty array");
  }

  if (!locales.includes(defaultLocale)) {
    throw new Error(
      `defaultLocale "${defaultLocale}" must be included in locales array`,
    );
  }

  let isServing = false;
  let server = null;
  let isProduction = false;
  let currentOutputDir = outputDir; // Will be set based on mode

  // Initialize component modules with correct output directory
  const assetProcessor = new AssetProcessor({
    srcDir,
    outputDir: isProduction ? outputDir : devOutputDir, // Use correct directory based on mode
    copyPublic,
  });

  const pageRenderer = new PageRenderer({
    outputDir: currentOutputDir,
    pagesDir,
    dataDir,
    locales,
    defaultLocale,
    localesMeta,
    linkRewrite,
  });

  const sitemapGenerator = new SitemapGenerator({
    outputDir: currentOutputDir,
    siteUrl,
    locales,
  });

  const notFoundGenerator = new NotFoundGenerator({
    outputDir: currentOutputDir,
    pagesDir,
    dataDir,
    locales,
    defaultLocale,
    localesMeta,
  });

  const webmanifestGenerator = new WebmanifestGenerator({
    outputDir: currentOutputDir,
    locales,
    defaultLocale,
    localesMeta,
  });

  const rootRedirectGenerator = new RootRedirectGenerator({
    outputDir: currentOutputDir,
    locales,
    defaultLocale,
  });

  // Track file modification times for incremental rebuilds
  const fileMTime = new Map();

  // Cleanup function for development
  function cleanupDevDirectory() {
    if (!isProduction && existsSync(devOutputDir)) {
      try {
        rmSync(devOutputDir, { recursive: true, force: true });
        console.log(`🧹 Cleaned up ${devOutputDir} directory`);
      } catch (error) {
        console.warn(`⚠️  Could not clean up ${devOutputDir}:`, error.message);
      }
    }
  }

  // Setup cleanup on process exit
  function setupCleanup() {
    const cleanup = () => {
      cleanupDevDirectory();
      process.exit(0);
    };

    // Handle various exit signals
    process.on("SIGINT", cleanup); // Ctrl+C
    process.on("SIGTERM", cleanup); // Termination signal
    process.on("exit", cleanupDevDirectory); // Process exit
  }

  // Configure Nunjucks
  const env = nunjucks.configure([srcDir, layoutsDir, partialsDir], {
    autoescape: true,
    watch: false, // We handle watching ourselves
    noCache: true, // Disable template caching for development
  });

  // Add Nunjucks globals and filters
  env.addFilter(
    "locale_url",
    (p, l) => `/${l}${p.startsWith("/") ? "" : "/"}${p}`,
  );
  env.addFilter("eq", (a, b) => a === b);

  // Add Eleventy-like filters for compatibility
  env.addFilter("url", (p) => {
    // Simple URL filter - handles asset paths and regular paths
    if (!p) return "/";

    // If it's already an absolute URL or starts with /, return as-is
    if (p.startsWith("http") || p.startsWith("/")) return p;

    // For relative paths, prepend with /
    return "/" + p;
  });

  env.addFilter("absoluteUrl", (path, baseUrl) => {
    // Create absolute URL by combining path with base URL
    if (!path) return baseUrl || "";
    if (!baseUrl) return path;

    // If path is already absolute, return as-is
    if (path.startsWith("http")) return path;

    // Ensure baseUrl doesn't end with slash and path starts with slash
    const cleanBase = baseUrl.replace(/\/$/, "");
    const cleanPath = path.startsWith("/") ? path : "/" + path;

    return cleanBase + cleanPath;
  });

  // Global translator - will be set per render
  env.addGlobal("t", function (key, params) {
    return currentTranslator ? currentTranslator(key, params) : key;
  });

  // If not found in manifest, fall back to the logical path
  //
  const manifest = assetProcessor.getManifest();
  console.log("manifest", manifest);
  env.addGlobal("asset", (logicalPath) => manifest[logicalPath] || logicalPath);
  env.addGlobal("manifest", manifest);
  // Set Nunjucks environment for all components that need it
  pageRenderer.setNunjucksEnv(env);
  notFoundGenerator.setNunjucksEnv(env);

  // Check if file is stale for incremental rebuilds
  function isStale(file) {
    if (!existsSync(file)) return false;
    const m = statSync(file).mtimeMs;
    const prev = fileMTime.get(file);
    fileMTime.set(file, m);
    return prev !== m;
  }

  // Generate all pages for all locales
  async function generatePages() {
    const localeData = loadLocaleData(locales, dataDir);
    const routesConfig = loadRoutesConfig();
    const metaData = loadMetaData(dataDir);

    console.log(`🌍 Generating pages for locales: ${locales.join(", ")}`);

    // Discover pages with co-located variants
    const allFiles = glob.sync(`${pagesDir}/**/*.njk`);
    const byBase = new Map(); // basePath => { default: file, variants: {en:file,fr:file} }
    console.log("generatePages allFiles", allFiles);
    for (const f of allFiles) {
      const rel = f.replace(`${pagesDir}/`, "");
      const m = rel.match(LOCALE_RE);
      const base = m ? rel.replace(LOCALE_RE, ".njk") : rel;
      const entry = byBase.get(base) || { default: null, variants: {} };
      if (m) entry.variants[m[1]] = rel;
      else entry.default = rel;
      byBase.set(base, entry);
    }

    // Update all components with current state
    const assetHashes = assetProcessor.getAssetHashes();
    pageRenderer.setAssetHashes(assetHashes);
    notFoundGenerator.setAssetHashes(assetHashes);

    // Render pages
    for (const [baseRel, entry] of byBase) {
      for (const locale of locales) {
        const relTemplate = entry.variants[locale] || entry.default; // fallback
        if (!relTemplate) continue; // no default: skip
        await pageRenderer.renderOne({
          relTemplate,
          baseRel,
          locale,
          availableLocales: Object.keys(entry.variants),
          localeData,
          routesConfig,
          metaData,
        });
      }
    }

    // Generate root redirect page
    await rootRedirectGenerator.generateRootRedirect(routesConfig);

    // Generate sitemaps if enabled
    if (emitSitemaps) {
      sitemapGenerator.buildSitemaps(routesConfig);
    }

    // Generate 404 pages if enabled
    if (emit404s) {
      await notFoundGenerator.write404s(routesConfig);
    }

    // Generate localized webmanifests
    await webmanifestGenerator.generateWebManifests(routesConfig, localeData);
  }

  // Setup file watcher for development with incremental rebuilds
  function setupWatcher() {
    const watchPaths = [
      // Nunjucks templates
      `${pagesDir}/**/*.njk`,
      `${layoutsDir}/**/*.njk`,
      `${partialsDir}/**/*.njk`,
      // Data files
      `${dataDir}/**/*.json`,
      // CSS files
      `${srcDir}/assets/css/**/*.css`,
      // JS files
      `${srcDir}/assets/js/**/*.js`,
      // Asset files that might affect the build
      `${srcDir}/assets/**/*`,
    ];

    const watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on("change", async (path) => {
      if (!isStale(path)) return;

      console.log(`📝 File changed: ${path}`);

      // Determine file type and appropriate action
      const ext = extname(path).toLowerCase();
      const isTemplate = ext === ".njk";
      const isData = ext === ".json" && path.startsWith(dataDir);
      const isAsset =
        ext === ".css" ||
        ext === ".js" ||
        path.startsWith(`${srcDir}/assets`) ||
        path.startsWith("public/");

      // For assets, reprocess them first
      if (isAsset) {
        console.log(`🎨 Reprocessing assets due to ${ext} file change...`);
        await assetProcessor.processAssets();
      }

      const localeData = loadLocaleData(locales, dataDir);
      const routesConfig = loadRoutesConfig();
      const metaData = loadMetaData(dataDir);

      // For templates and data files, handle page rebuilding
      if (isTemplate || isData) {
        // Discover pages with co-located variants for incremental rebuild
        const allFiles = glob.sync(`${pagesDir}/**/*.njk`);
        const byBase = new Map();

        for (const f of allFiles) {
          const rel = f.replace(`${pagesDir}/`, "");
          const m = rel.match(LOCALE_RE);
          const baseName = m ? rel.replace(LOCALE_RE, ".njk") : rel;
          const entry = byBase.get(baseName) || { default: null, variants: {} };
          if (m) entry.variants[m[1]] = rel;
          else entry.default = rel;
          byBase.set(baseName, entry);
        }

        // If a page changed: rebuild that base page for all locales
        if (path.startsWith(pagesDir)) {
          const rel = path.replace(`${pagesDir}/`, "");
          const base = rel.replace(LOCALE_RE, ".njk");
          await pageRenderer.rebuildBase(
            base,
            localeData,
            routesConfig,
            metaData,
            byBase,
          );
        } else {
          // layout/partials/data: rebuild all pages
          await generatePages();
        }
      } else if (isAsset) {
        // For assets, we need to update asset hashes and regenerate pages with new hashes
        const assetHashes = assetProcessor.getAssetHashes();
        pageRenderer.setAssetHashes(assetHashes);
        notFoundGenerator.setAssetHashes(assetHashes);

        // Regenerate all pages to pick up new asset hashes
        await generatePages();
      }

      // Trigger HMR if in dev mode
      if (server) {
        server.ws.send({ type: "full-reload" });
      }
    });

    watcher.on("add", async (path) => {
      console.log(`➕ File added: ${path}`);

      // Determine file type and appropriate action
      const ext = extname(path).toLowerCase();
      const isAsset =
        ext === ".css" ||
        ext === ".js" ||
        path.startsWith(`${srcDir}/assets`) ||
        path.startsWith("public/");

      // For assets, reprocess them first
      if (isAsset) {
        console.log(`🎨 Processing new asset: ${ext} file...`);
        await assetProcessor.processAssets();
      }

      // Always regenerate pages when files are added to ensure proper integration
      await generatePages();

      // Trigger HMR if in dev mode
      if (server) {
        server.ws.send({ type: "full-reload" });
      }
    });

    watcher.on("unlink", async (path) => {
      console.log(`🗑️  File deleted: ${path}`);

      // Determine file type and appropriate action
      const ext = extname(path).toLowerCase();
      const isAsset =
        ext === ".css" ||
        ext === ".js" ||
        path.startsWith(`${srcDir}/assets`) ||
        path.startsWith("public/");

      // For assets, reprocess them to update references
      if (isAsset) {
        console.log(`🎨 Reprocessing assets after deletion of ${ext} file...`);
        await assetProcessor.processAssets();
      }

      // Always regenerate pages when files are deleted to ensure cleanup
      await generatePages();

      // Trigger HMR if in dev mode
      if (server) {
        server.ws.send({ type: "full-reload" });
      }
    });

    return watcher;
  }

  return {
    name: "multi-locale",

    configResolved(config) {
      // Detect production mode using config.mode
      // In Vite:
      // - dev: command='serve', mode='development'
      // - preview: command='serve', mode='production'
      // - build: command='build', mode='production'
      isProduction = config.mode === "production";

      // Set output directory based on mode
      currentOutputDir = isProduction ? outputDir : devOutputDir;

      // Update all components with the correct output directory
      assetProcessor.outputDir = currentOutputDir;
      pageRenderer.outputDir = currentOutputDir;
      sitemapGenerator.outputDir = currentOutputDir;
      notFoundGenerator.outputDir = currentOutputDir;
      webmanifestGenerator.outputDir = currentOutputDir;
      rootRedirectGenerator.outputDir = currentOutputDir;

      // Update production state in all components
      assetProcessor.setProduction(isProduction);
      pageRenderer.setProduction(isProduction);
      notFoundGenerator.setProduction(isProduction);
      rootRedirectGenerator.setProduction(isProduction);

      console.log(
        `📁 Using output directory: ${currentOutputDir} (${isProduction ? "production" : "development"})`,
      );

      // Update paths based on Vite config
      if (config.root) {
        // Adjust paths to be relative to Vite root
      }
    },

    configureServer(devServer) {
      isServing = true;
      server = devServer;

      // Setup cleanup for development mode
      if (!isProduction) {
        setupCleanup();
      }

      // Generate initial pages and assets (async)
      (async () => {
        await assetProcessor.processAssets();
        await generatePages();
      })().catch(console.error);

      // Setup file watcher
      const watcher = setupWatcher();

      // Cleanup on server close
      devServer.httpServer?.on("close", () => {
        watcher.close();
        cleanupDevDirectory();
      });

      // Add HMR middleware to inject Vite client script into HTML responses
      devServer.middlewares.use((req, res, next) => {
        // Store original res.end to intercept HTML responses
        const originalEnd = res.end.bind(res);

        res.end = function (chunk, encoding) {
          // Only process HTML content in development
          if (
            !isProduction &&
            res.getHeader("Content-Type")?.includes("text/html") &&
            chunk &&
            typeof chunk === "string"
          ) {
            // Inject Vite client script if not already present
            if (!chunk.includes("/@vite/client")) {
              chunk = chunk.replace(
                /<head>/i,
                '<head>\n  <script type="module" src="/@vite/client"></script>',
              );
            }
          }

          originalEnd(chunk, encoding);
        };

        next();
      });

      // Custom middleware for locale routing and asset serving
      devServer.middlewares.use((req, res, next) => {
        const url = req.url;

        // Serve shared assets from /assets/ - prevent locale prefixing
        if (url.startsWith("/assets/")) {
          // Decode URL to handle spaces and special characters in filenames
          const decodedUrl = decodeURIComponent(url);
          const assetPath = join(currentOutputDir, decodedUrl);
          if (existsSync(assetPath)) {
            const content = readFileSync(assetPath);
            const ext = extname(decodedUrl);
            const mimeTypes = {
              ".css": "text/css",
              ".js": "text/javascript",
              ".svg": "image/svg+xml",
              ".png": "image/png",
              ".jpg": "image/jpeg",
            };
            res.setHeader("Content-Type", mimeTypes[ext] || "text/plain");
            res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year cache
            res.end(content);
            return;
          }
        }

        // If requesting root, serve the redirect page
        if (url === "/" || url === "/index.html") {
          const redirectHtml = readFileSync(
            `${currentOutputDir}/index.html`,
            "utf8",
          );
          res.setHeader("Content-Type", "text/html");
          res.end(redirectHtml);
          return;
        }

        // Load routes configuration for URL matching
        const routesConfig = loadRoutesConfig();
        const routesList = routesConfig.routes || [];

        // Try to match the URL to a route in any locale
        for (const locale of locales) {
          for (const route of routesList) {
            // Get the actual path for this locale
            const routePath = getRoutePath(route.key, locale, routesConfig);
            if (!routePath) continue;

            // Check if URL matches this route (with or without trailing slash)
            const cleanRoutePath = routePath.replace(/\/$/, "");
            const cleanUrlPath = url.replace(/\/$/, "");

            if (cleanRoutePath === cleanUrlPath) {
              // Convert route path to file path using same logic as renderOne
              let filePath = routePath.replace(/^\//, "").replace(/\/$/, "");
              if (!filePath) filePath = "index";

              // For index routes, place them in the locale directory structure
              if (filePath === "en" || filePath === "fr") {
                filePath = filePath + "/index";
              }

              if (!filePath.endsWith(".html")) filePath += ".html";

              const fullPath = join(currentOutputDir, filePath);
              if (existsSync(fullPath)) {
                const html = readFileSync(fullPath, "utf8");
                res.setHeader("Content-Type", "text/html");
                res.end(html);
                return;
              }
            }

            // Also check if URL matches route path without .html extension
            if (!url.endsWith(".html")) {
              const urlWithHtml = url + ".html";
              if (cleanRoutePath === urlWithHtml.replace(/\/$/, "")) {
                // Convert route path to file path using same logic as renderOne
                let filePath = routePath.replace(/^\//, "").replace(/\/$/, "");
                if (!filePath) filePath = "index";

                // For index routes, place them in the locale directory structure
                if (filePath === "en" || filePath === "fr") {
                  filePath = filePath + "/index";
                }

                if (!filePath.endsWith(".html")) filePath += ".html";

                const fullPath = join(currentOutputDir, filePath);
                if (existsSync(fullPath)) {
                  const html = readFileSync(fullPath, "utf8");
                  res.setHeader("Content-Type", "text/html");
                  res.end(html);
                  return;
                }
              }
            }
          }
        }

        // Legacy fallback: If requesting a locale-specific page with old structure
        const localeMatch = url.match(/^\/([a-z]{2})\/(.*)/);
        if (localeMatch) {
          const [, locale, path] = localeMatch;
          if (locales.includes(locale)) {
            const filePath = `${currentOutputDir}/${locale}/${path || "index.html"}`;
            if (existsSync(filePath)) {
              const html = readFileSync(filePath, "utf8");
              res.setHeader("Content-Type", "text/html");
              res.end(html);
              return;
            }
          }
        }

        next();
      });
    },

    configurePreviewServer(previewServer) {
      // Same middleware logic for preview mode
      previewServer.middlewares.use((req, res, next) => {
        const url = req.url;

        // Serve shared assets from /assets/ - prevent locale prefixing
        if (url.startsWith("/assets/")) {
          // Decode URL to handle spaces and special characters in filenames
          const decodedUrl = decodeURIComponent(url);
          const assetPath = join(currentOutputDir, decodedUrl);
          if (existsSync(assetPath)) {
            const content = readFileSync(assetPath);
            const ext = extname(decodedUrl);
            const mimeTypes = {
              ".css": "text/css",
              ".js": "text/javascript",
              ".svg": "image/svg+xml",
              ".png": "image/png",
              ".jpg": "image/jpeg",
            };
            res.setHeader("Content-Type", mimeTypes[ext] || "text/plain");
            res.setHeader("Cache-Control", "public, max-age=31536000"); // 1 year cache
            res.end(content);
            return;
          }
        }

        // If requesting root, serve the redirect page
        if (url === "/" || url === "/index.html") {
          const redirectHtml = readFileSync(
            `${currentOutputDir}/index.html`,
            "utf8",
          );
          res.setHeader("Content-Type", "text/html");
          res.end(redirectHtml);
          return;
        }

        // Load routes configuration for URL matching
        const routesConfig = loadRoutesConfig();
        const routesList = routesConfig.routes || [];

        // Try to match the URL to a route in any locale
        for (const locale of locales) {
          for (const route of routesList) {
            // Get the actual path for this locale
            const routePath = getRoutePath(route.key, locale, routesConfig);
            if (!routePath) continue;

            // Check if URL matches this route (with or without trailing slash)
            const cleanRoutePath = routePath.replace(/\/$/, "");
            const cleanUrlPath = url.replace(/\/$/, "");

            if (cleanRoutePath === cleanUrlPath) {
              // Convert route path to file path using same logic as renderOne
              let filePath = routePath.replace(/^\//, "").replace(/\/$/, "");
              if (!filePath) filePath = "index";

              // For index routes, place them in the locale directory structure
              if (filePath === "en" || filePath === "fr") {
                filePath = filePath + "/index";
              }

              if (!filePath.endsWith(".html")) filePath += ".html";

              const fullPath = join(currentOutputDir, filePath);
              if (existsSync(fullPath)) {
                const html = readFileSync(fullPath, "utf8");
                res.setHeader("Content-Type", "text/html");
                res.end(html);
                return;
              }
            }

            // Also check if URL matches route path without .html extension
            if (!url.endsWith(".html")) {
              const urlWithHtml = url + ".html";
              if (cleanRoutePath === urlWithHtml.replace(/\/$/, "")) {
                // Convert route path to file path using same logic as renderOne
                let filePath = routePath.replace(/^\//, "").replace(/\/$/, "");
                if (!filePath) filePath = "index";

                // For index routes, place them in the locale directory structure
                if (filePath === "en" || filePath === "fr") {
                  filePath = filePath + "/index";
                }

                if (!filePath.endsWith(".html")) filePath += ".html";

                const fullPath = join(currentOutputDir, filePath);
                if (existsSync(fullPath)) {
                  const html = readFileSync(fullPath, "utf8");
                  res.setHeader("Content-Type", "text/html");
                  res.end(html);
                  return;
                }
              }
            }
          }
        }

        // Legacy fallback: If requesting a locale-specific page with old structure
        const localeMatch = url.match(/^\/([a-z]{2})\/(.*)/);
        if (localeMatch) {
          const [, locale, path] = localeMatch;
          if (locales.includes(locale)) {
            const filePath = `${currentOutputDir}/${locale}/${path || "index.html"}`;
            if (existsSync(filePath)) {
              const html = readFileSync(filePath, "utf8");
              res.setHeader("Content-Type", "text/html");
              res.end(html);
              return;
            }
          }
        }

        next();
      });
    },

    async buildStart() {
      if (!isServing) {
        console.log("🏗️  Building multi-locale site...");
        // Ensure output directory exists and is clean
        if (!existsSync(currentOutputDir)) {
          mkdirSync(currentOutputDir, { recursive: true });
        }
        // Process assets for both dev and production
        await assetProcessor.processAssets();
        await generatePages();
      }
    },

    generateBundle(options, bundle) {
      // Clear the bundle since we don't need JS files for this static site
      for (const fileName of Object.keys(bundle)) {
        delete bundle[fileName];
      }
      console.log("📦 Multi-locale pages generated");
    },

    // Hook into the writeBundle to ensure our static files are copied to final output
    async writeBundle() {
      if (isProduction) {
        console.log("✅ Multi-locale build complete!");
      }
    },
  };
}

// Export a helper function to create the plugin with common defaults
export function createMultiLocalePlugin(userOptions = {}) {
  return multiLocalePlugin(userOptions);
}
