import { describe, expect, test } from 'vitest'
import {
  appendFileLineage,
  buildLineDifference,
  FILE_LINEAGE_DIFF_MAX_CELLS,
  computeBodyHash,
  createLineageDocumentId,
  createLineageId,
  markdownBody,
  parseFileLineage,
  parseFileLineageCandidate,
} from './fileLineage'

const source = '# Real local document\n\nA paragraph used for a real lineage boundary test.\n'

describe('file lineage protocol', () => {
  test('appends one hidden tail block and excludes it from body hashing', async () => {
    const output = await appendFileLineage(source, {
      lineageId: 'lineage-real',
      documentId: 'doc-v2',
      parentDocumentId: 'doc-v1',
      originalFilename: 'real-v1.md',
      savedAt: '2026-06-07T10:00:00.000Z',
      producer: { app: 'wowMD Pro', installationId: 'install-random' },
    })
    const parsed = parseFileLineage(output)
    expect(parsed.valid).toBe(true)
    expect(markdownBody(output)).toBe(source)
    if (parsed.valid) {
      expect(parsed.metadata.bodyHash).toBe(await computeBodyHash(source))
      expect(parsed.metadata.parentDocumentId).toBe('doc-v1')
    }
  })

  test('replaces a prior block instead of duplicating it', async () => {
    const first = await appendFileLineage(source, {
      lineageId: 'lineage-real',
      documentId: 'doc-v2',
      originalFilename: 'real.md',
      savedAt: '2026-06-07T10:00:00.000Z',
      producer: { app: 'wowMD Pro' },
    })
    const second = await appendFileLineage(first, {
      lineageId: 'lineage-real',
      documentId: 'doc-v3',
      parentDocumentId: 'doc-v2',
      originalFilename: 'real-v2.md',
      savedAt: '2026-06-07T11:00:00.000Z',
      producer: { app: 'wowMD Pro' },
    })
    expect(second.match(/wowmd:document-meta:v1/g)).toHaveLength(1)
    expect(parseFileLineage(second).valid).toBe(true)
  })

  test('rejects duplicate and malformed blocks without changing the body', async () => {
    const valid = await appendFileLineage(source, {
      lineageId: 'lineage-real',
      documentId: 'doc-v2',
      originalFilename: 'real.md',
      savedAt: '2026-06-07T10:00:00.000Z',
      producer: { app: 'wowMD Pro' },
    })
    expect(parseFileLineage(`${valid}\n${valid.slice(valid.indexOf('<!-- wowmd:document-meta:v1'))}`).valid).toBe(false)
    expect(parseFileLineage(`${source}\n<!-- wowmd:document-meta:v1\n{\nwowmd:document-meta:end -->`).valid).toBe(false)
  })

  test('accepts external AI candidate metadata without bodyHash and strips it from the body', () => {
    const output = `${source}
<!-- wowmd:document-meta:v1
{
  "lineageId": "lineage-real",
  "documentId": "doc-ai",
  "parentDocumentId": "doc-source",
  "sourceTicketId": "ticket-real",
  "producer": {
    "app": "External AI"
  }
}
wowmd:document-meta:end -->
`
    const strict = parseFileLineage(output)
    expect(strict.valid).toBe(false)
    if (strict.valid) return
    expect(strict.reason).toBe('invalid-fields')

    const candidate = parseFileLineageCandidate(output)
    expect(candidate.valid).toBe(true)
    if (!candidate.valid) return
    expect(candidate.missingBodyHash).toBe(true)
    expect(candidate.body).toBe(source)
    expect(candidate.metadata).toMatchObject({
      lineageId: 'lineage-real',
      documentId: 'doc-ai',
      parentDocumentId: 'doc-source',
      sourceTicketId: 'ticket-real',
    })
  })

  test('rejects damaged wowMD metadata without downgrading it to an external candidate', () => {
    const damaged = `${source}
<!-- wowmd:document-meta:v1
{
  "lineageId": "lineage-real",
  "documentId": "doc-v2",
  "parentDocumentId": "doc-v1",
  "sourceTicketId": "ticket-real",
  "originalFilename": "real.md",
  "savedAt": "2026-06-07T10:00:00.000Z",
  "producer": {
    "app": "wowMD Pro"
  }
}
wowmd:document-meta:end -->
`
    const candidate = parseFileLineageCandidate(damaged)
    expect(candidate.valid).toBe(false)
    if (candidate.valid) return
    expect(candidate.reason).toBe('canonical-without-hash')
  })

  test('does not parse invalid-json lineage blocks as candidates', () => {
    const malformed = `${source}
<!-- wowmd:document-meta:v1
{
wowmd:document-meta:end -->
`
    const candidate = parseFileLineageCandidate(malformed)
    expect(candidate.valid).toBe(false)
    if (candidate.valid) return
    expect(candidate.reason).toBe('invalid-json')
  })

  test('generates opaque identifiers', () => {
    expect(createLineageId()).toMatch(/^lineage_/)
    expect(createLineageDocumentId()).toMatch(/^doc_/)
  })

  test('reports positioned line differences instead of unordered set changes', () => {
    const result = buildLineDifference('one\ntwo\nthree\n', 'one\nsecond\nthree\nfour\n')
    expect(result).toMatchObject({ addedLineCount: 2, removedLineCount: 1 })
    expect(result.differences).toEqual([
      { kind: 'added', text: 'second', newLine: 2 },
      { kind: 'removed', text: 'two', oldLine: 2 },
      { kind: 'added', text: 'four', newLine: 4 },
    ])
  })

  test('uses a bounded positional preview for very large documents', () => {
    const count = Math.ceil(Math.sqrt(FILE_LINEAGE_DIFF_MAX_CELLS)) + 10
    const before = Array.from({ length: count }, (_, index) => `before ${index}`).join('\n')
    const after = Array.from({ length: count }, (_, index) => index === 600 ? 'changed line' : `before ${index}`).join('\n')
    const result = buildLineDifference(before, after)
    expect(result).toMatchObject({ addedLineCount: 1, removedLineCount: 1 })
    expect(result.differences).toContainEqual({ kind: 'removed', text: 'before 600', oldLine: 601 })
    expect(result.differences).toContainEqual({ kind: 'added', text: 'changed line', newLine: 601 })
  })
})
