import { resolve, join, dirname, basename, extname } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { glob } from 'glob'
import nunjucks from 'nunjucks'
import chokidar from 'chokidar'
import { minify } from 'html-minifier-terser'

export function multiLocalePlugin(options = {}) {
  const {
    srcDir = 'src',
    pagesDir = 'src/pages',
    layoutsDir = 'src/layouts', 
    partialsDir = 'src/partials',
    dataDir = 'src/data',
    outputDir = 'dist',
    defaultLocale = 'en',
    locales = ['en', 'fr']
  } = options

  let isServing = false
  let server = null
  let isProduction = false
  
  // Configure Nunjucks
  const env = nunjucks.configure([srcDir, layoutsDir, partialsDir], {
    autoescape: true,
    watch: false, // We handle watching ourselves
  })

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

  // Generate all pages for all locales
  async function generatePages() {
    const localeData = loadLocaleData()
    const pageFiles = glob.sync(`${pagesDir}/**/*.njk`)
    
    console.log(`🌍 Generating pages for locales: ${locales.join(', ')}`)
    
    for (const pageFile of pageFiles) {
      const relativePath = pageFile.replace(`${pagesDir}/`, '')
      const pageName = relativePath.replace('.njk', '.html')
      // Get just the template name for Nunjucks to find in its path
      const templateName = 'pages/' + relativePath
      
      for (const locale of locales) {
        try {
          // Render the page with locale data
          let html = env.render(templateName, {
            locale,
            t: localeData[locale] || {},
            locales,
            currentLocale: locale,
            defaultLocale,
            currentPage: `/${pageName}`,
            // Helper functions
            isCurrentLocale: (l) => l === locale,
            getLocalizedUrl: (path, targetLocale) => {
              const loc = targetLocale || locale
              return `/${loc}${path}`
            }
          })
          
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
          
          // Create output directory
          const outputPath = `${outputDir}/${locale}`
          if (!existsSync(outputPath)) {
            mkdirSync(outputPath, { recursive: true })
          }
          
          // Write the file
          const outputFile = `${outputPath}/${pageName}`
          const outputFileDir = dirname(outputFile)
          if (!existsSync(outputFileDir)) {
            mkdirSync(outputFileDir, { recursive: true })
          }
          
          writeFileSync(outputFile, html)
          console.log(`  ✓ ${locale}/${pageName}`)
          
        } catch (err) {
          console.error(`  ✗ Error rendering ${locale}/${pageName}:`, err.message)
        }
      }
    }
    
    // Generate root index.html that redirects to default locale
    let rootIndex = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirect</title>
  <script>
    // Simple locale detection and redirect
    const userLang = navigator.language.substring(0, 2);
    const supportedLocales = ${JSON.stringify(locales)};
    const locale = supportedLocales.includes(userLang) ? userLang : '${defaultLocale}';
    window.location.href = '/' + locale + '/';
  </script>
</head>
<body>
  <p>Redirecting...</p>
  <p><a href="/${defaultLocale}/">Continue to site</a></p>
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
  }

  // Setup file watcher for development
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
    
    watcher.on('change', (path) => {
      console.log(`📝 File changed: ${path}`)
      generatePages().catch(console.error)
      
      // Trigger HMR if in dev mode
      if (server) {
        server.ws.send({
          type: 'full-reload'
        })
      }
    })
    
    watcher.on('add', (path) => {
      console.log(`➕ File added: ${path}`)
      generatePages().catch(console.error)
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
      
      // Generate initial pages
      generatePages().catch(console.error)
      
      // Setup file watcher
      const watcher = setupWatcher()
      
      // Cleanup on server close
      devServer.httpServer?.on('close', () => {
        watcher.close()
      })
      
      // Custom middleware for locale routing
      devServer.middlewares.use((req, res, next) => {
        const url = req.url
        
        // If requesting root, serve the redirect page
        if (url === '/' || url === '/index.html') {
          const redirectHtml = readFileSync(`${outputDir}/index.html`, 'utf8')
          res.setHeader('Content-Type', 'text/html')
          res.end(redirectHtml)
          return
        }
        
        // If requesting a locale-specific page, serve it
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