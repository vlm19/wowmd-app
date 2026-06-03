import type { Annotation } from './annotations'

export type ObsidianExportOptions = {
  includeProperties: boolean
  includeTags: boolean
  includeAppendix: boolean
  generatedAt: Date
  fingerprint: string
}

export type MarkdownBlockKind =
  | 'frontmatter'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'blockquote'
  | 'fenced_code'
  | 'indented_code'
  | 'html'
  | 'hr'
  | 'blank'

export type MarkdownBlock = {
  kind: MarkdownBlockKind
  startLine: number
  endLine: number
  startOffset: number
  endOffset: number
  text: string
  protected: boolean
}

type MarkdownSection = {
  start: number
  end: number
  headingStart: number
  headingEnd: number
  level: number
  path: string[]
}

const CALLBACK_TYPE_MAP: Record<string, string> = {
  clarify: 'question',
  dispute: 'warning',
  important: 'important',
  confirmed: 'success',
}

const CALLBACK_TITLE_MAP: Record<string, string> = {
  clarify: 'wowMD Clarify',
  dispute: 'wowMD Dispute',
  important: 'wowMD Important',
  confirmed: 'wowMD Confirmed',
}

function mapAnnotationTypeToObsidian(type: string | null): { callout: string; title: string; tag: string } {
  if (type && type in CALLBACK_TYPE_MAP) {
    return {
      callout: CALLBACK_TYPE_MAP[type],
      title: CALLBACK_TITLE_MAP[type],
      tag: `#wowmd/${type}`,
    }
  }
  return { callout: 'note', title: 'wowMD Note', tag: '#wowmd/note' }
}

function shortenQuote(quote: string, maxLen = 80): { short: string; truncated: boolean } {
  const normalized = quote.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLen) return { short: normalized, truncated: false }
  return { short: normalized.slice(0, maxLen) + '...', truncated: true }
}

