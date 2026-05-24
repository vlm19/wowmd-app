export type AnnotationColor = 'yellow' | 'blue' | 'green' | 'rose' | 'violet' | 'amber'

export type Annotation = {
  id: string
  documentFingerprint: string
  quote: string
  prefix: string
  suffix: string
  headingPath: string[]
  offset: number
  note: string
  color: AnnotationColor
  createdAt: string
  updatedAt: string
}

const storagePrefix = 'wowmd.annotations.v1.'
const dbName = 'wowmd-pro'
const storeName = 'annotations'

export function loadAnnotations(documentFingerprint: string): Annotation[] {
  const raw = localStorage.getItem(storageKey(documentFingerprint))
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAnnotations(
  documentFingerprint: string,
  annotations: Annotation[],
) {
  localStorage.setItem(storageKey(documentFingerprint), JSON.stringify(annotations))
}

export async function loadAnnotationsFromDb(documentFingerprint: string) {
  try {
    const db = await openAnnotationsDb()
    return await new Promise<Annotation[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly')
      const request = tx.objectStore(storeName).get(documentFingerprint)
      request.onsuccess = () => {
        resolve(Array.isArray(request.result?.items) ? request.result.items : [])
      }
      request.onerror = () => reject(request.error)
    })
  } catch {
    return loadAnnotations(documentFingerprint)
  }
}

export async function saveAnnotationsToDb(
  documentFingerprint: string,
  annotations: Annotation[],
) {
  saveAnnotations(documentFingerprint, annotations)

  try {
    const db = await openAnnotationsDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite')
      tx.objectStore(storeName).put({
        documentFingerprint,
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
  documentFingerprint: string
  quote: string
  prefix?: string
  suffix?: string
  headingPath?: string[]
  offset?: number
  note: string
  color: AnnotationColor
}): Annotation {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    documentFingerprint: input.documentFingerprint,
    quote: input.quote,
    prefix: input.prefix || '',
    suffix: input.suffix || '',
    headingPath: input.headingPath || [],
    offset: input.offset ?? -1,
    note: input.note,
    color: input.color,
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
  mark.title = annotation.note || quote
  mark.textContent = text
  return mark
}

function storageKey(documentFingerprint: string) {
  return `${storagePrefix}${documentFingerprint}`
}

function openAnnotationsDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'documentFingerprint' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
