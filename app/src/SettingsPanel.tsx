import { useState } from 'react'
import { saveSettings, type AnnotationStyle, type PanelMode } from './settingsStore'

type Props = {
  panelMode: PanelMode
  setPanelMode: (mode: PanelMode) => void
  annotationStyle: AnnotationStyle
  setAnnotationStyle: (style: AnnotationStyle) => void
  onClose: () => void
}

export default function SettingsPanel({ panelMode, setPanelMode, annotationStyle, setAnnotationStyle, onClose }: Props) {
  const [localPanelMode, setLocalPanelMode] = useState(panelMode)
  const [localAnnotationStyle, setLocalAnnotationStyle] = useState(annotationStyle)

  const handleSave = () => {
    setPanelMode(localPanelMode)
    setAnnotationStyle(localAnnotationStyle)
    saveSettings(localPanelMode, localAnnotationStyle)
    onClose()
  }

  return (
    <div className="annotation-modal-layer" role="presentation">
      <section className="annotation-modal settings-panel" role="dialog" aria-modal="true" aria-label="Settings">
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>
          <span className="icon-mask icon-x" aria-hidden="true" />
        </button>
        <p className="eyebrow">Settings</p>
        <h2>Preferences</h2>

        <fieldset className="setting-group">
          <legend>Notes panel</legend>
          <label className="setting-radio">
            <input
              type="radio"
              name="panelMode"
              value="drawer"
              checked={localPanelMode === 'drawer'}
              onChange={() => setLocalPanelMode('drawer')}
            />
            <span>Slide out on demand (default)</span>
          </label>
          <label className="setting-radio">
            <input
              type="radio"
              name="panelMode"
              value="sidebar"
              checked={localPanelMode === 'sidebar'}
              onChange={() => setLocalPanelMode('sidebar')}
            />
            <span>Always visible as sidebar</span>
          </label>
        </fieldset>

        <fieldset className="setting-group">
          <legend>Annotation display</legend>
          <label className="setting-radio">
            <input
              type="radio"
              name="annotationStyle"
              value="highlight"
              checked={localAnnotationStyle === 'highlight'}
              onChange={() => setLocalAnnotationStyle('highlight')}
            />
            <span>Light highlight (default)</span>
          </label>
          <label className="setting-radio">
            <input
              type="radio"
              name="annotationStyle"
              value="underline"
              checked={localAnnotationStyle === 'underline'}
              onChange={() => setLocalAnnotationStyle('underline')}
            />
            <span>Underline + margin note</span>
          </label>
        </fieldset>

        <div className="modal-actions">
          <button className="ghost-action" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-action" type="button" onClick={handleSave}>
            Save
          </button>
        </div>
      </section>
    </div>
  )
}
