import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Annotation } from './annotations'
import type { TocItem } from './markdown'
import { applySearchHighlights } from './search'
import { copyIconSvg, copyTextWithFallback, highlightPlainText } from './appUtils'
import SearchControl from './SearchControl'
import FeedbackLink from './FeedbackLink'
import { themeNames, type ExportViewMode, type OpenDocument, type ThemeName } from './types'

export type ExportWorkspaceProps = {
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

export default function ExportWorkspace(props: ExportWorkspaceProps) {
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
