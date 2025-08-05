// Highlights the current nav link and rewrites language switcher links
;(() => {
  const ensureSlash = (p) => (p.endsWith('/') ? p : p + '/')
  const PATH = ensureSlash(location.pathname)
  const enToFr = {
    '/en/': '/fr/',
    '/en/gcs/': '/fr/gcs/',
    '/en/data/': '/fr/data/',
    '/en/education/': '/fr/education/',
    '/en/dictionary/': '/fr/dictionnaire/',
    '/en/links/': '/fr/liens-utiles/',
    '/en/about/': '/fr/a-propos/',
    '/en/contact/': '/fr/contact/',
  }
  const frToEn = Object.fromEntries(Object.entries(enToFr).map(([en, fr]) => [fr, en]))
  const isEn = PATH.startsWith('/en/')
  const isFr = PATH.startsWith('/fr/')
  
  // Highlight current navigation link
  document.querySelectorAll('#navigation a[href]').forEach((a) => {
    const hrefPath = ensureSlash(new URL(a.getAttribute('href'), location.origin).pathname)
    if (hrefPath === PATH) {
      a.setAttribute('aria-current', 'page')
      a.style.background = '#1a4f1a'
    }
  })
  
  // Update language switcher links
  const linkEn = document.querySelector('.lang-switch a[data-lang="en"]')
  const linkFr = document.querySelector('.lang-switch a[data-lang="fr"]')
  
  if (linkEn && linkFr) {
    const hash = location.hash || ''
    if (isEn) {
      linkEn.setAttribute('aria-current', 'true')
      linkEn.setAttribute('href', PATH + hash)
      linkFr.setAttribute('href', (enToFr[PATH] || '/fr/') + hash)
    } else if (isFr) {
      linkFr.setAttribute('aria-current', 'true')
      linkFr.setAttribute('href', PATH + hash)
      linkEn.setAttribute('href', (frToEn[PATH] || '/en/') + hash)
    } else {
      linkEn.setAttribute('href', '/en/')
      linkFr.setAttribute('href', '/fr/')
    }
  }
})()
