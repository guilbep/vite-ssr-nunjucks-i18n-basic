import { resolve, join, dirname, basename, extname } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync } from 'fs'
import { glob } from 'glob'
import nunjucks from 'nunjucks'
import chokidar from 'chokidar'
import { minify } from 'html-minifier-terser'
import { createHash } from 'crypto'

export function multiLocalePlugin(options = {}) {
  const {
    srcDir = 'src',
    pagesDir = 'src/pages',
    layoutsDir = 'src/layouts', 
    partialsDir = 'src/partials',
    dataDir = 'src/data',
    outputDir = 'dist',
    defaultLocale = 'en',
    locales = ['en', 'fr'],
    siteUrl = 'https://example.com',
    localesMeta = {},
    emitSitemaps = true,
    emit404s = true,
    linkRewrite = 'safety-net'
  } = options

  let isServing = false
  let server = null
  let isProduction = false
  let assetHashes = {} // Store asset hashes for cache busting
  
  // Track file modification times for incremental rebuilds
  const fileMTime = new Map()
  
  // Locale regex for co-located variants
  const LOCALE_RE = /\.([a-z]{2})\.njk$/
  
  // Configure Nunjucks
  const env = nunjucks.configure([srcDir, layoutsDir, partialsDir], {
    autoescape: true,
    watch: false, // We handle watching ourselves
  })

  // Add Nunjucks globals and filters
  env.addFilter('locale_url', (p, l) => `/${l}${p.startsWith('/') ? '' : '/'}${p}`)
  env.addFilter('eq', (a, b) => a === b)
  
  // Global translator - will be set per render
  let currentTranslator = null
  env.addGlobal('t', function(key, params) {
    return currentTranslator ? currentTranslator(key, params) : key
  })

  // Load routes configuration
  function loadRoutesConfig() {
    try {
      const routesData = JSON.parse(readFileSync('routes.config.json', 'utf8'))
      return routesData
    } catch (err) {
      console.warn('Could not load routes.config.json:', err.message)
      return { routes: {} }
    }
  }

  // Load locale data
  function loadLocaleData() {
    const localeData = {}
    for (const locale of locales) {
      try {
        const data = JSON.parse(readFileSync(`${dataDir}/${locale}.json`, 'utf8'))
        localeData[locale] = data
      } catch (err) {
        console.warn(`Could not load locale data for ${locale}:`, err.message)
        localeData[locale] = {}
      }
    }
    return localeData
  }

  // Helper function to get route path for a page key and locale
  function getRoutePath(pageKey, locale, routesConfig) {
    const routes = routesConfig.routes || {}
    const localeRoutes = routes[locale] || []
    const route = localeRoutes.find(r => r.key === pageKey)
    return route ? route.path : null
  }

  // Helper function to get page key from filename
  function getPageKey(filename) {
    // Remove extension and locale suffix
    const base = filename.replace(/\.njk$/, '').replace(/\.[a-z]{2}$/, '')
    return base
  }

  // Helper function to get all route paths for a page key across all locales
  function getAllRoutePaths(pageKey, routesConfig) {
    const paths = {}
    const routes = routesConfig.routes || {}
    
    for (const locale of locales) {
      const localeRoutes = routes[locale] || []
      const route = localeRoutes.find(r => r.key === pageKey)
      if (route) {
        paths[locale] = route.path
      }
    }
    return paths
  }

  // Create real t() function with fallback and params - now supports nested keys
  function makeTranslator(localeData, locale, defaultLocale) {
    const L = localeData[locale] || {}
    const D = localeData[defaultLocale] || {}
    
    return (key, params = {}) => {
      // Support nested keys like "homepage.title"
      let s = getNestedValue(L, key) ?? getNestedValue(D, key) ?? key
      
      // Handle parameter interpolation
      for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{{${k}}}`, String(v))
      }
      return s
    }
  }
  
  // Helper function to get nested object values
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  // Generate content hash for cache busting
  function generateHash(content) {
    return createHash('md5').update(content).digest('hex').slice(0, 8)
  }

  // Copy assets to /assets/ directory (dev: no hash, prod: with hash)
  function processAssets() {
    const assetsDir = join(outputDir, 'assets')
    if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true })
    
    // Reset hashes for this build
    assetHashes = {}
    
    // Process CSS files
    const cssDir = join(assetsDir, 'styles')
    if (!existsSync(cssDir)) mkdirSync(cssDir, { recursive: true })
    
    const cssFiles = ['main.css', 'tokens.css', 'navbar.css']
    let combinedCssContent = ''
    
    // First pass: read all CSS content to create a combined hash
    cssFiles.forEach(file => {
      const srcPath = join(srcDir, 'styles', file)
      if (existsSync(srcPath)) {
        combinedCssContent += readFileSync(srcPath, 'utf8')
      }
    })
    
    const cssHash = combinedCssContent ? generateHash(combinedCssContent) : ''
    if (cssHash) assetHashes.cssHash = cssHash
    
    // Second pass: copy files with the combined hash
    cssFiles.forEach(file => {
      const srcPath = join(srcDir, 'styles', file)
      if (existsSync(srcPath)) {
        const fileName = isProduction ? 
          file.replace('.css', `.${cssHash}.css`) : 
          file
        copyFileSync(srcPath, join(cssDir, fileName))
        console.log(`  ✓ ${file} → assets/styles/${fileName}`)
      }
    })
    
    // Process JS files  
    const jsDir = join(assetsDir, 'js')
    if (!existsSync(jsDir)) mkdirSync(jsDir, { recursive: true })
    
    const jsPath = 'public/js/nav-active-lang.js'
    if (existsSync(jsPath)) {
      const content = readFileSync(jsPath, 'utf8')
      const hash = generateHash(content)
      assetHashes.jsHash = hash
      const fileName = isProduction ? 
        `nav-active-lang.${hash}.js` : 
        'nav-active-lang.js'
      copyFileSync(jsPath, join(jsDir, fileName))
      console.log(`  ✓ nav-active-lang.js → assets/js/${fileName}`)
    }
    
    // Process images
    const imgDir = join(assetsDir, 'images')
    if (!existsSync(imgDir)) mkdirSync(imgDir, { recursive: true })
    
    const logoPath = join(srcDir, 'assets/logo.svg')
    if (existsSync(logoPath)) {
      const content = readFileSync(logoPath)
      const hash = generateHash(content)
      assetHashes.imgHash = hash
      const fileName = isProduction ? 
        `logo.${hash}.svg` : 
        'logo.svg'
      copyFileSync(logoPath, join(imgDir, fileName))
      console.log(`  ✓ logo.svg → assets/images/${fileName}`)
    }
  }

  // Check if file is stale for incremental rebuilds
  function isStale(file) {
    if (!existsSync(file)) return false
    const m = statSync(file).mtimeMs
    const prev = fileMTime.get(file)
    fileMTime.set(file, m)
    return prev !== m
  }

  // Rewrite root-relative links to be locale-aware using routes configuration
  function rewriteLinksWithRoutes(html, locale, routesConfig) {
    if (linkRewrite === 'off') return html
    
    // First, try to match page keys in links and convert them to proper routes
    return html.replace(/href="([^"]*?)"/g, (match, href) => {
      // Skip external links, anchors, mailto, tel, and assets
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || 
          href.startsWith('tel:') || href.startsWith('/assets/')) {
        return match
      }
      
      // If it's already a properly formatted route path, leave it
      if (href.startsWith('/en/') || href.startsWith('/fr/')) {
        return match
      }
      
      // Try to parse as page key (e.g., "about", "contact")
      const pageKey = href.replace(/^\//, '').replace(/\.html$/, '')
      const routePath = getRoutePath(pageKey, locale, routesConfig)
      
      if (routePath) {
        return `href="${routePath}"`
      }
      
      // Fallback to original behavior for unknown links
      const cleanHref = href.replace(/^\/+/, '')
      return `href="/${locale}/${cleanHref}"`
    }).replace(/src="([^"]*?)"/g, (match, src) => {
      // Handle src attributes (images, scripts, etc.)
      if (src.startsWith('http') || src.startsWith('/assets/') || src.startsWith('data:')) {
        return match
      }
      
      const cleanSrc = src.replace(/^\/+/, '')
      return `src="/${locale}/${cleanSrc}"`
    })
  }

  // Render one page for a specific locale
  async function renderOne({ relTemplate, baseRel, locale, availableLocales, localeData, routesConfig }) {
    const templateName = 'pages/' + relTemplate
    const pageKey = getPageKey(baseRel)
    
    // Get the route path for this page and locale
    const routePath = getRoutePath(pageKey, locale, routesConfig)
    if (!routePath) {
      console.warn(`No route found for page key "${pageKey}" in locale "${locale}"`)
      return
    }
    
    // Convert route path to file path (remove leading slash, ensure .html extension)
    let filePath = routePath.replace(/^\//, '').replace(/\/$/, '')
    if (!filePath) filePath = 'index'
    
    // For index routes, place them in the locale directory structure
    if (filePath === 'en' || filePath === 'fr') {
      filePath = filePath + '/index'
    }
    
    if (!filePath.endsWith('.html')) filePath += '.html'
    
    // Get all route paths for this page across locales for navigation
    const allRoutePaths = getAllRoutePaths(pageKey, routesConfig)
    
    // Include all configured locales in alternates for navigation
    const alternates = [...locales]
    const meta = localesMeta[locale] || {}
    
    // Create translator for this locale
    const translator = makeTranslator(localeData, locale, defaultLocale)
    
    // Set the global translator for this render
    currentTranslator = translator
    
    try {
      // Get navigation items from routes config for current locale
      const navItems = (routesConfig.routes?.[locale] || []).map(route => ({
        key: route.key,
        title: route.title,
        path: route.path
      }))
      
      let html = env.render(templateName, {
        locale,
        locales,
        alternates,             // for hreflang UI
        defaultLocale,
        rtl: meta.rtl || ['ar','he','fa','ur'].includes(locale),
        isProduction,           // Add production flag for template
        ...assetHashes,         // Add asset hashes (cssHash, jsHash, imgHash)
        t: translator,          // Function access: t("homepage.title") 
        // Also provide object access for backward compatibility
        ...Object.fromEntries(
          Object.entries(localeData[locale] || localeData[defaultLocale] || {})
        ),
        navItems,               // Navigation items from routes config
        currentPage: routePath,
        page: { 
          slug: pageKey,
          key: pageKey,
          path: routePath,
          routes: allRoutePaths  // All localized paths for this page
        },
        isCurrentLocale: l => l === locale,
        getLocalizedUrl: (pageKeyOrPath, targetLocale = locale) => {
          // If it's a page key, look up the route
          const targetRoute = getRoutePath(pageKeyOrPath, targetLocale, routesConfig)
          if (targetRoute) return targetRoute
          
          // Otherwise try to convert existing path
          const cleanPath = pageKeyOrPath.replace(/^\/([a-z]{2})\//,'')
          return `/${targetLocale}/${cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath}`
        },
        // Helper function to get route for a specific page key and locale
        getRouteUrl: (pageKey, targetLocale = locale) => {
          return getRoutePath(pageKey, targetLocale, routesConfig) || '#'
        }
      })
      
      // Update link rewriting to be aware of routes
      html = rewriteLinksWithRoutes(html, locale, routesConfig)
      
      // Minify HTML in production
      if (isProduction) {
        html = await minify(html, {
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
          minifyJS: true
        })
      }
      
      // Create output directory structure based on route path
      const outputPath = join(outputDir, dirname(filePath))
      if (!existsSync(outputPath)) {
        mkdirSync(outputPath, { recursive: true })
      }
      
      // Write the file
      const outputFile = join(outputDir, filePath)
      writeFileSync(outputFile, html)
      console.log(`  ✓ ${routePath} → ${filePath}`)
      
    } catch (err) {
      console.error(`  ✗ Error rendering ${routePath}:`, err.message)
    } finally {
      // Reset global translator
      currentTranslator = null
    }
  }

  // Generate localized sitemaps
  function buildSitemaps(routesConfig) {
    const urlsets = new Map() // locale => Set(paths)
    for (const locale of locales) urlsets.set(locale, new Set())
    
    // Use routes configuration to build sitemap URLs
    const routes = routesConfig.routes || {}
    for (const locale of locales) {
      const localeRoutes = routes[locale] || []
      for (const route of localeRoutes) {
        let url = `${siteUrl}${route.path}`
        if (!url.endsWith('/')) url += '/'
        urlsets.get(locale).add(url)
      }
    }

    // per-locale sitemaps
    for (const [locale, set] of urlsets) {
      const urls = [...set].sort().map(u => `  <url><loc>${u}</loc></url>`).join('\n')
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
      writeFileSync(join(outputDir, `sitemap-${locale}.xml`), sitemap)
      console.log(`  ✓ sitemap-${locale}.xml`)
    }

    // index
    const items = locales.map(l =>
      `  <sitemap><loc>${siteUrl}/sitemap-${l}.xml</loc></sitemap>`).join('\n')
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${items}
</sitemapindex>`
    writeFileSync(join(outputDir, `sitemap-index.xml`), sitemapIndex)
    console.log(`  ✓ sitemap-index.xml`)
  }

  // Generate localized 404 pages using routes
  async function write404s(routesConfig) {
    for (const locale of locales) {
      const meta = localesMeta[locale] || {}
      
      // Try to use a 404 template if available, otherwise use default
      let html
      const custom404Path = `${pagesDir}/404.njk`
      const custom404LocalePath = `${pagesDir}/404.${locale}.njk`
      
      if (existsSync(custom404LocalePath) || existsSync(custom404Path)) {
        // Use template system
        const localeData = loadLocaleData()
        const translator = makeTranslator(localeData, locale, defaultLocale)
        currentTranslator = translator
        
        try {
          const templateFile = existsSync(custom404LocalePath) ? '404.' + locale + '.njk' : '404.njk'
          html = env.render('pages/' + templateFile, {
            locale,
            locales,
            alternates: [locale], // Only current locale for 404
            defaultLocale,
            rtl: meta.rtl || ['ar','he','fa','ur'].includes(locale),
            t: translator,
            ...Object.fromEntries(
              Object.entries(localeData[locale] || localeData[defaultLocale] || {})
            ),
            currentPage: '/404.html',
            page: { slug: '404' },
            isCurrentLocale: l => l === locale,
            getLocalizedUrl: (pageKeyOrPath, targetLocale = locale) => {
              const targetRoute = getRoutePath(pageKeyOrPath, targetLocale, routesConfig)
              if (targetRoute) return targetRoute
              
              const cleanPath = pageKeyOrPath.replace(/^\/([a-z]{2})\//,'')
              return `/${targetLocale}/${cleanPath.startsWith('/') ? cleanPath.slice(1) : cleanPath}`
            },
            getRouteUrl: (pageKey, targetLocale = locale) => {
              return getRoutePath(pageKey, targetLocale, routesConfig) || '#'
            }
          })
        } catch (err) {
          console.warn(`Could not render 404 template for ${locale}, using default:`, err.message)
          html = null
        } finally {
          currentTranslator = null
        }
      }
      
      // Fallback to basic 404 page
      if (!html) {
        const homeRoute = getRoutePath('index', locale, routesConfig) || `/${locale}/`
        html = `<!DOCTYPE html>
<html lang="${locale}" dir="${meta.rtl ? 'rtl' : 'ltr'}">
<head>
  <meta charset="utf-8">
  <title>404 - Page Not Found</title>
</head>
<body>
  <h1>404 - Page Not Found</h1>
  <p>The page you are looking for could not be found.</p>
  <a href="${homeRoute}">Go Home</a>
</body>
</html>`
      }

      if (isProduction) {
        html = await minify(html, {
          removeComments: true,
          collapseWhitespace: true,
          minifyCSS: true,
          minifyJS: true
        })
      }

      // Write 404 to the locale-specific directory structure from routes
      const localeRoutes = routesConfig.routes?.[locale] || []
      const indexRoute = localeRoutes.find(r => r.key === 'index')
      const localeDir = indexRoute ? dirname(indexRoute.path.replace(/^\//, '')) : locale
      
      const out = join(outputDir, localeDir, '404.html')
      if (!existsSync(dirname(out))) mkdirSync(dirname(out), { recursive: true })
      writeFileSync(out, html)
      console.log(`  ✓ ${localeDir}/404.html`)
    }
  }

  // Rebuild specific base page for incremental builds
  async function rebuildBase(base, localeData, routesConfig) {
    const byBase = new Map()
    const allFiles = glob.sync(`${pagesDir}/**/*.njk`)
    
    for (const f of allFiles) {
      const rel = f.replace(`${pagesDir}/`, '')
      const m = rel.match(LOCALE_RE)
      const baseName = m ? rel.replace(LOCALE_RE, '.njk') : rel
      if (baseName === base) {
        const entry = byBase.get(base) || { default: null, variants: {} }
        if (m) entry.variants[m[1]] = rel
        else entry.default = rel
        byBase.set(base, entry)
      }
    }
    
    const entry = byBase.get(base)
    if (entry) {
      for (const locale of locales) {
        const relTemplate = entry.variants[locale] || entry.default
        if (!relTemplate) continue
        await renderOne({ 
          relTemplate, 
          baseRel: base, 
          locale, 
          availableLocales: Object.keys(entry.variants), 
          localeData,
          routesConfig
        })
      }
    }
  }

  // Generate all pages for all locales
  async function generatePages() {
    const localeData = loadLocaleData()
    const routesConfig = loadRoutesConfig()
    
    console.log(`🌍 Generating pages for locales: ${locales.join(', ')}`)
    
    // Discover pages with co-located variants
    const allFiles = glob.sync(`${pagesDir}/**/*.njk`)
    const byBase = new Map() // basePath => { default: file, variants: {en:file,fr:file} }

    for (const f of allFiles) {
      const rel = f.replace(`${pagesDir}/`, '')
      const m = rel.match(LOCALE_RE)
      const base = m ? rel.replace(LOCALE_RE, '.njk') : rel
      const entry = byBase.get(base) || { default: null, variants: {} }
      if (m) entry.variants[m[1]] = rel
      else entry.default = rel
      byBase.set(base, entry)
    }

    // Render pages
    for (const [baseRel, entry] of byBase) {
      for (const locale of locales) {
        const relTemplate = entry.variants[locale] || entry.default // fallback
        if (!relTemplate) continue // no default: skip
        await renderOne({ 
          relTemplate, 
          baseRel, 
          locale, 
          availableLocales: Object.keys(entry.variants), 
          localeData,
          routesConfig
        })
      }
    }
    
    // Generate improved root index.html with cookie support
    let rootIndex = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirect</title>
  <script>
    const qs = new URLSearchParams(location.search);
    const forced = qs.get('lang');
    const supported = ${JSON.stringify(locales)};
    const COOKIE = 'lang=';
    const getCookie = () => document.cookie.split('; ').find(c => c.startsWith(COOKIE))?.slice(COOKIE.length);

    let lang = forced || getCookie() || (navigator.language||'').toLowerCase().slice(0,2);
    if (!supported.includes(lang)) lang = '${defaultLocale}';
    document.cookie = \`lang=\${lang}; path=/; max-age=\${60*60*24*365}\`;
    
    // Redirect to the home page route for the selected language
    const routes = ${JSON.stringify(routesConfig.routes || {})};
    const localeRoutes = routes[lang] || [];
    const homeRoute = localeRoutes.find(r => r.key === 'index');
    const homePath = homeRoute ? homeRoute.path : '/' + lang + '/';
    location.replace(homePath);
  </script>
</head>
<body>
  <noscript>
    <p><a href="${getRoutePath('index', defaultLocale, routesConfig) || `/${defaultLocale}/`}">Continue</a></p>
  </noscript>
</body>
</html>`
    
    // Minify root index in production
    if (isProduction) {
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
        minifyJS: true
      })
    }
    
    writeFileSync(`${outputDir}/index.html`, rootIndex)
    console.log(`  ✓ Root redirect page`)
    
    // Generate sitemaps if enabled
    if (emitSitemaps) {
      buildSitemaps(routesConfig)
    }
    
    // Generate 404 pages if enabled
    if (emit404s) {
      await write404s(routesConfig)
    }
  }

  // Setup file watcher for development with incremental rebuilds
  function setupWatcher() {
    const watchPaths = [
      `${pagesDir}/**/*.njk`,
      `${layoutsDir}/**/*.njk`, 
      `${partialsDir}/**/*.njk`,
      `${dataDir}/**/*.json`
    ]
    
    const watcher = chokidar.watch(watchPaths, {
      persistent: true,
      ignoreInitial: true
    })
    
    watcher.on('change', async (path) => {
      if (!isStale(path)) return
      
      console.log(`📝 File changed: ${path}`)
      const localeData = loadLocaleData()
      const routesConfig = loadRoutesConfig()
      
      // If a page changed: rebuild that base page for all locales
      if (path.startsWith(pagesDir)) {
        const rel = path.replace(`${pagesDir}/`, '')
        const base = rel.replace(LOCALE_RE, '.njk')
        await rebuildBase(base, localeData, routesConfig)
      } else {
        // layout/partials/data: rebuild all
        await generatePages()
      }
      
      // Trigger HMR if in dev mode
      if (server) {
        server.ws.send({ type: 'full-reload' })
      }
    })
    
    watcher.on('add', async (path) => {
      console.log(`➕ File added: ${path}`)
      await generatePages()
    })
    
    return watcher
  }

  return {
    name: 'multi-locale',
    
    configResolved(config) {
      // Detect production mode
      isProduction = config.command === 'build'
      
      // Update paths based on Vite config
      if (config.root) {
        // Adjust paths to be relative to Vite root
      }
    },
    
    configureServer(devServer) {
      isServing = true
      server = devServer
      
      // Generate initial pages and assets
      processAssets()
      generatePages().catch(console.error)
      
      // Setup file watcher
      const watcher = setupWatcher()
      
      // Cleanup on server close
      devServer.httpServer?.on('close', () => {
        watcher.close()
      })
      
      // Custom middleware for locale routing and asset serving
      devServer.middlewares.use((req, res, next) => {
        const url = req.url
        
        // Serve shared assets from /assets/ - prevent locale prefixing
        if (url.startsWith('/assets/')) {
          const assetPath = join(outputDir, url)
          if (existsSync(assetPath)) {
            const content = readFileSync(assetPath)
            const ext = extname(url)
            const mimeTypes = {
              '.css': 'text/css',
              '.js': 'text/javascript',
              '.svg': 'image/svg+xml',
              '.png': 'image/png',
              '.jpg': 'image/jpeg'
            }
            res.setHeader('Content-Type', mimeTypes[ext] || 'text/plain')
            res.setHeader('Cache-Control', 'public, max-age=31536000') // 1 year cache
            res.end(content)
            return
          }
        }
        
        // If requesting root, serve the redirect page
        if (url === '/' || url === '/index.html') {
          const redirectHtml = readFileSync(`${outputDir}/index.html`, 'utf8')
          res.setHeader('Content-Type', 'text/html')
          res.end(redirectHtml)
          return
        }
        
        // Load routes configuration for URL matching
        const routesConfig = loadRoutesConfig()
        const routes = routesConfig.routes || {}
        
        // Try to match the URL to a route in any locale
        for (const locale of locales) {
          const localeRoutes = routes[locale] || []
          for (const route of localeRoutes) {
            // Check if URL matches this route (with or without trailing slash)
            const routePath = route.path.replace(/\/$/, '')
            const urlPath = url.replace(/\/$/, '')
            
            if (routePath === urlPath || (routePath === '' && urlPath === `/${locale}`)) {
              // Convert route path to file path
              let filePath = route.path.replace(/^\//, '').replace(/\/$/, '')
              if (!filePath) filePath = 'index'
              if (!filePath.endsWith('.html')) filePath += '.html'
              
              const fullPath = join(outputDir, filePath)
              if (existsSync(fullPath)) {
                const html = readFileSync(fullPath, 'utf8')
                res.setHeader('Content-Type', 'text/html')
                res.end(html)
                return
              }
            }
          }
        }
        
        // Legacy fallback: If requesting a locale-specific page with old structure
        const localeMatch = url.match(/^\/([a-z]{2})\/(.*)/)
        if (localeMatch) {
          const [, locale, path] = localeMatch
          if (locales.includes(locale)) {
            const filePath = `${outputDir}/${locale}/${path || 'index.html'}`
            if (existsSync(filePath)) {
              const html = readFileSync(filePath, 'utf8')
              res.setHeader('Content-Type', 'text/html')
              res.end(html)
              return
            }
          }
        }
        
        next()
      })
    },
    
    async buildStart() {
      if (!isServing) {
        console.log('🏗️  Building multi-locale site...')
        // Ensure output directory exists and is clean
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true })
        }
        // Process assets for both dev and production
        processAssets()
        await generatePages()
      }
    },
    
    generateBundle(options, bundle) {
      // Clear the bundle since we don't need JS files for this static site
      for (const fileName of Object.keys(bundle)) {
        delete bundle[fileName]
      }
      console.log('📦 Multi-locale pages generated')
    },
    
    // Hook into the writeBundle to ensure our static files are copied to final output
    async writeBundle() {
      if (isProduction) {
        console.log('✅ Multi-locale build complete!')
      }
    }
  }
}

// Export a helper function to create the plugin with common defaults
export function createMultiLocalePlugin(userOptions = {}) {
  return multiLocalePlugin(userOptions)
}