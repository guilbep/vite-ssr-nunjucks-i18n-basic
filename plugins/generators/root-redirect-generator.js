import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { minify } from "html-minifier-terser";
import nunjucks from "nunjucks";
import { getRoutePath } from "../utils/locale-utils.js";

const TEMPLATES_DIR = fileURLToPath(new URL("../templates", import.meta.url));

export class RootRedirectGenerator {
  constructor(options = {}) {
    this.outputDir = options.outputDir || "dist";
    this.locales = options.locales || ["en", "fr"];
    this.defaultLocale = options.defaultLocale || "en";
    this.isProduction = false;

    // Isolated env scoped to the package's own templates dir.
    this.templateEnv = new nunjucks.Environment(
      new nunjucks.FileSystemLoader(TEMPLATES_DIR, { watch: false }),
      { autoescape: true },
    );
  }

  setProduction(isProduction) {
    this.isProduction = isProduction;
  }

  // Generate improved root index.html with cookie support
  async generateRootRedirect(routesConfig) {
    const defaultHomeRoute =
      getRoutePath("index", this.defaultLocale, routesConfig) ||
      `/${this.defaultLocale}/`;

    // Transform routes to match the expected structure for the template
    const transformedRoutes = {};
    for (const locale of this.locales) {
      transformedRoutes[locale] = routesConfig.routes
        .map((route) => ({
          key: route.key,
          path: getRoutePath(route.key, locale, routesConfig),
        }))
        .filter((route) => route.path !== null);
    }

    let rootIndex = this.templateEnv.render("root-redirect.html.njk", {
      locales: this.locales,
      defaultLocale: this.defaultLocale,
      title: "INPLUGS - Language Selection",
      routes: transformedRoutes,
    });

    // Minify root index in production
    if (this.isProduction) {
      rootIndex = await minify(rootIndex, {
        removeComments: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        sortClassName: true,
        useShortDoctype: true,
        collapseWhitespace: true,
        conservativeCollapse: true,
        preserveLineBreaks: false,
        minifyCSS: true,
        minifyJS: true,
      });
    }

    writeFileSync(join(this.outputDir, "index.html"), rootIndex);
    console.log(`  ✓ Root redirect page`);
  }
}
