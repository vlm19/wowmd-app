/**
 * @vitest-environment jsdom
 *
 * Realistic "annotation survives a new document version" scenarios.
 *
 * Each test annotates v1, then re-anchors against an edited v2 through the REAL
 * path (reanchorAgainstMarkdown → renderMarkdown → DOM text → reanchorAnnotationOffset),
 * and asserts the survival tier:
 *   exact   — quote relocated verbatim (incl. whitespace-only changes)
 *   context — quote reworded, position recovered via prefix/suffix (needs review)
 *   lost    — quote and its context both gone (orphaned)
 */
import { describe, expect, test } from 'vitest'
import { createAnnotation, type Annotation } from './annotations'
import { reanchorAgainstMarkdown } from './hooks/useAnnotations'
import { renderMarkdown } from './markdown'

const V1 = `# Quarterly Report

## Revenue

Revenue grew by 12% in Q3, driven mainly by enterprise contracts.
The team closed three major deals during the period.

## Risks

The supply chain remains fragile and could delay shipments.
We recommend hedging against currency fluctuation.
`

const Q_REV = 'Revenue grew by 12% in Q3'
const Q_SUPPLY = 'The supply chain remains fragile'
const Q_HEDGE = 'hedging against currency fluctuation'

function renderedTextOf(markdown: string): string {
  const probe = new DOMParser().parseFromString(renderMarkdown(markdown), 'text/html')
  return probe.body.textContent || ''
}

/** Build an annotation against v1 the way the app captures one (offset + surrounding context). */
function anchorOn(markdown: string, quote: string): Annotation {
  const text = renderedTextOf(markdown)
  const offset = text.indexOf(quote)
  if (offset < 0) throw new Error(`quote not present in source: ${quote}`)
  return createAnnotation({
    documentFingerprint: 'v1',
    quote,
    prefix: text.slice(Math.max(0, offset - 40), offset),
    suffix: text.slice(offset + quote.length, offset + quote.length + 40),
    offset,
    type: 'dispute',
  })
}

type Tier = 'exact' | 'context' | 'lost'
function tier(a: Annotation): Tier {
  return a.orphaned ? 'lost' : a.needsReview ? 'context' : 'exact'
}
function reanchor(items: Annotation[], v2: string): Annotation[] {
  return reanchorAgainstMarkdown(items, v2, 'v2')
}

describe('标注跨版本存活 — 常见编辑场景', () => {
  test('场景1：整篇重新排版（不动被标注的句子）→ 全部精确存活', () => {
    const v2 = `# Quarterly Report


## Revenue

Revenue grew by 12% in Q3, driven mainly by enterprise contracts. The team closed three major deals during the period.

## Risks

The supply chain remains fragile and could delay shipments. We recommend hedging against currency fluctuation.
`
    const out = reanchor([anchorOn(V1, Q_REV), anchorOn(V1, Q_SUPPLY), anchorOn(V1, Q_HEDGE)], v2)
    expect(out.map(tier)).toEqual(['exact', 'exact', 'exact'])
  })

  test('场景2：在前面插入新章节（整体偏移）→ 精确存活并更新 offset', () => {
    const v2 = `# Quarterly Report

## Summary

This document was reviewed on June 2 by the editorial team.

## Revenue

Revenue grew by 12% in Q3, driven mainly by enterprise contracts.
The team closed three major deals during the period.

## Risks

The supply chain remains fragile and could delay shipments.
We recommend hedging against currency fluctuation.
`
    const a = anchorOn(V1, Q_SUPPLY)
    const [out] = reanchor([a], v2)
    expect(tier(out)).toBe('exact')
    expect(out.offset).toBe(renderedTextOf(v2).indexOf(Q_SUPPLY))
    expect(out.offset).not.toBe(a.offset) // genuinely moved
  })

  test('场景3：被标注的句子被改写、前后文完好 → 上下文重锚（待复核）', () => {
    // The disputed figure 12% → 15%; surrounding prose unchanged.
    const v2 = V1.replace('Revenue grew by 12% in Q3', 'Revenue grew by 15% in Q3')
    const out = reanchor([anchorOn(V1, Q_REV), anchorOn(V1, Q_SUPPLY)], v2)
    expect(out.map(tier)).toEqual(['context', 'exact'])
    expect(out[0].needsReview).toBe(true)
    expect(out[0].orphaned).toBe(false)
  })

  test('场景4：调换章节顺序（Risks 移到 Revenue 之前）→ 精确存活', () => {
    const v2 = `# Quarterly Report

## Risks

The supply chain remains fragile and could delay shipments.
We recommend hedging against currency fluctuation.

## Revenue

Revenue grew by 12% in Q3, driven mainly by enterprise contracts.
The team closed three major deals during the period.
`
    const out = reanchor([anchorOn(V1, Q_REV), anchorOn(V1, Q_SUPPLY)], v2)
    expect(out.map(tier)).toEqual(['exact', 'exact'])
  })

  test('场景5：同一短语在新版本出现多处 → 借上下文锚到原来那一处', () => {
    const v2 = `# Quarterly Report

## Risks

The supply chain remains fragile and could delay shipments.
We recommend hedging against currency fluctuation.

## Appendix

The supply chain remains fragile in many unrelated sectors worldwide.
`
    const [out] = reanchor([anchorOn(V1, Q_SUPPLY)], v2)
    const text = renderedTextOf(v2)
    expect(tier(out)).toBe('exact')
    // Must pick the original occurrence (followed by "and could delay"), not the decoy.
    expect(text.slice(out.offset + Q_SUPPLY.length).startsWith(' and could delay')).toBe(true)
    expect(out.offset).toBe(text.indexOf(Q_SUPPLY)) // the Risks one, not the Appendix one
  })

  test('场景6：整节被删除（引文与上下文都消失）→ 孤儿，引文尚存的仍精确', () => {
    const v2 = `# Quarterly Report

## Revenue

Revenue grew by 12% in Q3, driven mainly by enterprise contracts.
The team closed three major deals during the period.
`
    const out = reanchor([anchorOn(V1, Q_REV), anchorOn(V1, Q_SUPPLY), anchorOn(V1, Q_HEDGE)], v2)
    expect(out.map(tier)).toEqual(['exact', 'lost', 'lost'])
  })

  test('场景7：先删后恢复 → 孤儿在后续版本自动复活（孤儿可重试）', () => {
    const v2NoRisks = `# Quarterly Report

## Revenue

Revenue grew by 12% in Q3, driven mainly by enterprise contracts.
`
    const deleted = reanchor([anchorOn(V1, Q_SUPPLY)], v2NoRisks)
    expect(tier(deleted[0])).toBe('lost')

    // A later version restores the text — re-anchoring is retried, not skipped.
    const restored = reanchor(deleted, V1)
    expect(tier(restored[0])).toBe('exact')
    expect(restored[0].offset).toBe(renderedTextOf(V1).indexOf(Q_SUPPLY))
  })
})
