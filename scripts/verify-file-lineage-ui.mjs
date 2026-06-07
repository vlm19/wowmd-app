import { chromium } from 'playwright'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const fixture = path.join(root, 'scripts', 'fixtures', 'file-lineage', 'externally-edited.md')
const similarFixture = path.join(root, 'scripts', 'fixtures', 'file-lineage', 'renamed-similar-without-meta.md')
const aiFixture = path.join(root, 'scripts', 'fixtures', 'file-lineage', 'ai-revised-from-ticket.md')
const output = path.join(root, 'output', 'playwright', 'file-lineage')
const appUrl = process.env.APP_URL || 'http://127.0.0.1:5173/'

await mkdir(output, { recursive: true })
const sourceBeforeOpen = await readFile(fixture, 'utf8')

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })
await context.addInitScript(() => localStorage.setItem('wowmd.locale', 'en'))
const page = await context.newPage()
await page.goto(appUrl)

await page.evaluate(async () => {
  const rootSource = {
    id: 'doc_source_001',
    sourceType: 'local',
    sourceUrl: '',
    rawUrl: '',
    title: 'source-no-meta.md',
    markdownSnapshot: `# Local-first Review Plan

## Storage boundary

Saved annotations live in browser site data. Unsaved toolbar drafts are temporary.

## Delivery

Export HTML for people and Ticket JSON for an AI or editor.
`,
    fingerprint: 'fixture-root',
    lineageId: 'lineage_real_case_001',
    bodyHash: 'sha256:fixture-root',
    createdAt: '2026-06-07T10:00:00.000Z',
    updatedAt: '2026-06-07T10:00:00.000Z',
    lastOpenedAt: '2026-06-07T10:00:00.000Z',
  }
  const source = {
    id: 'doc_reviewed_copy_002',
    sourceType: 'local',
    sourceUrl: '',
    rawUrl: '',
    title: 'source-no-meta-reviewed.md',
    markdownSnapshot: `# Local-first Review Plan

## Storage boundary

Saved annotations live in browser site data. Unsaved toolbar drafts are temporary.

## Delivery

Export HTML for people and Ticket JSON for an AI or editor.
`,
    fingerprint: 'fixture-parent',
    parentDocumentId: 'doc_source_001',
    lineageId: 'lineage_real_case_001',
    bodyHash: 'sha256:recorded-reviewed-copy-hash',
    createdAt: '2026-06-07T10:10:00.000Z',
    updatedAt: '2026-06-07T10:10:00.000Z',
    lastOpenedAt: '2026-06-07T10:10:00.000Z',
  }
  const annotations = [
    {
      id: 'exact-1',
      documentId: source.id,
      documentFingerprint: source.fingerprint,
      quote: 'Unsaved toolbar drafts are temporary.',
      prefix: 'browser site data. ',
      suffix: '',
      headingPath: ['Local-first Review Plan', 'Storage boundary'],
      offset: 86,
      type: 'confirmed',
      note: 'This boundary remains accurate.',
      suggestedReplacement: '',
      color: 'green',
      legacyColor: null,
      orphaned: false,
      needsReview: false,
      createdAt: '2026-06-07T10:05:00.000Z',
      updatedAt: '2026-06-07T10:05:00.000Z',
    },
    {
      id: 'context-1',
      documentId: source.id,
      documentFingerprint: source.fingerprint,
      quote: 'Export HTML for people and Ticket JSON for an AI or editor.',
      prefix: 'Delivery',
      suffix: '',
      headingPath: ['Local-first Review Plan', 'Delivery'],
      offset: 136,
      type: 'important',
      note: 'Keep all delivery paths visible.',
      suggestedReplacement: '',
      color: 'amber',
      legacyColor: null,
      orphaned: false,
      needsReview: false,
      createdAt: '2026-06-07T10:06:00.000Z',
      updatedAt: '2026-06-07T10:06:00.000Z',
    },
    {
      id: 'lost-1',
      documentId: source.id,
      documentFingerprint: source.fingerprint,
      quote: 'A sentence removed from the next revision.',
      prefix: 'No surviving prefix',
      suffix: 'No surviving suffix',
      headingPath: ['Local-first Review Plan', 'Delivery'],
      offset: 190,
      type: 'clarify',
      note: 'This should stay available for manual recovery.',
      suggestedReplacement: '',
      color: 'blue',
      legacyColor: null,
      orphaned: false,
      needsReview: false,
      createdAt: '2026-06-07T10:07:00.000Z',
      updatedAt: '2026-06-07T10:07:00.000Z',
    },
  ]

  await new Promise((resolve, reject) => {
    const req = indexedDB.open('wowmd_local', 1)
    req.onupgradeneeded = () => req.result.createObjectStore('documents', { keyPath: 'id' })
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('documents', 'readwrite')
      tx.objectStore('documents').put(rootSource)
      tx.objectStore('documents').put(source)
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  })

  await new Promise((resolve, reject) => {
    const req = indexedDB.open('wowmd-pro', 2)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains('annotations')) {
        req.result.createObjectStore('annotations', { keyPath: 'documentFingerprint' })
      }
      if (!req.result.objectStoreNames.contains('annotations_v2')) {
        req.result.createObjectStore('annotations_v2', { keyPath: 'documentId' })
      }
    }
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('annotations_v2', 'readwrite')
      tx.objectStore('annotations_v2').put({ documentId: source.id, items: annotations, updatedAt: new Date().toISOString() })
      tx.oncomplete = () => { db.close(); resolve() }
      tx.onerror = () => reject(tx.error)
    }
  })
})

