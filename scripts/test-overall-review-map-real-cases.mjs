import assert from 'node:assert/strict'

const TYPES = ['clarify', 'dispute', 'important', 'confirmed']

function extractToc(markdown) {
  const lines = markdown.split(/\r?\n/)
  const headings = []

  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(lines[i])
    if (!match) continue

    headings.push({
      id: slug(match[2], headings.length),
      level: match[1].length,
      text: match[2],
      line: i,
      order: headings.length,
    })
  }

  return headings.map((heading, index) => {
    const next = headings[index + 1]
    const sectionLines = lines.slice(heading.line + 1, next ? next.line : lines.length)
    return {
      ...heading,
      headingPath: buildHeadingPath(headings, index),
      estimatedSize: sectionLines.join('\n').trim().length,
    }
  })
}

function slug(text, index) {
  return `${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'}-${index}`
}

function buildHeadingPath(headings, index) {
  const current = headings[index]
  const path = [current.text]

  for (let i = index - 1; i >= 0; i -= 1) {
    if (headings[i].level < current.level) {
      path.unshift(headings[i].text)
    }
  }

  return path
}

function emptyCounts() {
  return { clarify: 0, dispute: 0, important: 0, confirmed: 0 }
}

function buildOverallReviewMap({ markdown, annotations }) {
  const toc = extractToc(markdown)
  const medianSize = median(toc.map((section) => section.estimatedSize))
  const sections = toc.map((section) => ({
    ...section,
    counts: emptyCounts(),
    total: 0,
    coverageState: 'unreviewed',
    riskScore: 0,
    attentionReasons: [],
  }))

  for (const annotation of annotations) {
    if (!TYPES.includes(annotation.type)) continue

    const section = matchSection(sections, annotation.headingPath)
    if (!section) continue

    section.counts[annotation.type] += 1
    section.total += 1
    section.coverageState = 'reviewed'
  }

  for (const section of sections) {
    const { clarify, dispute, important, confirmed } = section.counts
    const largeUnreviewed = section.total === 0 && section.estimatedSize >= medianSize
    let riskScore = dispute * 3 + clarify * 2 + important * 0.5 - confirmed * 0.5

    if (largeUnreviewed) riskScore += 1.5

    section.riskScore = Math.max(0, riskScore)
    section.attentionReasons = buildReasons(section, largeUnreviewed)
  }

  const typedAnnotationCount = sections.reduce((sum, section) => sum + section.total, 0)
  const reviewedSectionCount = sections.filter((section) => section.total > 0).length
  const totals = sections.reduce((acc, section) => {
    for (const type of TYPES) acc[type] += section.counts[type]
    return acc
  }, emptyCounts())

  const attention = typedAnnotationCount === 0
    ? []
    : sections
        .filter((section) => section.riskScore > 0)
        .sort((a, b) => b.riskScore - a.riskScore || a.order - b.order)
        .slice(0, 5)

  return {
    summary: {
      sectionCount: sections.length,
      reviewedSectionCount,
      typedAnnotationCount,
      coverageRatio: sections.length ? reviewedSectionCount / sections.length : 0,
      confidenceRatio: typedAnnotationCount ? (totals.important + totals.confirmed) / typedAnnotationCount : 0,
      riskSectionCount: sections.filter((section) => section.counts.dispute > 0 || section.counts.clarify >= 2).length,
      dominantType: dominantType(totals),
    },
    sections,
    attention,
  }
}

function matchSection(sections, headingPath) {
  if (!Array.isArray(headingPath) || headingPath.length === 0) return null

  const normalized = headingPath.join('>')
  const fullMatch = sections.find((section) => section.headingPath.join('>') === normalized)
  if (fullMatch) return fullMatch

  const deepest = headingPath[headingPath.length - 1]
  const textMatches = sections.filter((section) => section.text === deepest)
  return textMatches.length === 1 ? textMatches[0] : null
}

function buildReasons(section, largeUnreviewed) {
  const reasons = []
  if (section.counts.dispute > 0) reasons.push('Disputes are concentrated here.')
  if (section.counts.clarify >= 2) reasons.push('Clarification notes are concentrated here.')
  if (section.counts.important > 0 && section.counts.confirmed === 0) {
    reasons.push('Important claims are not confirmed yet.')
  }
  if (largeUnreviewed) reasons.push('Large section has no typed review yet.')
  return reasons
}

function dominantType(counts) {
  let best = null
  let bestCount = 0
  for (const type of TYPES) {
    if (counts[type] > bestCount) {
      best = type
      bestCount = counts[type]
    }
  }
  return best
}

function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function a(type, headingPath) {
  return { type, headingPath }
}

