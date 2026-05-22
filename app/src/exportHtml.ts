import type { TocItem } from './markdown'
import type { Annotation } from './annotations'

type HtmlExportInput = {
  title: string
  bodyHtml: string
  toc: TocItem[]
  annotations?: Annotation[]
  labels: {
    currentDocument: string
    tableOfContents: string
    highlights: string
    highlight: string
    note: string
    jumpToHighlight: string
  }
  generatedAt: Date
  fingerprint: string
  theme: 'light' | 'dark'
  includeToc?: boolean
  includeMetadata?: boolean
}

const themeVars = {
  light: {
    bg: '#1e1e1c',
    surface: '#f5f1e8',
    panel: '#f5f1e8',
    panelText: '#5f584f',
    panelStrong: '#302d28',
    panelSubtle: '#ece6da',
    panelHover: '#eee8dc',
    panelBorder: '#d8d1c4',
    scrollTrack: '#eee8dc',
    scrollThumb: '#b7ad9d',
    border: '#d8d1c4',
    text: '#302d28',
    muted: '#746d62',
    accent: '#5b4dff',
    code: '#d8cfbf',
    codeCopyBg: '#eee8dc',
    codeCopyText: '#302d28',
    codeCopyBorder: '#bfb4a2',
  },
  dark: {
    bg: '#1e1e1c',
    surface: '#242421',
    panel: '#2a2a28',
    panelText: '#c8c4b8',
    panelStrong: '#f4f2ea',
    panelSubtle: '#242421',
    panelHover: '#272725',
    panelBorder: '#464640',
    scrollTrack: '#242421',
    scrollThumb: '#65645b',
    border: '#45443d',
    text: '#f3f0e7',
    muted: '#c5c0b4',
    accent: '#8f86ff',
    code: '#1d1d1a',
    codeCopyBg: '#242421',
    codeCopyText: '#f4f2ea',
    codeCopyBorder: '#464640',
  },
}

