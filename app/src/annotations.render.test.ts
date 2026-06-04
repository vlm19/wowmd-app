/**
 * @vitest-environment jsdom
 */
import { describe, expect, test } from 'vitest'
import { applyAnnotationHighlights, createAnnotation } from './annotations'

function highlightHtml(html: string, quote?: string) {
  const probe = new DOMParser().parseFromString(html, 'text/html')
  const selectedQuote = quote ?? (probe.body.textContent || '').trim()
  const annotation = createAnnotation({
    documentFingerprint: 'doc',
    quote: selectedQuote,
    offset: 0,
    color: 'amber',
    type: 'important',
  })
  const highlighted = applyAnnotationHighlights(html, [annotation])
  return new DOMParser().parseFromString(highlighted, 'text/html')
}

function expectValidHighlightStructure(doc: Document) {
  const marks = Array.from(doc.body.querySelectorAll('mark'))
  expect(marks.length).toBeGreaterThan(0)
  expect(marks.some((mark) => (mark.textContent || '').trim() === '')).toBe(false)
  expect(doc.body.querySelectorAll('ul > mark, ol > mark, table > mark, thead > mark, tbody > mark, tr > mark').length).toBe(0)
}

describe('applyAnnotationHighlights', () => {
  test('does not wrap whitespace-only nodes when a long selection spans list items', () => {
    const html = `
      <p>Core capabilities:</p>
      <ul>
        <li>Open <code>.md</code> and <code>.markdown</code> files by picker or drag-and-drop.</li>
        <li>Open public GitHub Markdown from the extension handoff/import route.</li>
        <li>Read with outline navigation, search, code highlighting, code copy, table scrolling, section folding, light/dark themes, and adjustable reader sizes.</li>
      </ul>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('keeps structure when selection spans paragraph to list', () => {
    const html = `
      <p>Core capabilities:</p>
      <ul>
        <li>Open local Markdown files.</li>
        <li>Export reviewed Markdown for Obsidian.</li>
      </ul>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('keeps structure when selection spans list to paragraph', () => {
    const html = `
      <ul>
        <li>Mark important claims.</li>
        <li>Keep review comments anchored.</li>
      </ul>
      <p>Then export a clean reviewed copy.</p>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('keeps heading and paragraph selection valid', () => {
    const html = `
      <h2>Review workflow</h2>
      <p>Select text, add a typed mark, and keep the original Markdown untouched.</p>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('keeps blockquote selection valid', () => {
    const html = `
      <blockquote>
        <p>Review this claim before it enters the knowledge base.</p>
        <p>Keep annotations visible but non-destructive.</p>
      </blockquote>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('keeps table selection valid', () => {
    const html = `
      <table>
        <thead><tr><th>Output</th><th>Use</th></tr></thead>
        <tbody>
          <tr><td>HTML</td><td>People</td></tr>
          <tr><td>Reviewed Markdown</td><td>Obsidian</td></tr>
        </tbody>
      </table>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('handles inline code without structural whitespace marks', () => {
    const html = `
      <p>Open <code>.md</code> and <code>.markdown</code> files, then save a reviewed copy.</p>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('handles mixed language punctuation emoji and repeated spacing', () => {
    const html = `
      <p>中文、English, emoji 🚀, and    repeated spaces stay readable.</p>
      <p>标注 important 后，排版不应该被破坏。</p>
    `
    expectValidHighlightStructure(highlightHtml(html))
  })

  test('matches normalized whitespace without wrapping separator whitespace', () => {
    const html = `
      <p>Alpha
        beta <strong>gamma</strong> delta.</p>
    `
    expectValidHighlightStructure(highlightHtml(html, 'Alpha beta gamma delta.'))
  })
})
