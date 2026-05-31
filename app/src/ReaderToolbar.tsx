import type { CSSProperties, MouseEvent } from 'react'
import SearchControl from './SearchControl'
import { themeNames, type ThemeName } from './types'

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

export type ReaderToolbarProps = {
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

export default function ReaderToolbar(props: ReaderToolbarProps) {
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
