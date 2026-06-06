import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outputDir = path.join(root, 'tmp', 'support-page-audit')
const supportUrl = process.env.SUPPORT_URL || 'http://127.0.0.1:4174/support.html'

async function inspectPage(page) {
  const requiredIds = [
    'open',
    'typed-review',
    'reanchor',
    'ticket',
    'storage',
    'reader',
    'annotate',
    'map',
    'export',
    'settings',
    'feedback',
    'faq',
  ]

  return page.evaluate((ids) => {
    const images = Array.from(document.querySelectorAll('.support-doc .shot-frame img')).map((image) => ({
      src: image.getAttribute('src'),
      loaded: image.complete && image.naturalWidth > 0,
      width: image.naturalWidth,
      height: image.naturalHeight,
    }))
    const missingIds = ids.filter((id) => !document.getElementById(id))
    const pageWidth = document.documentElement.clientWidth
    const scrollWidth = document.documentElement.scrollWidth

    return {
      images,
      missingIds,
      pageWidth,
      scrollWidth,
      bodyText: document.body.innerText,
    }
  }, requiredIds)
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  const browser = await chromium.launch({ headless: true })

  const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await desktop.goto(supportUrl, { waitUntil: 'networkidle' })
  const desktopResult = await inspectPage(desktop)
  for (const text of [
    'Open Markdown without changing the original',
    'Storage, backup, and recovery',
    'Overall Review Map',
  ]) {
    if (!desktopResult.bodyText.includes(text)) throw new Error(`Missing Support copy: ${text}`)
  }
  if (desktopResult.missingIds.length) throw new Error(`Missing Support sections: ${desktopResult.missingIds.join(', ')}`)
  if (desktopResult.images.length !== 6 || desktopResult.images.some((image) => !image.loaded)) {
    throw new Error(`Support screenshots failed: ${JSON.stringify(desktopResult.images)}`)
  }
  const desktopScreenshot = path.join(outputDir, 'support-desktop.png')
  await desktop.screenshot({ path: desktopScreenshot, fullPage: true })

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(supportUrl, { waitUntil: 'networkidle' })
  const mobileResult = await inspectPage(mobile)
  if (mobileResult.scrollWidth > mobileResult.pageWidth + 1) {
    throw new Error(`Support page has mobile horizontal overflow: ${JSON.stringify(mobileResult)}`)
  }
  const mobileScreenshot = path.join(outputDir, 'support-mobile.png')
  await mobile.screenshot({ path: mobileScreenshot, fullPage: true })

  await browser.close()
  console.log(JSON.stringify({
    desktopScreenshot,
    mobileScreenshot,
    desktop: {
      images: desktopResult.images,
      missingIds: desktopResult.missingIds,
      pageWidth: desktopResult.pageWidth,
      scrollWidth: desktopResult.scrollWidth,
    },
    mobile: {
      images: mobileResult.images,
      missingIds: mobileResult.missingIds,
      pageWidth: mobileResult.pageWidth,
      scrollWidth: mobileResult.scrollWidth,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
