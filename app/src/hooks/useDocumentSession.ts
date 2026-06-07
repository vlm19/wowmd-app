import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent, Dispatch, DragEvent, RefObject, SetStateAction } from 'react'
import {
  loadAnnotationsFromDb,
  saveAnnotationsToDb,
  type Annotation,
} from '../annotations'
import {
  importGitHubMarkdown,
} from '../importService'
import {
  loadLocalDocument,
  createDocumentVersion,
  confirmLocalDocumentRelationship,
  getDocumentLineage,
  listLocalDocuments,
  saveLocalDocument,
  type LocalDocument,
} from '../localDocuments'
import {
  computeDocumentFingerprint,
  sampleMarkdown,
} from '../markdown'
import type { OpenDocument } from '../types'
import {
  computeBodyHash,
  buildLineDifference,
  createLineageDocumentId,
  createLineageId,
  findFileLineageCandidate,
  markdownBody,
  parseFileLineage,
  type FileLineageMetadata,
} from '../fileLineage'
import type { FileAssociationCandidate } from '../FileAssociationDialog'
import { importErrorMessage, sourceLabel } from './documentUtils'

type WorkspaceView = 'reader' | 'exports' | 'license'
type ImportStatus = 'idle' | 'loading' | 'failed'

type PendingAssociation = {
  candidate: FileAssociationCandidate
  markdown: string
  filename: string
  fingerprint: string
  bodyHash: string
  metadata?: FileLineageMetadata
  carried: Annotation[]
  existingDocumentId?: string
}

export type { OpenDocument, WorkspaceView }

interface UseDocumentSessionArgs {
  reanchorAgainstMarkdown: (items: Annotation[], markdown: string, fingerprint: string) => Annotation[]
  annotationsRef: RefObject<Annotation[]>
  setAnnotationsRef: RefObject<Dispatch<SetStateAction<Annotation[]>>>
  resetSelectionCapture: () => void
  canOpenUserFiles: boolean
  isNarrowLayout: boolean
  setShowOutline: Dispatch<SetStateAction<boolean>>
  setShowNotes: Dispatch<SetStateAction<boolean>>
  setSearchQuery: Dispatch<SetStateAction<string>>
  setSearchIndex: Dispatch<SetStateAction<number>>
  setExportDefaults: (name: string) => void
  t: (key: string) => string
}

