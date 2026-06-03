import type { LocalDocument } from './localDocuments'

type Props = {
  versions: LocalDocument[]
  currentId: string
  onOpenVersion: (id: string) => void
  onClose: () => void
}

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

export default function VersionHistory({ versions, currentId, onOpenVersion, onClose }: Props) {
  const hasLineage = versions.length > 1

  return (
    <div className="annotation-modal-layer" role="presentation">
      <section
        className="annotation-modal version-history"
        role="dialog"
        aria-modal="true"
        aria-label="Version history"
      >
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <span className="icon-mask icon-x" aria-hidden="true" />
        </button>
        <p className="eyebrow">Version history</p>
        <h2>Document versions</h2>

        {!hasLineage ? (
          <p className="version-empty">
            This is the only version. Use "Save reviewed copy" to create an Obsidian-ready
            successor. Its annotations are carried forward and the original file is never
            overwritten.
          </p>
        ) : (
          <ol className="version-list">
            {versions.map((version, index) => {
              const isCurrent = version.id === currentId
              return (
                <li
                  key={version.id}
                  className={`version-item ${isCurrent ? 'is-current' : ''}`}
                >
                  <span className="version-index">v{index + 1}</span>
                  <button
                    type="button"
                    className="version-open"
                    disabled={isCurrent}
                    onClick={() => onOpenVersion(version.id)}
                    title={isCurrent ? 'Current version' : `Open ${version.title}`}
                  >
                    <span className="version-title">{version.title}</span>
                    <span className="version-when">{formatWhen(version.createdAt)}</span>
                  </button>
                  {isCurrent ? <span className="version-current-badge">Current</span> : null}
                </li>
              )
            })}
          </ol>
        )}
      </section>
    </div>
  )
}