function escapeCalloutQuote(quote: string): string {
  return quote.replace(/"/g, '\'')
}

function escapeBlockquoteLine(text: string): string {
  return text
}

function buildCallout(
  annotation: Annotation,
  options: { includeTags: boolean },
): string {
  const { callout, title } = mapAnnotationTypeToObsidian(annotation.type)
  const { short, truncated } = shortenQuote(annotation.quote)
  const safeQuote = escapeCalloutQuote(short)

  const lines: string[] = []
  lines.push(`> [!${callout}] ${title} - "${safeQuote}"`)

  if (truncated) {
    const fullQuote = annotation.quote.replace(/\s+/g, ' ').trim()
    for (const line of wrapText(`> Full quote: "${escapeCalloutQuote(fullQuote)}"`)) {
      lines.push(line)
    }
  }

  if (annotation.note) {
    const noteLines = annotation.note.split('\n')
    for (const noteLine of noteLines) {
      const trimmed = noteLine.trim()
      if (trimmed) {
        lines.push(`> ${escapeBlockquoteLine(trimmed)}`)
      } else {
        lines.push('>')
      }
    }
  }

  if (annotation.suggestedReplacement) {
    const repl = annotation.suggestedReplacement.trim()
    if (repl) {
      const replFirstLine = repl.split('\n')[0]
      lines.push(`> **Suggested replacement:** ${escapeBlockquoteLine(replFirstLine)}`)
      const remainder = repl.split('\n').slice(1)
      for (const rline of remainder) {
        if (rline.trim()) {
          lines.push(`> ${escapeBlockquoteLine(rline.trim())}`)
        } else {
          lines.push('>')
        }
      }
    }
  }

  if (options.includeTags) {
    lines.push(`> ${mapAnnotationTypeToObsidian(annotation.type).tag}`)
  }

  return lines.join('\n')
}

function findAllOccurrences(text: string, query: string): number[] {
  const indices: number[] = []
  let start = 0
  while (start < text.length) {
    const idx = text.indexOf(query, start)
    if (idx < 0) break
    indices.push(idx)
    start = idx + 1
  }
  return indices
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function stripFormatting(markdown: string): string {
  let text = markdown
  text = text.replace(/[*_]{1,2}(.+?)[*_]{1,2}/g, '$1')
  text = text.replace(/`{1,3}[^`]*`{1,3}/g, '')
  text = text.replace(/\[(.+?)\]\(.+?\)/g, '$1')
  text = text.replace(/!\[.*?\]\(.+?\)/g, '')
  text = text.replace(/^#{1,6}\s+/gm, '')
  text = text.replace(/^>\s?/gm, '')
  text = text.replace(/^\s*[-*+]\s+/gm, '')
  text = text.replace(/^\s*\d+\.\s+/gm, '')
  text = text.replace(/<[^>]+>/g, '')
  text = text.replace(/\|/g, ' ')
  return text
}

function findQuoteInMarkdown(
  markdown: string,
  annotation: Annotation,
  scope: { start: number; end: number },
): number | null {
  const quote = annotation.quote.trim()
  if (!quote) return null

  const scopedText = markdown.slice(scope.start, scope.end)

  // Step 4: Exact quote match
  let matches = findAllOccurrences(scopedText, quote).map((i) => scope.start + i)

  if (matches.length === 0) {
    // Step 5: Whitespace-normalized quote match
    const normalizedQuote = normalizeWhitespace(quote)
    const strippedScope = stripFormatting(scopedText)
    const normalizedScope = normalizeWhitespace(strippedScope)

    matches = findAllOccurrences(normalizedScope, normalizedQuote)

    if (matches.length > 0) {
      matches = matches.map((approxOffset) => {
        let pos = 0
        let normalizedIdx = 0
        while (pos < scopedText.length && normalizedIdx < approxOffset) {
          const ch = scopedText[pos]
          if (/\s/.test(ch)) {
            pos++
          } else {
            pos++
            normalizedIdx++
          }
        }
        return scope.start + pos
      })
    }
  }

  if (matches.length === 0) return null

  if (matches.length === 1) return matches[0]

  // Step 6: Disambiguate using prefix/suffix in raw Markdown source
  return disambiguateByContext(markdown, matches, annotation)
}

function disambiguateByContext(
  markdown: string,
  matchOffsets: number[],
  annotation: Annotation,
): number | null {
  const quoteLen = annotation.quote.trim().length

  // Score each match by prefix/suffix presence in raw markdown
  let bestOffset: number | null = null
  let bestScore = -1

  for (const offset of matchOffsets) {
    const prefix = annotation.prefix.trim()
    const suffix = annotation.suffix.trim()

    let score = 0

    if (prefix) {
      const before = markdown.slice(Math.max(0, offset - prefix.length - 20), offset)
      if (before.includes(prefix) || stripFormatting(before).includes(normalizeWhitespace(prefix))) {
        score += 1
      }
    }

    if (suffix) {
      const after = markdown.slice(offset + quoteLen, offset + quoteLen + suffix.length + 20)
      if (after.includes(suffix) || stripFormatting(after).includes(normalizeWhitespace(suffix))) {
        score += 1
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestOffset = offset
    }
  }

  // If context helped, use it
  if (bestScore > 0 && bestOffset != null) return bestOffset

  // Step 7: Fall back to offset-proximity
  return matchOffsets.reduce((closest, current) =>
    Math.abs(current - annotation.offset) < Math.abs(closest - annotation.offset) ? current : closest,
  )
}

function collectHeadingSections(markdown: string): MarkdownSection[] {
  const lines = markdown.split('\n')
  const headingRegex = /^(#{1,6})\s+(.+)/
  const headings: Array<Omit<MarkdownSection, 'end'>> = []
  const stack: string[] = []
  let runningOffset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const match = line.match(headingRegex)
    let heading: { level: number; text: string; headingStart: number; headingEnd: number } | null = null

    if (match) {
      heading = {
        level: match[1].length,
        text: match[2].trim(),
        headingStart: runningOffset,
        headingEnd: lineEndOffset(lines, i, runningOffset),
      }
    } else if (isSetextHeadingAt(lines, i)) {
      heading = {
        level: lines[i + 1].trim().startsWith('=') ? 1 : 2,
        text: trimmed,
        headingStart: runningOffset,
        headingEnd: lineEndOffset(lines, i + 1, runningOffset + line.length + 1),
      }
    }

    if (heading) {
      stack.length = heading.level - 1
      stack[heading.level - 1] = heading.text
      headings.push({
        start: heading.headingEnd,
        headingStart: heading.headingStart,
        headingEnd: heading.headingEnd,
        level: heading.level,
        path: stack.filter(Boolean),
      })

      if (isSetextHeadingAt(lines, i)) {
        runningOffset = heading.headingEnd
        i++
      } else {
        runningOffset = heading.headingEnd
      }
      continue
    }

    runningOffset = lineEndOffset(lines, i, runningOffset)
  }

  return headings.map((heading, index) => {
    const nextBoundary = headings
      .slice(index + 1)
      .find((candidate) => candidate.level <= heading.level)
    return {
      ...heading,
      end: nextBoundary?.headingStart ?? markdown.length,
    }
  })
}

function findSectionsByHeadingPath(markdown: string, headingPath: string[]): MarkdownSection[] {
  const normalizedPath = headingPath.map((part) => part.trim()).filter(Boolean)
  if (!normalizedPath.length) return []

  const sections = collectHeadingSections(markdown)
  const exactMatches = sections.filter((section) =>
    section.path.length === normalizedPath.length &&
    section.path.every((part, index) => part === normalizedPath[index]),
  )

  if (exactMatches.length > 0) return exactMatches

  const target = normalizedPath[normalizedPath.length - 1]
  return sections.filter((section) => section.path[section.path.length - 1] === target)
}

function findBestQuoteOffset(
  markdown: string,
  annotation: Annotation,
): number | null {
  if (annotation.headingPath.length > 0) {
    const sectionMatches = findSectionsByHeadingPath(markdown, annotation.headingPath)
      .map((section) => findQuoteInMarkdown(markdown, annotation, section))
      .filter((offset): offset is number => offset != null)

    if (sectionMatches.length > 0) {
      return sectionMatches.reduce((closest, current) =>
        Math.abs(current - annotation.offset) < Math.abs(closest - annotation.offset) ? current : closest,
      )
    }
  }

  return findQuoteInMarkdown(markdown, annotation, { start: 0, end: markdown.length })
}

export function splitMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []
  const lines = markdown.split('\n')
  let i = 0

  function makeBlock(kind: MarkdownBlockKind, startLine: number, endLine: number, isProtected: boolean): MarkdownBlock {
    const startOffset = computeOffset(lines, startLine)
    const endOffset = computeOffset(lines, endLine + 1)
    const text = markdown.slice(startOffset, endOffset)
    return { kind, startLine, endLine, startOffset, endOffset, text, protected: isProtected }
  }

  // Frontmatter detection
  if (lines.length > 0 && lines[0].trim() === '---') {
    const frontmatterLines = [lines[0]]
    let j = 1
    let isFrontmatter = false
    while (j < lines.length) {
      const line = lines[j]
      frontmatterLines.push(line)
      if (line.trim() === '---' || line.trim() === '...') {
        const content = frontmatterLines.join('\n')
        if (looksLikeFrontmatter(content)) {
          isFrontmatter = true
          j++
        }
        break
      }
      if (line.includes(':')) isFrontmatter = true
      j++
    }

    if (isFrontmatter) {
      blocks.push(makeBlock('frontmatter', 0, j - 1, true))
      i = j
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed === '') {
      blocks.push(makeBlock('blank', i, i, false))
      i++
      continue
    }

    // Fenced code block
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      const fenceMarker = trimmed.match(/^(`{3,}|~{3,})/)![1]
      const fenceChar = fenceMarker[0]
      const fenceLen = fenceMarker.length
      let j = i + 1
      while (j < lines.length) {
        const fline = lines[j].trim()
        if (fline.startsWith(fenceChar.repeat(fenceLen)) && fline.replace(fenceChar.repeat(fenceLen), '').trim() === '') {
          j++
          break
        }
        j++
      }
      blocks.push(makeBlock('fenced_code', i, j - 1, true))
      i = j
      continue
    }

    // Heading
    if (/^#{1,6}\s/.test(trimmed)) {
      blocks.push(makeBlock('heading', i, i, false))
      i++
      continue
    }

    // HR
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed)) {
      blocks.push(makeBlock('hr', i, i, true))
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('>')) {
      let j = i
      while (j < lines.length && (lines[j].startsWith('>') || (j > i && lines[j].trim() === '' && j + 1 < lines.length && lines[j + 1].startsWith('>')))) {
        j++
      }
      blocks.push(makeBlock('blockquote', i, j - 1, true))
      i = j
      continue
    }

    // Table detection
    if (isTableLine(trimmed)) {
      let j = i + 1
      let hasDelimiter = isTableDelimiter(trimmed)
      while (j < lines.length) {
        const tline = lines[j].trim()
        if (isTableLine(tline)) {
          if (isTableDelimiter(tline)) hasDelimiter = true
          j++
        } else {
          break
        }
      }
      if (hasDelimiter && j > i + 1) {
        blocks.push(makeBlock('table', i, j - 1, true))
        i = j
        continue
      }
    }

    // List
    if (isListItem(line)) {
      let j = i
      while (j < lines.length) {
        const lline = lines[j]
        if (isListItem(lline) || (j > i && lline.trim() !== '' && (lline.startsWith('  ') || lline.startsWith('\t')))) {
          j++
        } else if (lline.trim() === '' && j + 1 < lines.length && isListItem(lines[j + 1])) {
          j++
        } else {
          break
        }
      }
      blocks.push(makeBlock('list', i, j - 1, true))
      i = j
      continue
    }

    // HTML block
    if (/^<[a-zA-Z]/.test(trimmed) || /^<!--/.test(trimmed)) {
      if (/^<!--/.test(trimmed)) {
        let j = i
        while (j < lines.length) {
          if (lines[j].includes('-->')) { j++; break }
          j++
        }
        blocks.push(makeBlock('html', i, j - 1, true))
        i = j
        continue
      }
      blocks.push(makeBlock('html', i, i, true))
      i++
      continue
    }

    // Indented code
    if (/^( {4}|\t)/.test(line) && !isListItem(line)) {
      let j = i
      while (j < lines.length && (/^( {4}|\t)/.test(lines[j]) || lines[j].trim() === '')) {
        j++
      }
      blocks.push(makeBlock('indented_code', i, j - 1, true))
      i = j
      continue
    }

    // Setext heading
    if (isSetextHeadingAt(lines, i)) {
      blocks.push(makeBlock('heading', i, i + 1, false))
      i += 2
      continue
    }

    // Paragraph (collect consecutive non-structured lines)
    {
      let j = i
      while (j < lines.length) {
        const pline = lines[j].trim()
        if (pline === '') break
        if (isStructuredLine(lines[j])) break
        j++
      }
      blocks.push(makeBlock('paragraph', i, j - 1, false))
      i = j
    }
  }

  return blocks
}

