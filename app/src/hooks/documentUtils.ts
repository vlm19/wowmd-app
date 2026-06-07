import { ImportError, type ImportErrorCode } from '../importService'
import type { LocalDocument } from '../localDocuments'

export function importErrorMessage(error: unknown) {
  if (error instanceof ImportError) {
    return importErrorMessageByCode(error.code)
  }
  return importErrorMessageByCode('UNKNOWN')
}

export function importErrorMessageByCode(code: ImportErrorCode) {
  if (code === 'DISALLOWED_RAW_URL' || code === 'INVALID_SOURCE') {
    return 'This link is not supported yet. Currently wowMD only imports public GitHub Markdown files.'
  }
  if (code === 'EMPTY_MARKDOWN') {
    return 'This Markdown file seems to be empty.'
  }
  if (code === 'FETCH_TIMEOUT') {
    return "GitHub didn't respond in time. Please check your connection and try again."
  }
  if (code === 'FETCH_FAILED') {
    return "We couldn't open this Markdown file. You can try again, or open the original GitHub page."
  }
  return "We couldn't open this Markdown file. You can try again, or open the original GitHub page."
}

export function sourceLabel(document: LocalDocument) {
  if (document.sourceType === 'local') return `Local file · ${document.title}`
  const repo = document.owner && document.repo ? `${document.owner}/${document.repo}` : 'GitHub'
  const path = document.path || document.title
  return `Source: GitHub · ${repo} · ${path}`
}
