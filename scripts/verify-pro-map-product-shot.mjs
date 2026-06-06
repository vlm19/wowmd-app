import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outputDir = path.join(root, 'tmp', 'overall-review-map-product-shot')
const screenshotPath = path.join(outputDir, 'pro-page-map-section.png')
const fullPageScreenshotPath = path.join(outputDir, 'pro-page-audit.png')
const mobileScreenshotPath = path.join(outputDir, 'pro-page-audit-mobile.png')
const pageUrl = process.env.PRO_URL || 'http://127.0.0.1:4174/pro.html'

async function main() {
  await mkdir(outputDir, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto(pageUrl, { waitUntil: 'networkidle' })

  const pageText = await page.locator('body').innerText()
  for (const staleText of [
    'The review layer between an AI draft and what you ship.',
    'The Understanding Map shows density',
    'The outline tracks your scroll position.',
  ]) {
    if (pageText.includes(staleText)) throw new Error(`Stale Pro copy remains: ${staleText}`)
  }

  const shotMetrics = await page.locator('.shot-frame img').evaluateAll((images) =>
    images.map((element) => ({
      src: element.getAttribute('src'),
      loaded: element.complete && element.naturalWidth > 0,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      alt: element.alt,
    })),
  )
  if (shotMetrics.some((image) => !image.loaded)) {
    throw new Error(`One or more Pro screenshots failed to load: ${JSON.stringify(shotMetrics)}`)
  }

  const section = page.locator('#map')
  await section.scrollIntoViewIfNeeded()
  const image = section.locator('img[src*="assets/shots/map.png"]')
  await image.waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(250)

  const metrics = await image.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return {
      loaded: element.complete && element.naturalWidth > 0,
      naturalWidth: element.naturalWidth,
      naturalHeight: element.naturalHeight,
      renderedWidth: Math.round(rect.width),
      renderedHeight: Math.round(rect.height),
      alt: element.alt,
    }
  })

  if (!metrics.loaded) throw new Error('Pro page map screenshot did not load')
  if (metrics.naturalWidth !== 2560 || metrics.naturalHeight !== 2040) {
    throw new Error(`Unexpected map screenshot size: ${metrics.naturalWidth}x${metrics.naturalHeight}`)
  }

  await section.screenshot({ path: screenshotPath })
  await page.screenshot({ path: fullPageScreenshotPath, fullPage: true })

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobilePage.goto(pageUrl, { waitUntil: 'networkidle' })
  await mobilePage.screenshot({ path: mobileScreenshotPath, fullPage: true })
  const mobileOverflow = await mobilePage.evaluate(() => ({
    pageWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: Array.from(document.querySelectorAll('body *'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName,
          className: element.className,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        }
      })
      .filter((element) => element.left < -1 || element.right > document.documentElement.clientWidth + 1)
      .slice(0, 12),
  }))
  if (mobileOverflow.scrollWidth > mobileOverflow.pageWidth + 1) {
    throw new Error(`Pro page has horizontal overflow at 390px: ${JSON.stringify(mobileOverflow)}`)
  }

  await browser.close()
  console.log(JSON.stringify({
    screenshotPath,
    fullPageScreenshotPath,
    mobileScreenshotPath,
    mobileOverflow,
    metrics,
    shotMetrics,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
