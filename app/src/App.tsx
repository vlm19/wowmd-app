import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type SetStateAction,
} from 'react'
import './App.css'
import {
  applyAnnotationHighlights,
  type Annotation,
  type AnnotationColor,
  type AnnotationType,
} from './annotations'
import { buildCleanHtmlExport, downloadTextFile, safeExportFilename } from './exportHtml'
import { injectH2Foldable } from './fold'
import {
  createTranslator,
  getInitialLocale,
  saveLocale,
  type Locale,
} from './i18n'
import {
  activateLocalLicense,
  createAccessState,
  getLicenseSummary,
} from './license'
import {
  buildToc,
  getDocumentStats,
  renderMarkdown,
  type TocItem,
} from './markdown'
import { applySearchHighlights } from './search'
import SaveReviewedCopy from './SaveReviewedCopy'
import UnderstandingMap from './UnderstandingMap'
import SettingsPanel from './SettingsPanel'
import VersionHistory from './VersionHistory'
import FileAssociationDialog from './FileAssociationDialog'
import AnnotationToolbar from './AnnotationToolbar'
import NotesPanel from './NotesPanel'
import FeedbackLink from './FeedbackLink'
import ReaderToolbar from './ReaderToolbar'
import LanguagePicker from './LanguagePicker'
import { loadSettings, type PanelMode, type AnnotationStyle } from './settingsStore'
import {
  addCodeCopyButtonsToHtml,
  copyTextWithFallback,
  formatBytes,
  stripHeadingIds,
  withThemeSuffix,
} from './appUtils'
import { useAnnotations, reanchorAgainstMarkdown } from './hooks/useAnnotations'
import { useSelectionCapture } from './hooks/useSelectionCapture'
import { useDocumentSession } from './hooks/useDocumentSession'

type ThemeName = 'light' | 'dark'
type ExportViewMode = 'preview' | 'source'
type LicenseStatus = 'idle' | 'activating' | 'activated' | 'error'

const ExportWorkspace = lazy(() => import('./ExportWorkspace'))
const betaNoticeStorageKey = 'wowmd.betaNotice.dismissed.v1'

function loadBetaNoticeDismissed() {
  try {
    return localStorage.getItem(betaNoticeStorageKey) === '1'
  } catch {
    return false
  }
}

function getViewportWidth() {
  return typeof window === 'undefined' ? 1440 : window.innerWidth
}

function getOutlineWidthBounds(viewportWidth: number, showNotes: boolean) {
  if (viewportWidth <= 1100) return { min: 240, max: viewportWidth }
  const maxByViewport = Math.floor(viewportWidth * (showNotes ? 0.28 : 0.34))
  return {
    min: 240,
    max: Math.min(showNotes ? 460 : 520, Math.max(320, maxByViewport)),
  }
}

function clampOutlineWidth(width: number, viewportWidth: number, showNotes: boolean) {
  const bounds = getOutlineWidthBounds(viewportWidth, showNotes)
  return Math.round(Math.min(bounds.max, Math.max(bounds.min, width)))
}

