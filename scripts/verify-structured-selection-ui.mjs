import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(root, 'scripts', 'fixtures', 'selection', 'cross-structure-selection.md')
const output = path.join(root, 'output', 'playwright', 'structured-selection')
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/'

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await context.addInitScript(() => {
  localStorage.clear()
  localStorage.setItem('wowmd.locale', 'zh')
  localStorage.setItem('wowmd.betaNotice.dismissed.v1', '1')
})
const page = await context.newPage()
await page.goto(appUrl)
await page.locator('input[type=file]').setInputFiles(fixture)
await page.getByRole('heading', { name: 'Structured selection regression' }).waitFor()

await selectAcross(page, 'START_INLINE', 'END_INLINE')
await assertSelectionPreview(page, 'mixed inline selection', 4)
await page.screenshot({ path: path.join(output, 'cross-inline-selection.png'), fullPage: true })

await page.keyboard.press('Escape')
await page.evaluate(() => window.getSelection()?.removeAllRanges())
await page.locator('.markdown-body img[alt="non-text separator"]').waitFor({ state: 'attached' })
await selectAcross(page, 'START_IMAGE', 'END_IMAGE')
await assertSelectionPreview(page, 'selection crossing an image', 2)
await page.screenshot({ path: path.join(output, 'cross-image-selection.png'), fullPage: true })

console.log(`PASS structured selection UI verification: ${output}`)
await browser.close()

async function selectAcross(page, startNeedle, endNeedle) {
  await page.evaluate(({ startNeedle, endNeedle }) => {
    const root = document.querySelector('.markdown-body')
    if (!root) throw new Error('Missing markdown body')
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let startNode
    let endNode
    let startOffset = -1
    let endOffset = -1
    while (walker.nextNode()) {
      const node = walker.currentNode
      const value = node.textContent || ''
      if (!startNode && value.includes(startNeedle)) {
        startNode = node
        startOffset = value.indexOf(startNeedle)
      }
      if (value.includes(endNeedle)) {
        endNode = node
        endOffset = value.indexOf(endNeedle) + endNeedle.length
      }
    }
    if (!startNode || !endNode) throw new Error('Selection boundary text not found')
    const range = document.createRange()
    range.setStart(startNode, startOffset)
    range.setEnd(endNode, endOffset)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    startNode.parentElement?.scrollIntoView({ block: 'center' })
    root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  }, { startNeedle, endNeedle })
  await page.locator('.floating-markup').waitFor({ state: 'visible' })
}

async function assertSelectionPreview(page, label, minimumMarks) {
  const result = await page.evaluate(() => {
    const marks = [...document.querySelectorAll('[data-preview-highlight=true]')]
    return {
      previewMarks: marks.length,
      visiblePreviewMarks: marks.filter((mark) => {
        const rect = mark.getBoundingClientRect()
        const background = getComputedStyle(mark).backgroundColor
        return rect.width > 0 && rect.height > 0 && background !== 'rgba(0, 0, 0, 0)'
      }).length,
    }
  })
  if (result.previewMarks < minimumMarks || result.visiblePreviewMarks !== result.previewMarks) {
    throw new Error(`${label}: selected preview is not visibly rendered`)
  }
}
