import DOMPurify from 'dompurify'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdownLanguage from 'highlight.js/lib/languages/markdown'
import plaintext from 'highlight.js/lib/languages/plaintext'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import MarkdownIt from 'markdown-it'

export type TocItem = {
  id: string
  level: number
  text: string
}

export type DocumentStats = {
  imageCount: number
  remoteImageCount: number
  tableCount: number
  codeBlockCount: number
}

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  highlight(value, language): string {
    try {
      if (language && hljs.getLanguage(language)) {
        return `<pre class="hljs"><code>${hljs.highlight(value, { language }).value}</code></pre>`
      }

      return `<pre class="hljs"><code>${hljs.highlightAuto(value).value}</code></pre>`
    } catch {
      return `<pre><code>${escapeHtml(value)}</code></pre>`
    }
  },
})

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('markdown', markdownLanguage)
hljs.registerLanguage('md', markdownLanguage)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('text', plaintext)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)

export function renderMarkdown(source: string) {
  const dirty = markdown.render(source)
  // Keep this sanitizer in sync with wowmd-ext/extension/content/render.js.
  const clean = DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'br',
      'hr',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'a',
      'img',
      'strong',
      'em',
      'del',
      's',
      'div',
      'span',
    ],
    ALLOWED_ATTR: [
      'href',
      'src',
      'alt',
      'title',
      'class',
      'id',
      'target',
      'rel',
      'loading',
      'width',
      'height',
      'align',
    ],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  })

  return addHeadingIds(wrapTables(enhanceLinks(clean)))
}

export function buildToc(html: string): TocItem[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  return Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((heading) => ({
    id: heading.id,
    level: Number(heading.tagName.replace('H', '')),
    text: heading.textContent?.replace(/[▸▾]/g, '').trim() || 'Untitled',
  }))
}

export function getDocumentStats(html: string): DocumentStats {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const images = Array.from(doc.querySelectorAll('img[src]'))

  return {
    imageCount: images.length,
    remoteImageCount: images.filter((image) => {
      const src = image.getAttribute('src') || ''
      return /^(https?:)?\/\//i.test(src)
    }).length,
    tableCount: doc.querySelectorAll('table').length,
    codeBlockCount: doc.querySelectorAll('pre').length,
  }
}

export async function computeDocumentFingerprint(markdownSource: string) {
  const bytes = new TextEncoder().encode(markdownSource)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function addHeadingIds(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const used = new Map<string, number>()

  doc.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((heading) => {
    const base = slugify(heading.textContent || 'section')
    const count = used.get(base) || 0
    used.set(base, count + 1)
    const id = count === 0 ? base : `${base}-${count + 1}`
    heading.id = `md-reader-${id}`
  })

  return doc.body.innerHTML
}

function enhanceLinks(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href') || ''
    if (!href.startsWith('#')) {
      link.setAttribute('target', '_blank')
      link.setAttribute('rel', 'noopener noreferrer')
    }
  })

  doc.querySelectorAll('img[src]').forEach((image) => {
    image.setAttribute('loading', 'lazy')
  })

  return doc.body.innerHTML
}

function wrapTables(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll('table').forEach((table) => {
    const wrapper = doc.createElement('div')
    wrapper.className = 'md-table-wrap'
    table.parentNode?.insertBefore(wrapper, table)
    wrapper.appendChild(table)
  })

  return doc.body.innerHTML
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section'
  )
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entities[char]
  })
}

export const sampleMarkdown = `# wowMD Pro sample

This sample shows the first webapp slice: local Markdown reading, outline generation, safe rendering, code blocks, and tables.

## Local-first reading

The production app will process Markdown in the browser. Documents should not be uploaded for rendering, notes, HTML export, EPUB export, analytics, or license checks.

## Code blocks

\`\`\`ts
type ExportTarget = 'html' | 'epub'

function canExport(target: ExportTarget, licensed: boolean) {
  return licensed || target === 'html-preview'
}
\`\`\`

## Tables

| Feature | V1 status | Notes |
| --- | --- | --- |
| Local files | In progress | File picker and drag-and-drop |
| Highlights | Next | Stored locally by document fingerprint |
| HTML export | Next | Clean offline single-file export |
| EPUB export | Planned | Kindle, Apple Books, and Kobo |

## Paid upgrade

wowMD Pro is a low-price, lifetime webapp upgrade for local Markdown workflows.
`