function getOutlineTextScore(text: string) {
  return Array.from(text).reduce((score, char) => {
    if (/[\u2E80-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/u.test(char)) {
      return score + 9.5
    }
    if (/[A-Z0-9]/.test(char)) return score + 6.8
    if (/\s/.test(char)) return score + 3.2
    return score + 5.8
  }, 0)
}

function getAutoOutlineWidth(toc: TocItem[], outlineFontSize: number, viewportWidth: number, showNotes: boolean) {
  if (!toc.length) return clampOutlineWidth(300, viewportWidth, showNotes)

  const longestItem = toc.reduce((longest, item) => {
    const indent = Math.max(0, item.level - 1) * 8
    return Math.max(longest, 118 + indent + getOutlineTextScore(item.text) * (outlineFontSize / 11))
  }, 0)

  return clampOutlineWidth(longestItem, viewportWidth, showNotes)
}

function App() {
  const [theme, setTheme] = useState<ThemeName>('dark')
  const [showOutline, setShowOutline] = useState(true)
  const [showNotes, setShowNotes] = useState(true)
  const [isNarrowLayout, setIsNarrowLayout] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>(() => loadSettings().panelMode)
  const [annotationStyle, setAnnotationStyle] = useState<AnnotationStyle>(() => loadSettings().annotationStyle)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const [readerFontSize, setReaderFontSize] = useState(12)
  const [outlineFontSize, setOutlineFontSize] = useState(11)
  const [outlineWidthOverride, setOutlineWidthOverride] = useState<{
    fingerprint: string | null
    width: number
  } | null>(null)
  const [viewportWidth, setViewportWidth] = useState(getViewportWidth)
  const [exportPreviewScale, setExportPreviewScale] = useState(100)
  const [exportViewMode, setExportViewMode] = useState<ExportViewMode>('preview')
  const [exportSearchQuery, setExportSearchQuery] = useState('')
  const [exportSearchIndex, setExportSearchIndex] = useState(0)
  const [accessState, setAccessState] = useState(() => createAccessState())
  const [locale, setLocale] = useState<Locale>(() => getInitialLocale())
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false)
  const [licenseInput, setLicenseInput] = useState('')
  const [licenseMessage, setLicenseMessage] = useState('')
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>('idle')
  const [includeToc, setIncludeToc] = useState(true)
  const [includeHeadingAnchors, setIncludeHeadingAnchors] = useState(true)
  const [includeHighlights, setIncludeHighlights] = useState(true)
  const [includeExportMetadata, setIncludeExportMetadata] = useState(false)
  const [exportTitle, setExportTitle] = useState('wowMD')
  const [htmlFilename, setHtmlFilename] = useState('wowmd-export.html')
  const [betaNoticeDismissed, setBetaNoticeDismissed] = useState(loadBetaNoticeDismissed)
  const markdownBodyRef = useRef<HTMLDivElement | null>(null)

  const t = useMemo(() => createTranslator(locale), [locale])
  const feedbackHref = locale === 'zh' ? '../zh/support.html#feedback' : '../support.html#feedback'
  const supportBaseHref = locale === 'zh' ? '../zh/support.html' : '../support.html'

  useEffect(() => {
    globalThis.document.documentElement.lang = locale
  }, [locale])

  const licenseSummary = useMemo(
    () => getLicenseSummary(accessState, t),
    [t, accessState],
  )


  const annotationsRef = useRef<Annotation[]>([])
  const setAnnotationsRef = useRef<Dispatch<SetStateAction<Annotation[]>>>(() => {})
  // Bridge: useDocumentSession (declared first) needs resetSelectionCapture, which
  // comes from useSelectionCapture (declared after, since it needs `document`).
  const resetSelectionRef = useRef<() => void>(() => {})
  const resetSelectionCaptureBridge = useCallback(() => resetSelectionRef.current(), [])

  const setExportDefaults = useCallback((name: string) => {
    const baseName = name.replace(/\.(md|markdown)$/i, '') || 'wowMD'
    setExportTitle(baseName)
    setHtmlFilename(withThemeSuffix(safeExportFilename(name, 'html'), theme))
  }, [setExportTitle, setHtmlFilename, theme])

  const {
    document,
    error,
    importStatus,
    importSourceUrl,
    view,
    setView,
    showSaveVersion,
    setShowSaveVersion,
    showVersions,
    setShowVersions,
    versions,
    pendingAssociation,
    setPendingAssociation,
    fileInputRef,
    handleInitialRoute,
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
  } = useDocumentSession({
    reanchorAgainstMarkdown,
    annotationsRef,
    setAnnotationsRef,
    resetSelectionCapture: resetSelectionCaptureBridge,
    canOpenUserFiles: licenseSummary.canOpenUserFiles,
    isNarrowLayout,
    setShowOutline,
    setShowNotes,
    setSearchQuery,
    setSearchIndex,
    setExportDefaults,
    t,
  })

  const openExport = useCallback(() => {
    setView('exports')
  }, [setView])

  const openAnotherFromFileMenu = useCallback(() => {
    requestLocalFile()
  }, [requestLocalFile])

  const openSampleFromFileMenu = useCallback(() => {
    void openSample()
  }, [openSample])

  const clearFileFromFileMenu = useCallback(() => {
    clearCurrentFile()
  }, [clearCurrentFile])

  const {
    selectionQuote,
    selectionToolbar,
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
  } = useSelectionCapture({ document, markdownBodyRef })

  useEffect(() => {
    resetSelectionRef.current = resetSelectionCapture
  }, [resetSelectionCapture])

  const handleBeforeAnnotationSave = useCallback(() => {
    clearSelectionPreview()
  }, [clearSelectionPreview])

  const handleAfterAnnotationSave = useCallback(() => {
    setShowNotes(true)
    if (isNarrowLayout) setShowOutline(false)
    resetSelectionCapture()
  }, [isNarrowLayout, resetSelectionCapture])

  const handleLicenseRequired = useCallback(() => {
    setView('license')
    setLicenseMessage(t('activateToSave'))
  }, [setView, t])

  const handleScrollToAnnotation = useCallback(() => {
    setView('reader')
    setShowNotes(true)
    if (isNarrowLayout) setShowOutline(false)
  }, [isNarrowLayout, setView])

  const {
    annotations,
    setAnnotations,
    addAnnotation,
    deleteAnnotation,
    clearDocumentAnnotations,
    scrollToAnnotation,
    openAnnotationDetail,
    locateAnnotation,
    showReanchorCandidates,
    reanchorAnnotation,
    activeAnnotation,
    setActiveAnnotation,
    reanchorCandidates,
    reanchorId,
    pendingClearAnnotations,
    setPendingClearAnnotations,
    filterType,
    setFilterType,
    exportAnnotationsAsJson,
    exportTicketJson,
  } = useAnnotations({
    document,
    markdownBodyRef,
    canSaveAnnotations: licenseSummary.canSaveAnnotations,
    selectionQuote,
    getAnchorMetadata,
    onBeforeAnnotationSave: handleBeforeAnnotationSave,
    onAfterAnnotationSave: handleAfterAnnotationSave,
    onLicenseRequired: handleLicenseRequired,
    onScrollToAnnotation: handleScrollToAnnotation,
  })

  useEffect(() => {
    annotationsRef.current = annotations
    setAnnotationsRef.current = setAnnotations
  }, [annotations, setAnnotations])

  const handleToggleType = useCallback(
    (typeVal: AnnotationType, typeColor: AnnotationColor) => {
      const next = selectedType === typeVal ? null : typeVal
      setSelectedType(next)
      if (next) previewSelectionColor(typeColor)
      else previewSelectionColor('selection')
    },
    [selectedType, setSelectedType, previewSelectionColor],
  )

  const handleToolbarMouseLeave = useCallback(() => {}, [])

  const handleAnnotationSave = useCallback(() => {
    const typeColor = selectedType
      ? ({ clarify: 'blue', dispute: 'rose', important: 'amber', confirmed: 'green' }[selectedType] as AnnotationColor)
      : 'yellow'
    addAnnotation(typeColor, toolbarNote, selectedType, toolbarReplacement)
  }, [selectedType, toolbarNote, toolbarReplacement, addAnnotation])

  useEffect(() => {
    void handleInitialRoute()
    // Initial route import/restore should run once on page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rendered = useMemo(() => {
    if (!document) {
      return {
        html: '',
        baseHtml: '',
        exportHtml: '',
        toc: [] as TocItem[],
        stats: {
          imageCount: 0,
          remoteImageCount: 0,
          tableCount: 0,
          codeBlockCount: 0,
        },
        searchCount: 0,
      }
    }

    const baseHtml = renderMarkdown(document.markdown)
    const highlighted = applyAnnotationHighlights(baseHtml, annotations)
    const searched = applySearchHighlights(highlighted, searchQuery, searchIndex)
    const readerHtml = addCodeCopyButtonsToHtml(searched.html)

    return {
      html: readerHtml,
      baseHtml,
      exportHtml: highlighted,
      toc: buildToc(baseHtml),
      stats: getDocumentStats(baseHtml),
      searchCount: searched.count,
    }
  }, [annotations, document, searchIndex, searchQuery])

  const autoOutlineWidth = useMemo(
    () => getAutoOutlineWidth(rendered.toc, outlineFontSize, viewportWidth, showNotes),
    [outlineFontSize, rendered.toc, showNotes, viewportWidth],
  )
  const documentFingerprint = document?.fingerprint ?? null
  const manualOutlineWidth =
    outlineWidthOverride?.fingerprint === documentFingerprint ? outlineWidthOverride.width : null
  const outlineWidth =
    manualOutlineWidth === null
      ? autoOutlineWidth
      : clampOutlineWidth(manualOutlineWidth, viewportWidth, showNotes)

  useEffect(() => {
    const handleResize = () => setViewportWidth(getViewportWidth())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const exportBodyHtml = useMemo(() => {
    const html = includeHighlights ? rendered.exportHtml : rendered.baseHtml
    return includeHeadingAnchors ? html : stripHeadingIds(html)
  }, [includeHeadingAnchors, includeHighlights, rendered.baseHtml, rendered.exportHtml])

  const htmlPreview = useMemo(() => {
    if (!document) return ''

    return buildCleanHtmlExport({
      title: exportTitle || document.name,
      bodyHtml: exportBodyHtml,
      toc: rendered.toc,
      annotations,
      labels: {
        currentDocument: t('currentDocument'),
        tableOfContents: t('tableOfContents'),
        highlights: t('highlights'),
        highlight: t('highlight'),
        note: t('note'),
        jumpToHighlight: t('jumpToHighlight'),
      },
      generatedAt: new Date(),
      fingerprint: document.fingerprint,
      theme,
      includeToc,
      includeMetadata: includeExportMetadata,
    })
  }, [
    document,
    exportBodyHtml,
    exportTitle,
    includeExportMetadata,
    includeToc,
    rendered.toc,
    annotations,
    t,
    theme,
  ])

  const estimatedHtmlSize = formatBytes(new Blob([htmlPreview || '']).size)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHtmlFilename((filename) =>
        withThemeSuffix(filename || safeExportFilename(document?.name || 'wowmd-export', 'html'), theme),
      )
    }, 0)

    return () => window.clearTimeout(timer)
  }, [document?.name, theme])

  useEffect(() => {
    if (!markdownBodyRef.current) return
    injectH2Foldable(markdownBodyRef.current)
    const activeSearch = markdownBodyRef.current.querySelector(
      '.wowmd-search-hit.active',
    )
    activeSearch?.scrollIntoView({ block: 'center' })
  }, [rendered.html])

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1100px)')
    const sync = () => {
      setIsNarrowLayout(query.matches)
      if (query.matches && showNotes) setShowOutline(false)
    }

    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [showNotes])

  function startOutlineResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = outlineWidth
    const resize = (pointerEvent: globalThis.PointerEvent) => {
      const nextWidth = startWidth + pointerEvent.clientX - startX
      setOutlineWidthOverride({
        fingerprint: documentFingerprint,
        width: clampOutlineWidth(nextWidth, viewportWidth, showNotes),
      })
    }
    const stop = () => {
      window.removeEventListener('pointermove', resize)
      window.removeEventListener('pointerup', stop)
      globalThis.document.body.classList.remove('is-resizing-outline')
    }

    globalThis.document.body.classList.add('is-resizing-outline')
    window.addEventListener('pointermove', resize)
    window.addEventListener('pointerup', stop, { once: true })
  }

  async function handleMarkdownBodyClick(event: MouseEvent<HTMLDivElement>) {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      '.code-copy-button',
    )
    if (!button) return

    event.preventDefault()
    event.stopPropagation()

    const code = button.parentElement?.querySelector('code')
    const codeText = code?.textContent || ''
    if (!codeText) return

    let copied: boolean
    try {
      await navigator.clipboard.writeText(codeText)
      copied = true
    } catch {
      copied = copyTextWithFallback(codeText)
    }

    button.dataset.state = copied ? 'copied' : 'failed'
    button.setAttribute('aria-label', copied ? 'Code copied' : 'Copy failed')
    window.setTimeout(() => {
      delete button.dataset.state
      button.setAttribute('aria-label', 'Copy code')
    }, 1200)
  }

  function downloadHtmlExport() {
    if (!document) return
    if (!licenseSummary.canExport) {
      setView('license')
      setLicenseMessage(t('activateToExport'))
      return
    }

    downloadTextFile(
      htmlFilename || safeExportFilename(document.name, 'html'),
      htmlPreview,
      'text/html;charset=utf-8',
    )
  }

  function activateLicense() {
    setLicenseStatus('activating')
    setLicenseMessage(t('activating'))

    window.setTimeout(() => {
      const result = activateLocalLicense(licenseInput)
      setLicenseMessage(t(result.message))
      if (result.ok) {
        setLicenseStatus('activated')
        setAccessState(createAccessState())
      } else {
        setLicenseStatus('error')
      }
    }, 350)
  }

  function toggleNotes() {
    setShowNotes((current) => {
      const next = !current
      if (next && isNarrowLayout) setShowOutline(false)
      return next
    })
  }

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale)
    saveLocale(nextLocale)
  }

  function dismissBetaNotice() {
    setBetaNoticeDismissed(true)
    try {
      localStorage.setItem(betaNoticeStorageKey, '1')
    } catch {
      /* localStorage may be unavailable in private contexts */
    }
  }

  const showBetaNotice =
    view === 'reader' && document !== null && document.stableId !== 'sample' && !betaNoticeDismissed

  return (
    <div className={`app theme-${theme}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="wowMD home">
          <img src="assets/brand/logo-lockup-outlined.svg" alt="wowMD" />
          <span className="app-beta-badge">Beta</span>
        </a>
        <div className="topbar-right">
          {document ? (
            <nav className="topbar-nav" aria-label="App navigation">
              <button
                type="button"
                className={view === 'reader' ? 'active' : ''}
                onClick={() => setView('reader')}
              >
                {t('navReader')}
              </button>
              <button
                type="button"
                className={view === 'exports' ? 'active' : ''}
                onClick={openExport}
              >
                {t('navExports')}
              </button>
            </nav>
          ) : null}
          <LanguagePicker
            locale={locale}
            isOpen={languageMenuOpen}
            setIsOpen={setLanguageMenuOpen}
            changeLocale={changeLocale}
          />
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={handleFileInput}
        hidden
      />

      <main className="workspace">
        {view === 'reader' ? (
          <>
            {!document ? (
              <section className="import-panel empty-import" aria-labelledby="import-title">
                {importStatus === 'loading' ? (
                  <div className="drop-zone import-status-zone">
                    <div className="drop-icon" aria-hidden="true">
                      <img src="assets/brand/logo-mark.svg" alt="" />
                    </div>
                    <h1 id="import-title">Opening GitHub Markdown...</h1>
                    <p className="intro">
                      wowMD is creating a local reading copy in this browser.
                    </p>
                  </div>
                ) : (
                  <div
                    className="drop-zone"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={handleDrop}
                  >
                    <div className="drop-icon" aria-hidden="true">
                      <img src="assets/brand/logo-mark.svg" alt="" />
                    </div>
                    <h1 id="import-title">
                      {importStatus === 'failed' ? 'Could not open this Markdown file' : t('importTitle')}
                    </h1>
                    <p className="intro">
                      {importStatus === 'failed'
                        ? error || 'Currently wowMD only imports public GitHub Markdown files.'
                        : t('importIntro')}
                    </p>
                    {importStatus === 'failed' && importSourceUrl ? (
                      <a
                        className="primary-action"
                        href={importSourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open original GitHub page
                      </a>
                    ) : (
                      <button
                        className="primary-action"
                        type="button"
                        onClick={requestLocalFile}
                      >
                        <span className="button-icon" aria-hidden="true">
                          <i className="ti ti-folder-open" />
                        </span>
                        {t('chooseMarkdown')}
                      </button>
                    )}
                    <button className="ghost-action" type="button" onClick={() => void openSample()}>
                      <span className="button-icon" aria-hidden="true">
                        <i className="ti ti-eye" />
                      </span>
                      {t('openSample')}
                    </button>
                  </div>
                )}

                {importStatus !== 'loading' ? <p className="privacy-hint">{t('privacyHint')}</p> : null}
                {error && importStatus !== 'failed' ? <p className="error-message">{error}</p> : null}
              </section>
            ) : null}

            <ReaderToolbar
              t={t}
              theme={theme}
              setTheme={setTheme}
              showOutline={showOutline}
              outlineWidth={outlineWidth}
              setShowOutline={setShowOutline}
              showNotes={showNotes}
              toggleNotes={toggleNotes}
              documentOpen={Boolean(document)}
              documentName={document?.name || ''}
              openExport={openExport}
              openSaveVersion={() => setShowSaveVersion(true)}
              openVersions={() => void openVersions()}
              reviewSuggestedRelationship={() => void reviewSuggestedRelationship()}
              hasSuggestedRelationship={Boolean(document?.suggestedParentDocumentId)}
              openMap={() => setShowMap(true)}
              openSettings={() => setShowSettings(true)}
              readerFontSize={readerFontSize}
              setReaderFontSize={setReaderFontSize}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchIndex={searchIndex}
              setSearchIndex={setSearchIndex}
              searchCount={rendered.searchCount}
              openAnother={openAnotherFromFileMenu}
              openSample={openSampleFromFileMenu}
              clearFile={clearFileFromFileMenu}
              annotationCount={annotations.length}
            />

            {selectionToolbar && selectionQuote ? (
              <AnnotationToolbar
                x={selectionToolbar.x}
                y={selectionToolbar.y}
                selectedType={selectedType}
                toolbarNote={toolbarNote}
                toolbarReplacement={toolbarReplacement}
                selectionQuote={selectionQuote}
                showReplacement={showReplacement}
                canSave={!!(selectedType || toolbarNote.trim())}
                onToggleType={handleToggleType}
                onTypeHover={previewSelectionColor}
                onToolbarMouseLeave={handleToolbarMouseLeave}
                onNoteChange={setToolbarNote}
                onToggleReplacement={() => setShowReplacement(!showReplacement)}
                onReplacementChange={setToolbarReplacement}
                onSave={handleAnnotationSave}
                t={t}
              />
            ) : null}

            <section
              className={`reader-shell ${showOutline ? 'has-outline' : 'no-outline'} ${showNotes ? 'has-notes' : 'no-notes'}`}
              id="reader"
              style={
                {
                  '--reader-font-size': `${readerFontSize}px`,
                  '--outline-font-size': `${outlineFontSize}px`,
                  '--outline-width': `${outlineWidth}px`,
                } as CSSProperties
              }
            >
              {showOutline ? (
                <aside className="outline" aria-label="Document outline">
                  <div className="outline-header">
                    <div>
                      <span>{t('outline')}</span>
                      {document ? <small>{rendered.toc.length} sections</small> : null}
                    </div>
                    <div className="scale-controls outline-scale-controls" aria-label="Outline text size">
                      <button
                        type="button"
                        aria-label="Decrease outline text size"
                        onClick={() => setOutlineFontSize((size) => Math.max(10, size - 1))}
                      >
                        -
                      </button>
                      <span>{outlineFontSize}</span>
                      <button
                        type="button"
                        aria-label="Increase outline text size"
                        onClick={() => setOutlineFontSize((size) => Math.min(14, size + 1))}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {rendered.toc.length ? (
                    <ol>
                      {rendered.toc.map((item) => (
                        <li key={item.id} style={{ '--level': item.level } as CSSProperties}>
                          <a href={`#${item.id}`}>{item.text}</a>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="empty-outline">{t('readerEmptyBody')}</p>
                  )}
                  <button
                    className="outline-resize-handle"
                    type="button"
                    aria-label="Resize outline"
                    onPointerDown={startOutlineResize}
                  />
                </aside>
              ) : null}

              <article className="reader-card">
                {document ? (
                  <>
                    <div className="reader-document">
                      {showBetaNotice ? (
                        <aside className="beta-reader-notice" aria-labelledby="beta-reader-notice-title">
                          <div className="beta-reader-notice-copy">
                            <strong id="beta-reader-notice-title">{t('betaNoticeTitle')}</strong>
                            <p>{t('betaNoticeBody')}</p>
                            <p>{t('betaNoticeFooter')}</p>
                          </div>
                          <div className="beta-reader-notice-actions">
                            <a href={feedbackHref}>{t('betaNoticeFeedback')}</a>
                            <button type="button" onClick={dismissBetaNotice}>
                              {t('betaNoticeDismiss')}
                            </button>
                          </div>
                        </aside>
                      ) : null}
                      <header className="document-header">
                        <div>
                          <p className="eyebrow">{t('currentDocument')}</p>
                          <h2>{document.name}</h2>
                          {typeof document.source === 'object' && document.source?.sourceUrl ? (
                            <a
                              className="document-source-link"
                              href={(document.source as { sourceUrl: string }).sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {(document.source as { label: string }).label}
                            </a>
                          ) : null}
                        </div>
                        <code>{document.fingerprint.slice(0, 12)}</code>
                      </header>
                      <div
                        ref={markdownBodyRef}
                        className="markdown-body"
                        onClick={handleMarkdownBodyClick}
                        onMouseUp={captureSelection}
                        onKeyUp={captureSelection}
                        dangerouslySetInnerHTML={{ __html: rendered.html }}
                      />
                    </div>
                    <FeedbackLink href={feedbackHref} label={t('feedback')} />
                  </>
                ) : (
                  <div className="empty-reader">
                    <p className="eyebrow">{t('noDocument')}</p>
                    <h2>{t('readerEmptyTitle')}</h2>
                    <p>{t('readerEmptyBody')}</p>
                  </div>
                )}
              </article>

              {showNotes ? (
                <NotesPanel
                  annotations={annotations}
                  selectionQuote={selectionQuote}
                  filterType={filterType}
                  setFilterType={setFilterType}
                  exportTicketJson={exportTicketJson}
                  exportAnnotationsAsJson={exportAnnotationsAsJson}
                  setPendingClearAnnotations={setPendingClearAnnotations}
                  scrollToAnnotation={scrollToAnnotation}
                  openAnnotationDetail={openAnnotationDetail}
                  deleteAnnotation={deleteAnnotation}
                  showReanchorCandidates={showReanchorCandidates}
                  reanchorAnnotation={reanchorAnnotation}
                  reanchorId={reanchorId}
                  reanchorCandidates={reanchorCandidates}
                  supportBaseHref={supportBaseHref}
                  t={t}
                />
              ) : null}
            </section>
          </>
        ) : null}

        {activeAnnotation ? (
          <div className="annotation-modal-layer" role="presentation">
            <section
              className={`annotation-modal annotation-detail note-${activeAnnotation.color}`}
              role="dialog"
              aria-modal="true"
              aria-label={t('highlight')}
            >
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setActiveAnnotation(null)}
              >
                <span className="icon-mask icon-x" aria-hidden="true" />
              </button>
              <p className="eyebrow">
                {activeAnnotation.note ? t('note') : t('highlight')}
              </p>
              <h2>{activeAnnotation.headingPath.at(-1) || t('currentDocument')}</h2>
              <blockquote>{activeAnnotation.quote}</blockquote>
              {activeAnnotation.note ? <p>{activeAnnotation.note}</p> : null}
              {activeAnnotation.suggestedReplacement ? (
                <section className="annotation-replacement">
                  <h3>{t('suggestedReplacement')}</h3>
                  <p>{activeAnnotation.suggestedReplacement}</p>
                </section>
              ) : null}
              <div className="modal-actions">
                <button
                  className="ghost-action"
                  type="button"
                  onClick={() => setActiveAnnotation(null)}
                >
                  {t('close')}
                </button>
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => locateAnnotation(activeAnnotation)}
                >
                  <span className="icon-mask icon-map-pin" aria-hidden="true" />
                  <span>{t('locate')}</span>
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {pendingClearAnnotations ? (
          <div className="annotation-modal-layer" role="presentation">
            <section
              className="annotation-modal confirm-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t('deleteAllNotesConfirm')}
            >
              <button
                className="modal-close"
                type="button"
                aria-label="Close"
                onClick={() => setPendingClearAnnotations(false)}
              >
                <span className="icon-mask icon-x" aria-hidden="true" />
              </button>
              <p className="eyebrow">{t('notes')}</p>
              <h2>{t('clear')}</h2>
              <p>{t('deleteAllNotesConfirm')}</p>
              <div className="modal-actions">
                <button
                  className="ghost-action"
                  type="button"
                  onClick={() => setPendingClearAnnotations(false)}
                >
                  {t('cancel')}
                </button>
                <button
                  className="primary-action danger-action"
                  type="button"
                  onClick={clearDocumentAnnotations}
                >
                  {t('clear')}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {showSaveVersion && document ? (
          <SaveReviewedCopy
            document={document}
            annotations={annotations}
            onSaved={(result) => {
              void handleSavedReviewedCopy(result)
            }}
            onClose={() => setShowSaveVersion(false)}
          />
        ) : null}

        {showMap && document ? (
          <UnderstandingMap
            annotations={annotations}
            tocItems={rendered.toc}
            onClose={() => setShowMap(false)}
            onJumpToHeading={(id) => {
              setShowMap(false)
              const el = window.document.getElementById(id)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
            supportBaseHref={supportBaseHref}
            t={t}
          />
        ) : null}

        {showSettings ? (
          <SettingsPanel
            panelMode={panelMode}
            setPanelMode={setPanelMode}
            annotationStyle={annotationStyle}
            setAnnotationStyle={setAnnotationStyle}
            onClose={() => setShowSettings(false)}
          />
        ) : null}

        {showVersions && document ? (
          <VersionHistory
            versions={versions}
            currentId={document.stableId}
            onOpenVersion={(id) => void openVersion(id)}
            onClose={() => setShowVersions(false)}
          />
        ) : null}

        {view === 'exports' ? (
          <Suspense fallback={<section className="center-panel"><p className="intro">{t('exportsTitle')}</p></section>}>
            <ExportWorkspace
              t={t}
              document={document}
              theme={theme}
              setTheme={setTheme}
              exportPreviewScale={exportPreviewScale}
              setExportPreviewScale={setExportPreviewScale}
              exportViewMode={exportViewMode}
              setExportViewMode={setExportViewMode}
              exportSearchQuery={exportSearchQuery}
              setExportSearchQuery={setExportSearchQuery}
              exportSearchIndex={exportSearchIndex}
              setExportSearchIndex={setExportSearchIndex}
              htmlPreview={htmlPreview}
              toc={rendered.toc}
              annotations={annotations}
              includeToc={includeToc}
              setIncludeToc={setIncludeToc}
              includeHeadingAnchors={includeHeadingAnchors}
              setIncludeHeadingAnchors={setIncludeHeadingAnchors}
              includeHighlights={includeHighlights}
              setIncludeHighlights={setIncludeHighlights}
              includeExportMetadata={includeExportMetadata}
              setIncludeExportMetadata={setIncludeExportMetadata}
              htmlFilename={htmlFilename}
              setHtmlFilename={setHtmlFilename}
              estimatedHtmlSize={estimatedHtmlSize}
              canExport={licenseSummary.canExport}
              downloadHtmlExport={downloadHtmlExport}
              feedbackHref={feedbackHref}
            />
          </Suspense>
        ) : null}

        {pendingAssociation ? (
          <FileAssociationDialog
            candidate={pendingAssociation.candidate}
            t={t}
            onAssociate={() => void confirmPendingAssociation()}
            onOpenAsNew={() => void openPendingAsNew()}
            onClose={() => setPendingAssociation(null)}
          />
        ) : null}

        {view === 'license' ? (
          <section className="center-panel license-panel">
            <p className="eyebrow">{t('navLicense')}</p>
            <h1>{t('licenseTitle')}</h1>
            <p className="intro">{t('licenseIntro')}</p>
            <label className="license-field">
              <span>{t('licenseKey')}</span>
              <input
                placeholder="WOWMD-XXXX-XXXX"
                value={licenseInput}
                onChange={(event) => {
                  setLicenseInput(event.target.value)
                  setLicenseStatus('idle')
                  setLicenseMessage('')
                }}
              />
            </label>
            <button className="resend-link" type="button">
              {t('resendKey')} →
            </button>
            <div className="center-actions">
              <button
                type="button"
                disabled={licenseStatus === 'activating'}
                onClick={activateLicense}
              >
                {licenseStatus === 'activating' ? t('activating') : t('activate')}
              </button>
            </div>
            {licenseMessage ? (
              <p className={`license-result ${licenseStatus}`}>{licenseMessage}</p>
            ) : null}
            <div className="license-buy">
              <span>Don't have a license yet?</span>
              <button type="button">{t('buyLicense')}</button>
            </div>
            <p className="license-note">
              {t('currentStatus')}: {licenseSummary.label} / {licenseSummary.detail}
            </p>
          </section>
        ) : null}

      </main>
    </div>
  )
}

export default App