export function useDocumentSession({
  reanchorAgainstMarkdown,
  annotationsRef,
  setAnnotationsRef,
  resetSelectionCapture,
  canOpenUserFiles,
  isNarrowLayout,
  setShowOutline,
  setShowNotes,
  setSearchQuery,
  setSearchIndex,
  setExportDefaults,
  t,
}: UseDocumentSessionArgs) {
  const [document, setDocument] = useState<OpenDocument | null>(null)
  const [error, setError] = useState('')
  const [importStatus, setImportStatus] = useState<ImportStatus>('idle')
  const [importSourceUrl, setImportSourceUrl] = useState('')
  const [view, setView] = useState<WorkspaceView>('reader')
  const [showSaveVersion, setShowSaveVersion] = useState(false)
  const [showVersions, setShowVersions] = useState(false)
  const [versions, setVersions] = useState<LocalDocument[]>([])
  const [pendingAssociation, setPendingAssociation] = useState<PendingAssociation | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const openLocalDocument = useCallback(async (localDocument: LocalDocument) => {
    setDocument({
      name: localDocument.title,
      markdown: localDocument.markdownSnapshot,
      fingerprint: localDocument.fingerprint,
      stableId: localDocument.id,
      lineageId: localDocument.lineageId,
      parentDocumentId: localDocument.parentDocumentId,
      sourceTicketId: localDocument.sourceTicketId,
      bodyHash: localDocument.bodyHash,
      suggestedParentDocumentId: localDocument.suggestedParentDocumentId,
      source: {
        sourceType: localDocument.sourceType,
        sourceUrl: localDocument.sourceUrl,
        rawUrl: localDocument.rawUrl,
        label: sourceLabel(localDocument),
      },
    })
    setExportDefaults(localDocument.title)
    {
      const loaded = await loadAnnotationsFromDb(localDocument.id, localDocument.fingerprint)
      const reanchored = reanchorAgainstMarkdown(
        loaded,
        localDocument.markdownSnapshot,
        localDocument.fingerprint,
      )
      if (reanchored.some((a, i) => a !== loaded[i])) {
        void saveAnnotationsToDb(localDocument.id, reanchored)
      }
      setAnnotationsRef.current(reanchored)
    }
    resetSelectionCapture()
    setSearchQuery('')
    setSearchIndex(0)
    setView('reader')
    setShowOutline(!isNarrowLayout)
    setShowNotes(!isNarrowLayout)
  }, [reanchorAgainstMarkdown, setAnnotationsRef, resetSelectionCapture, setSearchQuery, setSearchIndex, setView, setShowOutline, setShowNotes, isNarrowLayout, setExportDefaults])

  const openFile = useCallback(async (file: File) => {
    setError('')
    setImportStatus('idle')

    if (!/\.(md|markdown)$/i.test(file.name)) {
      setError(t('typeError'))
      return
    }

    if (!canOpenUserFiles) {
      setError(t('expiredOpenError'))
      return
    }

    const rawMarkdown = await file.text()
    const parsed = parseFileLineage(rawMarkdown)
    const markdown = markdownBody(rawMarkdown)
    const fingerprint = await computeDocumentFingerprint(markdown)
    const bodyHash = await computeBodyHash(markdown)
    const all = await listLocalDocuments()
    const metadata = parsed.valid ? parsed.metadata : undefined
    const registeredExact = !metadata
      ? all.find((item) => item.title === file.name && item.bodyHash === bodyHash)
      : undefined
    if (registeredExact) {
      await openLocalDocument(registeredExact)
      return
    }
    const candidate = findFileLineageCandidate(file.name, markdown, bodyHash, metadata, all)

    if (candidate) {
      const loaded = await loadAnnotationsFromDb(candidate.parent.id, candidate.parent.fingerprint)
      const carried = reanchorAgainstMarkdown(loaded, markdown, fingerprint)
      const differences = buildLineDifference(candidate.parent.markdownSnapshot, markdown)
      setPendingAssociation({
        candidate: {
          ...candidate,
          exactCount: carried.filter((item) => !item.orphaned && !item.needsReview).length,
          reviewCount: carried.filter((item) => item.needsReview && !item.orphaned).length,
          lostCount: carried.filter((item) => item.orphaned).length,
          ...differences,
        },
        markdown,
        filename: file.name,
        fingerprint,
        bodyHash,
        metadata,
        carried,
      })
      return
    }

    const registered = await registerStandaloneLocalFile(file.name, markdown, fingerprint, bodyHash)
    await openLocalDocument(registered)
  }, [canOpenUserFiles, t, reanchorAgainstMarkdown, openLocalDocument])

  const confirmPendingAssociation = useCallback(async () => {
    if (!pendingAssociation) return
    const { candidate, markdown, filename, fingerprint, bodyHash, metadata, carried } = pendingAssociation
    const existing = await loadLocalDocument(metadata?.documentId || '')
    const lineageId = metadata?.lineageId || candidate.parent.lineageId || createLineageId()
    const registered = pendingAssociation.existingDocumentId
      ? await confirmLocalDocumentRelationship({
          id: pendingAssociation.existingDocumentId,
          parentDocumentId: candidate.parent.id,
          lineageId,
          sourceTicketId: metadata?.sourceTicketId,
        })
      : await saveLocalDocument({
          // A known documentId with a changed body is an externally edited
          // successor. Give it a new id and point back to the registered version.
          id: metadata?.documentId && !existing ? metadata.documentId : createLineageDocumentId(),
          sourceType: 'local',
          sourceUrl: '',
          rawUrl: '',
          title: filename,
          markdownSnapshot: markdown,
          fingerprint,
          parentDocumentId: candidate.parent.id,
          lineageId,
          sourceTicketId: metadata?.sourceTicketId,
          bodyHash,
        })
    if (!registered) return
    await saveAnnotationsToDb(registered.id, carried)
    setPendingAssociation(null)
    await openLocalDocument(registered)
  }, [pendingAssociation, openLocalDocument])

  const openPendingAsNew = useCallback(async () => {
    if (!pendingAssociation) return
    const { filename, markdown, fingerprint, bodyHash } = pendingAssociation
    const registered = await registerStandaloneLocalFile(filename, markdown, fingerprint, bodyHash, pendingAssociation.candidate.parent.id)
    setPendingAssociation(null)
    await openLocalDocument(registered)
  }, [pendingAssociation, openLocalDocument])

  const reviewSuggestedRelationship = useCallback(async () => {
    if (!document?.suggestedParentDocumentId) return
    const parent = await loadLocalDocument(document.suggestedParentDocumentId)
    if (!parent) return
    const loaded = await loadAnnotationsFromDb(parent.id, parent.fingerprint)
    const carried = reanchorAgainstMarkdown(loaded, document.markdown, document.fingerprint)
    setPendingAssociation({
      candidate: {
        parent,
        filename: document.name,
        reason: 'structure-similarity',
        externalEdit: false,
        exactCount: carried.filter((item) => !item.orphaned && !item.needsReview).length,
        reviewCount: carried.filter((item) => item.needsReview && !item.orphaned).length,
        lostCount: carried.filter((item) => item.orphaned).length,
        ...buildLineDifference(parent.markdownSnapshot, document.markdown),
      },
      markdown: document.markdown,
      filename: document.name,
      fingerprint: document.fingerprint,
      bodyHash: document.bodyHash || await computeBodyHash(document.markdown),
      carried,
      existingDocumentId: document.stableId,
    })
  }, [document, reanchorAgainstMarkdown])

  const openSample = useCallback(async () => {
    setError('')
    setImportStatus('idle')
    setDocument({
      name: 'wowMD Pro sample.md',
      markdown: sampleMarkdown,
      fingerprint: 'sample',
      stableId: 'sample',
    })
    setExportDefaults('wowMD Pro sample.md')
    setAnnotationsRef.current(await loadAnnotationsFromDb('sample', 'sample'))
    resetSelectionCapture()
    setSearchQuery('')
    setSearchIndex(0)
    setView('reader')
    setShowOutline(!isNarrowLayout)
    setShowNotes(!isNarrowLayout)
  }, [setExportDefaults, setAnnotationsRef, resetSelectionCapture, setSearchQuery, setSearchIndex, setView, setShowOutline, setShowNotes, isNarrowLayout])

  const importFromUrl = useCallback(async (searchParams: URLSearchParams, appBasePath = '') => {
    setImportStatus('loading')
    setImportSourceUrl(searchParams.get('pageUrl') || '')
    setError('')

    try {
      const { document: localDocument } = await importGitHubMarkdown(searchParams)
      await openLocalDocument(localDocument)
      window.history.replaceState(
        null,
        '',
        `${appBasePath}/reader/${encodeURIComponent(localDocument.id)}`,
      )
      setImportStatus('idle')
    } catch (importError) {
      setImportStatus('failed')
      setError(importErrorMessage(importError))
      console.warn('wowMD import failed', importError)
    }
  }, [openLocalDocument])

  const restoreImportedDocument = useCallback(async (id: string) => {
    setImportStatus('loading')
    setError('')

    try {
      const localDocument = await loadLocalDocument(id)
      if (!localDocument) {
        setImportStatus('failed')
        setError('We could not find this local document. Please import it from GitHub again.')
        return
      }

      await openLocalDocument(localDocument)
      setImportStatus('idle')
    } catch (importError) {
      setImportStatus('failed')
      setError('We could not open this local document. Please import it from GitHub again.')
      console.warn('wowMD local document restore failed', importError)
    }
  }, [openLocalDocument])

  const handleInitialRoute = useCallback(async () => {
    const { pathname, search } = window.location
    const appBasePath = pathname.startsWith('/app/') ? '/app' : ''
    const routePath = appBasePath ? pathname.slice(appBasePath.length) : pathname

    if (routePath === '/import') {
      await importFromUrl(new URLSearchParams(search), appBasePath)
      return
    }

    const readerMatch = routePath.match(/^\/reader\/([^/]+)$/)
    if (readerMatch) {
      await restoreImportedDocument(decodeURIComponent(readerMatch[1]))
    }
  }, [importFromUrl, restoreImportedDocument])

  const clearCurrentFile = useCallback(() => {
    setDocument(null)
    setAnnotationsRef.current([])
    resetSelectionCapture()
    setSearchQuery('')
    setSearchIndex(0)
    setError('')
    setImportStatus('idle')
    setImportSourceUrl('')
    setPendingAssociation(null)
    setView('reader')
    setShowOutline(true)
    setShowNotes(true)
  }, [setAnnotationsRef, resetSelectionCapture, setSearchQuery, setSearchIndex, setView, setShowOutline, setShowNotes])

  const requestLocalFile = useCallback(() => {
    setError('')
    fileInputRef.current?.click()
  }, [])

  const handleFileInput = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void openFile(file)
    event.target.value = ''
  }, [openFile])

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (file) void openFile(file)
  }, [openFile])

  const handleSavedReviewedCopy = useCallback(async (result: { newFilename: string; markdown: string }) => {
    if (!document) {
      setShowSaveVersion(false)
      return
    }

    const parsed = parseFileLineage(result.markdown)
    const body = markdownBody(result.markdown)
    const fingerprint = await computeDocumentFingerprint(body)
    const carried = reanchorAgainstMarkdown(annotationsRef.current, body, fingerprint)
    const metadata = parsed.valid ? parsed.metadata : undefined

    const successor = await createDocumentVersion({
      id: metadata?.documentId,
      parentDocumentId: document.stableId,
      title: result.newFilename,
      markdownSnapshot: body,
      fingerprint,
      sourceType: typeof document.source === 'object' ? document.source.sourceType : 'local',
      lineageId: metadata?.lineageId || document.lineageId || createLineageId(),
      sourceTicketId: metadata?.sourceTicketId,
      bodyHash: metadata?.bodyHash || await computeBodyHash(body),
    })
    const newStableId = successor.id

    await saveAnnotationsToDb(newStableId, carried)

    setDocument({
      ...document,
      name: result.newFilename,
      markdown: body,
      fingerprint,
      stableId: newStableId,
      lineageId: successor.lineageId,
      parentDocumentId: successor.parentDocumentId,
      sourceTicketId: successor.sourceTicketId,
      bodyHash: successor.bodyHash,
    })
    setAnnotationsRef.current(carried)
    setExportDefaults(result.newFilename)
    setShowSaveVersion(false)

    try {
      setVersions(await getDocumentLineage(newStableId))
    } catch {
      /* lineage is read-only sugar; ignore failures */
    }
  }, [document, reanchorAgainstMarkdown, annotationsRef, setAnnotationsRef, setExportDefaults])

  const openVersions = useCallback(async () => {
    if (!document) return
    try {
      setVersions(await getDocumentLineage(document.stableId))
    } catch {
      setVersions([])
    }
    setShowVersions(true)
  }, [document])

  const openVersion = useCallback(async (id: string) => {
    if (id === document?.stableId) return
    const localDocument = await loadLocalDocument(id)
    if (!localDocument) return
    setShowVersions(false)
    await openLocalDocument(localDocument)
  }, [document, openLocalDocument])

  return {
    document,
    setDocument,
    error,
    setError,
    importStatus,
    setImportStatus,
    importSourceUrl,
    setImportSourceUrl,
    view,
    setView,
    showSaveVersion,
    setShowSaveVersion,
    showVersions,
    setShowVersions,
    versions,
    setVersions,
    pendingAssociation,
    setPendingAssociation,
    fileInputRef,
    openFile,
    handleInitialRoute,
    importFromUrl,
    restoreImportedDocument,
    openLocalDocument,
    openSample,
    clearCurrentFile,
    requestLocalFile,
    handleFileInput,
    handleDrop,
    handleSavedReviewedCopy,
    openVersions,
    openVersion,
    confirmPendingAssociation,
    openPendingAsNew,
    reviewSuggestedRelationship,
  }
}

async function registerStandaloneLocalFile(
  filename: string,
  markdown: string,
  fingerprint: string,
  bodyHash: string,
  suggestedParentDocumentId?: string,
) {
  return saveLocalDocument({
    id: createLineageDocumentId(),
    sourceType: 'local',
    sourceUrl: '',
    rawUrl: '',
    title: filename,
    markdownSnapshot: markdown,
    fingerprint,
    lineageId: createLineageId(),
    bodyHash,
    suggestedParentDocumentId,
  })
}