function runAiArchitectureReviewCase() {
  const markdown = `# AI Architecture Review

## Overview
The system reads Markdown locally and keeps the original file untouched.

## Architecture
The app renders Markdown, captures typed annotations, and exports review artifacts.
The import path should not send license keys, emails, or Markdown bodies in URLs.

## Storage model
Annotations persist in browser storage. Imported GitHub documents may be saved as local document copies.
Unsaved toolbar drafts are not the same as saved annotations. Recovery language must explain this clearly.

## Export workflow
Users can export HTML for people, reviewed Markdown for Obsidian, Backup JSON, or Ticket JSON for AI.

## Security notes
Local-first claims need precise language. Browser local storage is private to the browser profile but can still be cleared by site-data deletion.
Users should keep backups for important exported content.

## FAQ
The FAQ explains common import and export behavior.
`

  const result = buildOverallReviewMap({
    markdown,
    annotations: [
      a('confirmed', ['AI Architecture Review', 'Overview']),
      a('dispute', ['AI Architecture Review', 'Architecture']),
      a('clarify', ['AI Architecture Review', 'Architecture']),
      a('dispute', ['AI Architecture Review', 'Storage model']),
      a('dispute', ['AI Architecture Review', 'Storage model']),
      a('clarify', ['AI Architecture Review', 'Storage model']),
      a('clarify', ['AI Architecture Review', 'Storage model']),
      a('important', ['AI Architecture Review', 'Export workflow']),
      a('confirmed', ['AI Architecture Review', 'Export workflow']),
    ],
  })

  assert.equal(result.sections.map((section) => section.text).join(' > '), 'AI Architecture Review > Overview > Architecture > Storage model > Export workflow > Security notes > FAQ')
  assert.equal(result.attention[0].text, 'Storage model')
  assert.equal(result.attention[1].text, 'Architecture')
  assert.ok(result.attention.some((section) => section.text === 'Security notes'))
  assert.equal(result.summary.reviewedSectionCount, 4)
  assert.equal(result.summary.sectionCount, 7)
  assert.equal(result.summary.riskSectionCount, 2)

  return result
}

function runPrivacyExportCopyCase() {
  const markdown = `# Privacy and Export Copy

## Local processing
Markdown renders in the browser and is not uploaded for reading or annotations.

## Browser storage
Saved annotations use browser site storage. Clearing site data can remove local copies.

## Export boundaries
Exported files leave the app only when the user downloads or shares them.

## Recovery
Saved annotations can survive browser restart, but unsaved toolbar drafts may be lost.

## Support
Support should explain storage, exports, and manual backups without overclaiming.
`

  const result = buildOverallReviewMap({
    markdown,
    annotations: [
      a('confirmed', ['Privacy and Export Copy', 'Local processing']),
      a('confirmed', ['Privacy and Export Copy', 'Browser storage']),
      a('important', ['Privacy and Export Copy', 'Browser storage']),
      a('dispute', ['Privacy and Export Copy', 'Export boundaries']),
      a('confirmed', ['Privacy and Export Copy', 'Recovery']),
      a('clarify', ['Privacy and Export Copy', 'Recovery']),
      a('confirmed', ['Privacy and Export Copy', 'Support']),
    ],
  })

  assert.ok(result.summary.confidenceRatio > 0.7)
  assert.equal(result.summary.dominantType, 'confirmed')
  assert.equal(result.attention[0].text, 'Export boundaries')
  assert.ok(result.summary.coverageRatio > 0.8)

  return result
}

function runUnreviewedFaqCase() {
  const markdown = `# User FAQ

## Setup
Install the extension and open the web app.

## Importing Markdown
Choose a local Markdown file or import supported public GitHub Markdown.

## Annotations
Select text and mark it with one of the review types.

## Exporting
Export HTML, reviewed Markdown, Backup JSON, or Ticket JSON.

## Troubleshooting
If storage is cleared, restore from your own backups where available.
`

  const result = buildOverallReviewMap({ markdown, annotations: [] })

  assert.equal(result.summary.coverageRatio, 0)
  assert.equal(result.summary.confidenceRatio, 0)
  assert.equal(result.summary.riskSectionCount, 0)
  assert.equal(result.attention.length, 0)
  assert.equal(result.sections.every((section) => section.coverageState === 'unreviewed'), true)

  return result
}

const cases = [
  ['AI architecture review', runAiArchitectureReviewCase],
  ['Privacy and export copy', runPrivacyExportCopyCase],
  ['Unreviewed FAQ', runUnreviewedFaqCase],
]

for (const [name, run] of cases) {
  const result = run()
  console.log(`PASS ${name}`)
  console.log(`  coverage=${Math.round(result.summary.coverageRatio * 100)}% confidence=${Math.round(result.summary.confidenceRatio * 100)}% riskSections=${result.summary.riskSectionCount}`)
  console.log(`  attention=${result.attention.map((section) => section.text).join(', ') || '(empty)'}`)
}

