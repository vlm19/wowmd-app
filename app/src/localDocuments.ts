import { randomId } from './compat'

export type LocalDocumentSource = {
  sourceType: 'github' | 'local'
  sourceUrl: string
  rawUrl: string
  owner?: string
  repo?: string
  branch?: string
  path?: string
}

export type LocalDocument = LocalDocumentSource & {
  id: string
  title: string
  markdownSnapshot: string
  fingerprint: string
  /** Version lineage: id of the document this one was saved-as-new-version from. */
  parentDocumentId?: string
  lineageId?: string
  sourceTicketId?: string
  bodyHash?: string
  suggestedParentDocumentId?: string
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
}

const dbName = 'wowmd_local'
const dbVersion = 1
const documentsStore = 'documents'

export function createDocId() {
  return `doc_${randomId()}`
}

export async function saveLocalDocument(
  input: Omit<LocalDocument, 'createdAt' | 'updatedAt' | 'lastOpenedAt'>,
) {
  const now = new Date().toISOString()
  const document: LocalDocument = {
    ...input,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  }

  const db = await openLocalDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readwrite')
    tx.objectStore(documentsStore).put(document)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  return document
}

export async function loadLocalDocument(id: string) {
  const db = await openLocalDb()
  const document = await new Promise<LocalDocument | null>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readonly')
    const request = tx.objectStore(documentsStore).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })

  if (document) {
    void touchLocalDocument(document.id)
  }

  return document
}

/**
 * Register an improved document as a NEW version (successor) of an existing one.
 * Never overwrites the parent. The successor carries `parentDocumentId` so the
 * version lineage is a first-class, persisted relationship (spec §2.5 / Stage E).
 * Source URLs are intentionally blanked so a successor never pollutes URL matching
 * (findLocalDocumentByUrl) — it is a local snapshot, reachable by its own id.
 */
export async function createDocumentVersion(input: {
  parentDocumentId: string
  title: string
  markdownSnapshot: string
  fingerprint: string
  sourceType?: 'github' | 'local'
  id?: string
  lineageId?: string
  sourceTicketId?: string
  bodyHash?: string
}): Promise<LocalDocument> {
  return saveLocalDocument({
    id: input.id ?? createDocId(),
    sourceType: input.sourceType ?? 'github',
    sourceUrl: '',
    rawUrl: '',
    title: input.title,
    markdownSnapshot: input.markdownSnapshot,
    fingerprint: input.fingerprint,
    parentDocumentId: input.parentDocumentId,
    lineageId: input.lineageId,
    sourceTicketId: input.sourceTicketId,
    bodyHash: input.bodyHash,
  })
}

export async function listLocalDocuments() {
  const db = await openLocalDb()
  return new Promise<LocalDocument[]>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readonly')
    const request = tx.objectStore(documentsStore).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

export async function confirmLocalDocumentRelationship(input: {
  id: string
  parentDocumentId: string
  lineageId: string
  sourceTicketId?: string
}) {
  const document = await loadLocalDocumentWithoutTouch(input.id)
  if (!document) return null
  const now = new Date().toISOString()
  const updated: LocalDocument = {
    ...document,
    parentDocumentId: input.parentDocumentId,
    lineageId: input.lineageId,
    sourceTicketId: input.sourceTicketId,
    suggestedParentDocumentId: undefined,
    updatedAt: now,
    lastOpenedAt: now,
  }
  const db = await openLocalDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readwrite')
    tx.objectStore(documentsStore).put(updated)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return updated
}

/**
 * Return the full version chain a document belongs to, ordered root → leaf:
 * walks up parentDocumentId links to the root ancestor, then back down through
 * successors. Read-only; for version-history visibility. Linear chains are
 * deterministic; on a branch the earliest-created successor is followed.
 */
export async function getDocumentLineage(id: string): Promise<LocalDocument[]> {
  const db = await openLocalDb()
  const all = await new Promise<LocalDocument[]>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readonly')
    const request = tx.objectStore(documentsStore).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })

  const byId = new Map(all.map((doc) => [doc.id, doc]))

  // Walk up to the root ancestor.
  let root = byId.get(id)
  const seenUp = new Set<string>()
  while (root && root.parentDocumentId && byId.has(root.parentDocumentId) && !seenUp.has(root.id)) {
    seenUp.add(root.id)
    root = byId.get(root.parentDocumentId)
  }
  if (!root) return []

  // Walk down following successors.
  const chain: LocalDocument[] = [root]
  const seenDown = new Set<string>([root.id])
  let cursor: LocalDocument | undefined = root
  for (;;) {
    const children = all
      .filter((doc) => doc.parentDocumentId === cursor!.id && !seenDown.has(doc.id))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (!children.length) break
    cursor = children[0]
    chain.push(cursor)
    seenDown.add(cursor.id)
  }
  return chain
}

export async function findLocalDocumentByUrl(rawUrl: string) {
  const normalized = normalizeUrl(rawUrl)
  const db = await openLocalDb()
  const all = await new Promise<LocalDocument[]>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readonly')
    const request = tx.objectStore(documentsStore).getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })

  return all.find((doc) => doc.sourceType === 'github' && normalizeUrl(doc.rawUrl) === normalized) || null
}

export function normalizeUrl(url: string) {
  try {
    const u = new URL(url)
    const normalized = `${u.protocol}//${u.hostname}${u.pathname}`.toLowerCase().replace(/\/$/, '')
    return normalized
  } catch {
    return url.toLowerCase()
  }
}

export async function updateLocalDocument(id: string, updates: { markdownSnapshot: string; fingerprint: string }) {
  const document = await loadLocalDocumentWithoutTouch(id)
  if (!document) return null

  const now = new Date().toISOString()
  const updated: LocalDocument = {
    ...document,
    markdownSnapshot: updates.markdownSnapshot,
    fingerprint: updates.fingerprint,
    updatedAt: now,
    lastOpenedAt: now,
  }

  const db = await openLocalDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readwrite')
    tx.objectStore(documentsStore).put(updated)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  return updated
}

async function touchLocalDocument(id: string) {
  const document = await loadLocalDocumentWithoutTouch(id)
  if (!document) return

  const now = new Date().toISOString()
  const db = await openLocalDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readwrite')
    tx.objectStore(documentsStore).put({
      ...document,
      lastOpenedAt: now,
      updatedAt: now,
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function loadLocalDocumentWithoutTouch(id: string) {
  const db = await openLocalDb()
  return new Promise<LocalDocument | null>((resolve, reject) => {
    const tx = db.transaction(documentsStore, 'readonly')
    const request = tx.objectStore(documentsStore).get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

function openLocalDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(documentsStore)) {
        db.createObjectStore(documentsStore, { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