function computeOffset(lines: string[], upToLine: number): number {
  let offset = 0
  for (let k = 0; k < upToLine; k++) {
    offset += lines[k].length
    if (k + 1 < lines.length) {
      offset += 1
    }
  }
  return offset
}

function lineEndOffset(lines: string[], lineIndex: number, lineStartOffset: number): number {
  return lineStartOffset + lines[lineIndex].length + (lineIndex + 1 < lines.length ? 1 : 0)
}

function isTableLine(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('|') || trimmed.endsWith('|') || trimmed.includes(' | ')
}

function isTableDelimiter(line: string): boolean {
  return /^\|?[\s:-]+\|[\s|:-]+\|?$/.test(line.trim())
}

function isListItem(line: string): boolean {
  return /^(\s*)([-*+]|\d+\.)\s/.test(line)
}

function isSetextHeadingAt(lines: string[], i: number): boolean {
  if (i + 1 >= lines.length) return false
  const current = lines[i].trim()
  const next = lines[i + 1].trim()
  if (current === '') return false
  if (isStructuredLine(lines[i])) return false
  return /^ {0,3}(=+|-+)\s*$/.test(next)
}

function isStructuredLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    /^`{3,}/.test(trimmed) ||
    /^~{3,}/.test(trimmed) ||
    /^#{1,6}\s/.test(trimmed) ||
    line.startsWith('>') ||
    isListItem(line) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(trimmed) ||
    /^<[a-zA-Z]/.test(trimmed)
  )
}

function looksLikeFrontmatter(content: string): boolean {
  const lines = content.split('\n')
  let colonCount = 0
  for (let i = 1; i < lines.length - 1; i++) {
    if (lines[i].includes(':')) colonCount++
  }
  return colonCount >= 1
}

function isInsideFencedCodeBlock(
  markdown: string,
  offset: number,
): boolean {
  const fenceRegex = /^(`{3,}|~{3,})/gm
  let match: RegExpExecArray | null
  let inFence = false
  let fenceChar = ''
  let fenceLen = 0

  fenceRegex.lastIndex = 0
  const before = markdown.slice(0, offset + 1)

  match = fenceRegex.exec(before)
  while (match !== null) {
    if (!inFence) {
      inFence = true
      fenceChar = match[1][0]
      fenceLen = match[1].length
    } else {
      const line = before.slice(match.index).split('\n')[0]
      if (line.trim() === fenceChar.repeat(fenceLen)) {
        inFence = false
      }
    }
    match = fenceRegex.exec(before)
  }

  return inFence
}

