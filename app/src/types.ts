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
