import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { AnnotationColor, AnnotationType } from '../annotations'
import type { OpenDocument, SelectionAnchorMetadata, SelectionToolbar } from '../types'

const selectionPreviewColors: Record<AnnotationColor, string> = {
  yellow: '#ffe27a',
  blue: '#a9d6ff',
  green: '#b2e3bd',
  rose: '#ffbac7',
  violet: '#d2bdff',
  amber: '#f3b760',
}

interface UseSelectionCaptureArgs {
  document: OpenDocument | null
  markdownBodyRef: RefObject<HTMLDivElement | null>
}

export function useSelectionCapture({
  document,
  markdownBodyRef,
}: UseSelectionCaptureArgs) {
  const [selectionQuote, setSelectionQuote] = useState('')
  const selectionRangeRef = useRef<Range | null>(null)
  const selectionAnchorRef = useRef<SelectionAnchorMetadata | null>(null)
  const selectionPreviewQuoteRef = useRef('')
  const selectionPreviewColorRef = useRef<AnnotationColor | null>(null)
  const selectionPreviewPendingRef = useRef(false)
  const selectionPreviewRenderLockRef = useRef(false)
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbar | null>(null)
  const [selectedType, setSelectedType] = useState<AnnotationType | null>(null)
  const [toolbarNote, setToolbarNote] = useState('')
  const [toolbarReplacement, setToolbarReplacement] = useState('')
  const [showReplacement, setShowReplacement] = useState(false)

  useEffect(() => {
    const styleId = 'wowmd-selection-preview-highlight-styles'
    if (globalThis.document.getElementById(styleId)) return

    const style = globalThis.document.createElement('style')
    style.id = styleId
    style.textContent = Object.entries(selectionPreviewColors)
      .map(
        ([color, value]) =>
          `::highlight(wowmd-selection-preview-${color}) { background: ${value}; color: inherit; }`,
      )
      .join('\n')
    globalThis.document.head.append(style)
  }, [])

  function getHeadingPath(element: Element | null) {
    if (!element || !markdownBodyRef.current) return []
    const headings = Array.from(
      markdownBodyRef.current.querySelectorAll('h1,h2,h3,h4,h5,h6'),
    )
    const path: string[] = []

    headings.forEach((heading) => {
      if (heading.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) {
        const level = Number(heading.tagName.replace('H', ''))
        path[level - 1] = heading.textContent?.replace(/[▸▾]/g, '').trim() || ''
        path.length = level
      }
    })

    return path.filter(Boolean)
  }

  function getSelectionAnchorMetadataFromRange(
    range: Range,
    quote: string,
  ): SelectionAnchorMetadata {
    if (!markdownBodyRef.current) {
      return { prefix: '', suffix: '', headingPath: [], offset: -1 }
    }

    const fullText = markdownBodyRef.current.textContent || ''
    const offset = fullText.indexOf(quote)
    const prefix = offset > 0 ? fullText.slice(Math.max(0, offset - 80), offset) : ''
    const suffix =
      offset >= 0 ? fullText.slice(offset + quote.length, offset + quote.length + 80) : ''
    const ancestor =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement
    const headingPath = getHeadingPath(ancestor)

    return { prefix, suffix, headingPath, offset }
  }

  function getSelectionAnchorMetadata(): SelectionAnchorMetadata {
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!range || !markdownBodyRef.current) {
      return { prefix: '', suffix: '', headingPath: [], offset: -1 }
    }

    return getSelectionAnchorMetadataFromRange(range, selection?.toString() || '')
  }

  function renderSelectionPreview(color: AnnotationColor) {
    const root = markdownBodyRef.current
    if (!root) return

    const textNodes: Text[] = []
    const walker = globalThis.document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.textContent?.trim()) return NodeFilter.FILTER_REJECT

        const parent = node.parentElement
        if (!parent || parent.closest('pre, button, input, textarea, select')) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })

    while (walker.nextNode()) {
      textNodes.push(walker.currentNode as Text)
    }

    const quote = selectionPreviewQuoteRef.current.trim()
    if (!quote) return

    const fullText = textNodes.map((node) => node.textContent || '').join('')
    let matchStart = selectionAnchorRef.current?.offset ?? -1
    if (matchStart < 0 || fullText.slice(matchStart, matchStart + quote.length) !== quote) {
      matchStart = fullText.indexOf(quote)
    }
    if (matchStart < 0) return

    const matchEnd = matchStart + quote.length
    let cursor = 0
    const segments: Array<{ node: Text; start: number; end: number }> = []
    textNodes.forEach((node) => {
      const text = node.textContent || ''
      const nodeStart = cursor
      const nodeEnd = cursor + text.length
      const start = Math.max(matchStart, nodeStart)
      const end = Math.min(matchEnd, nodeEnd)
      if (start < end) {
        segments.push({
          node,
          start: start - nodeStart,
          end: end - nodeStart,
        })
      }
      cursor = nodeEnd
    })

    if (!segments.length) return

    selectionPreviewRenderLockRef.current = true
    segments.reverse().forEach(({ node, start, end }) => {
      const text = node.textContent || ''
      if (start >= end) return

      const fragment = globalThis.document.createDocumentFragment()
      if (start > 0) {
        fragment.append(globalThis.document.createTextNode(text.slice(0, start)))
      }

      const mark = globalThis.document.createElement('mark')
      mark.className = `wowmd-highlight wowmd-preview-highlight wowmd-highlight-${color}`
      mark.dataset.previewHighlight = 'true'
      mark.textContent = text.slice(start, end)
      fragment.append(mark)

      if (end < text.length) {
        fragment.append(globalThis.document.createTextNode(text.slice(end)))
      }
      node.replaceWith(fragment)
    })

    selectionPreviewColorRef.current = color
    window.setTimeout(() => {
      selectionPreviewRenderLockRef.current = false
    }, 0)
  }

  const clearSelectionPreview = useCallback(() => {
    const highlights = (globalThis as typeof globalThis & {
      CSS?: { highlights?: Map<string, unknown> }
    }).CSS?.highlights

    if (highlights) {
      ;(Object.keys(selectionPreviewColors) as AnnotationColor[]).forEach((color) => {
        highlights.delete(`wowmd-selection-preview-${color}`)
      })
    }

    const root = markdownBodyRef.current
    if (!root) return

    root.querySelectorAll<HTMLElement>('[data-preview-highlight="true"]').forEach((mark) => {
      mark.replaceWith(globalThis.document.createTextNode(mark.textContent || ''))
    })
    root.normalize()
    selectionPreviewColorRef.current = null
  }, [markdownBodyRef])

  const previewSelectionColor = useCallback(
    (color: AnnotationColor) => {
      const root = markdownBodyRef.current
      if (!root) return

      const previewMarks = Array.from(
        root.querySelectorAll<HTMLElement>('[data-preview-highlight="true"]'),
      )
      if (previewMarks.length) {
        previewMarks.forEach((mark) => {
          mark.classList.remove(
            'wowmd-highlight-yellow',
            'wowmd-highlight-blue',
            'wowmd-highlight-green',
            'wowmd-highlight-rose',
            'wowmd-highlight-violet',
            'wowmd-highlight-amber',
          )
          mark.classList.add(`wowmd-highlight-${color}`)
        })
        selectionPreviewColorRef.current = color
        return
      }

      renderSelectionPreview(color)
    },
    [markdownBodyRef],
  )

  const captureSelection = useCallback(() => {
    if (!document || !markdownBodyRef.current) return

    const selection = window.getSelection()
    const quote = selection?.toString().trim() || ''
    if (!quote) {
      if (
        selectionPreviewPendingRef.current ||
        (selectionPreviewRenderLockRef.current &&
          markdownBodyRef.current?.querySelector('[data-preview-highlight="true"]'))
      ) {
        return
      }

      setSelectionQuote('')
      selectionRangeRef.current = null
      selectionAnchorRef.current = null
      selectionPreviewQuoteRef.current = ''
      clearSelectionPreview()
      setSelectionToolbar(null)
      return
    }

    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const isInsideReader =
      range &&
      markdownBodyRef.current.contains(range.commonAncestorContainer)

    if (!range || !isInsideReader) {
      setSelectionQuote('')
      selectionRangeRef.current = null
      selectionAnchorRef.current = null
      selectionPreviewQuoteRef.current = ''
      clearSelectionPreview()
      setSelectionToolbar(null)
      return
    }

    const rect = range.getBoundingClientRect()
    selectionRangeRef.current = range.cloneRange()
    selectionAnchorRef.current = getSelectionAnchorMetadataFromRange(range, quote)
    selectionPreviewQuoteRef.current = quote
    setSelectionQuote(quote.slice(0, 500))
    setSelectionToolbar({
      x: rect.left + rect.width / 2,
      y: Math.max(92, rect.top - 14),
    })
    selectionPreviewPendingRef.current = true
    window.setTimeout(() => {
      selectionPreviewPendingRef.current = false
      if (selectionRangeRef.current) previewSelectionColor('yellow')
    }, 0)
  }, [document, markdownBodyRef, clearSelectionPreview, previewSelectionColor])

  const resetSelectionCapture = useCallback(() => {
    setSelectionQuote('')
    setSelectedType(null)
    setToolbarNote('')
    setToolbarReplacement('')
    setShowReplacement(false)
    setSelectionToolbar(null)
    selectionRangeRef.current = null
    selectionAnchorRef.current = null
    setTimeout(() => {
      const selection = window.getSelection()
      if (selection) selection.removeAllRanges()
    }, 0)
  }, [])

  const getAnchorMetadata = useCallback((): SelectionAnchorMetadata => {
    return selectionAnchorRef.current ?? getSelectionAnchorMetadata()
  }, [])

  return {
    selectionQuote,
    setSelectionQuote,
    selectionToolbar,
    setSelectionToolbar,
    selectedType,
    setSelectedType,
    toolbarNote,
    setToolbarNote,
    toolbarReplacement,
    setToolbarReplacement,
    showReplacement,
    setShowReplacement,
    captureSelection,
    clearSelectionPreview,
    previewSelectionColor,
    resetSelectionCapture,
    getAnchorMetadata,
  }
}
