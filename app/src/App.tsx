import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
} from 'react'
import './App.css'
import {
  applyAnnotationHighlights,
  createAnnotation,
  loadAnnotationsFromDb,
  saveAnnotationsToDb,
  type Annotation,
  type AnnotationColor,
} from './annotations'
import {
  buildCleanHtmlExport,
  downloadTextFile,
  safeExportFilename,
} from './exportHtml'
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
  computeDocumentFingerprint,
  getDocumentStats,
  renderMarkdown,
  sampleMarkdown,
  type TocItem,
} from './markdown'
import { applySearchHighlights } from './search'

type ThemeName = 'light' | 'dark'
type WorkspaceView = 'reader' | 'exports' | 'license'
type LicenseStatus = 'idle' | 'activating' | 'activated' | 'error'

type OpenDocument = {
  name: string
  markdown: string
  fingerprint: string
}

type SelectionToolbar = {
  x: number
  y: number
}

type AnnotationDraft = {
  color: AnnotationColor
  note: string
}

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
  const [document, setDocument] = useState<OpenDocument | null>(null)
  const [theme, setTheme] = useState<ThemeName>('light')
  const [error, setError] = useState('')
  const [view, setView] = useState<WorkspaceView>('reader')
  const [showOutline, setShowOutline] = useState(true)
  const [showNotes, setShowNotes] = useState(true)
  const [isNarrowLayout, setIsNarrowLayout] = useState(false)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [selectionQuote, setSelectionQuote] = useState('')
  const [selectionToolbar, setSelectionToolbar] = useState<SelectionToolbar | null>(null)
  const [annotationDraft, setAnnotationDraft] = useState<AnnotationDraft | null>(null)
  const [activeAnnotation, setActiveAnnotation] = useState<Annotation | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchIndex, setSearchIndex] = useState(0)
  const [readerFontSize, setReaderFontSize] = useState(12)
  const [outlineFontSize, setOutlineFontSize] = useState(11)
  const [exportPreviewScale, setExportPreviewScale] = useState(100)
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const fileMenuRef = useRef<HTMLDetailsElement | null>(null)
  const markdownBodyRef = useRef<HTMLDivElement | null>(null)
  const trialFilePickerConfirmedRef = useRef(false)

  const t = useMemo(() => createTranslator(locale), [locale])

  const licenseSummary = useMemo(
    () => getLicenseSummary(trialState, t),
    [t, trialState],
  )

  const trialNeedsConfirmation = Boolean(
    !trialState.startedAt && !trialState.isLicensed,
  )

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

  async function openFile(file: File) {
    setError('')

    if (!/\.(md|markdown)$/i.test(file.name)) {
      setError(t('typeError'))
      return
    }

    if (!licenseSummary.canOpenUserFiles) {
      setError(t('expiredOpenError'))
      return
    }

    const markdown = await file.text()
    const fingerprint = await computeDocumentFingerprint(markdown)
    setTrialState(createTrialState({ startIfMissing: true }))
    setDocument({
      name: file.name,
      markdown,
      fingerprint,
    })
    setExportDefaults(file.name)
    setAnnotations(await loadAnnotationsFromDb(fingerprint))
    setSelectionQuote('')
    setSelectionToolbar(null)
    setSearchQuery('')
    setSearchIndex(0)
    setView('reader')
    setShowOutline(!isNarrowLayout)
    setShowNotes(!isNarrowLayout)
  }

  async function openSample() {
    setError('')
    setShowTrialConfirm(false)
    setPendingTrialFile(null)
    setDocument({
      name: 'wowMD Pro sample.md',
      markdown: sampleMarkdown,
      fingerprint: 'sample',
    })
    setExportDefaults('wowMD Pro sample.md')
    setAnnotations(await loadAnnotationsFromDb('sample'))
    setSelectionQuote('')
    setSelectionToolbar(null)
    setSearchQuery('')
    setSearchIndex(0)
    setView('reader')
    setShowOutline(!isNarrowLayout)
    setShowNotes(!isNarrowLayout)
  }

  function clearCurrentFile() {
    setDocument(null)
    setAnnotations([])
    setSelectionQuote('')
    setSelectionToolbar(null)
    setSearchQuery('')
    setSearchIndex(0)
    setError('')
    setView('reader')
    setShowOutline(true)
    setShowNotes(true)
  }

  function closeFileMenu() {
    if (fileMenuRef.current) {
      fileMenuRef.current.open = false
    }
  }

  function openAnotherFromFileMenu() {
    closeFileMenu()
    requestLocalFile()
  }

  function openSampleFromFileMenu() {
    closeFileMenu()
    void openSample()
  }

  function clearFileFromFileMenu() {
    closeFileMenu()
    clearCurrentFile()
  }

  function setExportDefaults(name: string) {
    const baseName = name.replace(/\.(md|markdown)$/i, '') || 'wowMD'
    setExportTitle(baseName)
    setHtmlFilename(safeExportFilename(name, 'html'))
  }

  function requestLocalFile() {
    setError('')
    if (trialNeedsConfirmation) {
      setPendingTrialFile(null)
      setShowTrialConfirm(true)
      return
    }
    fileInputRef.current?.click()
  }

  function confirmTrialAction() {
    setShowTrialConfirm(false)
    if (pendingTrialFile) {
      const file = pendingTrialFile
      setPendingTrialFile(null)
      void openFile(file)
      return
    }

    trialFilePickerConfirmedRef.current = true
    fileInputRef.current?.click()
  }

  function captureSelection() {
    if (!document || !markdownBodyRef.current) return

    const selection = window.getSelection()
    const quote = selection?.toString().trim() || ''
    if (!quote) {
      setSelectionQuote('')
      setSelectionToolbar(null)
      return
    }

    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const isInsideReader =
      range &&
      markdownBodyRef.current.contains(range.commonAncestorContainer)

    if (!range || !isInsideReader) {
      setSelectionQuote('')
      setSelectionToolbar(null)
      return
    }

    const rect = range.getBoundingClientRect()
    setSelectionQuote(quote.slice(0, 500))
    setSelectionToolbar({
      x: rect.left + rect.width / 2,
      y: Math.max(92, rect.top - 14),
    })
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

    let copied = false
    try {
      await navigator.clipboard.writeText(codeText)
      copied = true
    } catch {
      copied = copyTextWithFallback(codeText)
    }

    if (copied) {
      button.textContent = 'Copied'
      window.setTimeout(() => {
        button.textContent = 'Copy'
      }, 1200)
    } else {
      button.textContent = 'Failed'
      window.setTimeout(() => {
        button.textContent = 'Copy'
      }, 1200)
    }
  }

  function addAnnotation(color: AnnotationColor, note = '') {
    if (!document || !selectionQuote) return
    if (!licenseSummary.canSaveAnnotations) {
      setView('license')
      setLicenseMessage(t('activateToSave'))
      return
    }

    const next = [
      createAnnotation({
        documentFingerprint: document.fingerprint,
        quote: selectionQuote,
        ...getSelectionAnchorMetadata(),
        note: note.trim().slice(0, 100),
        color,
      }),
      ...annotations,
    ]

    setAnnotations(next)
    void saveAnnotationsToDb(document.fingerprint, next)
    setShowNotes(true)
    if (isNarrowLayout) setShowOutline(false)
    setSelectionQuote('')
    setSelectionToolbar(null)
    setAnnotationDraft(null)
    window.getSelection()?.removeAllRanges()
  }

  function openNoteComposer(color: AnnotationColor) {
    if (!selectionQuote) return
    setAnnotationDraft({ color, note: '' })
  }

  function getSelectionAnchorMetadata() {
    const selection = window.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    if (!range || !markdownBodyRef.current) {
      return { prefix: '', suffix: '', headingPath: [], offset: -1 }
    }

    const fullText = markdownBodyRef.current.textContent || ''
    const quote = selection?.toString() || ''
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

  function deleteAnnotation(id: string) {
    if (!document) return
    const next = annotations.filter((annotation) => annotation.id !== id)
    setAnnotations(next)
    void saveAnnotationsToDb(document.fingerprint, next)
  }

  function scrollToAnnotation(id: string) {
    setView('reader')
    setShowNotes(true)
    if (isNarrowLayout) setShowOutline(false)

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
  }

  function openAnnotationDetail(annotation: Annotation) {
    setActiveAnnotation(annotation)
  }

  function locateAnnotation(annotation: Annotation) {
    scrollToAnnotation(annotation.id)
    setActiveAnnotation(null)
  }

  function clearDocumentAnnotations() {
    if (!document) return
    const confirmed = window.confirm(t('deleteAllNotesConfirm'))
    if (!confirmed) return
    setAnnotations([])
    void saveAnnotationsToDb(document.fingerprint, [])
  }

  function openExport() {
    setView('exports')
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

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const trialAlreadyConfirmed = trialFilePickerConfirmedRef.current
    trialFilePickerConfirmedRef.current = false

    if (file) {
      if (trialNeedsConfirmation && !trialAlreadyConfirmed) {
        setPendingTrialFile(file)
        setShowTrialConfirm(true)
      } else {
        void openFile(file)
      }
    }
    event.target.value = ''
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return

    if (trialNeedsConfirmation) {
      setPendingTrialFile(file)
      setShowTrialConfirm(true)
      return
    }

    void openFile(file)
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
            <button
              type="button"
              className={view === 'license' ? 'active' : ''}
              onClick={() => setView('license')}
            >
              {t('navLicense')}
            </button>
          </nav>
        ) : null}
        <div className="topbar-right">
          <LanguagePicker
            locale={locale}
            isOpen={languageMenuOpen}
            setIsOpen={setLanguageMenuOpen}
            changeLocale={changeLocale}
          />
          {document ? (
            <details className="file-menu" ref={fileMenuRef}>
              <summary>{document.name}</summary>
              <button type="button" onClick={openAnotherFromFileMenu}>
                {t('openAnother')}
              </button>
              <button type="button" onClick={openSampleFromFileMenu}>
                {t('openSample')}
              </button>
              <button type="button" onClick={clearFileFromFileMenu}>
                {t('clearFile')}
              </button>
            </details>
          ) : null}
          <button
            className={`license-pill ${trialState.isExpired ? 'expired' : ''}`}
            id="license"
            type="button"
            onClick={() => setView('license')}
          >
            <span>{licenseSummary.label}</span>
            <strong>{licenseSummary.detail}</strong>
          </button>
          <button className="buy-pill" type="button" onClick={() => setView('license')}>
            {t('buyLicense')}
          </button>
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
                <div
                  className="drop-zone"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <div className="drop-icon" aria-hidden="true">
                    <img src="assets/brand/logo-mark.svg" alt="" />
                  </div>
                  <h1 id="import-title">{t('importTitle')}</h1>
                  <p className="intro">{t('importIntro')}</p>
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
                  <button className="ghost-action" type="button" onClick={() => void openSample()}>
                    <span className="button-icon" aria-hidden="true">
                      <i className="ti ti-eye" />
                    </span>
                    {t('openSample')}
                  </button>
                </div>

                <p className="privacy-hint">{t('privacyHint')}</p>
                <p className="trial-hint">{t('trialHint')}</p>
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
                {error ? <p className="error-message">{error}</p> : null}
              </section>
            ) : null}

            <ReaderToolbar
              t={t}
              theme={theme}
              setTheme={setTheme}
              showOutline={showOutline}
              setShowOutline={setShowOutline}
              showNotes={showNotes}
              toggleNotes={toggleNotes}
              documentOpen={Boolean(document)}
              openExport={openExport}
            />

            {selectionToolbar && selectionQuote ? (
              <div
                className="floating-markup"
                style={{
                  left: selectionToolbar.x,
                  top: selectionToolbar.y,
                }}
                aria-label="Selection actions"
              >
                <button
                  className="mark-yellow"
                  type="button"
                  aria-label="Yellow highlight"
                  onClick={() => addAnnotation('yellow')}
                >
                  <span />
                </button>
                <button
                  className="mark-blue"
                  type="button"
                  aria-label="Blue highlight"
                  onClick={() => addAnnotation('blue')}
                >
                  <span />
                </button>
                <button
                  className="mark-green"
                  type="button"
                  aria-label="Green highlight"
                  onClick={() => addAnnotation('green')}
                >
                  <span />
                </button>
                <button
                  className="mark-rose"
                  type="button"
                  aria-label="Rose highlight"
                  onClick={() => addAnnotation('rose')}
                >
                  <span />
                </button>
                <button className="mark-note" type="button" onClick={() => openNoteComposer('blue')}>
                  <span className="note-tool-icon" aria-hidden="true" />
                  <span>{t('note')}</span>
                </button>
              </div>
            ) : null}

            {annotationDraft && selectionQuote ? (
              <div className="annotation-modal-layer" role="presentation">
                <section
                  className="annotation-modal note-composer"
                  role="dialog"
                  aria-modal="true"
                  aria-label={t('addNotePrompt')}
                >
                  <button
                    className="modal-close"
                    type="button"
                    aria-label="Close"
                    onClick={() => setAnnotationDraft(null)}
                  >
                    <span className="icon-mask icon-x" aria-hidden="true" />
                  </button>
                  <p className="eyebrow">{t('note')}</p>
                  <h2>{t('addNotePrompt')}</h2>
                  <blockquote>{truncateText(selectionQuote, 96)}</blockquote>
                  <label className="note-input">
                    <textarea
                      value={annotationDraft.note}
                      maxLength={100}
                      autoFocus
                      onChange={(event) =>
                        setAnnotationDraft({
                          ...annotationDraft,
                          note: event.target.value.slice(0, 100),
                        })
                      }
                    />
                    <span>{annotationDraft.note.length}/100</span>
                  </label>
                  <div className="modal-actions">
                    <button
                      className="ghost-action"
                      type="button"
                      onClick={() => setAnnotationDraft(null)}
                    >
                      {t('cancel')}
                    </button>
                    <button
                      className="primary-action"
                      type="button"
                      onClick={() => addAnnotation(annotationDraft.color, annotationDraft.note)}
                    >
                      {t('save')}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}

            <section
              className={`reader-shell ${showOutline ? 'has-outline' : 'no-outline'} ${showNotes ? 'has-notes' : 'no-notes'}`}
              id="reader"
              style={
                {
                  '--reader-font-size': `${readerFontSize}px`,
                  '--outline-font-size': `${outlineFontSize}px`,
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
                </aside>
              ) : null}

              <article className="reader-card">
                {document ? (
                  <>
                    <div className="reader-document">
                      <div className="scale-controls reader-scale-controls" aria-label="Reader text size">
                        <button
                          type="button"
                          aria-label="Decrease reader text size"
                          onClick={() => setReaderFontSize((size) => Math.max(11, size - 1))}
                        >
                          -
                        </button>
                        <span>{readerFontSize}</span>
                        <button
                          type="button"
                          aria-label="Increase reader text size"
                          onClick={() => setReaderFontSize((size) => Math.min(18, size + 1))}
                        >
                          +
                        </button>
                      </div>
                      <header className="document-header">
                        <div>
                          <p className="eyebrow">{t('currentDocument')}</p>
                          <h2>{document.name}</h2>
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
                      <button type="button" onClick={clearDocumentAnnotations}>
                        {t('clear')}
                      </button>
                    </div>
                  ) : null}
                  {annotations.length ? (
                    <ol className="note-list">
                      {annotations.map((annotation) => (
                        <li
                          key={annotation.id}
                          className={`note-sticker note-${annotation.color} ${annotation.note ? 'has-note' : ''}`}
                        >
                          <button
                            className="note-locate"
                            type="button"
                            aria-label="Locate annotation"
                            onClick={() => scrollToAnnotation(annotation.id)}
                          >
                            <span className="icon-mask icon-map-pin" aria-hidden="true" />
                          </button>
                          <button
                            className="note-sticker-body"
                            type="button"
                            onClick={() => openAnnotationDetail(annotation)}
                          >
                            <span className="note-kind">
                              {annotation.note ? t('note') : t('highlight')}
                            </span>
                            <span className="note-preview">
                              {truncateText(annotation.note || annotation.quote, 34)}
                            </span>
                            <time dateTime={annotation.updatedAt}>
                              {new Date(annotation.updatedAt).toLocaleString()}
                            </time>
                          </button>
                          <button
                            className="note-delete"
                            type="button"
                            onClick={() => deleteAnnotation(annotation.id)}
                          >
                            {t('delete')}
                          </button>
                        </li>
                      ))}
                    </ol>
                  ) : (
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

        {view === 'exports' ? (
          <ExportWorkspace
            t={t}
            document={document}
            theme={theme}
            setTheme={setTheme}
            exportPreviewScale={exportPreviewScale}
            setExportPreviewScale={setExportPreviewScale}
            htmlPreview={htmlPreview}
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

type ReaderToolbarProps = {
  t: (key: string) => string
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
  showOutline: boolean
  setShowOutline: (updater: (value: boolean) => boolean) => void
  showNotes: boolean
  toggleNotes: () => void
  documentOpen: boolean
  openExport: () => void
}

function ReaderToolbar(props: ReaderToolbarProps) {
  return (
    <section className="tool-row" aria-label="Reader controls">
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
      <div className="toolbar-right" id="exports">
        <div className="export-actions">
          <button
            type="button"
            disabled={!props.documentOpen}
            onClick={props.openExport}
          >
            {props.t('exportHtml')}
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
  htmlPreview: string
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
}

function ExportWorkspace(props: ExportWorkspaceProps) {
  if (!props.document) {
    return (
      <section className="center-panel">
        <p className="eyebrow">{props.t('navExports')}</p>
        <h1>{props.t('exportsTitle')}</h1>
        <p className="intro">{props.t('readerEmptyBody')}</p>
      </section>
    )
  }

  return (
    <section className="export-workspace">
      <section className="tool-row export-tool-row" aria-label="Export controls">
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
        <div className="toolbar-center export-preview-status">
          <span>{props.t('preview')}</span>
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
        </div>
        <div className="toolbar-right" />
      </section>

      <div className="export-layout">
        <div className="export-preview-pane">
          <div
            className="html-preview-viewport"
            style={{ '--export-preview-scale': props.exportPreviewScale / 100 } as CSSProperties}
          >
              <iframe
                className="html-preview-frame"
                title="HTML export preview"
                srcDoc={props.htmlPreview}
              />
          </div>
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
      <label className="export-field">
        <span>{props.t('filename')}</span>
        <input
          value={props.htmlFilename}
          onChange={(event) => props.setHtmlFilename(event.target.value)}
        />
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

function truncateText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...`
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
    button.textContent = 'Copy'
    button.setAttribute('aria-label', 'Copy code')

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

function escapeCssIdentifier(value: string) {
  if (typeof CSS !== 'undefined' && CSS.escape) return CSS.escape(value)
  return value.replace(/["\\]/g, '\\$&')
}

export default App
