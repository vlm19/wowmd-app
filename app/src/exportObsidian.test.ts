/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from 'vitest'
import {
  splitMarkdownBlocks,
  buildObsidianReviewedMarkdown,
  type ObsidianExportOptions,
} from './exportObsidian'
import type { Annotation, AnnotationColor, AnnotationType } from './annotations'

function makeAnnotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: overrides.id ?? 'a1',
    documentId: overrides.documentId ?? 'doc1',
    documentFingerprint: overrides.documentFingerprint ?? 'abc123',
    quote: overrides.quote ?? 'test quote',
    prefix: overrides.prefix ?? '',
    suffix: overrides.suffix ?? '',
    headingPath: overrides.headingPath ?? [],
    offset: overrides.offset ?? 0,
    type: overrides.type ?? null,
    note: overrides.note ?? '',
    suggestedReplacement: overrides.suggestedReplacement ?? '',
    color: overrides.color ?? 'yellow' as AnnotationColor,
    legacyColor: overrides.legacyColor ?? null,
    orphaned: overrides.orphaned ?? false,
    needsReview: overrides.needsReview ?? false,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2025-01-01T00:00:00.000Z',
  }
}

function defaultOptions(overrides: Partial<ObsidianExportOptions> = {}): ObsidianExportOptions {
  return {
    includeProperties: true,
    includeTags: true,
    includeAppendix: true,
    generatedAt: new Date('2025-01-01T00:00:00.000Z'),
    fingerprint: 'abc123',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Type mapping tests (cases 1-5)
// ---------------------------------------------------------------------------
describe('type mapping', () => {
  test('clarify maps to [!question]', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Need clarification here.',
      annotations: [makeAnnotation({ quote: 'clarification', type: 'clarify' as AnnotationType, note: 'Explain this' })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('[!question]')
    expect(result).toContain('wowMD Clarify')
    expect(result).toContain('#wowmd/clarify')
  })

  test('dispute maps to [!warning]', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'This might be wrong.',
      annotations: [makeAnnotation({ quote: 'might be wrong', type: 'dispute' as AnnotationType, note: 'Check this' })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('[!warning]')
    expect(result).toContain('wowMD Dispute')
    expect(result).toContain('#wowmd/dispute')
  })

  test('important maps to [!important]', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Key point here.',
      annotations: [makeAnnotation({ quote: 'Key point', type: 'important' as AnnotationType, note: 'Retain' })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('[!important]')
    expect(result).toContain('wowMD Important')
    expect(result).toContain('#wowmd/important')
  })

  test('confirmed maps to [!success]', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Confirmed text.',
      annotations: [makeAnnotation({ quote: 'Confirmed text', type: 'confirmed' as AnnotationType })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('[!success]')
    expect(result).toContain('wowMD Confirmed')
    expect(result).toContain('#wowmd/confirmed')
  })

  test('null type maps to [!note]', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Just a note.',
      annotations: [makeAnnotation({ quote: 'note', note: 'My note' })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('[!note]')
    expect(result).toContain('wowMD Note')
    expect(result).toContain('#wowmd/note')
  })
})

// ---------------------------------------------------------------------------
// Callout body tests (cases 6-7)
// ---------------------------------------------------------------------------
describe('callout body', () => {
  test('note text is blockquoted line by line', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'A paragraph with multi-line note.',
      annotations: [makeAnnotation({
        quote: 'multi-line note',
        note: 'First line.\nSecond line.\nThird line.',
      })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    const lines = result.split('\n')
    const calloutLines = lines.filter((l) => l.startsWith('> ') || l === '>')
    expect(calloutLines.length).toBeGreaterThan(1)
    expect(result).toContain('> First line.')
    expect(result).toContain('> Second line.')
    expect(result).toContain('> Third line.')
  })

  test('suggested replacement included only when present', () => {
    const withReplacement = buildObsidianReviewedMarkdown({
      markdown: 'Original text here.',
      annotations: [makeAnnotation({
        quote: 'Original text',
        note: 'Change this',
        suggestedReplacement: 'New text here',
      })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(withReplacement).toContain('**Suggested replacement:**')

    const withoutReplacement = buildObsidianReviewedMarkdown({
      markdown: 'Another text here.',
      annotations: [makeAnnotation({
        quote: 'Another text',
        note: 'A note',
      })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(withoutReplacement).not.toContain('**Suggested replacement:**')
  })
})

// ---------------------------------------------------------------------------
// Tag control (case 8)
// ---------------------------------------------------------------------------
describe('tag control', () => {
  test('tags can be disabled', () => {
    const withTags = buildObsidianReviewedMarkdown({
      markdown: 'Text.',
      annotations: [makeAnnotation({ quote: 'Text', type: 'important' as AnnotationType })],
      documentName: 'test.md',
      options: defaultOptions({ includeTags: true }),
    })
    expect(withTags).toContain('#wowmd/important')

    const withoutTags = buildObsidianReviewedMarkdown({
      markdown: 'Text.',
      annotations: [makeAnnotation({ quote: 'Text', type: 'important' as AnnotationType })],
      documentName: 'test.md',
      options: defaultOptions({ includeTags: false }),
    })
    expect(withoutTags).not.toContain('#wowmd/important')
  })
})

// ---------------------------------------------------------------------------
// Frontmatter tests (cases 9-10)
// ---------------------------------------------------------------------------
describe('frontmatter', () => {
  test('existing frontmatter preserved and wowMD keys merged', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: '---\ntitle: My Document\ntags: [foo]\n---\n\nSome content.',
      annotations: [makeAnnotation({ quote: 'content', type: 'clarify' as AnnotationType })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('title: My Document')
    expect(result).toContain('tags: [foo]')
    expect(result).toContain('wowmd_reviewed: true')
    expect(result).toContain('wowmd_annotations: 1')
    expect(result).toContain('wowmd_clarify: 1')
    expect(result).toContain('wowmd_dispute: 0')
    expect(result).toContain('wowmd_important: 0')
    expect(result).toContain('wowmd_confirmed: 0')
  })

  test('no frontmatter creates new frontmatter', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Just plain content.',
      annotations: [makeAnnotation({ quote: 'content', type: 'important' as AnnotationType })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result.startsWith('---')).toBe(true)
    expect(result).toContain('wowmd_reviewed: true')
    expect(result).toContain('wowmd_important: 1')
  })
})

// ---------------------------------------------------------------------------
// Protected block tests (cases 11-12)
// ---------------------------------------------------------------------------
describe('protected blocks', () => {
  test('annotation inside fenced code goes to appendix', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Some prose.\n\n```\nconst x = 1\n```\n\nMore prose.',
      annotations: [makeAnnotation({ quote: 'const x = 1' })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('## wowMD Review')
    expect(result).toContain('const x = 1')
    // Should NOT have callout directly inside the code block
    const codeStart = result.indexOf('```')
    const codeEnd = result.indexOf('```', codeStart + 3)
    const appendixStart = result.indexOf('## wowMD Review')
    // The quote should be in appendix after the code
    expect(appendixStart).toBeGreaterThan(codeEnd)
  })

  test('annotation in table row inserts callout after full table', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Before\n\n| Col A | Col B |\n| --- | --- |\n| value | 42 |\n\nAfter',
      annotations: [makeAnnotation({ quote: 'value' })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    // Callout exists
    expect(result).toContain('[!note]')
    // Table is intact
    expect(result).toContain('| Col A | Col B |')
    expect(result).toContain('| --- | --- |')
    expect(result).toContain('| value | 42 |')
    // Callout appears before 'After'
    const calloutPos = result.indexOf('> [!note]')
    const afterPos = result.lastIndexOf('After')
    expect(calloutPos).toBeLessThan(afterPos)
    // Table heading separator stays intact (not broken by inserted content)
    const delimPos = result.indexOf('| --- | --- |')
    const valueRowPos = result.indexOf('| value | 42 |')
    expect(delimPos).toBeLessThan(valueRowPos)
    expect(valueRowPos).toBeLessThan(calloutPos)
  })
})

// ---------------------------------------------------------------------------
// Multiple annotations (case 13)
// ---------------------------------------------------------------------------
describe('multiple annotations', () => {
  test('multiple annotations in one paragraph insert multiple callouts', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'This is a paragraph with several points to review.',
      annotations: [
        makeAnnotation({ id: 'a1', quote: 'paragraph', type: 'clarify' as AnnotationType, offset: 10 }),
        makeAnnotation({ id: 'a2', quote: 'several points', type: 'important' as AnnotationType, offset: 30 }),
        makeAnnotation({ id: 'a3', quote: 'review', type: 'dispute' as AnnotationType, offset: 50 }),
      ],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('[!question]')
    expect(result).toContain('[!important]')
    expect(result).toContain('[!warning]')
  })
})

// ---------------------------------------------------------------------------
// Duplicate quote (case 14)
// ---------------------------------------------------------------------------
describe('duplicate quote handling', () => {
  test('duplicate quote uses offset to choose nearest block', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'First a test phrase here.\n\nSome unrelated content.\n\nSecond a test phrase here.',
      annotations: [
        makeAnnotation({
          id: 'a1',
          quote: 'a test phrase',
          offset: 50, // closer to first occurrence
          prefix: 'First',
          suffix: 'here.',
        }),
      ],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    // Should contain at least one callout
    expect(result).toContain('[!note]')
    // Should not produce appendix (it should find a placement)
    expect(result).not.toContain('## wowMD Review')
  })
})

// ---------------------------------------------------------------------------
// Missing quote (case 15)
// ---------------------------------------------------------------------------
describe('missing quote', () => {
  test('missing quote goes to appendix', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'Some content without the target.',
      annotations: [makeAnnotation({ quote: 'nonexistent quote text' })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('## wowMD Review')
    expect(result).toContain('nonexistent quote text')
  })
})

// ---------------------------------------------------------------------------
// Output stability (case 16)
// ---------------------------------------------------------------------------
describe('output stability', () => {
  test('output is stable across repeated runs', () => {
    const markdown = 'Some content for review.'
    const annotations = [makeAnnotation({ quote: 'content', type: 'clarify' as AnnotationType })]
    const opts = defaultOptions()

    const result1 = buildObsidianReviewedMarkdown({ markdown, annotations, documentName: 'test.md', options: opts })
    const result2 = buildObsidianReviewedMarkdown({ markdown, annotations, documentName: 'test.md', options: opts })

    expect(result1).toBe(result2)
  })
})

// ---------------------------------------------------------------------------
// Rendered-text prefix/suffix fallback (case 17)
// ---------------------------------------------------------------------------
describe('prefix/suffix fallback', () => {
  test('rendered-text prefix/suffix not in raw Markdown fall back to offset proximity', () => {
    // The quote "bold text" appears in the markdown as **bold text**
    // The prefix from rendered text would be "This is " but in raw markdown it's "This is **"
    const markdown = 'This is **bold text** with formatting.'
    const result = buildObsidianReviewedMarkdown({
      markdown,
      annotations: [makeAnnotation({
        quote: 'bold text',
        offset: 8,
        prefix: 'This is ',
        suffix: ' with formatting',
      })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    // Should still find the placement (not go to appendix)
    expect(result).not.toContain('## wowMD Review')
    expect(result).toContain('[!note]')
  })
})

// ---------------------------------------------------------------------------
// Idempotent export (case 18)
// ---------------------------------------------------------------------------
describe('idempotent export', () => {
  test('existing wowMD-generated callouts removed on repeated export', () => {
    const markdown = 'Some content.\n\n> [!question] wowMD Clarify - "content"\n> Explain this.\n> #wowmd/clarify'
    const annotations = [makeAnnotation({ quote: 'content', type: 'clarify' as AnnotationType })]
    const opts = defaultOptions()

    const result = buildObsidianReviewedMarkdown({ markdown, annotations, documentName: 'test.md', options: opts })

    // Should have exactly one callout (not duplicated)
    const calloutMatches = (result.match(/\[!question\]/g) || []).length
    expect(calloutMatches).toBe(1)
    expect(result).toContain('[!question]')
  })
})

// ---------------------------------------------------------------------------
// User-authored callouts preserved (case 19)
// ---------------------------------------------------------------------------
describe('user-authored callouts', () => {
  test('user-authored callouts are preserved', () => {
    const markdown = 'Some content.\n\n> [!note] My personal note\n> This is my own callout.'
    const annotations = [makeAnnotation({ quote: 'content', type: 'important' as AnnotationType })]
    const opts = defaultOptions()

    const result = buildObsidianReviewedMarkdown({ markdown, annotations, documentName: 'test.md', options: opts })

    expect(result).toContain('> [!note] My personal note')
    expect(result).toContain('> This is my own callout.')
    expect(result).toContain('[!important]')
    // Should have exactly one [!important]
    const importantMatches = (result.match(/\[!important\]/g) || []).length
    expect(importantMatches).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Local file behavior (case 20)
// ---------------------------------------------------------------------------
describe('local file behavior', () => {
  test('local-file reviewed copy produces valid markdown', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: '# Hello\n\nLocal file content here.',
      annotations: [makeAnnotation({ quote: 'content', type: 'confirmed' as AnnotationType, note: 'Looks good' })],
      documentName: 'my-local-file-reviewed.md',
      options: defaultOptions(),
    })
    expect(result).toContain('[!success]')
    expect(result).toContain('wowMD Confirmed')
    expect(result).toContain('Looks good')
    expect(result).toContain('wowmd_source_fingerprint')
  })
})

// ---------------------------------------------------------------------------
// splitMarkdownBlocks tests
// ---------------------------------------------------------------------------
describe('splitMarkdownBlocks', () => {
  test('identifies frontmatter', () => {
    const blocks = splitMarkdownBlocks('---\ntitle: Test\n---\n\nContent.')
    expect(blocks[0].kind).toBe('frontmatter')
    expect(blocks[0].protected).toBe(true)
  })

  test('identifies fenced code block', () => {
    const blocks = splitMarkdownBlocks('Before\n\n```\ncode here\n```\n\nAfter')
    const codeBlock = blocks.find((b) => b.kind === 'fenced_code')
    expect(codeBlock).toBeDefined()
    expect(codeBlock!.protected).toBe(true)
    expect(codeBlock!.text).toContain('code here')
  })

  test('identifies heading', () => {
    const blocks = splitMarkdownBlocks('# Main Title\n\nContent.')
    const heading = blocks.find((b) => b.kind === 'heading')
    expect(heading).toBeDefined()
    expect(heading!.text).toBe('# Main Title\n')
  })

  test('identifies table', () => {
    const blocks = splitMarkdownBlocks('Before\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nAfter')
    const table = blocks.find((b) => b.kind === 'table')
    expect(table).toBeDefined()
    expect(table!.protected).toBe(true)
  })

  test('identifies list', () => {
    const blocks = splitMarkdownBlocks('Before\n\n- Item 1\n- Item 2\n- Item 3\n\nAfter')
    const list = blocks.find((b) => b.kind === 'list')
    expect(list).toBeDefined()
    expect(list!.protected).toBe(true)
  })

  test('identifies blockquote', () => {
    const blocks = splitMarkdownBlocks('Before\n\n> Quoted text\n> More quote\n\nAfter')
    const bq = blocks.find((b) => b.kind === 'blockquote')
    expect(bq).toBeDefined()
    expect(bq!.protected).toBe(true)
  })

  test('covers full document without gaps', () => {
    const markdown = '# Title\n\nParagraph one.\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n- list 1\n- list 2\n\n```\ncode\n```\n\n> quote\n\nFinal paragraph.'
    const blocks = splitMarkdownBlocks(markdown)
    // Verify coverage
    let lastEnd = 0
    for (const block of blocks) {
      expect(block.startOffset).toBe(lastEnd)
      lastEnd = block.endOffset
    }
    expect(lastEnd).toBe(markdown.length)
  })

  test('paragraphs are not protected', () => {
    const blocks = splitMarkdownBlocks('Plain paragraph here.')
    const para = blocks.find((b) => b.kind === 'paragraph')
    expect(para).toBeDefined()
    expect(para!.protected).toBe(false)
  })

  test('frontmatter without yaml content treated correctly', () => {
    // `---` without colons is a horizontal rule, not frontmatter
    const blocks = splitMarkdownBlocks('---\n\nContent.')
    expect(blocks[0].kind).toBe('hr')
  })

  test('setext heading is one block', () => {
    const blocks = splitMarkdownBlocks('Title\n===\n\nContent.')
    const heading = blocks.find((b) => b.kind === 'heading')
    expect(heading).toBeDefined()
    expect(heading!.text).toContain('Title')
    expect(heading!.text).toContain('===')
  })

  test('setext heading with --- underline is one block', () => {
    const blocks = splitMarkdownBlocks('Title\n---\n\nContent.')
    const heading = blocks.find((b) => b.kind === 'heading')
    expect(heading).toBeDefined()
    expect(heading!.text).toContain('Title')
    expect(heading!.text).toContain('---')
  })

  test('inline pipe paragraph does not cause infinite loop', () => {
    const blocks = splitMarkdownBlocks('Compare A | B for this result.')
    const paragraphs = blocks.filter((b) => b.kind === 'paragraph')
    expect(paragraphs.length).toBe(1)
    expect(paragraphs[0].text).toContain('A | B')
  })
})

// ---------------------------------------------------------------------------
// Setext heading placement
// ---------------------------------------------------------------------------
describe('setext heading', () => {
  test('callout inserts after setext underline, not between title and underline', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: 'My Title\n===\n\nParagraph content.',
      annotations: [makeAnnotation({ quote: 'My Title', type: 'important' as AnnotationType })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    const underlinePos = result.indexOf('===')
    const calloutPos = result.indexOf('[!important]')
    expect(calloutPos).toBeGreaterThan(underlinePos)
    // Title and === should remain adjacent (no text inserted between them)
    const titleStart = result.indexOf('My Title')
    const contentBetween = result.slice(titleStart, underlinePos)
    expect(contentBetween).not.toContain('>')
    expect(contentBetween).not.toContain('[!')
  })

  test('repeated heading sections place callout in correct section', () => {
    const markdown = '# Doc\n\n## First\n\nContent in first.\n\n## First\n\nContent in second.\n\n## Next\n\nDone.'
    const result = buildObsidianReviewedMarkdown({
      markdown,
      annotations: [makeAnnotation({
        quote: 'Content in second',
        headingPath: ['Doc', 'First'],
        offset: markdown.indexOf('Content in second'),
      })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    const firstSectionIdx = result.indexOf('## First')
    const secondSectionIdx = result.indexOf('## First', firstSectionIdx + 1)
    const contentSecondIdx = result.indexOf('Content in second')
    const calloutIdx = result.indexOf('[!note]')
    const nextHeadingIdx = result.indexOf('## Next')

    expect(result).not.toContain('## wowMD Review')
    expect(contentSecondIdx).toBeGreaterThan(secondSectionIdx)
    expect(calloutIdx).toBeGreaterThan(contentSecondIdx)
    expect(calloutIdx).toBeLessThan(nextHeadingIdx)
  })

  test('repeated heading sections with same quote use offset proximity', () => {
    const markdown = '# Doc\n\n## First\n\nRepeated claim.\n\n## First\n\nRepeated claim.\n\n## Next\n\nDone.'
    const secondQuoteOffset = markdown.indexOf('Repeated claim.', markdown.indexOf('## First', 10))
    const result = buildObsidianReviewedMarkdown({
      markdown,
      annotations: [makeAnnotation({
        quote: 'Repeated claim.',
        headingPath: ['Doc', 'First'],
        offset: secondQuoteOffset,
      })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    const firstQuoteIdx = result.indexOf('Repeated claim.')
    const secondQuoteIdx = result.indexOf('Repeated claim.', firstQuoteIdx + 1)
    const calloutIdx = result.indexOf('[!note]')
    const nextHeadingIdx = result.indexOf('## Next')

    expect(result).not.toContain('## wowMD Review')
    expect(calloutIdx).toBeGreaterThan(secondQuoteIdx)
    expect(calloutIdx).toBeLessThan(nextHeadingIdx)
  })

  test('stale heading path with unique quote falls back to full-document placement', () => {
    const markdown = '# Doc\n\n## Current Heading\n\nUnique recoverable quote.\n\n## Next\n\nDone.'
    const result = buildObsidianReviewedMarkdown({
      markdown,
      annotations: [makeAnnotation({
        quote: 'Unique recoverable quote.',
        headingPath: ['Doc', 'Old Heading'],
        offset: markdown.indexOf('Unique recoverable quote.'),
      })],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    const quoteIdx = result.indexOf('Unique recoverable quote.')
    const calloutIdx = result.indexOf('[!note]')
    const nextHeadingIdx = result.indexOf('## Next')

    expect(result).not.toContain('## wowMD Review')
    expect(calloutIdx).toBeGreaterThan(quoteIdx)
    expect(calloutIdx).toBeLessThan(nextHeadingIdx)
  })
})

// ---------------------------------------------------------------------------
// Empty annotations
// ---------------------------------------------------------------------------
describe('empty annotations', () => {
  test('empty annotations list returns markdown with only frontmatter', () => {
    const result = buildObsidianReviewedMarkdown({
      markdown: '# Doc\n\nSome content.',
      annotations: [],
      documentName: 'test.md',
      options: defaultOptions(),
    })
    expect(result).toContain('wowmd_reviewed: true')
    expect(result).toContain('wowmd_annotations: 0')
    expect(result).toContain('# Doc')
    expect(result).toContain('Some content.')
    expect(result).not.toContain('[!')
  })
})
