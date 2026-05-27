import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Eta } from "eta";
import { getRoutePath, makeTranslator } from "../utils/locale-utils.js";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates", import.meta.url));

export class WebmanifestGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || "dist";
    this.locales = options.locales || ["en", "fr"];
    this.defaultLocale = options.defaultLocale || "en";
    this.localesMeta = options.localesMeta || {};

    // Isolated Eta scoped to the package's own templates dir.
    // autoEscape off for raw JSON output.
    this.eta = new Eta({
      views: TEMPLATES_DIR,
      useWith: true,
      autoEscape: false,
      cache: true,
    });
  }

  // Generate localized site.webmanifest files
  async generateWebManifests(routesConfig, localeData) {
    const manifestPath = "public/site.webmanifest";
    let baseManifest = {};

    if (existsSync(manifestPath)) {
      try {
        baseManifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      } catch (err) {
        console.warn("Could not parse site.webmanifest, using defaults");
      }
    }

    for (const locale of this.locales) {
      const meta = this.localesMeta[locale] || {};
      const translator = makeTranslator(localeData, locale, this.defaultLocale);

      // Get the home route for this locale as start_url
      const homeRoute =
        getRoutePath("index", locale, routesConfig) || `/${locale}/`;

      // Get localized values
      const localizedName =
        translator("site.name") ||
        translator("meta.title") ||
        baseManifest.name ||
        "INPLUGS";
      const localizedShortName =
        translator("site.short_name") ||
        translator("meta.short_title") ||
        baseManifest.short_name ||
        "INPLUGS";
      const localizedDescription =
        translator("site.description") ||
        translator("meta.description") ||
        baseManifest.description ||
        "";

      // Pull icons, theme/background colour, and display mode from the user's
      // public/site.webmanifest when present so the generated per-locale
      // manifests don't hardcode INPLUGS-specific values. Fall back to safe
      //, generic defaults — including an empty icons array, which is valid
      // per the spec and stops the browser from 404'ing on icons we don't
      // actually ship.
      const DEFAULT_ICONS = [
        {
          src: "/assets/images/favicon/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/assets/images/favicon/android-chrome-384x384.png",
          sizes: "384x384",
          type: "image/png",
        },
      ];
      const icons = Array.isArray(baseManifest.icons)
        ? baseManifest.icons
        : DEFAULT_ICONS;
      const themeColor = baseManifest.theme_color || "#ffffff";
      const backgroundColor = baseManifest.background_color || "#ffffff";
      const display = baseManifest.display || "standalone";

      // Render manifest using template
      const manifestJson = this.eta.render("manifest.json.eta", {
        name: localizedName,
        shortName: localizedShortName,
        description: localizedDescription,
        startUrl: homeRoute,
        locale,
        scope: homeRoute,
        dir:
          meta.rtl || ["ar", "he", "fa", "ur"].includes(locale) ? "rtl" : "ltr",
        themeColor,
        backgroundColor,
        display,
        icons,
      });

      // Determine output path based on locale directory structure
      const routes = routesConfig.routes || [];
      const indexRoute = routes.find((r) => r.key === "landing_page"); // Changed from 'index' to 'landing_page'
      let localeDir = locale; // fallback
      if (indexRoute) {
        const indexPath = getRoutePath("landing_page", locale, routesConfig);
        if (indexPath) {
          const pathParts = indexPath.split("/").filter((p) => p); // Remove empty parts
          localeDir = pathParts[0] || locale;
        }
      }

      const outputPath = join(this.outputDir, localeDir);
      if (!existsSync(outputPath)) {
        mkdirSync(outputPath, { recursive: true });
      }

      const outputFile = join(outputPath, "site.webmanifest");
      writeFileSync(outputFile, manifestJson);
      console.log(`  ✓ ${localeDir}/site.webmanifest`);
    }
  }
}