export function buildCleanHtmlExport(input: HtmlExportInput) {
  const vars = themeVars[input.theme]
  const includeToc = input.includeToc ?? true
  const includeMetadata = input.includeMetadata ?? true
  const bodyHtml = addCodeCopyButtons(addAnnotationAnchors(input.bodyHtml))
  const exportedAnnotations = input.bodyHtml.includes('data-annotation-id')
    ? input.annotations || []
    : []
  const notes = exportedAnnotations.length
    ? `<aside class="notes" aria-label="${escapeAttr(input.labels.highlights)}">
        <h2>${escapeHtml(input.labels.highlights)}</h2>
        <ol>
          ${exportedAnnotations
            .map(
              (annotation) => `<li class="note note-${annotation.color}">
                <a href="#annotation-${escapeAttr(annotation.id)}" aria-label="${escapeAttr(input.labels.jumpToHighlight)}">
                  <span class="note-kind">${escapeHtml(annotation.note ? input.labels.note : input.labels.highlight)}</span>
                  <span class="note-preview">${escapeHtml(shortText(annotation.note || annotation.quote, 42))}</span>
                </a>
                ${annotation.note ? `<p>${escapeHtml(shortText(annotation.quote, 88))}</p>` : ''}
              </li>`,
            )
            .join('\n')}
        </ol>
      </aside>`
    : ''
  const toc = includeToc && input.toc.length
    ? `<nav class="toc" aria-label="${escapeAttr(input.labels.tableOfContents)}">
        <h2>${escapeHtml(input.labels.tableOfContents)}</h2>
        <ol>
          ${input.toc
            .map(
              (item) =>
                `<li style="--level:${item.level}"><a href="#${escapeAttr(item.id)}">${escapeHtml(item.text)}</a></li>`,
            )
            .join('\n')}
        </ol>
      </nav>`
    : ''

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
    <meta name="generator" content="wowMD Pro">
    <meta name="created" content="${input.generatedAt.toISOString()}">
    <meta name="wowmd:fingerprint" content="${escapeAttr(input.fingerprint)}">
    <style>
      :root {
        color-scheme: ${input.theme === 'dark' ? 'dark' : 'light'};
        --bg: ${vars.bg};
        --surface: ${vars.surface};
        --panel: ${vars.panel};
        --panel-text: ${vars.panelText};
        --panel-strong: ${vars.panelStrong};
        --panel-subtle: ${vars.panelSubtle};
        --panel-hover: ${vars.panelHover};
        --panel-border: ${vars.panelBorder};
        --scroll-track: ${vars.scrollTrack};
        --scroll-thumb: ${vars.scrollThumb};
        --border: ${vars.border};
        --text: ${vars.text};
        --muted: ${vars.muted};
        --accent: ${vars.accent};
        --code: ${vars.code};
        --code-copy-bg: ${vars.codeCopyBg};
        --code-copy-text: ${vars.codeCopyText};
        --code-copy-border: ${vars.codeCopyBorder};
      }
      * { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      body {
        margin: 0;
        background:
          radial-gradient(circle at 50% -20%, rgba(91, 77, 255, 0.15), transparent 34rem),
          linear-gradient(180deg, #242421 0%, #1e1e1c 48rem),
          var(--bg);
        color: var(--text);
        font: 13px/1.75 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif;
      }
      .page {
        display: grid;
        grid-template-columns: minmax(190px, 260px) minmax(0, 760px) minmax(190px, 260px);
        grid-template-areas: "toc document notes";
        gap: 24px;
        width: min(1240px, calc(100% - 40px));
        margin: 0 auto;
        padding: 28px 0 56px;
      }
      .page:not(.has-toc) {
        grid-template-columns: minmax(0, 820px) minmax(190px, 260px);
        grid-template-areas: "document notes";
        width: min(1120px, calc(100% - 40px));
      }
      .page:not(.has-notes) {
        grid-template-columns: minmax(180px, 240px) minmax(0, 780px);
        grid-template-areas: "toc document";
        width: min(1060px, calc(100% - 40px));
      }
      .page:not(.has-toc):not(.has-notes) {
        display: block;
        width: min(820px, calc(100% - 40px));
      }
      .toc,
      .notes {
        position: sticky;
        top: 24px;
        align-self: start;
        max-height: calc(100vh - 48px);
        overflow-y: auto;
        overflow-x: hidden;
        border: 0.5px solid var(--panel-border);
        border-radius: 8px;
        padding: 16px;
        background: var(--panel);
        color: var(--panel-text);
        scrollbar-color: var(--scroll-thumb) var(--panel);
        scrollbar-width: thin;
      }
      .toc::-webkit-scrollbar,
      .notes::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      .toc::-webkit-scrollbar-track,
      .notes::-webkit-scrollbar-track {
        background: var(--panel);
      }
      .toc::-webkit-scrollbar-thumb,
      .notes::-webkit-scrollbar-thumb {
        border: 2px solid var(--panel);
        border-radius: 99px;
        background: var(--scroll-thumb);
      }
      .toc { grid-area: toc; }
      .notes { grid-area: notes; }
      .toc h2,
      .notes h2 {
        margin: 0 0 10px;
        color: var(--panel-strong);
        font-size: 14px;
        font-weight: 500;
      }
      .toc ol,
      .notes ol {
        display: grid;
        gap: 4px;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .toc li { padding-left: calc((var(--level) - 1) * 12px); }
      .toc li,
      .notes li { min-width: 0; }
      .toc a {
        display: block;
        min-width: 0;
        overflow: hidden;
        border-radius: 6px;
        padding: 5px 6px;
        color: var(--panel-text);
        font-size: 13px;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .toc a:hover { color: var(--panel-strong); background: var(--panel-hover); }
      .note {
        display: grid;
        gap: 3px;
        border: 0.5px solid var(--panel-border);
        border-left: 3px solid var(--accent);
        border-radius: 6px;
        padding: 7px 8px;
        background: var(--panel-subtle);
      }
      .note-yellow { border-left-color: #b28a00; }
      .note-blue { border-left-color: #4c82c3; }
      .note-green { border-left-color: #4a9365; }
      .note-rose { border-left-color: #c45a72; }
      .note a {
        display: grid;
        gap: 2px;
        overflow: hidden;
        color: var(--panel-strong);
        text-decoration: none;
      }
      .note-kind {
        color: var(--muted);
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .note-preview {
        overflow: hidden;
        color: var(--panel-strong);
        font-size: 12px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .note p {
        overflow: hidden;
        margin: 0;
        color: var(--panel-text);
        font-size: 11px;
        line-height: 1.4;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .document {
        grid-area: document;
        min-width: 0;
      }
      .doc-header,
      .doc-body {
        border: 0.5px solid var(--border);
        background: var(--surface);
      }
      .doc-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 20px;
        border-radius: 8px;
        margin-bottom: 8px;
        padding: 20px 24px 14px;
      }
      .doc-header p {
        margin: 0 0 8px;
        color: var(--muted);
        font-size: 9px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .doc-header h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 600;
        line-height: 1.25;
      }
      .doc-header code {
        flex: none;
        border: 0.5px solid var(--border);
        border-radius: 6px;
        padding: 4px 7px;
        color: var(--muted);
        font-size: 10px;
      }
      .doc-body {
        border-radius: 8px;
        padding: 24px;
        overflow-wrap: anywhere;
      }
      .doc-meta {
        margin-bottom: 28px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 16px;
        color: var(--muted);
        font-size: 12px;
      }
      h1, h2, h3, h4, h5, h6 {
        color: var(--text);
        line-height: 1.22;
        overflow-wrap: anywhere;
      }
      h1, h2, h3, h4 { margin: 1.5em 0 0.55em; }
      h1:first-child, h2:first-child { margin-top: 0; }
      a { color: var(--accent); }
      blockquote {
        border-left: 4px solid var(--border);
        margin-left: 0;
        padding-left: 16px;
        color: var(--muted);
      }
      pre {
        position: relative;
        overflow: auto;
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 38px 14px 14px;
        background: var(--code);
        font-size: 13px;
        line-height: 1.55;
      }
      .code-copy-button {
        position: sticky;
        left: calc(100% - 54px);
        top: 8px;
        z-index: 1;
        display: flex;
        width: 46px;
        height: 24px;
        align-items: center;
        justify-content: center;
        border: 0.5px solid var(--code-copy-border);
        border-radius: 6px;
        margin: -30px 0 8px auto;
        padding: 0;
        background: var(--code-copy-bg);
        color: var(--code-copy-text);
        font: 600 10px/1 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Arial, sans-serif;
        letter-spacing: 0;
        transition: opacity 0.15s ease;
      }
      .code-copy-button:hover { opacity: 0.88; }
      code {
        border-radius: 5px;
        padding: 2px 5px;
        background: var(--code);
        font-size: 0.9em;
      }
      pre code { padding: 0; background: transparent; }
      img { max-width: 100%; height: auto; }
      .md-table-wrap { overflow-x: auto; margin-bottom: 1em; }
      table {
        width: max-content;
        min-width: 100%;
        border-collapse: collapse;
      }
      th, td {
        border: 1px solid var(--border);
        padding: 8px 10px;
      }
      th { text-align: left; background: var(--code); }
      .md-fold-btn { display: none; }
      :root {
        scrollbar-color: var(--scroll-thumb) var(--scroll-track);
        scrollbar-width: thin;
      }
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }
      ::-webkit-scrollbar-track {
        background: var(--scroll-track);
      }
      ::-webkit-scrollbar-thumb {
        border: 2px solid var(--scroll-track);
        border-radius: 99px;
        background: var(--scroll-thumb);
      }
      .wowmd-highlight {
        border-radius: 2px;
        padding: 0 1px;
      }
      .wowmd-highlight-yellow { background: ${input.theme === 'dark' ? 'rgba(255, 210, 82, 0.34)' : '#fff0a8'}; }
      .wowmd-highlight-blue { background: ${input.theme === 'dark' ? 'rgba(111, 169, 255, 0.32)' : '#cfe5ff'}; }
      .wowmd-highlight-green { background: ${input.theme === 'dark' ? 'rgba(98, 205, 147, 0.3)' : '#ccebd4'}; }
      .wowmd-highlight-rose { background: ${input.theme === 'dark' ? 'rgba(255, 134, 162, 0.32)' : '#ffd4dc'}; }
      .wowmd-highlight:target {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      @media (max-width: 820px) {
        .page,
        .page:not(.has-toc),
        .page:not(.has-notes) {
          grid-template-columns: 1fr;
          grid-template-areas: "toc" "document" "notes";
          width: min(100% - 28px, 820px);
        }
        .page:not(.has-toc) { grid-template-areas: "document" "notes"; }
        .page:not(.has-notes) { grid-template-areas: "toc" "document"; }
        .page:not(.has-toc):not(.has-notes) { display: block; }
        .toc,
        .notes { position: static; max-height: none; }
        .doc-header { flex-direction: column; }
        .doc-body { padding: 22px; }
      }
    </style>
  </head>
  <body>
    <main class="page${toc ? ' has-toc' : ''}${notes ? ' has-notes' : ''}">
      ${toc}
      <section class="document" aria-label="Document">
        <header class="doc-header">
          <div>
            <p>${escapeHtml(input.labels.currentDocument)}</p>
            <h1>${escapeHtml(input.title)}</h1>
          </div>
          <code>${escapeHtml(input.fingerprint.slice(0, 12))}</code>
        </header>
        <article class="doc-body">
        ${
          includeMetadata
            ? `<div class="doc-meta">
          Exported by wowMD Pro / ${escapeHtml(input.generatedAt.toLocaleString())}
        </div>`
            : ''
        }
        ${bodyHtml}
        </article>
      </section>
      ${notes}
    </main>
    <script>
      function copyTextWithFallback(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);

        try {
          return document.execCommand('copy');
        } catch (error) {
          return false;
        } finally {
          textarea.remove();
        }
      }

      document.addEventListener('click', function (event) {
        var copyButton = event.target.closest('.code-copy-button');
        if (copyButton) {
          var code = copyButton.parentElement && copyButton.parentElement.querySelector('code');
          var codeText = code ? code.textContent || '' : '';
          var copied = false;

          event.preventDefault();
          event.stopPropagation();

          if (!codeText) return;

          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(codeText).then(function () {
              copyButton.textContent = 'Copied';
              window.setTimeout(function () {
                copyButton.textContent = 'Copy';
              }, 1200);
            }).catch(function () {
              copied = copyTextWithFallback(codeText);
              copyButton.textContent = copied ? 'Copied' : 'Failed';
              window.setTimeout(function () {
                copyButton.textContent = 'Copy';
              }, 1200);
            });
            return;
          }

          copied = copyTextWithFallback(codeText);
          copyButton.textContent = copied ? 'Copied' : 'Failed';
          window.setTimeout(function () {
            copyButton.textContent = 'Copy';
          }, 1200);
          return;
        }

        var link = event.target.closest('a[href^="#"]');
        if (!link) return;
        var id = decodeURIComponent(link.getAttribute('href').slice(1));
        var target = document.getElementById(id);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ block: 'start' });
        history.replaceState(null, '', '#' + encodeURIComponent(id));
      });
    </script>
  </body>
</html>
`
}

export function downloadTextFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function safeExportFilename(name: string, extension: string) {
  const base = name
    .replace(/\.(md|markdown)$/i, '')
    .split('')
    .map((char) => (isUnsafeFilenameChar(char) ? '-' : char))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)

  return `${base || 'wowmd-export'}.${extension}`
}

function isUnsafeFilenameChar(char: string) {
  return char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char)
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

function escapeAttr(value: string) {
  return escapeHtml(value)
}

function addAnnotationAnchors(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  doc.querySelectorAll<HTMLElement>('[data-annotation-id]').forEach((element) => {
    const id = element.dataset.annotationId
    if (id) element.id = `annotation-${id}`
  })
  return doc.body.innerHTML
}

function addCodeCopyButtons(html: string) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  doc.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
    const code = pre.querySelector('code')
    if (!code || pre.querySelector('.code-copy-button')) return

    const button = doc.createElement('button')
    button.className = 'code-copy-button'
    button.type = 'button'
    button.textContent = 'Copy'
    button.setAttribute('aria-label', 'Copy code')
    pre.append(button)
  })

  return doc.body.innerHTML
}

function shortText(value: string, length: number) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= length) return normalized
  return `${normalized.slice(0, length)}...`
}
