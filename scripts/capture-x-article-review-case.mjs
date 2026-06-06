import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const outputDir = path.join(root, 'tmp', 'x-article-review-case')
const markdownPath = path.join(
  root,
  'docs',
  'how-to-build-an-obsidian-second-brain-that-connects-every-idea-automatically.md',
)
const reviewMarkdownPath = path.join(outputDir, 'x-article-review.md')
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/app/'

const shots = {
  reviewedArticle: path.join(outputDir, '01-reviewed-article.png'),
  constructiveNote: path.join(outputDir, '02-constructive-note.png'),
  reviewMap: path.join(outputDir, '03-review-map.png'),
}

const annotations = [
  {
    text: 'The connection is where the value lives.',
    type: 'important',
    note: 'This is the strongest organizing idea in the guide. It explains why the system optimizes for relationships rather than storage volume.',
  },
  {
    text: 'solves all three problems',
    type: 'clarify',
    note: 'The system reduces these problems, but it does not fully solve them automatically. Capture prompts, two-link filing, backlink review, and map maintenance still depend on consistent human effort.',
  },
  {
    text: 'a system that thinks',
    type: 'dispute',
    note: 'The folder creates a useful synthesis layer, but “a system that thinks” overstates what is happening. The outputs still require human evaluation and may contain plausible but weak connections.',
    replacement: 'The INTELLIGENCE folder turns connected notes into a system that regularly surfaces relationships, tensions, and questions for you to evaluate.',
  },
  {
    text: 'Not one. Two.',
    type: 'dispute',
    note: 'A strict two-link quota may encourage weak or decorative links. Consider allowing an intentionally isolated note when no meaningful second connection exists yet.',
    replacement: 'Before filing a permanent note, add two meaningful links when they exist, or record why the note should remain intentionally isolated for now.',
  },
  {
    text: 'add the link to both notes',
    type: 'clarify',
    note: 'This is a consequential write operation across the vault. A preview-and-confirm step would reduce accidental link pollution and make the automation easier to trust.',
  },
  {
    text: 'highly connected nodes',
    type: 'clarify',
    note: 'Graph density is a useful signal, but it can also reward over-linking. The guide could add a periodic weak-link cleanup or accepted/rejected connection review.',
  },
  {
    text: 'a standing research agenda',
    type: 'confirmed',
    note: 'Strong practical pattern: open questions turn a map from a static index into an active research surface.',
  },
]

async function selectPhrase(page, phrase) {
  const box = await page.evaluate((needle) => {
    const root = document.querySelector('.markdown-body')
    if (!root) throw new Error('Missing markdown body')
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

    while (walker.nextNode()) {
      const node = walker.currentNode
      const value = node.textContent || ''
      const index = value.indexOf(needle)
      if (index < 0) continue

      node.parentElement?.scrollIntoView({ block: 'center', inline: 'nearest' })
      const range = document.createRange()
      range.setStart(node, index)
      range.setEnd(node, index + needle.length)
      const rect = range.getBoundingClientRect()
      return {
        x1: rect.left + 2,
        y1: rect.top + rect.height / 2,
        x2: rect.right - 2,
        y2: rect.top + rect.height / 2,
      }
    }

    throw new Error(`Phrase not found: ${needle}`)
  }, phrase)

  await page.mouse.move(box.x1, box.y1)
  await page.mouse.down()
  await page.mouse.move(box.x2, box.y2, { steps: 12 })
  await page.mouse.up()
  await page.locator('.floating-markup').waitFor({ state: 'visible', timeout: 5000 })
}

async function annotate(page, item) {
  console.log(`Annotating [${item.type}]: ${item.text}`)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await selectPhrase(page, item.text)
    const chip = page.locator(`.type-chip.chip-${item.type}`)
    if (await chip.isVisible().catch(() => false)) break
    await page.waitForTimeout(150)
  }

  await page.locator(`.type-chip.chip-${item.type}`).click({ timeout: 5000 })
  await page.locator('.toolbar-note-input').fill(item.note)

  if (item.replacement) {
    await page.locator('.toolbar-replacement-toggle').click()
    await page.locator('.toolbar-replacement-input').fill(item.replacement)
  }

  await page.locator('.toolbar-confirm').click()
  await page.locator('.floating-markup').waitFor({ state: 'hidden', timeout: 10000 })
  await page.waitForTimeout(120)
}

async function main() {
  await mkdir(outputDir, { recursive: true })
  const sourceMarkdown = await readFile(markdownPath, 'utf8')
  const reviewMarkdown = sourceMarkdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n+/, '')
  await writeFile(reviewMarkdownPath, reviewMarkdown, 'utf8')

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  await page.addInitScript(() => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('wowmd.locale', 'en')
    localStorage.setItem('wowmd.betaNotice.dismissed.v1', '1')
  })

  await page.goto(appUrl, { waitUntil: 'networkidle' })
  await page.locator('input[type="file"]').first().setInputFiles(reviewMarkdownPath)
  await page.getByRole('heading', {
    name: 'How to Build an Obsidian Second Brain That Connects Every Idea Automatically',
    exact: true,
  }).waitFor({ state: 'visible', timeout: 10000 })

  for (const annotation of annotations) {
    await annotate(page, annotation)
  }

  await page.getByRole('link', { name: 'Why Most Obsidian Setups Fail to Produce Connections' }).click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: shots.reviewedArticle })

  const replacementSticker = page.locator('.note-sticker.has-replacement').first()
  await replacementSticker.locator('.note-sticker-body').click()
  await page.locator('.annotation-detail').waitFor({ state: 'visible', timeout: 5000 })
  await page.waitForTimeout(250)
  await page.screenshot({ path: shots.constructiveNote })
  await page.locator('.annotation-detail .modal-close').click()

  await page.locator('.map-action').click()
  await page.getByRole('heading', { name: 'Overall Review Map' }).waitFor({
    state: 'visible',
    timeout: 10000,
  })
  await page.waitForTimeout(350)
  await page.screenshot({ path: shots.reviewMap })

  const result = await page.evaluate(() => ({
    annotations: document.querySelectorAll('.note-sticker').length,
    highlights: document.querySelectorAll('.wowmd-highlight').length,
    outlineSections: document.querySelectorAll('.outline li').length,
    mapSummary: Array.from(document.querySelectorAll('.map-summary-item')).map((node) =>
      node.textContent?.trim(),
    ),
  }))

  await browser.close()
  console.log(JSON.stringify({ outputDir, markdownPath, reviewMarkdownPath, shots, result }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
