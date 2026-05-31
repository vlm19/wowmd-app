import { strToU8, zipSync } from 'fflate'
import type { TocItem } from './markdown'
import { safeExportFilename } from './exportHtml'
import { randomId } from './compat'

type EpubExportInput = {
  title: string
  author?: string
  language: string
  bodyHtml: string
  toc: TocItem[]
  filename?: string
}

export function exportEpub(input: EpubExportInput) {
  const id = `urn:uuid:${randomId()}`
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  const title = input.title.replace(/\.(md|markdown)$/i, '') || 'wowMD export'
  const author = input.author?.trim() || 'Unknown'
  const language = input.language || 'en'
  const content = prepareContent(input.bodyHtml)

  const files: Record<string, Uint8Array> = {
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(containerXml),
    'OEBPS/package.opf': strToU8(packageOpf({ id, title, author, language, now })),
    'OEBPS/nav.xhtml': strToU8(navXhtml(title, input.toc)),
    'OEBPS/toc.ncx': strToU8(tocNcx({ id, title, author, toc: input.toc })),
    'OEBPS/styles.css': strToU8(epubCss),
    'OEBPS/content.xhtml': strToU8(contentXhtml(title, language, content.html)),
  }

  const zipped = zipSync(files, {
    level: 6,
    mtime: new Date(0),
  })

  downloadBinaryFile(
    input.filename || safeExportFilename(input.title, 'epub'),
    zipped,
    'application/epub+zip',
  )
}

const containerXml = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
`

function packageOpf(input: {
  id: string
  title: string
  author: string
  language: string
  now: string
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${escapeXml(input.id)}</dc:identifier>
    <dc:title>${escapeXml(input.title)}</dc:title>
    <dc:creator>${escapeXml(input.author)}</dc:creator>
    <dc:language>${escapeXml(input.language)}</dc:language>
    <meta property="dcterms:modified">${input.now}</meta>
    <meta name="generator" content="wowMD Pro"/>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="toc" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="content" href="content.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="styles.css" media-type="text/css"/>
  </manifest>
  <spine toc="toc">
    <itemref idref="content"/>
  </spine>
</package>
`
}

function navXhtml(title: string, toc: TocItem[]) {
  const items = toc.length
    ? toc
        .map(
          (item) =>
            `<li><a href="content.xhtml#${escapeXml(item.id)}">${escapeXml(item.text)}</a></li>`,
        )
        .join('')
    : '<li><a href="content.xhtml">Start</a></li>'

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <head>
    <title>${escapeXml(title)}</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>${items}</ol>
    </nav>
  </body>
</html>
`
}

function tocNcx(input: {
  id: string
  title: string
  author: string
  toc: TocItem[]
}) {
  const points = (input.toc.length
    ? input.toc
    : [{ id: '', text: 'Start', level: 1 }]
  )
    .map(
      (item, index) => `<navPoint id="navPoint-${index + 1}" playOrder="${index + 1}">
  <navLabel><text>${escapeXml(item.text)}</text></navLabel>
  <content src="content.xhtml${item.id ? `#${escapeXml(item.id)}` : ''}"/>
</navPoint>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${escapeXml(input.id)}"/>
    <meta name="dtb:depth" content="2"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(input.title)}</text></docTitle>
  <docAuthor><text>${escapeXml(input.author)}</text></docAuthor>
  <navMap>
    ${points}
  </navMap>
</ncx>
`
}

function contentXhtml(title: string, language: string, bodyHtml: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}">
  <head>
    <title>${escapeXml(title)}</title>
    <link rel="stylesheet" type="text/css" href="styles.css"/>
  </head>
  <body>
    <article>
      ${bodyHtml}
    </article>
  </body>
</html>
`
}

const epubCss = `body {
  font-family: serif;
  line-height: 1.55;
}
pre {
  white-space: pre-wrap;
  border: 1px solid #d8d2c5;
  padding: 0.75em;
  background: #f4f0e8;
}
code {
  font-family: monospace;
}
table {
  border-collapse: collapse;
  width: 100%;
}
th, td {
  border: 1px solid #d8d2c5;
  padding: 0.35em;
}
img {
  max-width: 100%;
  height: auto;
}
.md-fold-btn {
  display: none;
}
`

function prepareContent(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,button').forEach((node) => node.remove())
  doc.querySelectorAll('a[target],a[rel]').forEach((link) => {
    link.removeAttribute('target')
    link.removeAttribute('rel')
  })
  doc.querySelectorAll('img[src]').forEach((image) => {
    const src = image.getAttribute('src') || ''
    if (/^(https?:)?\/\//i.test(src) || src.startsWith('file:')) {
      const figure = doc.createElement('figure')
      const caption = doc.createElement('figcaption')
      caption.textContent = `Image not embedded: ${src}`
      image.replaceWith(figure)
      figure.appendChild(caption)
    }
  })

  doc.querySelectorAll('[data-annotation-id],[data-search-index]').forEach((node) => {
    node.removeAttribute('data-annotation-id')
    node.removeAttribute('data-search-index')
  })

  return {
    html: toXhtml(doc.body.innerHTML),
  }
}

function toXhtml(html: string) {
  return html
    .replace(/<br>/g, '<br/>')
    .replace(/<hr>/g, '<hr/>')
    .replace(/<img([^>]*?)(?<!\/)>/g, '<img$1/>')
}

function downloadBinaryFile(filename: string, contents: Uint8Array, type: string) {
  const bytes = new Uint8Array(contents)
  const blob = new Blob([bytes.buffer], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    }
    return entities[char]
  })
}