function findPlacementBlock(
  annotation: Annotation,
  blocks: MarkdownBlock[],
  markdown: string,
): MarkdownBlock | null {
  const matchOffset = findBestQuoteOffset(markdown, annotation)
  if (matchOffset == null) return null

  // Check if inside fenced code
  if (isInsideFencedCodeBlock(markdown, matchOffset)) return null

  // Find containing block
  const containingBlock = blocks.find((b) =>
    b.startOffset <= matchOffset && matchOffset < b.endOffset,
  )

  if (!containingBlock) return null

  // Code-like blocks: quotes inside are not meaningful annotation targets → appendix
  if (
    containingBlock.kind === 'fenced_code' ||
    containingBlock.kind === 'indented_code' ||
    containingBlock.kind === 'html'
  ) {
    return null
  }

  // Structured blocks (tables, lists, blockquotes): callout goes after the entire block
  return containingBlock
}

function removeWowMdCallouts(markdown: string): string {
  const lines = markdown.split('\n')
  const result: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (/^>\s*\[!\w+\]\s+wowMD\s/i.test(line)) {
      // Start of a potential wowMD callout
      let j = i + 1
      let hasWowMdTag = line.includes('#wowmd/')
      while (j < lines.length && lines[j].startsWith('>')) {
        if (/#wowmd\//i.test(lines[j])) hasWowMdTag = true
        j++
      }
      if (hasWowMdTag) {
        // Skip blank line after callout if present
        if (j < lines.length && lines[j].trim() === '') j++
        i = j
        continue
      }
    }

    result.push(line)
    i++
  }

  return result.join('\n')
}

