import { createDocId, findLocalDocumentByUrl, saveLocalDocument, updateLocalDocument, type LocalDocument } from './localDocuments'
import { computeDocumentFingerprint } from './markdown'

export type ImportMeta = {
  source: 'github'
  rawUrl: string
  pageUrl: string
  owner?: string
  repo?: string
  branch?: string
  path?: string
  title: string
}

export type ImportErrorCode =
  | 'INVALID_SOURCE'
  | 'DISALLOWED_RAW_URL'
  | 'FETCH_FAILED'
  | 'FETCH_TIMEOUT'
  | 'EMPTY_MARKDOWN'
  | 'UNKNOWN'

export class ImportError extends Error {
  code: ImportErrorCode

  constructor(code: ImportErrorCode) {
    super(code)
    this.name = 'ImportError'
    this.code = code
  }
}

const importTimeoutMs = 10000

export function parseImportParams(searchParams: URLSearchParams): ImportMeta {
  const source = searchParams.get('source')
  if (source !== 'github') {
    throw new ImportError('INVALID_SOURCE')
  }

  const rawUrl = searchParams.get('rawUrl') || ''
  if (!isAllowedRawUrl(rawUrl)) {
    throw new ImportError('DISALLOWED_RAW_URL')
  }

  const path = cleanOptional(searchParams.get('path'))
  const title =
    cleanOptional(searchParams.get('title')) ||
    fileNameFromPath(path) ||
    'GitHub Markdown'

  return {
    source,
    rawUrl,
    pageUrl: cleanOptional(searchParams.get('pageUrl')) || '',
    owner: cleanOptional(searchParams.get('owner')),
    repo: cleanOptional(searchParams.get('repo')),
    branch: cleanOptional(searchParams.get('branch')),
    path,
    title,
  }
}

export function isAllowedRawUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname === 'raw.githubusercontent.com'
  } catch {
    return false
  }
}

export async function importGitHubMarkdown(searchParams: URLSearchParams) {
  const meta = parseImportParams(searchParams)
  const markdown = await fetchMarkdownFromRawUrl(meta.rawUrl)
  const fingerprint = await computeDocumentFingerprint(markdown)

  const result = await createLocalDocument(meta, markdown, fingerprint)
  return result
}

export async function fetchMarkdownFromRawUrl(rawUrl: string) {
  if (!isAllowedRawUrl(rawUrl)) {
    throw new ImportError('DISALLOWED_RAW_URL')
  }

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), importTimeoutMs)

  try {
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new ImportError('FETCH_FAILED')
    }

    const markdown = await response.text()
    if (!markdown.trim()) {
      throw new ImportError('EMPTY_MARKDOWN')
    }

    return markdown
  } catch (error) {
    if (error instanceof ImportError) throw error
    if (isAbortError(error)) throw new ImportError('FETCH_TIMEOUT')
    throw new ImportError('FETCH_FAILED')
  } finally {
    window.clearTimeout(timer)
  }
}

export async function createLocalDocument(
  meta: ImportMeta,
  markdown: string,
  fingerprint: string,
): Promise<{ document: LocalDocument; isNewVersion: boolean }> {
  const existing = await findLocalDocumentByUrl(meta.rawUrl)

  if (existing) {
    const updated = await updateLocalDocument(existing.id, {
      markdownSnapshot: markdown,
      fingerprint,
    })
    if (!updated) throw new ImportError('FETCH_FAILED')
    return { document: updated, isNewVersion: existing.fingerprint !== fingerprint }
  }

  const document = await saveLocalDocument({
    id: createDocId(),
    sourceType: 'github',
    title: meta.title,
    sourceUrl: meta.pageUrl,
    rawUrl: meta.rawUrl,
    owner: meta.owner,
    repo: meta.repo,
    branch: meta.branch,
    path: meta.path,
    markdownSnapshot: markdown,
    fingerprint,
  })
  return { document, isNewVersion: false }
}

function cleanOptional(value: string | null) {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function fileNameFromPath(path?: string) {
  if (!path) return ''
  return path.split('/').filter(Boolean).pop() || ''
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}
