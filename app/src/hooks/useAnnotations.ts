import { useCallback, useState } from 'react'
import type { RefObject } from 'react'
import {
  createAnnotation,
  createTicketExport,
  findReanchorCandidates,
  reanchorAnnotationOffset,
  saveAnnotationsToDb,
  type Annotation,
  type AnnotationColor,
  type AnnotationType,
  type ReanchorCandidate,
} from '../annotations'
import { downloadTextFile, safeExportFilename } from '../exportHtml'
import { renderMarkdown } from '../markdown'
import type { OpenDocument, SelectionAnchorMetadata } from '../types'

/**
 * Re-anchor every annotation against a (possibly edited) version of the document.
 * Runs on every open — including the cross-version paths: same-URL re-import,
 * "save as new version", and reopening a local file under a matching name.
 *
 * Orphaned annotations are re-evaluated rather than skipped, so a later version
 * that restores deleted text revives them automatically. The result carries a
 * confidence tier: `context` hits set `needsReview` (position recovered, wording
 * changed), `lost` hits set `orphaned`, `exact` hits clear both.
 */
export function reanchorAgainstMarkdown(
  items: Annotation[],
  markdown: string,
  fingerprint: string,
): Annotation[] {
  if (!items.length) return items
  const probe = new DOMParser().parseFromString(renderMarkdown(markdown), 'text/html')
  const renderedText = probe.body.textContent || ''
  const now = new Date().toISOString()

  return items.map((annotation): Annotation => {
    const outcome = reanchorAnnotationOffset(renderedText, annotation)
    const nextOrphaned = outcome.confidence === 'lost'
    const nextNeedsReview = outcome.confidence === 'context'

    const unchanged =
      annotation.documentFingerprint === fingerprint &&
      annotation.orphaned === nextOrphaned &&
      (annotation.needsReview ?? false) === nextNeedsReview &&
      (nextOrphaned || outcome.offset === annotation.offset)
    if (unchanged) return annotation

    return {
      ...annotation,
      // Keep the last known offset when lost so manual recovery has a starting point.
      offset: nextOrphaned ? annotation.offset : outcome.offset,
      orphaned: nextOrphaned,
      needsReview: nextNeedsReview,
      documentFingerprint: fingerprint,
      updatedAt: now,
    }
  })
}

interface UseAnnotationsArgs {
  document: OpenDocument | null
  markdownBodyRef: RefObject<HTMLDivElement | null>
  canSaveAnnotations: boolean
  selectionQuote: string
  getAnchorMetadata: () => SelectionAnchorMetadata
  onBeforeAnnotationSave: () => void
  onAfterAnnotationSave: () => void
  onLicenseRequired: () => void
  onScrollToAnnotation: () => void
}

