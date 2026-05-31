import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
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
  createTrialState,
  getLicenseSummary,
} from './license'
import {
  buildToc,
  getDocumentStats,
  renderMarkdown,
  type TocItem,
} from './markdown'
import { applySearchHighlights } from './search'
import SaveAsVersion from './SaveAsVersion'
import UnderstandingMap from './UnderstandingMap'
import SettingsPanel from './SettingsPanel'
import VersionHistory from './VersionHistory'
import { loadSettings, type PanelMode, type AnnotationStyle } from './settingsStore'
import { useAnnotations, reanchorAgainstMarkdown } from './hooks/useAnnotations'
import { useSelectionCapture } from './hooks/useSelectionCapture'
import { useDocumentSession } from './hooks/useDocumentSession'
import type { OpenDocument } from './types'

type ThemeName = 'light' | 'dark'
type ExportViewMode = 'preview' | 'source'
type LicenseStatus = 'idle' | 'activating' | 'activated' | 'error'

const themeNames: ThemeName[] = ['light', 'dark']

const localeOptions: Array<{
  locale: Locale
  label: string
  flag: string
}> = [
  { locale: 'en', label: 'English', flag: 'gb' },
  { locale: 'zh', label: 'Chinese', flag: 'cn' },
  { locale: 'ja', label: 'Japanese', flag: 'jp' },
  { locale: 'ko', label: 'Korean', flag: 'kr' },
  { locale: 'de', label: 'Deutsch', flag: 'de' },
  { locale: 'fr', label: 'French', flag: 'fr' },
]

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
  const [outlineWidth, setOutlineWidth] = useState(300)
  const [exportPreviewScale, setExportPreviewScale] = useState(100)
  const [exportViewMode, setExportViewMode] = useState<ExportViewMode>('preview')
  const [exportSearchQuery, setExportSearchQuery] = useState('')
  const [exportSearchIndex, setExportSearchIndex] = useState(0)
  const [trialState, setTrialState] = useState(() => createTrialState())
  const [showTrialConfirm, setShowTrialConfirm] = useState(false)
  const [pendingTrialFile, setPendingTrialFile] = useState<File | null>(null)
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
  const markdownBodyRef = useRef<HTMLDivElement | null>(null)

  const t = useMemo(() => createTranslator(locale), [locale])
  const feedbackHref = locale === 'en' ? '../feedback.html' : `../${locale}/feedback.html`

  const licenseSummary = useMemo(
    () => getLicenseSummary(trialState, t),
    [t, trialState],
  )

  const trialNeedsConfirmation = Boolean(
    !trialState.startedAt && !trialState.isLicensed,
  )

  const annotationsRef = useRef<Annotation[]>([])
  const setAnnotationsRef = useRef<Dispatch<SetStateAction<Annotation[]>>>(() => {})

  const setExportDefaults = useCallback((name: string) => {
    const baseName = name.replace(/\.(md|markdown)$/i, '') || 'wowMD'
    setExportTitle(baseName)
    setHtmlFilename(withThemeSuffix(safeExportFilename(name, 'html'), theme))
  }, [setExportTitle, setHtmlFilename, withThemeSuffix, theme])

  const {
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
    openSample,
    clearCurrentFile,
    requestLocalFile,
    confirmTrialAction,
    handleFileInput,
    handleDrop,
    handleSavedNewVersion,
    openVersions,
    openVersion,
  } = useDocumentSession({
    reanchorAgainstMarkdown,
    annotationsRef,
    setAnnotationsRef,
    resetSelectionCapture,
    canOpenUserFiles: licenseSummary.canOpenUserFiles,
    setTrialState,
    isNarrowLayout,
    setShowOutline,
    setShowNotes,
    setSearchQuery,
    setSearchIndex,
    setExportDefaults,
    t,
    trialNeedsConfirmation,
    setPendingTrialFile,
    setShowTrialConfirm,
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
  } = useSelectionCapture({ document, markdownBodyRef })

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
  }, [t])

  const handleScrollToAnnotation = useCallback(() => {
    setView('reader')
    setShowNotes(true)
    if (isNarrowLayout) setShowOutline(false)
  }, [isNarrowLayout])

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

  annotationsRef.current = annotations
  setAnnotationsRef.current = setAnnotations

  useEffect(() => {
    void handleInitialRoute()
    // Initial route import/restore should run once on page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
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
      setOutlineWidth(Math.min(440, Math.max(240, nextWidth)))
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
        setTrialState(createTrialState())
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

  return (
    <div className={`app theme-${theme}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="wowMD home">
          <img src="assets/brand/logo-lockup-outlined.svg" alt="wowMD" />
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
                {importStatus !== 'loading' ? <p className="trial-hint">{t('trialHint')}</p> : null}
                {showTrialConfirm ? (
                  <div className="trial-confirm-layer">
                    <div
                      className="trial-confirm"
                      role="alertdialog"
                      aria-modal="true"
                      aria-labelledby="trial-confirm-title"
                    >
                      <button
                        className="trial-confirm-close"
                        type="button"
                        aria-label="Close"
                        onClick={() => {
                          trialFilePickerConfirmedRef.current = false
                          setShowTrialConfirm(false)
                          setPendingTrialFile(null)
                        }}
                      >
                        <span aria-hidden="true" />
                      </button>
                      <strong id="trial-confirm-title">{t('trialConfirmTitle')}</strong>
                      <p>{t('trialConfirmBody')}</p>
                      <div>
                        <button
                          className="primary-action"
                          type="button"
                          onClick={confirmTrialAction}
                        >
                          {pendingTrialFile
                            ? t('trialConfirmOpenDropped')
                            : t('trialConfirmAction')}
                        </button>
                        <button
                          className="ghost-action"
                          type="button"
                          onClick={() => void openSample()}
                        >
                          {t('openSample')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
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
              <div
                className="floating-markup floating-markup-v2"
                style={{
                  left: selectionToolbar.x,
                  top: selectionToolbar.y,
                }}
                aria-label="Annotation type picker"
                onMouseLeave={() => {
                  if (!selectedType) clearSelectionPreview()
                }}
              >
                <div className="type-chips">
                  {(['clarify', 'dispute', 'important', 'confirmed'] as const).map((typeVal) => {
                    const typeColor = { clarify: 'blue', dispute: 'rose', important: 'amber', confirmed: 'green' }[typeVal] as AnnotationColor
                    const typeKeys: Record<string, string> = { clarify: 'typeClarify', dispute: 'typeDispute', important: 'typeImportant', confirmed: 'typeConfirmed' }
                    return (
                      <button
                        key={typeVal}
                        className={`type-chip chip-${typeVal} ${selectedType === typeVal ? 'active' : ''}`}
                        type="button"
                        data-preview-color={typeColor}
                        aria-label={t(typeKeys[typeVal])}
                        aria-pressed={selectedType === typeVal}
                        onFocus={() => previewSelectionColor(typeColor)}
                        onMouseEnter={() => previewSelectionColor(typeColor)}
                        onClick={() => {
                          setSelectedType(selectedType === typeVal ? null : typeVal)
                          if (selectedType !== typeVal) previewSelectionColor(typeColor)
                          else clearSelectionPreview()
                        }}
                      >
                        <span className="type-chip-icon" aria-hidden="true">
                          {typeVal === 'clarify' && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M7.6 9.5h.8v-4a.4.4 0 0 0-.4-.4H7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="8" cy="11.5" r=".7" fill="currentColor"/></svg>}
                          {typeVal === 'dispute' && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 13.5V3.8a.8.8 0 0 1 .8-.8h3.5l.7 1.5h4.2a.8.8 0 0 1 .8.8V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 13.5l1.5-3h6l1.5 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><line x1="7.5" y1="13.5" x2="7.5" y2="15" stroke="currentColor" strokeWidth="1.3"/></svg>}
                          {typeVal === 'important' && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l2 4.5 5 .5-3.5 3.5 1 5L8 12.5l-4.5 2.5 1-5L1 6.5l5-.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>}
                          {typeVal === 'confirmed' && <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </span>
                        <span className="type-chip-label">{t(typeKeys[typeVal])}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="toolbar-note-row">
                  <input
                    className="toolbar-note-input"
                    type="text"
                    placeholder={t('note')}
                    maxLength={1000}
                    value={toolbarNote}
                    onChange={(e) => setToolbarNote(e.target.value)}
                  />
                </div>
                <div className="toolbar-replacement-row">
                  <button
                    className="toolbar-replacement-toggle"
                    type="button"
                    onClick={() => setShowReplacement(!showReplacement)}
                  >
                    {t('suggestedReplacement')}
                  </button>
                  {showReplacement ? (
                    <textarea
                      className="toolbar-replacement-input"
                      placeholder={t('suggestedReplacementHint')}
                      value={toolbarReplacement}
                      onChange={(e) => setToolbarReplacement(e.target.value)}
                      rows={3}
                    />
                  ) : null}
                </div>
                <div className="toolbar-actions">
                  <button
                    className="toolbar-confirm"
                    type="button"
                    disabled={!selectedType && !toolbarNote.trim()}
                    onClick={() => {
                      const typeColor = selectedType
                        ? ({ clarify: 'blue', dispute: 'rose', important: 'amber', confirmed: 'green' }[selectedType] as AnnotationColor)
                        : 'yellow'
                      addAnnotation(typeColor, toolbarNote, selectedType, toolbarReplacement)
                    }}
                  >
                    {t('save')}
                  </button>
                </div>
              </div>
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
                ) : trialState.isExpired ? (
                  <div className="empty-reader expired-reader">
                    <p className="eyebrow">{t('trialExpired')}</p>
                    <h2>{t('licenseRequired')}</h2>
                    <p>{t('sampleStillAvailable')}</p>
                    <div className="center-actions">
                      <button type="button" onClick={() => setView('license')}>
                        {t('buyLicense')}
                      </button>
                      <button type="button" onClick={() => void openSample()}>
                        {t('openSample')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="empty-reader">
                    <p className="eyebrow">{t('noDocument')}</p>
                    <h2>{t('readerEmptyTitle')}</h2>
                    <p>{t('readerEmptyBody')}</p>
                  </div>
                )}
              </article>

              {showNotes ? (
                <aside className="notes-panel" aria-label="Document notes">
                  <div className="outline-header">
                    <span>{t('notes')}</span>
                    <small>{annotations.length} notes</small>
                  </div>
                  {selectionQuote ? (
                    <div className="selection-preview">
                      <span>{t('selected')}</span>
                      <p>{selectionQuote}</p>
                    </div>
                  ) : null}
                  {annotations.length ? (
                    <div className="note-actions">
                      <select
                        className="type-filter"
                        value={filterType ?? ''}
                        onChange={(e) => setFilterType((e.target.value || null) as AnnotationType | null)}
                      >
                        <option value="">{t('filterAll')}</option>
                        <option value="clarify">{t('typeClarify')}</option>
                        <option value="dispute">{t('typeDispute')}</option>
                        <option value="important">{t('typeImportant')}</option>
                        <option value="confirmed">{t('typeConfirmed')}</option>
                      </select>
                      <button type="button" onClick={exportTicketJson}>
                        {t('exportTicketJson')}
                      </button>
                      <button type="button" onClick={exportAnnotationsAsJson}>
                        {t('exportJson')}
                      </button>
                      <button type="button" onClick={() => setPendingClearAnnotations(true)}>
                        {t('clear')}
                      </button>
                    </div>
                  ) : null}
                  {annotations.length ? (() => {
                    const typeLabels: Record<string, string> = {
                      clarify: 'typeClarify', dispute: 'typeDispute',
                      important: 'typeImportant', confirmed: 'typeConfirmed',
                    }
                    const filtered = filterType
                      ? annotations.filter((a) => a.type === filterType)
                      : annotations
                    const activeAnnotations = filtered.filter((a) => !a.orphaned)
                    const orphanedAnnotations = filtered.filter((a) => a.orphaned)
                    const colorNames: Record<string, string> = {
                      yellow: 'Yellow', blue: 'Blue', green: 'Green',
                      rose: 'Rose', violet: 'Violet', amber: 'Amber',
                    }
                    const renderItem = (annotation: Annotation) => (
                      <li
                        key={annotation.id}
                        className={`note-sticker note-${annotation.color} ${annotation.note ? 'has-note' : ''} ${annotation.orphaned ? 'note-orphaned' : ''}`}
                      >
                        <button
                          className="note-locate"
                          type="button"
                          aria-label="Locate annotation"
                          onClick={() => scrollToAnnotation(annotation.id)}
                          disabled={annotation.orphaned}
                        >
                          <span className="icon-mask icon-map-pin" aria-hidden="true" />
                        </button>
                        <button
                          className="note-sticker-body"
                          type="button"
                          onClick={() => openAnnotationDetail(annotation)}
                        >
                          <span className="note-kind">
                            {annotation.orphaned ? '[orphaned] ' : ''}
                            {annotation.type
                              ? t(typeLabels[annotation.type])
                              : annotation.legacyColor
                                ? `${t('note')} · ${colorNames[annotation.legacyColor] ?? annotation.legacyColor}`
                                : t('note')}
                          </span>
                          <span className="note-preview">
                            {truncateText(annotation.note || annotation.quote, 34)}
                          </span>
                          <time dateTime={annotation.updatedAt}>
                            {new Date(annotation.updatedAt).toLocaleString()}
                          </time>
                        </button>
                        {annotation.orphaned ? (
                          <button
                            className="note-reanchor-btn"
                            type="button"
                            onClick={() => showReanchorCandidates(annotation)}
                          >
                            Find
                          </button>
                        ) : null}
                        <button
                          className="note-delete"
                          type="button"
                          onClick={() => deleteAnnotation(annotation.id)}
                        >
                          {t('delete')}
                        </button>
                        {reanchorId === annotation.id && reanchorCandidates.length > 0 ? (
                          <div className="reanchor-candidates">
                            {reanchorCandidates.map((c, i) => (
                              <button
                                key={i}
                                className="reanchor-candidate"
                                type="button"
                                onClick={() => reanchorAnnotation(annotation.id, c)}
                              >
                                ...{c.snippet}...
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {reanchorId === annotation.id && reanchorCandidates.length === 0 ? (
                          <p className="reanchor-empty">No matching candidates found.</p>
                        ) : null}
                      </li>
                    )
                    return (
                      <ol className="note-list">
                        {activeAnnotations.map(renderItem)}
                        {orphanedAnnotations.length > 0 && activeAnnotations.length > 0 ? (
                          <li className="note-orphaned-separator" aria-hidden="true" />
                        ) : null}
                        {orphanedAnnotations.map(renderItem)}
                      </ol>
                    )
                  })() : (
                    <p className="empty-outline">{t('selectToNote')}</p>
                  )}
                </aside>
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
          <SaveAsVersion
            document={document}
            onSaved={(newFilename) => {
              void handleSavedNewVersion(newFilename)
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

function FeedbackLink(props: { href: string; label: string }) {
  return (
    <a
      className="reader-feedback-link"
      href={props.href}
      target="_blank"
      rel="noreferrer"
      aria-label={props.label}
    >
      <span className="feedback-bubble-icon" aria-hidden="true" />
      <span>{props.label}</span>
    </a>
  )
}

function FileMenu(props: {
  documentName: string
  openAnother: () => void
  openSample: () => void
  clearFile: () => void
  openSaveVersion: () => void
  openVersions: () => void
  t: (key: string) => string
}) {
  const closeThen = (event: MouseEvent<HTMLButtonElement>, action: () => void) => {
    const menu = event.currentTarget.closest('details')
    if (menu) menu.open = false
    action()
  }

  return (
    <details className="file-menu">
      <summary>{props.documentName}</summary>
      <div className="file-menu-list">
        <button type="button" onClick={(event) => closeThen(event, props.openVersions)}>
          {props.t('versions')}
        </button>
        <button type="button" onClick={(event) => closeThen(event, props.openSaveVersion)}>
          {props.t('saveNewVersion')}
        </button>
        <div className="file-menu-sep" role="separator" />
        <button type="button" onClick={(event) => closeThen(event, props.openAnother)}>
          {props.t('openAnother')}
        </button>
        <button type="button" onClick={(event) => closeThen(event, props.openSample)}>
          {props.t('openSample')}
        </button>
        <button type="button" onClick={(event) => closeThen(event, props.clearFile)}>
          {props.t('clearFile')}
        </button>
      </div>
    </details>
  )
}

function SearchControl(props: {
  t: (key: string) => string
  value: string
  onChange: (value: string) => void
  index: number
  count: number
  previous: () => void
  next: () => void
  disabled?: boolean
}) {
  const hasResults = props.count > 0

  return (
    <div className="search-control" role="search">
      <input
        type="search"
        value={props.value}
        disabled={props.disabled}
        placeholder={props.t('search')}
        aria-label={props.t('search')}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <span className="search-count">
        {props.value.trim() ? (hasResults ? `${props.index + 1}/${props.count}` : `0/0`) : props.t('search')}
      </span>
      <button
        type="button"
        disabled={props.disabled || !hasResults}
        aria-label={props.t('prev')}
        onClick={props.previous}
      >
        -
      </button>
      <button
        type="button"
        disabled={props.disabled || !hasResults}
        aria-label={props.t('next')}
        onClick={props.next}
      >
        +
      </button>
    </div>
  )
}

type ReaderToolbarProps = {
  t: (key: string) => string
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  showOutline: boolean
  outlineWidth: number
  setShowOutline: (updater: (value: boolean) => boolean) => void
  showNotes: boolean
  toggleNotes: () => void
  documentOpen: boolean
  documentName: string
  openExport: () => void
  openSaveVersion: () => void
  openVersions: () => void
  openMap: () => void
  openSettings: () => void
  readerFontSize: number
  setReaderFontSize: (value: number | ((value: number) => number)) => void
  searchQuery: string
  setSearchQuery: (value: string) => void
  searchIndex: number
  setSearchIndex: (value: number | ((value: number) => number)) => void
  searchCount: number
  openAnother: () => void
  openSample: () => void
  clearFile: () => void
  annotationCount: number
}

function ReaderToolbar(props: ReaderToolbarProps) {
  const mapDisabled = !props.documentOpen || props.annotationCount === 0
  return (
    <section
      className={`tool-row reader-tool-row ${props.showOutline ? 'has-outline' : 'no-outline'} ${props.showNotes ? 'has-notes' : 'no-notes'}`}
      style={{ '--outline-width': `${props.outlineWidth}px` } as CSSProperties}
      aria-label="Reader controls"
    >
      <div className="toolbar-left">
        <div className="segmented">
          {themeNames.map((name) => (
            <button
              key={name}
              type="button"
              className={props.theme === name ? 'active' : ''}
              onClick={() => props.setTheme(name)}
            >
              {props.t(name)}
            </button>
          ))}
        </div>
        <span className="toolbar-divider" aria-hidden="true" />
        <div className="panel-toggles">
          <button
            type="button"
            className={props.showOutline ? 'active' : ''}
            onClick={() => props.setShowOutline((value) => !value)}
          >
            {props.t('outline')}
          </button>
          <button
            type="button"
            className={props.showNotes ? 'active' : ''}
            onClick={props.toggleNotes}
          >
            {props.t('notes')}
          </button>
        </div>
      </div>
      <div className="toolbar-center toolbar-center-control">
        {props.documentOpen ? (
          <FileMenu
            documentName={props.documentName}
            openAnother={props.openAnother}
            openSample={props.openSample}
            clearFile={props.clearFile}
            openSaveVersion={props.openSaveVersion}
            openVersions={props.openVersions}
            t={props.t}
          />
        ) : null}
        <div className="scale-controls" aria-label="Reader text size">
          <button
            type="button"
            aria-label="Decrease reader text size"
            onClick={() => props.setReaderFontSize((size) => Math.max(11, size - 1))}
          >
            -
          </button>
          <span>{props.readerFontSize}</span>
          <button
            type="button"
            aria-label="Increase reader text size"
            onClick={() => props.setReaderFontSize((size) => Math.min(18, size + 1))}
          >
            +
          </button>
        </div>
        <SearchControl
          t={props.t}
          value={props.searchQuery}
          onChange={(value) => {
            props.setSearchQuery(value)
            props.setSearchIndex(0)
          }}
          index={props.searchIndex}
          count={props.searchCount}
          disabled={!props.documentOpen}
          previous={() =>
            props.setSearchIndex((index) =>
              props.searchCount ? (index - 1 + props.searchCount) % props.searchCount : 0,
            )
          }
          next={() =>
            props.setSearchIndex((index) =>
              props.searchCount ? (index + 1) % props.searchCount : 0,
            )
          }
        />
      </div>
      <div className="toolbar-right" id="exports">
        <div className="export-actions">
          <button
            type="button"
            className={`map-action ${mapDisabled ? 'is-disabled' : ''}`}
            aria-disabled={mapDisabled}
            title={props.documentOpen && props.annotationCount === 0 ? props.t('mapEmptyHint') : undefined}
            onClick={() => {
              if (!mapDisabled) props.openMap()
            }}
          >
            {props.t('map')}
          </button>
          <button
            type="button"
            className="export-html-action"
            disabled={!props.documentOpen}
            onClick={props.openExport}
          >
            {props.t('exportHtml')}
          </button>
          <button
            type="button"
            className="toolbar-settings-action"
            aria-label={props.t('settings')}
            title={props.t('settings')}
            onClick={props.openSettings}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M19.4 13a1.6 1.6 0 0 0 .32 1.76l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.6 1.6 0 0 0-1.76-.32 1.6 1.6 0 0 0-1 1.46V21a2 2 0 0 1-4 0v-.08a1.6 1.6 0 0 0-1.05-1.46 1.6 1.6 0 0 0-1.76.32l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.46-1H3a2 2 0 0 1 0-4h.08A1.6 1.6 0 0 0 4.6 8.94a1.6 1.6 0 0 0-.32-1.76l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.6 1.6 0 0 0 1.76.32H9a1.6 1.6 0 0 0 1-1.46V3a2 2 0 0 1 4 0v.08a1.6 1.6 0 0 0 1 1.46 1.6 1.6 0 0 0 1.76-.32l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.6 1.6 0 0 0-.32 1.76V9a1.6 1.6 0 0 0 1.46 1H21a2 2 0 0 1 0 4h-.08a1.6 1.6 0 0 0-1.46 1z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}

function LanguagePicker(props: {
  locale: Locale
  isOpen: boolean
  setIsOpen: (isOpen: boolean) => void
  changeLocale: (locale: Locale) => void
}) {
  const activeOption =
    localeOptions.find((option) => option.locale === props.locale) || localeOptions[0]

  return (
    <div className={`language-picker ${props.isOpen ? 'is-open' : ''}`}>
      <button
        className="language-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={props.isOpen}
        aria-label="Language selector"
        onClick={() => props.setIsOpen(!props.isOpen)}
        onBlur={(event) => {
          if (!event.currentTarget.parentElement?.contains(event.relatedTarget)) {
            props.setIsOpen(false)
          }
        }}
      >
        <img
          className="flag"
          src={`assets/flags/${activeOption.flag}.svg`}
          alt=""
        />
        <span className="language-arrow" aria-hidden="true" />
      </button>
      <div className="language-menu" role="listbox" hidden={!props.isOpen}>
        {localeOptions.map((option) => (
          <button
            key={option.locale}
            type="button"
            role="option"
            aria-label={option.label}
            aria-selected={props.locale === option.locale}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              props.changeLocale(option.locale)
              props.setIsOpen(false)
            }}
          >
            <img
              className="flag"
              src={`assets/flags/${option.flag}.svg`}
              alt=""
            />
          </button>
        ))}
      </div>
    </div>
  )
}

type ExportWorkspaceProps = {
  t: (key: string) => string
  document: OpenDocument | null
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  exportPreviewScale: number
  setExportPreviewScale: (value: number | ((value: number) => number)) => void
  exportViewMode: ExportViewMode
  setExportViewMode: (mode: ExportViewMode) => void
  exportSearchQuery: string
  setExportSearchQuery: (value: string) => void
  exportSearchIndex: number
  setExportSearchIndex: (value: number | ((value: number) => number)) => void
  htmlPreview: string
  toc: TocItem[]
  annotations: Annotation[]
  includeToc: boolean
  setIncludeToc: (value: boolean) => void
  includeHeadingAnchors: boolean
  setIncludeHeadingAnchors: (value: boolean) => void
  includeHighlights: boolean
  setIncludeHighlights: (value: boolean) => void
  includeExportMetadata: boolean
  setIncludeExportMetadata: (value: boolean) => void
  htmlFilename: string
  setHtmlFilename: (value: string) => void
  estimatedHtmlSize: string
  canExport: boolean
  downloadHtmlExport: () => void
  feedbackHref: string
}

function ExportWorkspace(props: ExportWorkspaceProps) {
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null)
  const sourcePreviewRef = useRef<HTMLPreElement | null>(null)
  const [sourceCopyState, setSourceCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const previewSearch = useMemo(
    () => applySearchHighlights(props.htmlPreview, props.exportSearchQuery, props.exportSearchIndex),
    [props.exportSearchIndex, props.exportSearchQuery, props.htmlPreview],
  )
  const sourceSearch = useMemo(
    () => highlightPlainText(props.htmlPreview, props.exportSearchQuery, props.exportSearchIndex),
    [props.exportSearchIndex, props.exportSearchQuery, props.htmlPreview],
  )
  const activeSearchCount =
    props.exportViewMode === 'source' ? sourceSearch.count : previewSearch.count

  useEffect(() => {
    if (props.exportViewMode === 'source') {
      sourcePreviewRef.current
        ?.querySelector('.source-search-hit.active')
        ?.scrollIntoView({ block: 'center' })
      return
    }

    const frame = previewFrameRef.current
    const scrollActiveHit = () => {
      frame?.contentDocument
        ?.querySelector('.wowmd-search-hit.active')
        ?.scrollIntoView({ block: 'center' })
    }

    scrollActiveHit()
    const timeout = window.setTimeout(scrollActiveHit, 80)
    return () => window.clearTimeout(timeout)
  }, [previewSearch.html, props.exportViewMode, sourceSearch.html])

  if (!props.document) {
    return (
      <section className="center-panel">
        <p className="eyebrow">{props.t('navExports')}</p>
        <h1>{props.t('exportsTitle')}</h1>
        <p className="intro">{props.t('readerEmptyBody')}</p>
      </section>
    )
  }

  const hasExportToc = props.includeToc && props.toc.length > 0
  const hasExportNotes = props.includeHighlights && props.annotations.length > 0
  const copySourceHtml = async () => {
    let copied = false
    try {
      await navigator.clipboard.writeText(props.htmlPreview)
      copied = true
    } catch {
      copied = copyTextWithFallback(props.htmlPreview)
    }

    setSourceCopyState(copied ? 'copied' : 'failed')
    window.setTimeout(() => setSourceCopyState('idle'), 1200)
  }

  return (
    <section className="export-workspace">
      <section
        className={`tool-row export-tool-row ${hasExportToc ? 'has-toc' : 'no-toc'} ${hasExportNotes ? 'has-notes' : 'no-notes'}`}
        aria-label="Export controls"
      >
        <div className="toolbar-left">
          <div className="segmented">
            {themeNames.map((name) => (
              <button
                key={name}
                type="button"
                className={props.theme === name ? 'active' : ''}
                onClick={() => props.setTheme(name)}
              >
                {props.t(name)}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-center toolbar-center-control">
          <div className="segmented export-mode-tabs">
            {(['preview', 'source'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={props.exportViewMode === mode ? 'active' : ''}
                onClick={() => props.setExportViewMode(mode)}
              >
                {props.t(mode === 'preview' ? 'preview' : 'sourceTab')}
              </button>
            ))}
          </div>
          {props.exportViewMode === 'preview' ? (
            <div className="scale-controls" aria-label="Export preview scale">
              <button
                type="button"
                aria-label="Decrease export preview scale"
                onClick={() => props.setExportPreviewScale((scale) => Math.max(70, scale - 10))}
              >
                -
              </button>
              <span>{props.exportPreviewScale}%</span>
              <button
                type="button"
                aria-label="Increase export preview scale"
                onClick={() => props.setExportPreviewScale((scale) => Math.min(130, scale + 10))}
              >
                +
              </button>
            </div>
          ) : null}
          <SearchControl
            t={props.t}
            value={props.exportSearchQuery}
            onChange={(value) => {
              props.setExportSearchQuery(value)
              props.setExportSearchIndex(0)
            }}
            index={props.exportSearchIndex}
            count={activeSearchCount}
            previous={() =>
              props.setExportSearchIndex((index) =>
                activeSearchCount ? (index - 1 + activeSearchCount) % activeSearchCount : 0,
              )
            }
            next={() =>
              props.setExportSearchIndex((index) =>
                activeSearchCount ? (index + 1) % activeSearchCount : 0,
              )
            }
          />
        </div>
        <div className="toolbar-right" />
      </section>

      <div className="export-layout">
        <div className="export-preview-pane">
          {props.exportViewMode === 'preview' ? (
            <div
              key="preview"
              className="html-preview-viewport export-view-stage"
              style={{ '--export-preview-scale': props.exportPreviewScale / 100 } as CSSProperties}
            >
              <iframe
                ref={previewFrameRef}
                className="html-preview-frame"
                title="HTML export preview"
                srcDoc={previewSearch.html}
              />
            </div>
          ) : (
            <pre
              key="source"
              ref={sourcePreviewRef}
              className="source-preview export-view-stage"
            >
              <code dangerouslySetInnerHTML={{ __html: sourceSearch.html }} />
              <button
                className="code-copy-button source-copy-button"
                type="button"
                aria-label={sourceCopyState === 'copied' ? 'Code copied' : sourceCopyState === 'failed' ? 'Copy failed' : 'Copy source'}
                data-state={sourceCopyState === 'idle' ? undefined : sourceCopyState}
                data-copied-label="Copied"
                data-failed-label="Failed"
                onClick={copySourceHtml}
              >
                <span dangerouslySetInnerHTML={{ __html: copyIconSvg() }} />
              </button>
            </pre>
          )}
          <FeedbackLink href={props.feedbackHref} label={props.t('feedback')} />
        </div>

        <aside className="export-options-panel">
          <HtmlExportOptions {...props} />
        </aside>
      </div>
    </section>
  )
}

function HtmlExportOptions(props: ExportWorkspaceProps) {
  return (
    <>
      <p className="panel-label">{props.t('include')}</p>
      <div className="export-option-group">
        <ToggleRow
          label={props.t('tableOfContents')}
          checked={props.includeToc}
          onChange={props.setIncludeToc}
        />
        <ToggleRow
          label={props.t('headingAnchors')}
          checked={props.includeHeadingAnchors}
          onChange={props.setIncludeHeadingAnchors}
        />
        <ToggleRow
          label={props.t('highlights')}
          checked={props.includeHighlights}
          onChange={props.setIncludeHighlights}
        />
        <ToggleRow
          label={props.t('exportMetadata')}
          checked={props.includeExportMetadata}
          onChange={props.setIncludeExportMetadata}
        />
      </div>
      <label className="export-field">
        <span>{props.t('filename')}</span>
        <input
          value={props.htmlFilename}
          onChange={(event) => props.setHtmlFilename(event.target.value)}
        />
        <small>{props.t('exportThemeFilenameHint')}</small>
      </label>
      <div className="export-download-box">
        <small>
          {props.t('estimatedSize')}: {props.estimatedHtmlSize} / Images linked
        </small>
        <button type="button" disabled={!props.canExport} onClick={props.downloadHtmlExport}>
          {props.t('downloadHtml')}
        </button>
      </div>
    </>
  )
}

function ToggleRow(props: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="toggle-row">
      <span>{props.label}</span>
      <input
        type="checkbox"
        checked={props.checked}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.checked)}
      />
    </label>
  )
}

function stripHeadingIds(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').forEach((heading) => {
    heading.removeAttribute('id')
  })
  return doc.body.innerHTML
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function withThemeSuffix(filename: string, theme: ThemeName) {
  const normalized = filename.trim() || 'wowmd-export.html'
  const withoutExtension = normalized.replace(/\.html?$/i, '')
  const base = withoutExtension.replace(/-(light|dark)$/i, '')
  return `${base}-${theme}.html`
}

function highlightPlainText(text: string, query: string, activeIndex: number) {
  const needle = query.trim()
  if (!needle) return { html: escapeHtml(text), count: 0 }

  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const parts: string[] = []
  let cursor = 0
  let count = 0

  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerNeedle, cursor)
    if (index < 0) break

    parts.push(escapeHtml(text.slice(cursor, index)))
    parts.push(
      `<mark class="source-search-hit ${count === activeIndex ? 'active' : ''}">${escapeHtml(
        text.slice(index, index + needle.length),
      )}</mark>`,
    )
    count += 1
    cursor = index + needle.length
  }

  parts.push(escapeHtml(text.slice(cursor)))
  return { html: parts.join(''), count }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })
}

function truncateText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...`
}

function copyIconSvg() {
  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  `
}

function addCodeCopyButtonsToHtml(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
    const code = pre.querySelector('code')
    if (!code || pre.querySelector('.code-copy-button')) return

    const button = doc.createElement('button')
    button.className = 'code-copy-button'
    button.type = 'button'
    button.innerHTML = copyIconSvg()
    button.setAttribute('aria-label', 'Copy code')
    button.dataset.copiedLabel = 'Copied'
    button.dataset.failedLabel = 'Failed'

    pre.append(button)
  })

  return doc.body.innerHTML
}

function copyTextWithFallback(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

export default App
