import type { CSSProperties } from 'react'
import type { Annotation, AnnotationType } from './annotations'
import {
  buildOverallReviewMap,
  overallReviewTypes,
  type AttentionReason,
  type OverallReviewSection,
  type TocItem,
} from './overallReviewMap'

type Props = {
  annotations: Annotation[]
  tocItems: TocItem[]
  onClose: () => void
  onJumpToHeading: (headingId: string) => void
  supportBaseHref: string
  t: (key: string) => string
}

// Match the annotation highlight palette used in the reader.
const TYPE_COLORS: Record<AnnotationType, string> = {
  clarify: 'var(--highlight-blue)',
  dispute: 'var(--highlight-rose)',
  important: 'var(--highlight-amber)',
  confirmed: 'var(--highlight-green)',
}

const TYPE_LABEL_KEYS: Record<AnnotationType, string> = {
  clarify: 'typeClarify',
  dispute: 'typeDispute',
  important: 'typeImportant',
  confirmed: 'typeConfirmed',
}

const REASON_LABEL_KEYS: Record<AttentionReason, string> = {
  dispute: 'mapReasonDispute',
  clarify: 'mapReasonClarify',
  importantUnconfirmed: 'mapReasonImportantUnconfirmed',
  largeUnreviewed: 'mapReasonLargeUnreviewed',
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function sectionTypeSummary(section: OverallReviewSection, t: (key: string) => string) {
  return overallReviewTypes
    .map((type) => `${t(TYPE_LABEL_KEYS[type])}: ${section.counts[type]}`)
    .join(', ')
}

function firstReason(section: OverallReviewSection, t: (key: string) => string) {
  const reason = section.attentionReasons[0]
  return reason ? t(REASON_LABEL_KEYS[reason]) : t('mapReasonReviewGap')
}

export default function UnderstandingMap({ annotations, tocItems, onClose, onJumpToHeading, supportBaseHref, t }: Props) {
  const model = buildOverallReviewMap({ annotations, tocItems })
  const { summary, sections, attention } = model
  const hasData = summary.typedAnnotationCount > 0
  const topAttention = attention[0]

  return (
    <div className="annotation-modal-layer" role="presentation">
      <section className="annotation-modal understanding-map" role="dialog" aria-modal="true" aria-label={t('map')}>
        <button className="modal-close" type="button" aria-label={t('close')} onClick={onClose}>
          <span className="icon-mask icon-x" aria-hidden="true" />
        </button>
        <p className="eyebrow">{t('map')}</p>
        <h2>{t('mapOverallTitle')}</h2>
        <p className="map-intro">{t('mapIntro')}</p>
        <a className="support-help-link map-help-link" href={`${supportBaseHref}#map`} target="_blank" rel="noreferrer">
          {t('supportReadMore')}
        </a>

        {!hasData ? (
          <p className="map-empty">{t('mapEmptyTyped')}</p>
        ) : (
          <>
            <div className="map-summary" aria-label={t('mapSummaryLabel')}>
              <div className="map-summary-item">
                <span className="map-summary-label">{t('mapCoverage')}</span>
                <strong>{formatPercent(summary.coverageRatio)}</strong>
                <span className="map-summary-note">
                  {summary.reviewedSectionCount}/{summary.sectionCount} {t('mapSectionsReviewed')}
                </span>
              </div>
              <div className={`map-summary-item confidence-${summary.confidence}`}>
                <span className="map-summary-label">{t('mapConfidence')}</span>
                <strong>{t(`mapConfidence_${summary.confidence}`)}</strong>
                <span className="map-summary-note">
                  {formatPercent(summary.confidenceRatio)} {t('mapConfidenceBasis')}
                </span>
              </div>
              <div className="map-summary-item risk-focus">
                <span className="map-summary-label">{t('mapRiskFocus')}</span>
                <strong>{summary.riskSectionCount}</strong>
                <span className="map-summary-note">
                  {t(summary.riskSectionCount === 1 ? 'mapRiskSectionSingular' : 'mapRiskSectionPlural')}
                </span>
              </div>
            </div>

            <div className="map-legend" aria-label={t('mapLegend')}>
              {overallReviewTypes.map((type) => (
                <span key={type} className="map-legend-item">
                  <span className="map-legend-swatch" style={{ backgroundColor: TYPE_COLORS[type] }} />
                  <span>{t(TYPE_LABEL_KEYS[type])}</span>
                </span>
              ))}
              <span className="map-legend-item">
                <span className="map-legend-swatch unreviewed" />
                <span>{t('mapUnreviewed')}</span>
              </span>
            </div>

            <div className="map-layout">
              <div className="map-overview">
                <h3>{t('mapDocumentOverview')}</h3>
                <div className="map-spine" aria-label={t('mapDocumentOverview')}>
                  {sections.map((section) => (
                    <button
                      key={section.headingId}
                      className={`map-spine-row ${section.total > 0 ? 'is-reviewed' : 'is-unreviewed'}`}
                      type="button"
                      style={{ '--map-indent': `${Math.max(0, section.level - 1) * 14}px` } as CSSProperties}
                      aria-label={`${section.headingText}. ${sectionTypeSummary(section, t)}`}
                      onClick={() => onJumpToHeading(section.headingId)}
                    >
                      <span className="map-spine-marker" aria-hidden="true" />
                      <span className="map-spine-title">{section.headingText}</span>
                      <span className="map-ribbon" aria-hidden="true">
                        {section.total > 0 ? (
                          overallReviewTypes.map((type) => (
                            section.counts[type] > 0 ? (
                              <span
                                key={type}
                                className={`map-ribbon-segment segment-${type}`}
                                style={{
                                  flexGrow: section.counts[type],
                                  backgroundColor: TYPE_COLORS[type],
                                }}
                              />
                            ) : null
                          ))
                        ) : (
                          <span className="map-ribbon-segment segment-unreviewed" />
                        )}
                      </span>
                      <span className="map-section-total">{section.total || '-'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <aside className="map-attention" aria-label={t('mapNeedsAttention')}>
                <h3>{t('mapNeedsAttention')}</h3>
                {attention.length ? (
                  <ol className="map-attention-list">
                    {attention.map((section) => (
                      <li key={section.headingId}>
                        <button type="button" className="map-attention-item" onClick={() => onJumpToHeading(section.headingId)}>
                          <span className="map-attention-title">{section.headingText}</span>
                          <span className="map-attention-reason">{firstReason(section, t)}</span>
                          <span className="map-attention-badges" aria-hidden="true">
                            {overallReviewTypes.map((type) => (
                              section.counts[type] > 0 ? (
                                <span key={type} style={{ color: TYPE_COLORS[type] }}>
                                  {section.counts[type]} {t(TYPE_LABEL_KEYS[type])}
                                </span>
                              ) : null
                            ))}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="map-attention-empty">{t('mapNoHighRisk')}</p>
                )}
              </aside>
            </div>

            <div className="map-footer-actions">
              <span>{t('mapClickHint')}</span>
              <button
                type="button"
                className="map-jump-risk"
                disabled={!topAttention}
                onClick={() => topAttention && onJumpToHeading(topAttention.headingId)}
              >
                {t('mapJumpHighestRisk')}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
