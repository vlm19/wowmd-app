// Pure presentation/util helpers shared by App and its split-out components.
// Behavior-preserving move out of App.tsx (no logic changes).

export function stripHeadingIds(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]').forEach((heading) => {
    heading.removeAttribute('id')
  })
  return doc.body.innerHTML
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function withThemeSuffix(filename: string, theme: 'light' | 'dark') {
  const normalized = filename.trim() || 'wowmd-export.html'
  const withoutExtension = normalized.replace(/\.html?$/i, '')
  const base = withoutExtension.replace(/-(light|dark)$/i, '')
  return `${base}-${theme}.html`
}

export function highlightPlainText(text: string, query: string, activeIndex: number) {
  const needle = query.trim()
  if (!needle) return { html: escapeHtml(text), count: 0 }

  const lowerText = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const parts: string[] = []
  let cursor = 0
  let count = 0

  while (cursor < text.length) {
    const index = lowerText.indexOf(lowerNeedle, cursor)
    if (index < 0) break

    parts.push(escapeHtml(text.slice(cursor, index)))
    parts.push(
      `<mark class="source-search-hit ${count === activeIndex ? 'active' : ''}">${escapeHtml(
        text.slice(index, index + needle.length),
      )}</mark>`,
    )
    count += 1
    cursor = index + needle.length
  }

  parts.push(escapeHtml(text.slice(cursor)))
  return { html: parts.join(''), count }
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[char]
  })
}

export function copyIconSvg() {
  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="8" y="8" width="10" height="12" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M6 16H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </svg>
  `
}

export function addCodeCopyButtonsToHtml(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
    const code = pre.querySelector('code')
    if (!code || pre.querySelector('.code-copy-button')) return

    const button = doc.createElement('button')
    button.className = 'code-copy-button'
    button.type = 'button'
    button.innerHTML = copyIconSvg()
    button.setAttribute('aria-label', 'Copy code')
    button.dataset.copiedLabel = 'Copied'
    button.dataset.failedLabel = 'Failed'

    pre.append(button)
  })

  return doc.body.innerHTML
}

export function copyTextWithFallback(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}
