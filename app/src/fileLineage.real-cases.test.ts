import { describe, expect, test } from 'vitest'
import source from '../../scripts/fixtures/file-lineage/source-no-meta.md?raw'
import reviewedCopy from '../../scripts/fixtures/file-lineage/reviewed-copy-renamed.md?raw'
import externallyEdited from '../../scripts/fixtures/file-lineage/externally-edited.md?raw'
import aiRevision from '../../scripts/fixtures/file-lineage/ai-revised-from-ticket.md?raw'
import renamedSimilar from '../../scripts/fixtures/file-lineage/renamed-similar-without-meta.md?raw'
import {
  computeBodyHash,
  documentSimilarity,
  FILE_LINEAGE_SIMILARITY_THRESHOLD,
  findFileLineageCandidate,
  markdownBody,
  parseFileLineage,
  type FileLineageRecord,
} from './fileLineage'

describe('file lineage real Markdown cases', () => {
  test('links AI output to a metadata-free source through its explicit parent identity', async () => {
    const parsed = parseFileLineage(aiRevision)
    expect(parsed.valid).toBe(true)
    if (!parsed.valid) return

    const sourceRecord = await record('doc_source_001', source, 'lineage_real_case_001')
    const candidate = findFileLineageCandidate(
      'ai-revised.md',
      markdownBody(aiRevision),
      await computeBodyHash(aiRevision),
      parsed.metadata,
      [sourceRecord],
    )
    expect(candidate).toMatchObject({
      parent: { id: 'doc_source_001' },
      reason: 'explicit-parent',
      externalEdit: false,
    })
  })

  test('detects manual external editing of a known portable version', async () => {
    const reviewedMeta = parseFileLineage(reviewedCopy)
    const editedMeta = parseFileLineage(externallyEdited)
    expect(reviewedMeta.valid && editedMeta.valid).toBe(true)
    if (!reviewedMeta.valid || !editedMeta.valid) return

    const known = await record(reviewedMeta.metadata.documentId, reviewedCopy, reviewedMeta.metadata.lineageId)
    const candidate = findFileLineageCandidate(
      'renamed-after-external-edit.md',
      markdownBody(externallyEdited),
      await computeBodyHash(externallyEdited),
      editedMeta.metadata,
      [known],
    )
    expect(candidate).toMatchObject({
      reason: 'known-document',
      externalEdit: true,
    })
  })

  test('keeps similarity-only matching as a confirmable weak candidate', async () => {
    const sourceRecord = await record('doc_source_001', source, 'lineage_real_case_001')
    const candidate = findFileLineageCandidate(
      'local-first-plan-v3.md',
      renamedSimilar,
      await computeBodyHash(renamedSimilar),
      undefined,
      [sourceRecord],
    )
    expect(candidate).toMatchObject({ reason: 'structure-similarity', externalEdit: false })
  })

  test('uses an identical metadata-free body as candidate evidence, not as an automatic identity', async () => {
    const sourceRecord = await record('doc_source_001', source, 'lineage_real_case_001')
    const candidate = findFileLineageCandidate(
      'same-body-different-name.md',
      source,
      await computeBodyHash(source),
      undefined,
      [sourceRecord],
    )
    expect(candidate).toMatchObject({ reason: 'body-hash', externalEdit: false })
  })

  test('does not suggest an unrelated Markdown document', async () => {
    const sourceRecord = await record('doc_source_001', source, 'lineage_real_case_001')
    const unrelated = '# Quarterly menu\n\nA list of lunch orders and kitchen inventory.\n'
    expect(findFileLineageCandidate(
      'menu.md',
      unrelated,
      await computeBodyHash(unrelated),
      undefined,
      [sourceRecord],
    )).toBeNull()
    expect(documentSimilarity(renamedSimilar, source)).toBeGreaterThanOrEqual(FILE_LINEAGE_SIMILARITY_THRESHOLD)
    expect(documentSimilarity(unrelated, source)).toBeLessThan(FILE_LINEAGE_SIMILARITY_THRESHOLD)
  })
})

async function record(id: string, markdown: string, lineageId: string): Promise<FileLineageRecord> {
  return {
    id,
    title: `${id}.md`,
    markdownSnapshot: markdownBody(markdown),
    updatedAt: '2026-06-07T10:00:00.000Z',
    lineageId,
    bodyHash: await computeBodyHash(markdown),
  }
}
