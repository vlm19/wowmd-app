export type PanelMode = 'drawer' | 'sidebar'
export type AnnotationStyle = 'highlight' | 'underline'

const STORAGE_KEY = 'wowmd.settings.v1'

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { panelMode: 'drawer' as PanelMode, annotationStyle: 'highlight' as AnnotationStyle }
    const parsed = JSON.parse(raw)
    return {
      panelMode: (parsed.panelMode === 'sidebar' ? 'sidebar' : 'drawer') as PanelMode,
      annotationStyle: (parsed.annotationStyle === 'underline' ? 'underline' : 'highlight') as AnnotationStyle,
    }
  } catch {
    return { panelMode: 'drawer' as PanelMode, annotationStyle: 'highlight' as AnnotationStyle }
  }
}

export function saveSettings(panelMode: PanelMode, annotationStyle: AnnotationStyle) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ panelMode, annotationStyle }))
}
