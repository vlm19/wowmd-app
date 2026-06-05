import { useState, type Dispatch, type SetStateAction } from 'react'
import type { Annotation, AnnotationType, ReanchorCandidate } from './annotations'
import { copyTextWithFallback } from './appUtils'

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
  supportBaseHref: string
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
  supportBaseHref,
  t,
}: NotesPanelProps) {
  const [showTicketInfo, setShowTicketInfo] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
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
          <span className="ticket-export-control">
            <button type="button" title={t('ticketJsonTitle')} onClick={exportTicketJson}>
              {t('exportTicketJson')}
            </button>
            <button
              className="ticket-info-button"
              type="button"
              aria-label={t('ticketInfoTitle')}
              title={t('ticketInfoTitle')}
              onClick={() => setShowTicketInfo(true)}
            >
              i
            </button>
          </span>
          <button type="button" title={t('backupJsonTitle')} onClick={exportAnnotationsAsJson}>
            {t('backupJsonLabel')}
          </button>
          <button type="button" onClick={() => setPendingClearAnnotations(true)}>
            {t('clear')}
          </button>
        </div>
      ) : null}
      {showTicketInfo ? (
        <div className="annotation-modal-layer" role="presentation">
          <section
            className="annotation-modal ticket-info-modal"
            role="dialog"
            aria-modal="true"
            aria-label={t('ticketInfoTitle')}
          >
            <button
              className="modal-close"
              type="button"
              aria-label={t('close')}
              onClick={() => setShowTicketInfo(false)}
            >
              <span className="icon-mask icon-x" aria-hidden="true" />
            </button>
            <p className="eyebrow">{t('exportTicketJson')}</p>
            <h2>{t('ticketInfoTitle')}</h2>
            <div className="ticket-info-copy">
              <section>
                <h3>{t('ticketInfoWhatTitle')}</h3>
                <p>{t('ticketInfoWhatBody')}</p>
              </section>
              <section>
                <h3>{t('ticketInfoHowTitle')}</h3>
                <p>{t('ticketInfoHowBody')}</p>
              </section>
              <section>
                <h3>{t('ticketInfoDiffTitle')}</h3>
                <p>{t('ticketInfoDiffBody')}</p>
              </section>
            </div>
            <div className="modal-actions">
              <button
                className="ghost-action"
                type="button"
                onClick={() => {
                  const copied = copyTextWithFallback(t('ticketPromptTemplate'))
                  setPromptCopied(copied)
                  if (copied) {
                    window.setTimeout(() => setPromptCopied(false), 1600)
                  }
                }}
              >
                {promptCopied ? t('copied') : t('copyPromptTemplate')}
              </button>
              <button className="primary-action" type="button" onClick={() => setShowTicketInfo(false)}>
                {t('close')}
              </button>
              <a className="support-help-link" href={`${supportBaseHref}#ticket`} target="_blank" rel="noreferrer">
                {t('supportReadMore')}
              </a>
            </div>
          </section>
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
              supportBaseHref={supportBaseHref}
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
              supportBaseHref={supportBaseHref}
              t={t}
            />
          ))}
        </ol>
      ) : (
        <p className="empty-outline">{t('notesEmptyFlow')}</p>
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
  supportBaseHref: string
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
  supportBaseHref,
  t,
}: AnnotationItemProps) {
  return (
    <li
      className={`note-sticker note-${annotation.color} ${annotation.note ? 'has-note' : ''} ${annotation.suggestedReplacement ? 'has-replacement' : ''} ${annotation.orphaned ? 'note-orphaned' : ''} ${annotation.needsReview && !annotation.orphaned ? 'note-review' : ''}`}
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
          {annotation.orphaned ? '[orphaned] ' : annotation.needsReview ? '[review] ' : ''}
          {annotation.type
            ? t(typeLabels[annotation.type])
            : annotation.legacyColor
              ? `${t('note')} · ${colorNames[annotation.legacyColor] ?? annotation.legacyColor}`
              : t('note')}
        </span>
        <span className="note-preview">
          {truncateText(annotation.note || annotation.suggestedReplacement || annotation.quote, 34)}
        </span>
        {annotation.suggestedReplacement ? (
          <span className="note-replacement-preview">
            <b>{t('suggestedReplacementShort')}</b>
            <span>{truncateText(annotation.suggestedReplacement, 58)}</span>
          </span>
        ) : null}
        <time dateTime={annotation.updatedAt}>
          {new Date(annotation.updatedAt).toLocaleString()}
        </time>
      </button>
      {annotation.orphaned ? (
        <div className="note-reanchor-actions">
          <button
            className="note-reanchor-btn"
            type="button"
            onClick={() => showReanchorCandidates(annotation)}
          >
            Find
          </button>
          <a className="support-help-link compact" href={`${supportBaseHref}#reanchor`} target="_blank" rel="noreferrer">
            {t('supportReadMore')}
          </a>
        </div>
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
