import { randomId, sha256Hex } from './compat'

export const FILE_LINEAGE_START = '<!-- wowmd:document-meta:v1'
export const FILE_LINEAGE_END = 'wowmd:document-meta:end -->'
export const FILE_LINEAGE_SIMILARITY_THRESHOLD = 0.64
export const FILE_LINEAGE_DIFF_MAX_CELLS = 1_500_000

export type FileLineageMetadata = {
  lineageId: string
  documentId: string
  parentDocumentId?: string
  sourceTicketId?: string
  bodyHash: string
  originalFilename: string
  savedAt: string
  producer: {
    app: string
    installationId?: string
  }
}

export type FileLineageParseResult =
  | { valid: true; metadata: FileLineageMetadata; body: string }
  | { valid: false; reason: 'missing' | 'duplicate' | 'not-tail' | 'invalid-json' | 'invalid-fields'; body: string }

export type FileLineageRecord = {
  id: string
  title: string
  markdownSnapshot: string
  updatedAt: string
  lineageId?: string
  bodyHash?: string
}

export type FileLineageCandidateReason =
  | 'explicit-parent'
  | 'known-lineage'
  | 'known-document'
  | 'body-hash'
  | 'structure-similarity'

export type FileLineageCandidate<T extends FileLineageRecord = FileLineageRecord> = {
  parent: T
  filename: string
  reason: FileLineageCandidateReason
  externalEdit: boolean
}

export type LineDifference = {
  kind: 'added' | 'removed'
  text: string
  oldLine?: number
  newLine?: number
}

export function createLineageId() {
  return `lineage_${randomId()}`
}

export function createLineageDocumentId() {
  return `doc_${randomId()}`
}

export function createTicketId() {
  return `ticket_${randomId()}`
}

export function parseFileLineage(markdown: string): FileLineageParseResult {
  const start = markdown.lastIndexOf(FILE_LINEAGE_START)
  const end = markdown.lastIndexOf(FILE_LINEAGE_END)
  if (start < 0 || end < 0 || end < start) return { valid: false, reason: 'missing', body: markdown }
  if (markdown.indexOf(FILE_LINEAGE_START) !== start) return { valid: false, reason: 'duplicate', body: markdown }
  if (markdown.slice(end + FILE_LINEAGE_END.length).trim()) {
    return { valid: false, reason: 'not-tail', body: markdown }
  }

  try {
    const raw = JSON.parse(markdown.slice(start + FILE_LINEAGE_START.length, end).trim()) as Partial<FileLineageMetadata>
    if (
      typeof raw.lineageId !== 'string' ||
      typeof raw.documentId !== 'string' ||
      typeof raw.bodyHash !== 'string' ||
      typeof raw.originalFilename !== 'string' ||
      typeof raw.savedAt !== 'string' ||
      !raw.producer ||
      typeof raw.producer.app !== 'string'
    ) {
      return { valid: false, reason: 'invalid-fields', body: markdown }
    }
    return {
      valid: true,
      metadata: raw as FileLineageMetadata,
      body: markdown.slice(0, start).trimEnd() + '\n',
    }
  } catch {
    return { valid: false, reason: 'invalid-json', body: markdown }
  }
}

export function markdownBody(markdown: string) {
  const parsed = parseFileLineage(markdown)
  return parsed.valid ? parsed.body : markdown
}

export async function computeBodyHash(markdown: string) {
  return `sha256:${await sha256Hex(markdownBody(markdown))}`
}

export async function appendFileLineage(
  markdown: string,
  input: Omit<FileLineageMetadata, 'bodyHash'>,
) {
  const body = markdownBody(markdown).trimEnd() + '\n'
  const metadata: FileLineageMetadata = {
    ...input,
    bodyHash: await computeBodyHash(body),
  }
  return `${body}\n${FILE_LINEAGE_START}\n${JSON.stringify(metadata, null, 2)}\n${FILE_LINEAGE_END}\n`
}