function removeWowMdFrontmatter(markdown: string): string {
  const lines = markdown.split('\n')
  if (lines.length === 0 || lines[0].trim() !== '---') return markdown

  let endIdx = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---' || lines[i].trim() === '...') {
      endIdx = i
      break
    }
  }

  if (endIdx < 0) return markdown

  // Check if this frontmatter looks well-formed
  let hasColon = false
  for (let i = 1; i < endIdx; i++) {
    if (lines[i].includes(':')) hasColon = true
  }

  if (!hasColon) return markdown

  const frontmatterLines = lines.slice(1, endIdx)
  const cleanedFrontmatter = frontmatterLines.filter(
    (line) => !/^wowmd_/.test(line.trim()),
  )

  if (cleanedFrontmatter.length === 0) {
    // Remove entire frontmatter
    return lines.slice(endIdx + 1).join('\n')
  }

  return ['---', ...cleanedFrontmatter, '---', ...lines.slice(endIdx + 1)].join('\n')
}

function addOrMergeFrontmatter(markdown: string, newProperties: Record<string, unknown>): string {
  if (Object.keys(newProperties).length === 0) return markdown

  const lines = markdown.split('\n')

  if (lines.length > 0 && lines[0].trim() === '---') {
    // Existing frontmatter
    let endIdx = -1
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---' || lines[i].trim() === '...') {
        endIdx = i
        break
      }
    }

    if (endIdx < 0) {
      // Malformed frontmatter — do not attempt repair
      return markdown
    }

    let hasColon = false
    for (let i = 1; i < endIdx; i++) {
      if (lines[i].includes(':')) hasColon = true
    }
    if (!hasColon) {
      // Doesn't look like frontmatter — treat as document content
      return markdown
    }

    const existingLines = lines.slice(1, endIdx)
    const existingKeys = new Set(
      existingLines.map((l) => l.split(':')[0].trim()),
    )

    const newLines: string[] = []
    for (const [key, value] of Object.entries(newProperties)) {
      if (!existingKeys.has(key)) {
        newLines.push(`${key}: ${JSON.stringify(value)}`)
      }
    }

    if (newLines.length === 0) return markdown

    return ['---', ...existingLines, ...newLines, '---', ...lines.slice(endIdx + 1)].join('\n')
  }

  // No existing frontmatter
  const fmLines = Object.entries(newProperties).map(
    ([key, value]) => `${key}: ${JSON.stringify(value)}`,
  )
  return ['---', ...fmLines, '---', '', ...lines].join('\n')
}

