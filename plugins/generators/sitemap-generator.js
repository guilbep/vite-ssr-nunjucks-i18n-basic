import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { Eta } from "eta";
import { getRoutePath, getAllRoutePaths } from "../utils/locale-utils.js";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates", import.meta.url));

export class SitemapGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || "dist";
    this.siteUrl = options.siteUrl || "https://example.com";
    this.locales = options.locales || ["en", "fr"];

    // Isolated Eta scoped to the package's own templates dir so the plugin
    // works regardless of the consumer's CWD. autoEscape off for raw XML.
    this.eta = new Eta({
      views: TEMPLATES_DIR,
      useWith: true,
      autoEscape: false,
      cache: true,
    });
  }

  // Generate localized sitemaps
  buildSitemaps(routesConfig) {
    // Build alternate routes map for hreflang
    const alternateRoutes = new Map();
    const routes = routesConfig.routes || [];

    // First pass: collect all routes by base route
    for (const locale of this.locales) {
      for (const route of routes) {
        const routePath = getRoutePath(route.key, locale, routesConfig);
        if (routePath) {
          const baseRoute = route.baseRoute || routePath;
          if (!alternateRoutes.has(baseRoute)) {
            alternateRoutes.set(baseRoute, {});
          }
          alternateRoutes.get(baseRoute)[locale] = {
            ...route,
            path: routePath,
          };
        }
      }
    }

    // Generate per-locale sitemaps
    for (const locale of this.locales) {
      const sitemapRoutes = routes
        .map((route) => {
          const routePath = getRoutePath(route.key, locale, routesConfig);
          if (routePath) {
            return {
              ...route,
              path: routePath,
              baseRoute: route.baseRoute || routePath,
            };
          }
          return null;
        })
        .filter((route) => route !== null);

      const sitemapXml = this.eta.render("sitemap.xml.eta", {
        routes: sitemapRoutes,
        siteUrl: this.siteUrl,
        lastmod: new Date().toISOString().split("T")[0],
        alternateRoutes: Object.fromEntries(alternateRoutes),
      });

      writeFileSync(join(this.outputDir, `sitemap-${locale}.xml`), sitemapXml);
      console.log(`  ✓ sitemap-${locale}.xml`);
    }

    // Generate sitemap index
    const sitemapItems = this.locales.map((locale) => ({
      loc: `${this.siteUrl}/sitemap-${locale}.xml`,
      lastmod: new Date().toISOString().split("T")[0],
    }));

    const sitemapIndex = this.eta.render("sitemap-index.xml.eta", {
      sitemaps: sitemapItems,
    });

    writeFileSync(join(this.outputDir, `sitemap-index.xml`), sitemapIndex);
    console.log(`  ✓ sitemap-index.xml`);
  }
}
