export type SearchResult = {
  html: string
  count: number
}

export function applySearchHighlights(
  html: string,
  query: string,
  activeIndex: number,
): SearchResult {
  const needle = query.trim()
  if (!needle) return { html, count: 0 }

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  let count = 0

  const walker = document.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent) return NodeFilter.FILTER_REJECT
      if (parent.closest('pre, code, script, style, button, textarea, input')) {
        return NodeFilter.FILTER_REJECT
      }
      return node.textContent?.toLowerCase().includes(needle.toLowerCase())
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_SKIP
    },
  })

  const matches: Array<{ node: Text; start: number; end: number; index: number }> = []

  while (true) {
    const node = walker.nextNode() as Text | null
    if (!node?.textContent) break

    const text = node.textContent
    const lowerText = text.toLowerCase()
    const lowerNeedle = needle.toLowerCase()
    let cursor = 0

    while (cursor < text.length) {
      const index = lowerText.indexOf(lowerNeedle, cursor)
      if (index < 0) break
      matches.push({
        node,
        start: index,
        end: index + needle.length,
        index: count,
      })
      count += 1
      cursor = index + needle.length
    }
  }

  matches.reverse().forEach((match) => {
    const range = document.createRange()
    range.setStart(match.node, match.start)
    range.setEnd(match.node, match.end)
    const mark = document.createElement('mark')
    mark.className =
      match.index === activeIndex
        ? 'wowmd-search-hit active'
        : 'wowmd-search-hit'
    mark.dataset.searchIndex = String(match.index)
    range.surroundContents(mark)
  })

  return { html: doc.body.innerHTML, count }
}