function buildAppendix(
  annotations: Annotation[],
  options: { includeTags: boolean },
): string {
  const callouts = annotations.map((a) => {
    let callout = buildCallout(a, options)
    if (a.headingPath.length > 0) {
      const sectionInfo = `> **Section:** ${a.headingPath.join(' > ')}`
      const lines = callout.split('\n')
      lines.splice(1, 0, sectionInfo)
      callout = lines.join('\n')
    }
    return callout
  })
  return callouts.join('\n\n')
}

function countByType(annotations: Annotation[]): Record<string, number> {
  const counts: Record<string, number> = {
    clarify: 0,
    dispute: 0,
    important: 0,
    confirmed: 0,
  }
  for (const a of annotations) {
    if (a.type && a.type in counts) {
      counts[a.type]++
    }
  }
  return counts
}

function wrapText(text: string): string[] {
  const result: string[] = []
  let remaining = text
  while (remaining.length > 80) {
    let breakPoint = remaining.lastIndexOf(' ', 80)
    if (breakPoint <= 0) breakPoint = 80
    result.push(remaining.slice(0, breakPoint))
    remaining = remaining.slice(breakPoint).trimStart()
  }
  if (remaining) result.push(remaining)
  return result
}

export function buildObsidianReviewedMarkdown(input: {
  markdown: string
  annotations: Annotation[]
  documentName: string
  options: ObsidianExportOptions
}): string {
  let markdown = input.markdown

  // Idempotent cleanup
  markdown = removeWowMdCallouts(markdown)
  markdown = removeWowMdFrontmatter(markdown)

  if (!input.annotations.length) {
    if (input.options.includeProperties) {
      const typeCounts = countByType(input.annotations)
      const properties: Record<string, unknown> = {
        wowmd_reviewed: true,
        wowmd_exported_at: input.options.generatedAt.toISOString(),
        wowmd_source_fingerprint: input.options.fingerprint,
        wowmd_annotations: input.annotations.length,
        wowmd_clarify: typeCounts.clarify,
        wowmd_dispute: typeCounts.dispute,
        wowmd_important: typeCounts.important,
        wowmd_confirmed: typeCounts.confirmed,
      }
      return addOrMergeFrontmatter(markdown, properties)
    }
    return markdown
  }

  // Split into immutable blocks
  const blocks = splitMarkdownBlocks(markdown)

  // Sort annotations by offset ascending
  const sortedAnnotations = [...input.annotations].sort((a, b) => a.offset - b.offset)

  // Compute all placements
  const placements: Array<{ annotation: Annotation; block: MarkdownBlock; callout: string }> = []
  const unplaced: Annotation[] = []

  for (const annotation of sortedAnnotations) {
    const block = findPlacementBlock(annotation, blocks, markdown)
    if (block) {
      placements.push({
        annotation,
        block,
        callout: buildCallout(annotation, { includeTags: input.options.includeTags }),
      })
    } else {
      unplaced.push(annotation)
    }
  }

  // Group placements by block
  const grouped = new Map<MarkdownBlock, typeof placements>()
  for (const p of placements) {
    const existing = grouped.get(p.block)
    if (existing) {
      existing.push(p)
    } else {
      grouped.set(p.block, [p])
    }
  }

  // Sort target blocks by endOffset descending for safe insertion
  const sortedBlocks = Array.from(grouped.keys()).sort((a, b) => b.endOffset - a.endOffset)

  // Insert callouts
  let result = markdown
  for (const block of sortedBlocks) {
    const blockPlacements = grouped.get(block)!
    const calloutText = blockPlacements.map((p) => p.callout).join('\n\n')
    result = result.slice(0, block.endOffset) + '\n' + calloutText + result.slice(block.endOffset)
  }

  // Build appendix
  if (unplaced.length > 0 && input.options.includeAppendix) {
    const appendixSection = '\n\n---\n\n## wowMD Review\n\n' + buildAppendix(unplaced, { includeTags: input.options.includeTags })
    result += appendixSection
  }

  // Merge frontmatter
  if (input.options.includeProperties) {
    const typeCounts = countByType(input.annotations)
    const properties: Record<string, unknown> = {
      wowmd_reviewed: true,
      wowmd_exported_at: input.options.generatedAt.toISOString(),
      wowmd_source_fingerprint: input.options.fingerprint,
      wowmd_annotations: input.annotations.length,
      wowmd_clarify: typeCounts.clarify,
      wowmd_dispute: typeCounts.dispute,
      wowmd_important: typeCounts.important,
      wowmd_confirmed: typeCounts.confirmed,
    }
    result = addOrMergeFrontmatter(result, properties)
  }

  return result
}
