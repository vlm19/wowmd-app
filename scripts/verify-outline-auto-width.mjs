import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const tmpDir = path.join(root, 'tmp', 'outline-auto-width')
const appUrl = process.env.APP_URL || 'http://127.0.0.1:4174/app/'
const screenshotPath = path.join(tmpDir, 'outline-auto-width-real-case.png')
const markdownPath = path.join(tmpDir, 'long-outline-real-case.md')

const markdown = `# Reader Outline Width Regression Case

This document checks that the reader outline can adapt to realistic long headings without covering the reader content.

## Executive summary with an intentionally long title that should still remain readable in the outline

The reader should keep the outline and body in separate grid columns.

## Local storage, browser site data, and cache terminology that reviewers frequently confuse

This section uses the kind of title that appears in product review documents and support articles.

### Browser local storage is not the same thing as browser cache and the copy must stay precise

Long nested headings should wrap inside the outline instead of being hidden behind the reader pane.

## Export behavior for reviewed Markdown, backup JSON, ticket JSON, and copied AI handoff snippets

The title is long enough to require the automatic outline width calculation to do useful work.

## Short section

Short headings should still look normal after the wider outline calculation.
`

async function main() {
  await mkdir(tmpDir, { recursive: true })
  await writeFile(markdownPath, markdown, 'utf8')

  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('wowmd.locale', 'en')
  })

  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.locator('input[type="file"]').first().setInputFiles(markdownPath)
  await page.getByRole('heading', { name: 'Reader Outline Width Regression Case' }).waitFor({
    state: 'visible',
    timeout: 10000,
  })

  const metrics = await page.evaluate(() => {
    const outline = document.querySelector('.outline')
    const reader = document.querySelector('.reader-card')
    const links = Array.from(document.querySelectorAll('.outline a'))

    if (!outline || !reader) throw new Error('Missing reader outline or reader card')

    const outlineRect = outline.getBoundingClientRect()
    const readerRect = reader.getBoundingClientRect()
    const overflowingLinks = links
      .filter((link) => link.scrollWidth > link.clientWidth + 1)
      .map((link) => link.textContent?.trim())
      .filter(Boolean)

    return {
      outlineWidth: Math.round(outlineRect.width),
      readerLeft: Math.round(readerRect.left),
      outlineRight: Math.round(outlineRect.right),
      overlapsReader: outlineRect.right > readerRect.left,
      overflowingLinks,
      linkCount: links.length,
    }
  })

  if (metrics.outlineWidth <= 300) {
    throw new Error(`Expected auto outline width above 300px, got ${metrics.outlineWidth}px`)
  }
  if (metrics.overlapsReader) {
    throw new Error(`Outline overlaps reader: ${JSON.stringify(metrics)}`)
  }
  if (metrics.overflowingLinks.length) {
    throw new Error(`Outline links overflow horizontally: ${metrics.overflowingLinks.join(' | ')}`)
  }

  await page.screenshot({ path: screenshotPath, fullPage: false })
  await browser.close()

  console.log(JSON.stringify({ screenshotPath, markdownPath, metrics }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
