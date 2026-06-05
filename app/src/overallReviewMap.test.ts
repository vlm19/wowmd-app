import { describe, expect, test } from 'vitest'
import type { Annotation, AnnotationType } from './annotations'
import { buildOverallReviewMap, type TocItem } from './overallReviewMap'

function makeAnnotation(type: AnnotationType | null, headingPath: string[], overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: `${type || 'legacy'}-${headingPath.join('-')}`,
    documentId: 'doc-real-case',
    documentFingerprint: 'fp-real-case',
    quote: 'selected passage',
    prefix: 'before',
    suffix: 'after',
    headingPath,
    offset: 10,
    type,
    note: '',
    suggestedReplacement: '',
    color: 'yellow',
    legacyColor: null,
    orphaned: false,
    needsReview: false,
    createdAt: '2026-06-05T00:00:00.000Z',
    updatedAt: '2026-06-05T00:00:00.000Z',
    ...overrides,
  }
}

function toc(items: Array<[string, number, number]>): TocItem[] {
  return items.map(([text, level, estimatedSize], index) => ({
    id: `${text.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`,
    text,
    level,
    estimatedSize,
  }))
}

describe('buildOverallReviewMap real cases', () => {
  test('AI architecture review preserves document order and ranks storage risk first', () => {
    const tocItems = toc([
      ['AI Architecture Review', 1, 80],
      ['Overview', 2, 180],
      ['Architecture', 2, 420],
      ['Storage model', 2, 560],
      ['Export workflow', 2, 360],
      ['Security notes', 2, 520],
      ['FAQ', 2, 160],
    ])
    const annotations = [
      makeAnnotation('confirmed', ['AI Architecture Review', 'Overview']),
      makeAnnotation('dispute', ['AI Architecture Review', 'Architecture']),
      makeAnnotation('clarify', ['AI Architecture Review', 'Architecture']),
      makeAnnotation('dispute', ['AI Architecture Review', 'Storage model']),
      makeAnnotation('dispute', ['AI Architecture Review', 'Storage model']),
      makeAnnotation('clarify', ['AI Architecture Review', 'Storage model']),
      makeAnnotation('clarify', ['AI Architecture Review', 'Storage model']),
      makeAnnotation('important', ['AI Architecture Review', 'Export workflow']),
      makeAnnotation('confirmed', ['AI Architecture Review', 'Export workflow']),
    ]

    const result = buildOverallReviewMap({ annotations, tocItems })

    expect(result.sections.map((section) => section.headingText)).toEqual([
      'AI Architecture Review',
      'Overview',
      'Architecture',
      'Storage model',
      'Export workflow',
      'Security notes',
      'FAQ',
    ])
    expect(result.attention.map((section) => section.headingText).slice(0, 3)).toEqual([
      'Storage model',
      'Architecture',
      'Security notes',
    ])
    expect(result.summary.reviewedSectionCount).toBe(4)
    expect(result.summary.sectionCount).toBe(7)
    expect(result.summary.riskSectionCount).toBe(2)
  })

  test('privacy and export copy treats confirmed review as confidence but still surfaces export dispute', () => {
    const tocItems = toc([
      ['Privacy and Export Copy', 1, 60],
      ['Local processing', 2, 260],
      ['Browser storage', 2, 320],
      ['Export boundaries', 2, 280],
      ['Recovery', 2, 240],
      ['Support', 2, 180],
    ])
    const annotations = [
      makeAnnotation('confirmed', ['Privacy and Export Copy', 'Local processing']),
      makeAnnotation('confirmed', ['Privacy and Export Copy', 'Browser storage']),
      makeAnnotation('important', ['Privacy and Export Copy', 'Browser storage']),
      makeAnnotation('dispute', ['Privacy and Export Copy', 'Export boundaries']),
      makeAnnotation('confirmed', ['Privacy and Export Copy', 'Recovery']),
      makeAnnotation('clarify', ['Privacy and Export Copy', 'Recovery']),
      makeAnnotation('confirmed', ['Privacy and Export Copy', 'Support']),
    ]

    const result = buildOverallReviewMap({ annotations, tocItems })

    expect(result.summary.confidenceRatio).toBeGreaterThan(0.7)
    expect(result.summary.confidence).toBe('high')
    expect(result.summary.dominantType).toBe('confirmed')
    expect(result.attention[0].headingText).toBe('Export boundaries')
  })

  test('unreviewed FAQ returns empty typed-review state without fake attention ranking', () => {
    const tocItems = toc([
      ['User FAQ', 1, 80],
      ['Setup', 2, 160],
      ['Importing Markdown', 2, 220],
      ['Annotations', 2, 220],
      ['Exporting', 2, 200],
      ['Troubleshooting', 2, 260],
    ])

    const result = buildOverallReviewMap({ annotations: [], tocItems })

    expect(result.summary.coverageRatio).toBe(0)
    expect(result.summary.confidenceRatio).toBe(0)
    expect(result.summary.riskSectionCount).toBe(0)
    expect(result.attention).toEqual([])
    expect(result.sections.every((section) => section.coverageState === 'unreviewed')).toBe(true)
  })

  test('duplicate heading text uses full heading path instead of ambiguous deepest text', () => {
    const tocItems = toc([
      ['Spec', 1, 80],
      ['Import', 2, 200],
      ['Limits', 3, 180],
      ['Export', 2, 220],
      ['Limits', 3, 260],
    ])
    const annotations = [
      makeAnnotation('dispute', ['Spec', 'Export', 'Limits']),
    ]

    const result = buildOverallReviewMap({ annotations, tocItems })

    expect(result.sections.find((section) => section.headingPath.join('/') === 'Spec/Import/Limits')?.total).toBe(0)
    expect(result.sections.find((section) => section.headingPath.join('/') === 'Spec/Export/Limits')?.counts.dispute).toBe(1)
  })

  test('legacy untyped annotations do not inflate coverage or confidence', () => {
    const tocItems = toc([
      ['Legacy Notes', 1, 80],
      ['Old highlights', 2, 240],
      ['Typed review', 2, 240],
    ])
    const annotations = [
      makeAnnotation(null, ['Legacy Notes', 'Old highlights'], { legacyColor: 'blue', note: 'old color note' }),
      makeAnnotation('confirmed', ['Legacy Notes', 'Typed review']),
    ]

    const result = buildOverallReviewMap({ annotations, tocItems })

    expect(result.summary.typedAnnotationCount).toBe(1)
    expect(result.summary.reviewedSectionCount).toBe(1)
    expect(result.summary.confidenceRatio).toBe(1)
  })
})
