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
  getDocumentLineage,
  type LocalDocument,
} from '../localDocuments'
import {
  computeDocumentFingerprint,
  sampleMarkdown,
} from '../markdown'
import type { OpenDocument } from '../types'
import { importErrorMessage, sourceLabel } from './documentUtils'

type WorkspaceView = 'reader' | 'exports' | 'license'
type ImportStatus = 'idle' | 'loading' | 'failed'

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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const openLocalDocument = useCallback(async (localDocument: LocalDocument) => {
    setDocument({
      name: localDocument.title,
      markdown: localDocument.markdownSnapshot,
      fingerprint: localDocument.fingerprint,
      stableId: localDocument.id,
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

    const markdown = await file.text()
    const fingerprint = await computeDocumentFingerprint(markdown)
    const stableId = `file:${file.name}`
    setDocument({
      name: file.name,
      markdown,
      fingerprint,
      stableId,
    })
    setExportDefaults(file.name)
    {
      const loaded = await loadAnnotationsFromDb(stableId, fingerprint)
      const reanchored = reanchorAgainstMarkdown(loaded, markdown, fingerprint)
      if (reanchored.some((a, i) => a !== loaded[i])) {
        void saveAnnotationsToDb(stableId, reanchored)
      }
      setAnnotationsRef.current(reanchored)
    }
    resetSelectionCapture()
    setSearchQuery('')
    setSearchIndex(0)
    setView('reader')
    setShowOutline(!isNarrowLayout)
    setShowNotes(!isNarrowLayout)
  }, [canOpenUserFiles, t, setAnnotationsRef, reanchorAgainstMarkdown, resetSelectionCapture, setSearchQuery, setSearchIndex, setView, setShowOutline, setShowNotes, isNarrowLayout, setExportDefaults])

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

    const fingerprint = await computeDocumentFingerprint(result.markdown)
    const carried = reanchorAgainstMarkdown(annotationsRef.current, result.markdown, fingerprint)

    let newStableId: string
    const isGithubSourced = !!document.source && typeof document.source !== 'string'

    if (isGithubSourced) {
      const successor = await createDocumentVersion({
        parentDocumentId: document.stableId,
        title: result.newFilename,
        markdownSnapshot: result.markdown,
        fingerprint,
      })
      newStableId = successor.id
    } else {
      newStableId = `file:${result.newFilename}`
    }

    await saveAnnotationsToDb(newStableId, carried)

    setDocument({
      ...document,
      name: result.newFilename,
      markdown: result.markdown,
      fingerprint,
      stableId: newStableId,
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
  }
}
