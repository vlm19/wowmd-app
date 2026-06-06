import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outputDir = path.join(root, 'tmp', 'overall-review-map-product-shot')
const appUrl = process.env.APP_URL || 'http://127.0.0.1:4174/app/'
const screenshotPath = path.join(outputDir, 'map.png')
const readerScreenshotPath = path.join(outputDir, 'reader.png')
const annotateScreenshotPath = path.join(outputDir, 'annotate.png')
const exportScreenshotPath = path.join(outputDir, 'export.png')
const markdownPath = path.join(outputDir, 'architecture-review.md')

const markdown = `# AI Architecture Review

This document reviews a local-first Markdown workflow, its privacy boundaries, recovery model, and delivery formats.

## Product intent

wowMD Pro reads Markdown in the browser and keeps the source file untouched. Reviewers can record decisions without silently rewriting the original document.

The goal is to make uncertain claims, important details, and confirmed passages easy to find before delivery.

## Import and handoff

The extension can hand supported GitHub Markdown to the Pro web app. Only source metadata should travel through the handoff path.

License keys, email addresses, tokens, full Markdown bodies, and private notes must never be placed in handoff URLs.

## Storage model

Saved annotations persist in browser site storage. Imported documents can also be saved as browser-local document copies.

Browser site storage is not the same as browser cache. Clearing site data can remove annotations and imported document copies.

Unsaved toolbar drafts remain fragile and can be lost after refresh, browser crash, or tab closure.

## Recovery expectations

Local-first does not mean impossible to lose. Product copy must explain what is saved, what remains unsaved, and which export protects long-term work.

Backup JSON should preserve annotation data for later re-import. Reviewed Markdown should preserve human-readable review context.

## Delivery workflow

HTML export serves people who need a portable review artifact. Reviewed Markdown creates an Obsidian-ready successor without changing the source file.

Ticket JSON provides a precise work order for an AI or editor. Suggested replacements are included as proposals and are not automatically applied.

## Security notes

Markdown rendering and annotation work happen in the browser unless the user explicitly exports or shares files elsewhere.

The website should avoid broad claims that sound like security certification and explain practical boundaries in plain language.

## Open questions

Users need a clear way to distinguish saved annotations, imported local copies, exported backups, and unsaved draft notes.

The product should make the next review action visible without pretending to judge the quality of the document itself.
`

const annotationPools = {
  clarify: [
    'Only source metadata should travel through the handoff path',
    'Browser site storage is not the same as browser cache',
    'which export protects long-term work',
    'distinguish saved annotations, imported local copies, exported backups, and unsaved draft notes',
  ],
  dispute: [
    'Local-first does not mean impossible to lose',
    'Unsaved toolbar drafts remain fragile',
    'can remove annotations and imported document copies',
    'avoid broad claims that sound like security certification',
  ],
  important: [
    'must never be placed in handoff URLs',
    'preserve annotation data for later re-import',
    'unless the user explicitly exports or shares files elsewhere',
  ],
  confirmed: [
    'keeps the source file untouched',
    'without changing the source file',
    'are not automatically applied',
    'persist in browser site storage',
  ],
}

function shuffle(values) {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

async function selectText(page, text) {
  const box = await page.evaluate((targetText) => {
    const root = document.querySelector('.markdown-body')
    if (!root) throw new Error('Missing markdown body')
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

    while (walker.nextNode()) {
      const node = walker.currentNode
      const value = node.textContent || ''
      const start = value.indexOf(targetText)
      if (start < 0) continue

      const range = document.createRange()
      range.setStart(node, start)
      range.setEnd(node, start + targetText.length)
      node.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' })
      const rect = range.getBoundingClientRect()
      return {
        x1: rect.left + 2,
        y1: rect.top + rect.height / 2,
        x2: rect.right - 2,
        y2: rect.top + rect.height / 2,
      }
    }

    throw new Error(`Text not found: ${targetText}`)
  }, text)

  await page.mouse.move(box.x1, box.y1)
  await page.mouse.down()
  await page.mouse.move(box.x2, box.y2, { steps: 12 })
  await page.mouse.up()
  await page.locator('.floating-markup').waitFor({ state: 'visible', timeout: 5000 })
}

async function markAnnotation(page, annotation) {
  await selectText(page, annotation.text)
  await page.locator(`.type-chip.chip-${annotation.type}`).click()
  await page.locator('.toolbar-confirm').click()
  await page.locator('.floating-markup').waitFor({ state: 'hidden', timeout: 10000 })
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  await writeFile(markdownPath, markdown, 'utf8')

  const annotations = [
    ...shuffle(annotationPools.clarify).slice(0, 3).map((text) => ({ text, type: 'clarify' })),
    ...shuffle(annotationPools.dispute).slice(0, 3).map((text) => ({ text, type: 'dispute' })),
    ...shuffle(annotationPools.important).slice(0, 2).map((text) => ({ text, type: 'important' })),
    ...shuffle(annotationPools.confirmed).slice(0, 2).map((text) => ({ text, type: 'confirmed' })),
  ]

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1020 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('wowmd.locale', 'en')
    localStorage.setItem('wowmd.betaNotice.dismissed.v1', '1')
  })

  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.locator('input[type="file"]').first().setInputFiles(markdownPath)
  await page.getByRole('heading', { name: 'AI Architecture Review' }).waitFor({
    state: 'visible',
    timeout: 10000,
  })
  await page.screenshot({ path: readerScreenshotPath })

  for (const annotation of annotations) {
    await markAnnotation(page, annotation)
    await page.waitForTimeout(100)
  }
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }))
  await page.screenshot({ path: annotateScreenshotPath })

  await page.locator('.map-action').click()
  await page.getByRole('heading', { name: 'Overall Review Map' }).waitFor({
    state: 'visible',
    timeout: 10000,
  })
  await page.locator('.understanding-map').getByText('Needs attention', { exact: true }).waitFor({
    state: 'visible',
    timeout: 10000,
  })
  await page.waitForTimeout(350)
  await page.screenshot({ path: screenshotPath })

  const stats = await page.evaluate(() => ({
    title: document.querySelector('.understanding-map h2')?.textContent?.trim(),
    summary: Array.from(document.querySelectorAll('.map-summary-item')).map((node) =>
      node.textContent?.trim(),
    ),
    attention: Array.from(document.querySelectorAll('.map-attention-title')).map((node) =>
      node.textContent?.trim(),
    ),
    ribbons: document.querySelectorAll('.map-ribbon').length,
  }))

  await page.locator('.understanding-map .modal-close').click()
  await page.getByRole('button', { name: 'Export HTML' }).click()
  await page.locator('.export-workspace').waitFor({ state: 'visible', timeout: 10000 })
  await page.waitForTimeout(450)
  await page.screenshot({ path: exportScreenshotPath })

  await browser.close()
  console.log(JSON.stringify({
    screenshotPath,
    readerScreenshotPath,
    annotateScreenshotPath,
    exportScreenshotPath,
    markdownPath,
    annotations,
    stats,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
