export type LocalDocumentSource = {
  sourceType: 'github'
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
  createdAt: string
  updatedAt: string
  lastOpenedAt: string
}

const dbName = 'wowmd_local'
const dbVersion = 1
const documentsStore = 'documents'

export function createDocId() {
  return `doc_${crypto.randomUUID()}`
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
