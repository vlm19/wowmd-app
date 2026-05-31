import type { Annotation, AnnotationType } from './annotations'

type TocItem = { id: string; level: number; text: string }

type Props = {
  annotations: Annotation[]
  tocItems: TocItem[]
  onClose: () => void
  onJumpToHeading: (headingId: string) => void
}

type SectionDensity = {
  headingId: string
  headingText: string
  level: number
  clarify: number
  dispute: number
  important: number
  confirmed: number
  total: number
}

function buildDensityMap(annotations: Annotation[], tocItems: TocItem[]): SectionDensity[] {
  const map = new Map<string, SectionDensity>()

  for (const item of tocItems) {
    map.set(item.id, {
      headingId: item.id,
      headingText: item.text,
      level: item.level,
      clarify: 0,
      dispute: 0,
      important: 0,
      confirmed: 0,
      total: 0,
    })
  }

  for (const a of annotations) {
    if (!a.headingPath.length || !a.type) continue
    const deepestHeading = a.headingPath[a.headingPath.length - 1]
    const tocMatch = tocItems.find((t) => t.text === deepestHeading)
    if (!tocMatch) continue

    const entry = map.get(tocMatch.id)
    if (!entry) continue

    entry[a.type] += 1
    entry.total += 1
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

// Match the annotation highlight palette (what the reader sees on the text), which
// is also bright enough to read on the dark modal surface — the accent set
// (--blue/--coral/...) is the light-theme palette and renders muddy here.
const TYPE_COLORS: Record<AnnotationType, string> = {
  clarify: 'var(--highlight-blue)',
  dispute: 'var(--highlight-rose)',
  important: 'var(--highlight-amber)',
  confirmed: 'var(--highlight-green)',
}

const TYPE_LABELS: Record<AnnotationType, string> = {
  clarify: 'Clarify',
  dispute: 'Dispute',
  important: 'Important',
  confirmed: 'Confirmed',
}

export default function UnderstandingMap({ annotations, tocItems, onClose, onJumpToHeading }: Props) {
  const sections = buildDensityMap(annotations, tocItems)
  const maxTotal = Math.max(1, ...sections.map((s) => s.total))
  const hasData = sections.some((s) => s.total > 0)

  return (
    <div className="annotation-modal-layer" role="presentation">
      <section className="annotation-modal understanding-map" role="dialog" aria-modal="true" aria-label="Understanding Map">
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <span className="icon-mask icon-x" aria-hidden="true" />
        </button>
        <p className="eyebrow">Understanding Map</p>
        <h2>Section density by type</h2>

        {!hasData ? (
          <p className="map-empty">No typed annotations yet. Mark text with Clarify / Dispute / Important / Confirmed to see the map.</p>
        ) : (
          <div className="map-sections">
            {sections.filter((s) => s.total > 0).map((section) => (
              <div key={section.headingId} className="map-section-row">
                <button
                  className="map-section-label"
                  type="button"
                  style={{ paddingLeft: `${(section.level - 1) * 14}px` }}
                  onClick={() => onJumpToHeading(section.headingId)}
                >
                  {section.headingText}
                </button>
                <div className="map-bars">
                  {(['clarify', 'dispute', 'important', 'confirmed'] as const).map((type) => (
                    <div key={type} className="map-bar-row" title={`${TYPE_LABELS[type]}: ${section[type]}`}>
                      <span className="map-bar-type" style={{ color: TYPE_COLORS[type] }}>
                        {TYPE_LABELS[type].charAt(0)}
                      </span>
                      <span className="map-bar-track">
                        <span
                          className="map-bar-fill"
                          style={{
                            width: `${(section[type] / maxTotal) * 100}%`,
                            backgroundColor: TYPE_COLORS[type],
                          }}
                        />
                      </span>
                      <span
                        className="map-bar-count"
                        style={section[type] > 0 ? { color: TYPE_COLORS[type] } : undefined}
                      >
                        {section[type]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
