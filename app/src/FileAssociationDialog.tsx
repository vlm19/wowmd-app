import { useState } from 'react'
import type { LocalDocument } from './localDocuments'
import type { FileLineageCandidateReason } from './fileLineage'
import type { LineDifference } from './fileLineage'

export type FileAssociationCandidate = {
  parent: LocalDocument
  filename: string
  reason: FileLineageCandidateReason
  externalEdit: boolean
  exactCount: number
  reviewCount: number
  lostCount: number
  differences: LineDifference[]
  addedLineCount: number
  removedLineCount: number
}

type Props = {
  candidate: FileAssociationCandidate
  t: (key: string) => string
  onAssociate: () => void
  onOpenAsNew: () => void
  onClose: () => void
}

const REASON_KEYS: Record<FileAssociationCandidate['reason'], string> = {
  'explicit-parent': 'associationReasonParent',
  'known-lineage': 'associationReasonLineage',
  'known-document': 'associationReasonDocument',
  'body-hash': 'associationReasonBody',
  'structure-similarity': 'associationReasonSimilarity',
}

export default function FileAssociationDialog({ candidate, t, onAssociate, onOpenAsNew, onClose }: Props) {
  const [showDifferences, setShowDifferences] = useState(false)

  return (
    <div className="annotation-modal-layer" role="presentation">
      <section
        className="annotation-modal file-association"
        role="dialog"
        aria-modal="true"
        aria-label={t('associationDialogLabel')}
      >
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <span className="icon-mask icon-x" aria-hidden="true" />
        </button>

        <p className="eyebrow">{t('associationEyebrow')}</p>
        <h2>{candidate.externalEdit ? t('associationExternalTitle') : t('associationFoundTitle')}</h2>
        <p className="association-intro">
          <strong>{candidate.filename}</strong> {t('associationMayContinueFrom')} <strong>{candidate.parent.title}</strong>.
          {' '}{t('associationNothingLinked')}
        </p>

        <div className="association-evidence">
          <span className="association-route" aria-hidden="true">
            <i />
            <b />
            <i />
          </span>
          <div>
            <small>{t('associationCandidateParent')}</small>
            <strong>{candidate.parent.title}</strong>
            <span>{t(REASON_KEYS[candidate.reason])}</span>
          </div>
        </div>

        <div className="association-results" aria-label="Annotation migration preview">
          <div>
            <strong>{candidate.exactCount}</strong>
            <span>{t('associationReady')}</span>
          </div>
          <div>
            <strong>{candidate.reviewCount}</strong>
            <span>{t('associationCheck')}</span>
          </div>
          <div>
            <strong>{candidate.lostCount}</strong>
            <span>{t('associationNeedLocating')}</span>
          </div>
        </div>

        <button
          className="association-diff-action"
          type="button"
          aria-expanded={showDifferences}
          onClick={() => setShowDifferences((current) => !current)}
        >
          <span>{showDifferences ? t('associationHideDifferences') : t('associationViewDifferences')}</span>
          <small>+{candidate.addedLineCount} / -{candidate.removedLineCount} {t('associationLines')}</small>
        </button>

        {showDifferences ? (
          <div className="association-diff" aria-label="Line difference preview">
            {candidate.differences.map((difference, index) => (
              <p className={`diff-${difference.kind}`} key={`${difference.kind}-${index}`}>
                <span>{difference.kind === 'added' ? `+${difference.newLine}` : `-${difference.oldLine}`}</span>
                {' '}{difference.text}
              </p>
            ))}
            {!candidate.differences.length ? (
              <p>{t('associationNoVisibleChanges')}</p>
            ) : null}
          </div>
        ) : null}

        <p className="association-boundary">
          {t('associationBoundary')}
        </p>

        <div className="modal-actions association-actions">
          <button className="ghost-action" type="button" onClick={onOpenAsNew}>
            {t('associationOpenAsNew')}
          </button>
          <button className="primary-action" type="button" onClick={onAssociate}>
            {t('associationConfirm')}
          </button>
        </div>
      </section>
    </div>
  )
}
