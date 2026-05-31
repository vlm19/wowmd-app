export type OpenDocument = {
  name: string
  markdown: string
  fingerprint: string
  stableId: string
  source?: string | { sourceType: 'github'; sourceUrl: string; rawUrl: string; label: string }
}

export type SelectionAnchorMetadata = {
  prefix: string
  suffix: string
  headingPath: string[]
  offset: number
}

export type SelectionToolbar = {
  x: number
  y: number
}

export type ThemeName = 'light' | 'dark'
export type ExportViewMode = 'preview' | 'source'
export const themeNames: ThemeName[] = ['light', 'dark']
