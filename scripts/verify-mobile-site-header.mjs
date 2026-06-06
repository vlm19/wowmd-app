import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outputDir = path.join(root, 'tmp', 'mobile-site-header')
const baseUrl = process.env.SITE_URL || 'http://127.0.0.1:4174'
const pages = [
  ['home', '/'],
  ['pro', '/pro.html'],
  ['extension', '/extension.html'],
  ['support', '/support.html'],
]

async function main() {
  await mkdir(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  const results = []

  for (const [name, pathname] of pages) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(`${baseUrl}${pathname}`, { waitUntil: 'networkidle' })

    const metrics = await page.evaluate(() => {
      const logo = document.querySelector('.site-header .logo-link')
      const language = document.querySelector('.site-header .language-picker')
      const nav = document.querySelector('.site-header .site-nav')
      if (!logo || !language || !nav) throw new Error('Missing shared header elements')

      const logoRect = logo.getBoundingClientRect()
      const languageRect = language.getBoundingClientRect()
      const navRect = nav.getBoundingClientRect()
      return {
        logoTop: Math.round(logoRect.top),
        languageTop: Math.round(languageRect.top),
        navTop: Math.round(navRect.top),
        sameRow: Math.abs(
          logoRect.top + logoRect.height / 2 - (languageRect.top + languageRect.height / 2),
        ) <= 2,
        navBelow: navRect.top >= Math.max(logoRect.bottom, languageRect.bottom),
        pageWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }
    })

    if (!metrics.sameRow || !metrics.navBelow || metrics.scrollWidth > metrics.pageWidth + 1) {
      throw new Error(`${name} mobile header failed: ${JSON.stringify(metrics)}`)
    }

    if (name === 'home') {
      const entries = await page.evaluate(() => {
        const appEntry = document.querySelector('.site-header .nav-pro')
        const proEntry = document.querySelector('.flow-stage-label-pro')
        return {
          appText: appEntry?.textContent?.trim(),
          appHref: appEntry?.getAttribute('href'),
          proText: proEntry?.textContent?.trim(),
          proHref: proEntry?.getAttribute('href'),
        }
      })

      if (
        entries.appText !== 'wowMD Pro App'
        || entries.appHref !== 'app/'
        || entries.proText !== 'Explore wowMD Pro'
        || entries.proHref !== 'pro.html'
      ) {
        throw new Error(`home entry targets failed: ${JSON.stringify(entries)}`)
      }

      metrics.entries = entries
    }

    const screenshotPath = path.join(outputDir, `${name}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: false })
    results.push({ name, screenshotPath, metrics })
    await page.close()
  }

  await browser.close()
  console.log(JSON.stringify(results, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
