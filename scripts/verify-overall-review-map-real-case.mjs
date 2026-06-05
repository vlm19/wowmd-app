import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const tmpDir = path.join(root, 'tmp', 'overall-review-map')
const appUrl = process.env.APP_URL || 'http://127.0.0.1:4174/app/'
const screenshotPath = path.join(tmpDir, 'overall-review-map-real-case.png')
const markdownPath = path.join(tmpDir, 'real-architecture-review.md')

const markdown = `# AI Architecture Review

This document is a realistic review target for wowMD Pro. It mixes product claims, privacy boundaries, storage behavior, and export semantics.

## Overview

wowMD Pro reads Markdown in the browser and keeps the source file untouched. The product should help reviewers mark important passages, challenge uncertain claims, and export useful review artifacts.

The intended outcome is not automatic rewriting. The app should preserve user judgment and make next actions visible.

## Architecture

The application renders local Markdown into a structured reader with outline navigation, typed annotations, and export tools. The extension can hand off supported GitHub Markdown into the Pro web app.

The import handoff should avoid putting license keys, email addresses, tokens, full Markdown bodies, or private notes into URLs. Only source metadata should travel through the handoff path.

## Storage model

Saved annotations persist in browser site storage. Imported GitHub documents may also be saved as browser-local document copies, so they can be reopened from a local reader URL.

Browser local storage is not the same as browser cache. Clearing site data can remove saved annotations and imported document copies. Unsaved toolbar drafts are even more fragile and can be lost after refresh or crash.

This section needs careful wording because users may assume local-first means impossible to lose. The product should say what is saved, what is unsaved, and what backup/export action protects long-term work.

## Export workflow

wowMD Pro can export HTML for people, reviewed Markdown for Obsidian, Backup JSON for re-import, and Ticket JSON for AI or editor handoff.

Reviewed Markdown creates a new Markdown copy with review callouts. It does not modify the original source file and does not automatically apply suggested replacements.

## Security notes

Local-first processing means Markdown rendering and annotation work happen in the browser unless the user chooses to export or share files elsewhere.

The website copy should avoid broad claims that sound like security certification. It should explain practical boundaries in plain language.

## FAQ

Users should understand the difference between saved annotations, imported local document copies, exported files, and unsaved draft notes.

If a browser profile is removed or site data is cleared, the app cannot recover data that was never exported or backed up.
`

const annotations = [
  { text: 'keeps the source file untouched', type: 'confirmed' },
  { text: 'avoid putting license keys, email addresses, tokens, full Markdown bodies, or private notes into URLs', type: 'important' },
  { text: 'Browser local storage is not the same as browser cache.', type: 'clarify' },
  { text: 'Unsaved toolbar drafts are even more fragile', type: 'dispute' },
  { text: 'local-first means impossible to lose', type: 'dispute' },
  { text: 'does not automatically apply suggested replacements', type: 'confirmed' },
  { text: 'avoid broad claims that sound like security certification', type: 'clarify' },
]

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

async function markAnnotation(page, item) {
  await selectText(page, item.text)
  const button = page.locator(`.type-chip.chip-${item.type}`)
  await button.waitFor({ state: 'visible', timeout: 10000 })
  await button.click()
  await page.locator('.toolbar-confirm').click()
  await page.locator('.floating-markup').waitFor({ state: 'hidden', timeout: 10000 })
}

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

  const fileInput = page.locator('input[type="file"]').first()
  await fileInput.setInputFiles(markdownPath)
  await page.getByRole('heading', { name: 'AI Architecture Review' }).waitFor({ state: 'visible', timeout: 10000 })

  for (const item of annotations) {
    await markAnnotation(page, item)
    await page.waitForTimeout(120)
  }

  await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }))
  await page.locator('.map-action').click()
  await page.getByRole('heading', { name: 'Overall Review Map' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.understanding-map .map-attention-title', { hasText: 'Storage model' }).waitFor({ state: 'visible', timeout: 10000 })
  await page.locator('.understanding-map').getByText('Needs attention', { exact: true }).waitFor({ state: 'visible', timeout: 10000 })
  await page.screenshot({ path: screenshotPath, fullPage: false })

  const stats = await page.evaluate(() => {
    const getText = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => node.textContent?.trim()).filter(Boolean)
    return {
      title: document.querySelector('.understanding-map h2')?.textContent?.trim(),
      summary: getText('.map-summary-item'),
      attention: getText('.map-attention-title'),
      ribbons: document.querySelectorAll('.map-ribbon').length,
    }
  })

  await browser.close()
  console.log(JSON.stringify({ screenshotPath, markdownPath, stats }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
