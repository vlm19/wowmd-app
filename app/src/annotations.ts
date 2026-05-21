export type AnnotationColor = 'yellow' | 'blue' | 'green' | 'rose'

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

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (
        parent.closest(
          'pre, code, script, style, mark, button, textarea, input',
        )
      ) {
        return NodeFilter.FILTER_REJECT
      }
      return node.textContent?.includes(quote)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP
    },
  })

  const textNode = walker.nextNode()
  if (!textNode?.textContent) return false

  const index = textNode.textContent.indexOf(quote)
  if (index < 0) return false

  const range = docRange(textNode, index, quote.length)
  const mark = document.createElement('mark')
  mark.className = `wowmd-highlight wowmd-highlight-${annotation.color}`
  mark.dataset.annotationId = annotation.id
  mark.title = annotation.note || quote
  range.surroundContents(mark)
  return true
}

function docRange(textNode: Node, start: number, length: number) {
  const range = document.createRange()
  range.setStart(textNode, start)
  range.setEnd(textNode, start + length)
  return range
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
