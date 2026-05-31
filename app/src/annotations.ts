import { randomId } from './compat'

export type AnnotationColor = 'yellow' | 'blue' | 'green' | 'rose' | 'violet' | 'amber'

export type AnnotationType = 'clarify' | 'dispute' | 'important' | 'confirmed'

export type Annotation = {
  id: string
  documentId: string
  documentFingerprint: string
  quote: string
  prefix: string
  suffix: string
  headingPath: string[]
  offset: number
  type: AnnotationType | null
  note: string
  suggestedReplacement: string
  color: AnnotationColor
  legacyColor: AnnotationColor | null
  orphaned: boolean
  createdAt: string
  updatedAt: string
}

const storagePrefixV1 = 'wowmd.annotations.v1.'
const storagePrefixV2 = 'wowmd.annotations.v2.'
const dbName = 'wowmd-pro'
const storeNameV1 = 'annotations'
const storeNameV2 = 'annotations_v2'

function storageKeyV1(documentFingerprint: string) {
  return `${storagePrefixV1}${documentFingerprint}`
}

function storageKeyV2(documentFingerprint: string) {
  return `${storagePrefixV2}${documentFingerprint}`
}

export function migrateAnnotation(raw: Record<string, unknown>): Annotation {
  const color = (
    typeof raw.color === 'string' &&
    ['yellow', 'blue', 'green', 'rose', 'violet', 'amber'].includes(raw.color)
  ) ? raw.color as AnnotationColor : 'yellow'

  return {
    id: typeof raw.id === 'string' ? raw.id : randomId(),
    documentId: typeof raw.documentId === 'string' ? raw.documentId : '',
    documentFingerprint: typeof raw.documentFingerprint === 'string' ? raw.documentFingerprint : '',
    quote: typeof raw.quote === 'string' ? raw.quote : '',
    prefix: typeof raw.prefix === 'string' ? raw.prefix : '',
    suffix: typeof raw.suffix === 'string' ? raw.suffix : '',
    headingPath: Array.isArray(raw.headingPath) ? raw.headingPath as string[] : [],
    offset: typeof raw.offset === 'number' ? raw.offset : -1,
    type: null,
    note: typeof raw.note === 'string' ? raw.note : '',
    suggestedReplacement: '',
    color,
    legacyColor: color,
    orphaned: false,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
  }
}

export function isValidAnnotation(a: Annotation): boolean {
  return a.type != null || a.note !== '' || a.legacyColor != null
}

export function migrateAnnotationArray(items: unknown[]): Annotation[] {
  return items
    .map((item) => migrateAnnotation(item as Record<string, unknown>))
    .filter(isValidAnnotation)
}

