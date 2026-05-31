import type { Dispatch, SetStateAction } from 'react'
import type { Annotation, AnnotationType, ReanchorCandidate } from './annotations'

interface NotesPanelProps {
  annotations: Annotation[]
  selectionQuote: string
  filterType: AnnotationType | null
  setFilterType: Dispatch<SetStateAction<AnnotationType | null>>
  exportTicketJson: () => void
  exportAnnotationsAsJson: () => void
  setPendingClearAnnotations: Dispatch<SetStateAction<boolean>>
  scrollToAnnotation: (id: string) => void
  openAnnotationDetail: (a: Annotation) => void
  deleteAnnotation: (id: string) => void
  showReanchorCandidates: (a: Annotation) => void
  reanchorAnnotation: (id: string, candidate: ReanchorCandidate) => void
  reanchorId: string | null
  reanchorCandidates: ReanchorCandidate[]
  t: (key: string) => string
}

const typeLabels: Record<string, string> = {
  clarify: 'typeClarify',
  dispute: 'typeDispute',
  important: 'typeImportant',
  confirmed: 'typeConfirmed',
}

const colorNames: Record<string, string> = {
  yellow: 'Yellow',
  blue: 'Blue',
  green: 'Green',
  rose: 'Rose',
  violet: 'Violet',
  amber: 'Amber',
}

export default function NotesPanel({
  annotations,
  selectionQuote,
  filterType,
  setFilterType,
  exportTicketJson,
  exportAnnotationsAsJson,
  setPendingClearAnnotations,
  scrollToAnnotation,
  openAnnotationDetail,
  deleteAnnotation,
  showReanchorCandidates,
  reanchorAnnotation,
  reanchorId,
  reanchorCandidates,
  t,
}: NotesPanelProps) {
  const filtered = filterType
    ? annotations.filter((a) => a.type === filterType)
    : annotations
  const activeAnnotations = filtered.filter((a) => !a.orphaned)
  const orphanedAnnotations = filtered.filter((a) => a.orphaned)

  return (
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
      {annotations.length ? (
        <ol className="note-list">
          {activeAnnotations.map((annotation) => (
            <AnnotationItem
              key={annotation.id}
              annotation={annotation}
              scrollToAnnotation={scrollToAnnotation}
              openAnnotationDetail={openAnnotationDetail}
              deleteAnnotation={deleteAnnotation}
              showReanchorCandidates={showReanchorCandidates}
              reanchorAnnotation={reanchorAnnotation}
              reanchorId={reanchorId}
              reanchorCandidates={reanchorCandidates}
              t={t}
            />
          ))}
          {orphanedAnnotations.length > 0 && activeAnnotations.length > 0 ? (
            <li className="note-orphaned-separator" aria-hidden="true" />
          ) : null}
          {orphanedAnnotations.map((annotation) => (
            <AnnotationItem
              key={annotation.id}
              annotation={annotation}
              scrollToAnnotation={scrollToAnnotation}
              openAnnotationDetail={openAnnotationDetail}
              deleteAnnotation={deleteAnnotation}
              showReanchorCandidates={showReanchorCandidates}
              reanchorAnnotation={reanchorAnnotation}
              reanchorId={reanchorId}
              reanchorCandidates={reanchorCandidates}
              t={t}
            />
          ))}
        </ol>
      ) : (
        <p className="empty-outline">{t('selectToNote')}</p>
      )}
    </aside>
  )
}

interface AnnotationItemProps {
  annotation: Annotation
  scrollToAnnotation: (id: string) => void
  openAnnotationDetail: (a: Annotation) => void
  deleteAnnotation: (id: string) => void
  showReanchorCandidates: (a: Annotation) => void
  reanchorAnnotation: (id: string, candidate: ReanchorCandidate) => void
  reanchorId: string | null
  reanchorCandidates: ReanchorCandidate[]
  t: (key: string) => string
}

function AnnotationItem({
  annotation,
  scrollToAnnotation,
  openAnnotationDetail,
  deleteAnnotation,
  showReanchorCandidates,
  reanchorAnnotation,
  reanchorId,
  reanchorCandidates,
  t,
}: AnnotationItemProps) {
  return (
    <li
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
}

function truncateText(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength)}...`
}
