import { useLayoutEffect, useRef, useState } from 'react'
import type { AnnotationColor, AnnotationType } from './annotations'
import { copyIconSvg, copyTextWithFallback } from './appUtils'

const typeColorMap: Record<AnnotationType, AnnotationColor> = {
  clarify: 'blue',
  dispute: 'rose',
  important: 'amber',
  confirmed: 'green',
}

const typeKeys: Record<AnnotationType, string> = {
  clarify: 'typeClarify',
  dispute: 'typeDispute',
  important: 'typeImportant',
  confirmed: 'typeConfirmed',
}

const annotationTypes = ['clarify', 'dispute', 'important', 'confirmed'] as const

interface AnnotationToolbarProps {
  x: number
  y: number
  selectedType: AnnotationType | null
  toolbarNote: string
  toolbarReplacement: string
  selectionQuote: string
  showReplacement: boolean
  canSave: boolean
  onToggleType: (typeVal: AnnotationType, typeColor: AnnotationColor) => void
  onTypeHover: (color: AnnotationColor) => void
  onToolbarMouseLeave: () => void
  onNoteChange: (value: string) => void
  onToggleReplacement: () => void
  onReplacementChange: (value: string) => void
  onSave: () => void
  t: (key: string) => string
}

export default function AnnotationToolbar({
  x,
  y,
  selectedType,
  toolbarNote,
  toolbarReplacement,
  selectionQuote,
  showReplacement,
  canSave,
  onToggleType,
  onTypeHover,
  onToolbarMouseLeave,
  onNoteChange,
  onToggleReplacement,
  onReplacementChange,
  onSave,
  t,
}: AnnotationToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const [clampedPosition, setClampedPosition] = useState({ x, y })
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const margin = 10
    const rect = toolbar.getBoundingClientRect()
    const halfWidth = rect.width / 2
    const nextX = Math.min(
      window.innerWidth - halfWidth - margin,
      Math.max(halfWidth + margin, x),
    )
    const nextY = Math.max(92, y)
    setClampedPosition({ x: nextX, y: nextY })
  }, [x, y, showReplacement, toolbarNote, toolbarReplacement, t])

  const copySelection = async () => {
    let copied: boolean
    try {
      await navigator.clipboard.writeText(selectionQuote)
      copied = true
    } catch {
      copied = copyTextWithFallback(selectionQuote)
    }
    setCopyState(copied ? 'copied' : 'failed')
    window.setTimeout(() => setCopyState('idle'), 1200)
  }

  return (
    <div
      ref={toolbarRef}
      className="floating-markup floating-markup-v2"
      style={{ left: clampedPosition.x, top: clampedPosition.y }}
      aria-label="Annotation type picker"
      onMouseLeave={onToolbarMouseLeave}
    >
      <div className="type-chips">
        {annotationTypes.map((typeVal) => {
          const typeColor = typeColorMap[typeVal]
          return (
            <button
              key={typeVal}
              className={`type-chip chip-${typeVal} ${selectedType === typeVal ? 'active' : ''}`}
              type="button"
              data-preview-color={typeColor}
              aria-label={t(typeKeys[typeVal])}
              aria-pressed={selectedType === typeVal}
              onFocus={() => onTypeHover(typeColor)}
              onMouseEnter={() => onTypeHover(typeColor)}
              onClick={() => onToggleType(typeVal, typeColor)}
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
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </div>
      <div className="toolbar-replacement-row">
        <button
          className="toolbar-replacement-toggle"
          type="button"
          onClick={onToggleReplacement}
        >
          {t('suggestedReplacement')}
        </button>
        {showReplacement ? (
          <textarea
            className="toolbar-replacement-input"
            placeholder={t('suggestedReplacementHint')}
            value={toolbarReplacement}
            onChange={(e) => onReplacementChange(e.target.value)}
            rows={3}
          />
        ) : null}
      </div>
      <div className="toolbar-actions">
        <button
          className="toolbar-copy"
          type="button"
          aria-label={copyState === 'copied' ? t('copied') : t('copySelection')}
          title={copyState === 'copied' ? t('copied') : t('copySelection')}
          data-state={copyState === 'idle' ? undefined : copyState}
          onClick={copySelection}
        >
          {copyState === 'copied' ? (
            <svg className="toolbar-copy-check" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
              <path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <span dangerouslySetInnerHTML={{ __html: copyIconSvg() }} />
          )}
        </button>
        <button
          className="toolbar-confirm"
          type="button"
          disabled={!canSave}
          onClick={onSave}
        >
          {t('save')}
        </button>
      </div>
    </div>
  )
}