export function loadAnnotations(documentId: string, documentFingerprint: string): Annotation[] {
  const rawV2 = localStorage.getItem(storageKeyV2(documentId))
  if (rawV2) {
    try {
      const parsed = JSON.parse(rawV2)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const rawV1 = localStorage.getItem(storageKeyV1(documentFingerprint))
  if (!rawV1) return []

  try {
    const parsed = JSON.parse(rawV1)
    const migrated = migrateAnnotationArray(Array.isArray(parsed) ? parsed : [])
    if (migrated.length) {
      localStorage.setItem(storageKeyV2(documentId), JSON.stringify(migrated))
    }
    return migrated
  } catch {
    return []
  }
}

export function saveAnnotations(
  documentId: string,
  annotations: Annotation[],
) {
  localStorage.setItem(storageKeyV2(documentId), JSON.stringify(annotations))
}

export async function loadAnnotationsFromDb(documentId: string, documentFingerprint: string) {
  try {
    const db = await openAnnotationsDb()

    const fromV2 = await new Promise<Annotation[] | null>((resolve, reject) => {
      const tx = db.transaction(storeNameV2, 'readonly')
      const request = tx.objectStore(storeNameV2).get(documentId)
      request.onsuccess = () => {
        resolve(Array.isArray(request.result?.items) ? request.result.items : null)
      }
      request.onerror = () => reject(request.error)
    })

    if (fromV2) return fromV2

    const fromV1 = await new Promise<Annotation[]>((resolve, reject) => {
      const tx = db.transaction(storeNameV1, 'readonly')
      const request = tx.objectStore(storeNameV1).get(documentFingerprint)
      request.onsuccess = () => {
        resolve(Array.isArray(request.result?.items) ? request.result.items : [])
      }
      request.onerror = () => reject(request.error)
    })

    if (fromV1.length === 0) {
      return loadAnnotations(documentId, documentFingerprint)
    }

    const migrated = migrateAnnotationArray(fromV1)
    try {
      const txV2 = db.transaction(storeNameV2, 'readwrite')
      txV2.objectStore(storeNameV2).put({
        documentId,
        items: migrated,
        updatedAt: new Date().toISOString(),
      })
      await new Promise<void>((resolve) => { txV2.oncomplete = () => resolve() })
      saveAnnotations(documentId, migrated)
    } catch { /* v2 write failed, return migrated from memory */ }

    return migrated
  } catch {
    return loadAnnotations(documentId, documentFingerprint)
  }
}

export async function saveAnnotationsToDb(
  documentId: string,
  annotations: Annotation[],
) {
  saveAnnotations(documentId, annotations)

  try {
    const db = await openAnnotationsDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeNameV2, 'readwrite')
      tx.objectStore(storeNameV2).put({
        documentId,
        items: annotations,
        updatedAt: new Date().toISOString(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // localStorage has already been written as a fallback.
  }
}

export function createAnnotation(input: {
  documentId?: string
  documentFingerprint: string
  quote: string
  prefix?: string
  suffix?: string
  headingPath?: string[]
  offset?: number
  type?: AnnotationType | null
  note?: string
  suggestedReplacement?: string
  color?: AnnotationColor
}): Annotation {
  const now = new Date().toISOString()
  const annotationType = input.type ?? null
  const annotationColor = input.color ?? 'yellow'
  const annotationLegacyColor = input.color ?? null

  return {
    id: randomId(),
    documentId: input.documentId || input.documentFingerprint,
    documentFingerprint: input.documentFingerprint,
    quote: input.quote,
    prefix: input.prefix || '',
    suffix: input.suffix || '',
    headingPath: input.headingPath || [],
    offset: input.offset ?? -1,
    type: annotationType,
    note: input.note || '',
    suggestedReplacement: input.suggestedReplacement || '',
    color: annotationColor,
    legacyColor: annotationLegacyColor,
    orphaned: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function applyAnnotationHighlights(
  html: string,
  annotations: Annotation[],
) {
  if (!annotations.length) return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  annotations
    .slice()
    .reverse()
    .forEach((annotation) => {
      wrapFirstQuoteMatch(doc.body, annotation)
    })

  return doc.body.innerHTML
}

function wrapFirstQuoteMatch(root: HTMLElement, annotation: Annotation) {
  const quote = annotation.quote.trim()
  if (!quote) return false

  const textNodes = collectAnnotatableTextNodes(root)
  const fullText = textNodes.map((item) => item.node.textContent || '').join('')
  const match = findQuoteMatch(fullText, quote, annotation.offset)
  if (!match) return false

  return wrapTextMatch(textNodes, match.start, match.end, annotation, quote)
}

function collectAnnotatableTextNodes(root: HTMLElement) {
  const textNodes: Array<{ node: Text; start: number; end: number }> = []
  let cursor = 0
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (
        parent.closest(
          'pre, script, style, mark, button, textarea, input',
        )
      ) {
        return NodeFilter.FILTER_REJECT
      }
      return node.textContent ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
    },
  })

  let node = walker.nextNode() as Text | null
  while (node) {
    const length = node.textContent?.length || 0
    textNodes.push({ node, start: cursor, end: cursor + length })
    cursor += length
    node = walker.nextNode() as Text | null
  }

  return textNodes
}

function findQuoteMatch(fullText: string, quote: string, preferredOffset: number) {
  const exactMatches = findAllIndexes(fullText, quote)
  if (exactMatches.length) {
    const start = pickClosestIndex(exactMatches, preferredOffset)
    return { start, end: start + quote.length }
  }

  return (
    findNormalizedQuoteMatch(fullText, quote, preferredOffset) ||
    findCompactQuoteMatch(fullText, quote, preferredOffset)
  )
}

function findAllIndexes(text: string, query: string) {
  const indexes: number[] = []
  let cursor = 0

  while (cursor <= text.length) {
    const index = text.indexOf(query, cursor)
    if (index < 0) break
    indexes.push(index)
    cursor = index + Math.max(1, query.length)
  }

  return indexes
}

function pickClosestIndex(indexes: number[], preferredOffset: number) {
  if (preferredOffset < 0) return indexes[0]
  return indexes.reduce((closest, index) =>
    Math.abs(index - preferredOffset) < Math.abs(closest - preferredOffset)
      ? index
      : closest,
  )
}

function findNormalizedQuoteMatch(fullText: string, quote: string, preferredOffset: number) {
  const textMap = normalizeWithMap(fullText)
  const quoteMap = normalizeWithMap(quote)
  if (!textMap.text || !quoteMap.text) return null

  const indexes = findAllIndexes(textMap.text, quoteMap.text)
  if (!indexes.length) return null

  const preferredNormalizedOffset =
    preferredOffset >= 0
      ? textMap.map.findIndex((offset) => offset >= preferredOffset)
      : -1
  const normalizedStart = pickClosestIndex(indexes, preferredNormalizedOffset)
  const normalizedEnd = normalizedStart + quoteMap.text.length - 1
  const start = textMap.map[normalizedStart]
  const end = (textMap.map[normalizedEnd] ?? start) + 1

  return start >= 0 && end > start ? { start, end } : null
}

function normalizeWithMap(value: string) {
  let text = ''
  const map: number[] = []
  let pendingSpace = false

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (/\s/.test(char)) {
      pendingSpace = text.length > 0
      continue
    }

    if (pendingSpace) {
      text += ' '
      map.push(index)
      pendingSpace = false
    }

    text += char
    map.push(index)
  }

  return { text, map }
}

function findCompactQuoteMatch(fullText: string, quote: string, preferredOffset: number) {
  const textMap = compactWithMap(fullText)
  const quoteMap = compactWithMap(quote)
  if (!textMap.text || !quoteMap.text) return null

  const indexes = findAllIndexes(textMap.text, quoteMap.text)
  if (!indexes.length) return null

  const preferredCompactOffset =
    preferredOffset >= 0
      ? textMap.map.findIndex((offset) => offset >= preferredOffset)
      : -1
  const compactStart = pickClosestIndex(indexes, preferredCompactOffset)
  const compactEnd = compactStart + quoteMap.text.length - 1
  const start = textMap.map[compactStart]
  const end = (textMap.map[compactEnd] ?? start) + 1

  return start >= 0 && end > start ? { start, end } : null
}

function compactWithMap(value: string) {
  let text = ''
  const map: number[] = []

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (/\s/.test(char)) continue
    text += char
    map.push(index)
  }

  return { text, map }
}

function wrapTextMatch(
  textNodes: Array<{ node: Text; start: number; end: number }>,
  start: number,
  end: number,
  annotation: Annotation,
  quote: string,
) {
  let didWrap = false

  textNodes.forEach(({ node, start: nodeStart, end: nodeEnd }) => {
    const wrapStart = Math.max(start, nodeStart)
    const wrapEnd = Math.min(end, nodeEnd)
    if (wrapStart >= wrapEnd) return

    const text = node.textContent || ''
    const localStart = wrapStart - nodeStart
    const localEnd = wrapEnd - nodeStart
    const before = text.slice(0, localStart)
    const selected = text.slice(localStart, localEnd)
    const after = text.slice(localEnd)
    if (!selected) return

    const fragment = document.createDocumentFragment()
    if (before) fragment.append(document.createTextNode(before))
    fragment.append(createHighlightMark(annotation, selected, quote))
    if (after) fragment.append(document.createTextNode(after))
    node.parentNode?.replaceChild(fragment, node)
    didWrap = true
  })

  return didWrap
}

function createHighlightMark(annotation: Annotation, text: string, quote: string) {
  const mark = document.createElement('mark')
  mark.className = `wowmd-highlight wowmd-highlight-${annotation.color}`
  mark.dataset.annotationId = annotation.id
  if (annotation.type) {
    mark.dataset.annotationType = annotation.type
  }
  mark.title = annotation.note || quote
  mark.textContent = text
  return mark
}

function openAnnotationsDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 2)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeNameV1)) {
        db.createObjectStore(storeNameV1, { keyPath: 'documentFingerprint' })
      }
      if (!db.objectStoreNames.contains(storeNameV2)) {
        db.createObjectStore(storeNameV2, { keyPath: 'documentId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function narrowToQuote(body: string, quote: string): string {
  const paras = body.split(/\n{2,}/)
  if (!quote) return paras.slice(0, 3).join('\n\n')
  const q = quote.trim()
  const i = paras.findIndex((p) => p.includes(q))
  if (i < 0) return paras.slice(0, 3).join('\n\n')
  return paras.slice(Math.max(0, i - 1), i + 2).join('\n\n')
}

export function extractSectionBody(markdown: string, headingPath: string[], quote?: string): string {
  if (!headingPath.length) return ''

  const lines = markdown.split('\n')
  const headingRegex = /^(#{1,6})\s+(.+)/

  // Build expected heading levels for each breadcrumb (starting at h1)
  const expectedLevels: Array<{ level: number; text: string }> = headingPath.map((text, i) => ({
    level: i + 1,
    text,
  }))

  let matchIndex = 0
  let startLine = -1
  let sectionLevel = 0

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(headingRegex)
    if (!match) continue

    const level = match[1].length
    const text = match[2].trim()

    if (matchIndex < expectedLevels.length && level === expectedLevels[matchIndex].level && text === expectedLevels[matchIndex].text) {
      matchIndex += 1
      if (matchIndex === expectedLevels.length) {
        startLine = i + 1
        sectionLevel = level
        continue
      }
    } else {
      matchIndex = 0
    }

    if (startLine >= 0 && level <= sectionLevel) {
      const body = lines.slice(startLine, i).join('\n').trim()
      return body.length > 3000
        ? narrowToQuote(body, quote ?? '')
        : body
    }
  }

  if (startLine >= 0) {
    const body = lines.slice(startLine).join('\n').trim()
    return body.length > 3000
      ? narrowToQuote(body, quote ?? '')
      : body
  }

  // Fallback: search by last heading text at any level
  const targetHeading = headingPath[headingPath.length - 1]
  let fallbackLine = -1
  let fallbackLevel = 0

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(headingRegex)
    if (!match) continue

    const level = match[1].length
    const text = match[2].trim()

    if (text === targetHeading) {
      fallbackLine = i + 1
      fallbackLevel = level
      continue
    }

    if (fallbackLine >= 0 && level <= fallbackLevel) {
      const body = lines.slice(fallbackLine, i).join('\n').trim()
      return body.length > 3000
        ? narrowToQuote(body, quote ?? '')
        : body
    }
  }

  if (fallbackLine >= 0) {
    const body = lines.slice(fallbackLine).join('\n').trim()
    return body.length > 3000
      ? narrowToQuote(body, quote ?? '')
      : body
  }

  return ''
}

export function createTicketExport(
  documentTitle: string,
  documentSource: string,
  documentFingerprint: string,
  markdown: string,
  annotations: Annotation[],
) {
  const typeLegend: Record<string, string> = {
    clarify: '解释、澄清此处，勿动实质。Explain or clarify this point without changing substance.',
    dispute: '复核此处，可能有误，实质可能需要修改。Review — this may be incorrect and may need correction.',
    important: '保留并强调此关键点。This is a key point worth retaining and emphasizing.',
    confirmed: '已审、正确，无需动作。Reviewed and confirmed — no action needed.',
  }

  const tickets = annotations.map((a) => {
    const sectionBody = extractSectionBody(markdown, a.headingPath, a.quote)

    return {
      type: a.type,
      quote: a.quote,
      prefix: a.prefix,
      suffix: a.suffix,
      headingPath: a.headingPath,
      sectionBody,
      note: a.note || undefined,
      suggestedReplacement: a.suggestedReplacement || undefined,
    }
  })

  return {
    document: {
      title: documentTitle,
      source: documentSource,
      fingerprint: documentFingerprint,
      markdownSnapshot: markdown,
    },
    typeLegend,
    tickets,
  }
}

export function quoteMatchesText(fullText: string, quote: string, preferredOffset = -1): boolean {
  const q = quote.trim()
  if (!q) return false
  return findQuoteMatch(fullText, q, preferredOffset) != null
}

export type ReanchorOutcome = { offset: number; matched: boolean }

/**
 * Automatic re-anchor of one annotation against new rendered text.
 * - Single exact occurrence → relocate offset there.
 * - Multiple occurrences → disambiguate by surrounding prefix/suffix context,
 *   tie-break by closeness to the previous offset (fixes wrong-occurrence highlight).
 * - No exact occurrence → fall back to whitespace-tolerant match for existence.
 * - Quote genuinely gone → matched=false (caller marks orphaned; manual recovery
 *   via findReanchorCandidates remains available).
 * Pure + DOM-free for testability.
 */
export function reanchorAnnotationOffset(
  renderedText: string,
  annotation: Pick<Annotation, 'quote' | 'prefix' | 'suffix' | 'offset'>,
): ReanchorOutcome {
  const quote = annotation.quote.trim()
  if (!quote) return { offset: annotation.offset, matched: false }

  const exact = findAllIndexes(renderedText, quote)
  if (exact.length === 1) return { offset: exact[0], matched: true }

  if (exact.length > 1) {
    let best = exact[0]
    let bestScore = -1
    for (const idx of exact) {
      const score = scoreContext(renderedText, idx, quote.length, annotation.prefix, annotation.suffix)
      const closer = Math.abs(idx - annotation.offset) < Math.abs(best - annotation.offset)
      if (score > bestScore || (score === bestScore && closer)) {
        best = idx
        bestScore = score
      }
    }
    return { offset: best, matched: true }
  }

  const fallback = findQuoteMatch(renderedText, quote, annotation.offset)
  return fallback ? { offset: fallback.start, matched: true } : { offset: annotation.offset, matched: false }
}

function scoreContext(
  text: string,
  start: number,
  quoteLength: number,
  prefix: string,
  suffix: string,
): number {
  const compact = (value: string) => value.replace(/\s+/g, '')
  let score = 0

  const p = compact(prefix).slice(-40)
  if (p) {
    const before = compact(text.slice(Math.max(0, start - 80), start)).slice(-40)
    if (before && (before.endsWith(p) || p.endsWith(before) || before.includes(p) || p.includes(before))) {
      score += 1
    }
  }

  const s = compact(suffix).slice(0, 40)
  if (s) {
    const after = compact(text.slice(start + quoteLength, start + quoteLength + 80)).slice(0, 40)
    if (after && (after.startsWith(s) || s.startsWith(after) || after.includes(s) || s.includes(after))) {
      score += 1
    }
  }

  return score
}

export type ReanchorCandidate = { start: number; end: number; snippet: string }

export function findReanchorCandidates(
  renderedText: string,
  annotation: Annotation,
  maxCandidates = 5,
): ReanchorCandidate[] {
  const out: ReanchorCandidate[] = []
  const quote = annotation.quote.trim()
  if (!quote) return out

  for (const start of findAllIndexes(renderedText, quote)) {
    out.push(makeReanchorCandidate(renderedText, start, start + quote.length))
    if (out.length >= maxCandidates) return out
  }

  const anchors = [annotation.prefix, annotation.suffix].map((s) => s.trim()).filter(Boolean)
  for (const anchor of anchors) {
    for (const idx of findAllIndexes(renderedText, anchor)) {
      const start = anchor === annotation.prefix ? idx + anchor.length : Math.max(0, idx - quote.length)
      out.push(makeReanchorCandidate(renderedText, start, start + quote.length))
      if (out.length >= maxCandidates) return out
    }
  }
  return out
}

function makeReanchorCandidate(text: string, start: number, end: number): ReanchorCandidate {
  const s = Math.max(0, start)
  const e = Math.min(text.length, end)
  const snippet = text.slice(Math.max(0, s - 30), Math.min(text.length, e + 30)).trim()
  return { start: s, end: e, snippet }
}