await page.locator('input[type=file]').setInputFiles(fixture)
await page.getByRole('dialog', { name: 'Possible document relationship' }).waitFor()

const title = await page.getByRole('heading', { name: 'This version was edited outside wowMD' }).textContent()
if (!title) throw new Error('External edit relationship title was not shown')
await page.screenshot({ path: path.join(output, 'file-association-desktop.png'), fullPage: true })
await page.getByRole('button', { name: /View differences/ }).click()
await page.getByLabel('Line difference preview').waitFor()
await page.screenshot({ path: path.join(output, 'file-association-differences-desktop.png'), fullPage: true })
await page.getByRole('button', { name: /Hide differences/ }).click()

await page.setViewportSize({ width: 390, height: 844 })
await page.screenshot({ path: path.join(output, 'file-association-mobile.png'), fullPage: true })

await page.getByRole('button', { name: 'Associate and review' }).click()
await page.getByText('Local-first Review Plan', { exact: true }).first().waitFor()
const externalEditSuccessor = await page.evaluate(async () => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wowmd_local', 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('documents', 'readonly')
      const all = tx.objectStore('documents').getAll()
      all.onsuccess = () => {
        const doc = all.result.find((item) => item.title === 'externally-edited.md')
        resolve(doc || null)
        db.close()
      }
      all.onerror = () => reject(all.error)
    }
  })
})
if (
  !externalEditSuccessor ||
  externalEditSuccessor.id === 'doc_reviewed_copy_002' ||
  externalEditSuccessor.parentDocumentId !== 'doc_reviewed_copy_002'
) {
  throw new Error(`External edit was not registered as a new child version: ${JSON.stringify(externalEditSuccessor)}`)
}
await page.screenshot({ path: path.join(output, 'associated-reader-mobile.png'), fullPage: true })

await page.setViewportSize({ width: 1440, height: 1000 })
await page.evaluate(() => {
  Reflect.deleteProperty(window, 'showSaveFilePicker')
})
await page.locator('details.file-menu summary').click()
await page.locator('details.file-menu .file-menu-list button').nth(1).click()
await page.getByRole('dialog', { name: 'Save Obsidian reviewed copy' }).waitFor()
const downloadPromise = page.waitForEvent('download')
await page.getByRole('button', { name: 'Save reviewed .md' }).click()
const reviewedDownload = await downloadPromise
const reviewedPath = await reviewedDownload.path()
const reviewedText = await readFile(reviewedPath, 'utf8')
if ((reviewedText.match(/wowmd:document-meta:v1/g) || []).length !== 1) {
  throw new Error('Reviewed copy did not contain exactly one lineage metadata block')
}
if (!reviewedText.includes('"parentDocumentId"') || !reviewedText.includes('"bodyHash"')) {
  throw new Error('Reviewed copy lineage metadata is incomplete')
}

await page.locator('input[type=file]').setInputFiles(similarFixture)
await page.getByRole('dialog', { name: 'Possible document relationship' }).waitFor()
await page.getByText('Its headings and content closely resemble a known version.').waitFor()
await page.getByRole('button', { name: 'Open as new' }).click()
await page.getByText('Local-first Review Plan v3', { exact: true }).first().waitFor()
const openedAsNew = await page.evaluate(async () => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wowmd_local', 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('documents', 'readonly')
      const all = tx.objectStore('documents').getAll()
      all.onsuccess = () => {
        const doc = all.result.find((item) => item.title === 'renamed-similar-without-meta.md')
        resolve(Boolean(doc && !doc.parentDocumentId && doc.lineageId !== 'lineage_real_case_001'))
        db.close()
      }
      all.onerror = () => reject(all.error)
    }
  })
})
if (!openedAsNew) throw new Error('Open as new persisted an unintended relationship')

await page.locator('details.file-menu summary').click()
await page.getByRole('button', { name: 'Review suggested relationship' }).click()
await page.getByRole('dialog', { name: 'Possible document relationship' }).waitFor()
await page.getByRole('button', { name: 'Associate and review' }).click()
await page.getByRole('dialog', { name: 'Possible document relationship' }).waitFor({ state: 'hidden' })
const recoveredDocument = await page.evaluate(async () => {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('wowmd_local', 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => {
      const db = req.result
      const tx = db.transaction('documents', 'readonly')
      const all = tx.objectStore('documents').getAll()
      all.onsuccess = () => {
        const doc = all.result.find((item) => item.title === 'renamed-similar-without-meta.md')
        resolve(doc || null)
        db.close()
      }
      all.onerror = () => reject(all.error)
    }
  })
})
if (!recoveredDocument?.parentDocumentId || recoveredDocument.lineageId !== 'lineage_real_case_001' || recoveredDocument.suggestedParentDocumentId) {
  throw new Error(`Deferred relationship could not be recovered and confirmed: ${JSON.stringify(recoveredDocument)}`)
}

await page.locator('input[type=file]').setInputFiles(aiFixture)
await page.getByRole('dialog', { name: 'Possible document relationship' }).waitFor()
await page.getByText('The file names a known parent version.').waitFor()
await page.screenshot({ path: path.join(output, 'ai-ticket-relationship-desktop.png'), fullPage: true })

const sourceAfterOpen = await readFile(fixture, 'utf8')
if (sourceAfterOpen !== sourceBeforeOpen) throw new Error('Opening and associating modified the source Markdown file')

console.log(`PASS file-lineage UI verification: ${output}`)
await browser.close()