export function findFileLineageCandidate<T extends FileLineageRecord>(
  filename: string,
  markdown: string,
  bodyHash: string,
  metadata: FileLineageMetadata | undefined,
  documents: T[],
): FileLineageCandidate<T> | null {
  if (metadata) {
    const known = documents.find((item) => item.id === metadata.documentId)
    if (known) {
      return { parent: known, filename, reason: 'known-document', externalEdit: known.bodyHash !== bodyHash }
    }
    const parent = documents.find((item) => item.id === metadata.parentDocumentId)
    if (parent) {
      return { parent, filename, reason: 'explicit-parent', externalEdit: false }
    }
    const lineage = documents
      .filter((item) => item.lineageId === metadata.lineageId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    if (lineage) {
      return { parent: lineage, filename, reason: 'known-lineage', externalEdit: false }
    }
  }

  const sameBody = documents.find((item) => item.bodyHash === bodyHash)
  if (sameBody) return { parent: sameBody, filename, reason: 'body-hash', externalEdit: false }

  const similar = documents
    .map((item) => ({ item, score: documentSimilarity(markdown, item.markdownSnapshot) }))
    // This threshold only creates a user-confirmed suggestion. Real fixtures
    // establish the lower bound; unrelated-document fixtures guard false positives.
    .filter(({ score }) => score >= FILE_LINEAGE_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0]
  return similar
    ? { parent: similar.item, filename, reason: 'structure-similarity', externalEdit: false }
    : null
}

export function documentSimilarity(left: string, right: string) {
  const terms = (value: string) => new Set(
    value.toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) || [],
  )
  const headings = (value: string) => new Set(
    value
      .split(/\r?\n/)
      .map((line) => /^#{1,6}\s+(.+?)\s*$/.exec(line)?.[1].toLowerCase().replace(/\bv\d+\b/g, '').trim())
      .filter((heading): heading is string => Boolean(heading)),
  )
  const overlap = (a: Set<string>, b: Set<string>) => {
    if (!a.size || !b.size) return 0
    let intersection = 0
    for (const item of a) if (b.has(item)) intersection += 1
    return intersection / Math.max(a.size, b.size)
  }
  const a = terms(left)
  const b = terms(right)
  const headingScore = overlap(headings(left), headings(right))
  const termScore = overlap(a, b)
  return headingScore * 0.55 + termScore * 0.45
}

export function buildLineDifference(previous: string, current: string, previewLimit = 8) {
  const before = previous.split(/\r?\n/)
  const after = current.split(/\r?\n/)
  if ((before.length + 1) * (after.length + 1) > FILE_LINEAGE_DIFF_MAX_CELLS) {
    return buildBoundedLineDifference(before, after, previewLimit)
  }
  const lengths = Array.from({ length: before.length + 1 }, () => new Uint32Array(after.length + 1))

  for (let i = before.length - 1; i >= 0; i -= 1) {
    for (let j = after.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = before[i] === after[j]
        ? lengths[i + 1][j + 1] + 1
        : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    }
  }

  const differences: LineDifference[] = []
  let i = 0
  let j = 0
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      i += 1
      j += 1
    } else if (j < after.length && (i === before.length || lengths[i][j + 1] >= lengths[i + 1][j])) {
      differences.push({ kind: 'added', text: after[j], newLine: j + 1 })
      j += 1
    } else {
      differences.push({ kind: 'removed', text: before[i], oldLine: i + 1 })
      i += 1
    }
  }

  return {
    addedLineCount: differences.filter((item) => item.kind === 'added').length,
    removedLineCount: differences.filter((item) => item.kind === 'removed').length,
    differences: differences.filter((item) => item.text.trim()).slice(0, previewLimit),
  }
}

function buildBoundedLineDifference(before: string[], after: string[], previewLimit: number) {
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix += 1

  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) suffix += 1

  const removed = before.slice(prefix, before.length - suffix)
  const added = after.slice(prefix, after.length - suffix)
  const differences: LineDifference[] = []
  for (let index = 0; index < Math.max(removed.length, added.length) && differences.length < previewLimit; index += 1) {
    if (index < removed.length && removed[index].trim()) {
      differences.push({ kind: 'removed', text: removed[index], oldLine: prefix + index + 1 })
    }
    if (index < added.length && added[index].trim() && differences.length < previewLimit) {
      differences.push({ kind: 'added', text: added[index], newLine: prefix + index + 1 })
    }
  }
  return {
    addedLineCount: added.length,
    removedLineCount: removed.length,
    differences,
  }
}