export function useAnnotations({
  document,
  markdownBodyRef,
  canSaveAnnotations,
  selectionQuote,
  getAnchorMetadata,
  onBeforeAnnotationSave,
  onAfterAnnotationSave,
  onLicenseRequired,
  onScrollToAnnotation,
}: UseAnnotationsArgs) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null)
  const [pendingClearAnnotations, setPendingClearAnnotations] = useState(false)
  const [reanchorId, setReanchorId] = useState<string | null>(null)
  const [reanchorCandidates, setReanchorCandidates] = useState<ReanchorCandidate[]>([])
  const [filterType, setFilterType] = useState<AnnotationType | null>(null)

  const addAnnotation = useCallback(
    (color: AnnotationColor, note = '', annotationType: AnnotationType | null = null, suggestedReplacement = '') => {
      if (!document || !selectionQuote) return
      onBeforeAnnotationSave()
      if (!canSaveAnnotations) {
        onLicenseRequired()
        return
      }
      const next = [
        createAnnotation({
          documentId: document.stableId,
          documentFingerprint: document.fingerprint,
          quote: selectionQuote,
          ...(getAnchorMetadata()),
          note: note.trim().slice(0, 1000),
          color,
          type: annotationType,
          suggestedReplacement,
        }),
        ...annotations,
      ]
      setAnnotations(next)
      void saveAnnotationsToDb(document.stableId, next)
      onAfterAnnotationSave()
    },
    [document, selectionQuote, canSaveAnnotations, annotations, onBeforeAnnotationSave, onAfterAnnotationSave, onLicenseRequired, getAnchorMetadata],
  )

  const deleteAnnotation = useCallback(
    (id: string) => {
      if (!document) return
      const next = annotations.filter((annotation) => annotation.id !== id)
      setAnnotations(next)
      void saveAnnotationsToDb(document.stableId, next)
    },
    [document, annotations],
  )

  const clearDocumentAnnotations = useCallback(() => {
    if (!document) return
    setAnnotations([])
    void saveAnnotationsToDb(document.stableId, [])
    setPendingClearAnnotations(false)
  }, [document])

  const scrollToAnnotation = useCallback(
    (id: string) => {
      onScrollToAnnotation()

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const annotation = annotations.find((item) => item.id === id)
          const root = markdownBodyRef.current
          if (!root) return

          const target =
            root.querySelector<HTMLElement>(
              `[data-annotation-id="${escapeCssIdentifier(id)}"]`,
            ) ||
            Array.from(root.querySelectorAll<HTMLElement>('.wowmd-highlight')).find(
              (element) =>
                Boolean(annotation?.quote) &&
                element.textContent?.trim() === annotation?.quote.trim(),
            )

          if (!target) return
          target.scrollIntoView({ block: 'center' })
          target.classList.add('wowmd-highlight-located')
          window.setTimeout(() => {
            target.classList.remove('wowmd-highlight-located')
          }, 900)
        })
      })
    },
    [annotations, markdownBodyRef, onScrollToAnnotation],
  )

  const openAnnotationDetail = useCallback((annotation: Annotation) => {
    setActiveAnnotation(annotation)
  }, [])

  const locateAnnotation = useCallback(
    (annotation: Annotation) => {
      scrollToAnnotation(annotation.id)
      setActiveAnnotation(null)
    },
    [scrollToAnnotation],
  )

  const showReanchorCandidates = useCallback(
    (annotation: Annotation) => {
      if (!document) return
      const renderedHtml = renderMarkdown(document.markdown)
      const probe = new DOMParser().parseFromString(renderedHtml, 'text/html')
      const renderedText = probe.body.textContent || ''
      const candidates = findReanchorCandidates(renderedText, annotation)
      setReanchorId(annotation.id)
      setReanchorCandidates(candidates)
    },
    [document],
  )

  const reanchorAnnotationFn = useCallback(
    (id: string, candidate: ReanchorCandidate) => {
      const next = annotations.map((a) =>
        a.id === id
          ? { ...a, offset: candidate.start, orphaned: false, needsReview: false, updatedAt: new Date().toISOString() }
          : a,
      )
      setAnnotations(next)
      void saveAnnotationsToDb(document!.stableId, next)
      setReanchorId(null)
      setReanchorCandidates([])
    },
    [annotations, document],
  )

  const exportAnnotationsAsJson = useCallback(() => {
    if (!document || !annotations.length) return
    downloadTextFile(
      safeExportFilename(document.name, 'json'),
      JSON.stringify(annotations, null, 2),
      'application/json;charset=utf-8',
    )
  }, [document, annotations])

  const exportTicketJson = useCallback(() => {
    if (!document || !annotations.length) return
    const sourceStr = typeof document.source === 'string'
      ? document.source
      : document.source?.label ?? ''
    const ticket = createTicketExport(
      document.name,
      sourceStr,
      document.fingerprint,
      document.markdown,
      annotations,
      {
        lineageId: document.lineageId,
        documentId: document.stableId,
        bodyHash: document.bodyHash,
        filename: document.name,
      },
    )
    downloadTextFile(
      safeExportFilename(document.name, 'tickets'),
      JSON.stringify(ticket, null, 2),
      'application/json;charset=utf-8',
    )
  }, [document, annotations])

  return {
    annotations,
    setAnnotations,
    addAnnotation,
    deleteAnnotation,
    clearDocumentAnnotations,
    scrollToAnnotation,
    openAnnotationDetail,
    locateAnnotation,
    showReanchorCandidates,
    reanchorAnnotation: reanchorAnnotationFn,
    activeAnnotation,
    setActiveAnnotation,
    reanchorAgainstMarkdown,
    reanchorCandidates,
    reanchorId,
    pendingClearAnnotations,
    setPendingClearAnnotations,
    filterType,
    setFilterType,
    exportAnnotationsAsJson,
    exportTicketJson,
  }
}

function escapeCssIdentifier(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}
