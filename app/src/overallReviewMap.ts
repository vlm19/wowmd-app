import type { Annotation, AnnotationType } from './annotations'

export type TocItem = {
  id: string
  level: number
  text: string
  estimatedSize?: number
}

export type ReviewTypeCounts = Record<AnnotationType, number>

export type AttentionReason =
  | 'dispute'
  | 'clarify'
  | 'importantUnconfirmed'
  | 'largeUnreviewed'

export type ReviewConfidence = 'low' | 'mixed' | 'high'

export type OverallReviewSection = {
  headingId: string
  headingText: string
  headingPath: string[]
  level: number
  order: number
  estimatedSize: number
  counts: ReviewTypeCounts
  total: number
  coverageState: 'unreviewed' | 'reviewed'
  riskScore: number
  attentionReasons: AttentionReason[]
}

export type OverallReviewSummary = {
  sectionCount: number
  reviewedSectionCount: number
  typedAnnotationCount: number
  coverageRatio: number
  confidenceRatio: number
  confidence: ReviewConfidence
  riskSectionCount: number
  dominantType: AnnotationType | null
}

export type OverallReviewMapModel = {
  summary: OverallReviewSummary
  sections: OverallReviewSection[]
  attention: OverallReviewSection[]
}

type BuildInput = {
  annotations: Annotation[]
  tocItems: TocItem[]
}

const annotationTypes: AnnotationType[] = ['clarify', 'dispute', 'important', 'confirmed']

function emptyCounts(): ReviewTypeCounts {
  return { clarify: 0, dispute: 0, important: 0, confirmed: 0 }
}

function buildSectionPaths(tocItems: TocItem[]) {
  const stack: Array<{ level: number; text: string }> = []

  return tocItems.map((item, order) => {
    while (stack.length && stack[stack.length - 1].level >= item.level) {
      stack.pop()
    }

    const headingPath = [...stack.map((entry) => entry.text), item.text]
    stack.push({ level: item.level, text: item.text })

    return {
      headingId: item.id,
      headingText: item.text,
      headingPath,
      level: item.level,
      order,
      estimatedSize: item.estimatedSize ?? 0,
      counts: emptyCounts(),
      total: 0,
      coverageState: 'unreviewed' as const,
      riskScore: 0,
      attentionReasons: [] as AttentionReason[],
    }
  })
}

function matchSection(sections: OverallReviewSection[], headingPath: string[]) {
  if (!headingPath.length) return null

  const normalizedPath = headingPath.join('\u0000')
  const fullMatch = sections.find((section) => section.headingPath.join('\u0000') === normalizedPath)
  if (fullMatch) return fullMatch

  const deepestHeading = headingPath[headingPath.length - 1]
  const textMatches = sections.filter((section) => section.headingText === deepestHeading)
  return textMatches.length === 1 ? textMatches[0] : null
}

function median(values: number[]) {
  const usable = values.filter((value) => value > 0).sort((a, b) => a - b)
  if (!usable.length) return 0
  return usable[Math.floor(usable.length / 2)]
}

function buildReasons(section: OverallReviewSection, largeUnreviewed: boolean): AttentionReason[] {
  const reasons: AttentionReason[] = []

  if (section.counts.dispute > 0) reasons.push('dispute')
  if (section.counts.clarify >= 2) reasons.push('clarify')
  if (section.counts.important > 0 && section.counts.confirmed === 0) {
    reasons.push('importantUnconfirmed')
  }
  if (largeUnreviewed) reasons.push('largeUnreviewed')

  return reasons
}

function dominantType(counts: ReviewTypeCounts): AnnotationType | null {
  let best: AnnotationType | null = null
  let bestCount = 0

  for (const type of annotationTypes) {
    if (counts[type] > bestCount) {
      best = type
      bestCount = counts[type]
    }
  }

  return best
}

function confidenceLevel(confidenceRatio: number, riskSectionCount: number, typedAnnotationCount: number): ReviewConfidence {
  if (typedAnnotationCount === 0) return 'low'
  if (confidenceRatio >= 0.7 && riskSectionCount <= 1) return 'high'
  if (confidenceRatio >= 0.4 || riskSectionCount > 0) return 'mixed'
  return 'low'
}

export function buildOverallReviewMap({ annotations, tocItems }: BuildInput): OverallReviewMapModel {
  const sections = buildSectionPaths(tocItems)
  const medianSectionSize = median(sections.map((section) => section.estimatedSize))

  for (const annotation of annotations) {
    if (!annotation.type) continue

    const section = matchSection(sections, annotation.headingPath)
    if (!section) continue

    section.counts[annotation.type] += 1
    section.total += 1
    section.coverageState = 'reviewed'
  }

  for (const section of sections) {
    const { clarify, dispute, important, confirmed } = section.counts
    const largeUnreviewed = section.total === 0 && medianSectionSize > 0 && section.estimatedSize >= medianSectionSize
    const riskScore = dispute * 3 + clarify * 2 + important * 0.5 - confirmed * 0.5 + (largeUnreviewed ? 1.5 : 0)

    section.riskScore = Math.max(0, riskScore)
    section.attentionReasons = buildReasons(section, largeUnreviewed)
  }

  const totals = sections.reduce((acc, section) => {
    for (const type of annotationTypes) {
      acc[type] += section.counts[type]
    }
    return acc
  }, emptyCounts())
  const typedAnnotationCount = sections.reduce((sum, section) => sum + section.total, 0)
  const reviewedSectionCount = sections.filter((section) => section.total > 0).length
  const confidenceRatio = typedAnnotationCount
    ? (totals.important + totals.confirmed) / typedAnnotationCount
    : 0
  const riskSectionCount = sections.filter((section) => section.counts.dispute > 0 || section.counts.clarify >= 2).length

  return {
    summary: {
      sectionCount: sections.length,
      reviewedSectionCount,
      typedAnnotationCount,
      coverageRatio: sections.length ? reviewedSectionCount / sections.length : 0,
      confidenceRatio,
      confidence: confidenceLevel(confidenceRatio, riskSectionCount, typedAnnotationCount),
      riskSectionCount,
      dominantType: dominantType(totals),
    },
    sections,
    attention: typedAnnotationCount === 0
      ? []
      : sections
          .filter((section) => section.riskScore > 0)
          .sort((a, b) => b.riskScore - a.riskScore || a.order - b.order)
          .slice(0, 5),
  }
}

export { annotationTypes as overallReviewTypes }
