# wowMD

**A non-destructive review layer for Markdown. Read, annotate, and let your understanding accumulate across document versions — locally, privately, and under your control.**

Markdown files change. AI re-generates them. Editors rewrite them. wowMD gives you a place to pause, read with structure, mark what matters, and keep those annotations alive as the document evolves. Export as HTML to share with people, or as JSON — if you choose to involve AI, it stays your decision, on your terms.

A local-first workspace plus a free Chrome extension for quick GitHub reading.

---

## Product Philosophy

### Your data, your rules

All processing stays in your browser. Nothing is uploaded. Annotations never leave your machine unless you explicitly export them. wowMD does not make trust decisions on your behalf.

### The annotation layer is the product

Markdown converters come and go. What persists is your layer of judgement — what you highlighted, what you questioned, what you understood. wowMD treats annotations as first-class data: they are stored, reloaded, re-anchored across document versions, and aggregated into an understanding map. This layer grows more valuable the more you use it.

### AI is an optional downstream consumer, not the product

You choose whether to involve AI at all. Export JSON if you want to feed annotations into an external tool. Use local AI to keep everything private. Or don't — the understanding map and cross-version tracking work entirely without AI. The product stands on its own. The AI pipe is yours to connect or ignore.

---

## The Workflow

```
Open Markdown → Read with structure → Judge & highlight → Add notes
                                                              │
                                     ┌────────────────────────┘
                                     ▼
                              Annotations persist
                              (IndexedDB + localStorage)
                                     │
                                     ├── Export HTML (share with people)
                                     ├── Export JSON (your choice: feed AI or not)
                                     └── Understanding map (where you're stuck)
```

---

## Products

### wowMD Pro WebApp (`app/`)

A browser-based workspace for local Markdown files. Nothing is uploaded.

- **Open** — drag-and-drop or file picker for `.md` / `.markdown` files. Import from GitHub via the Chrome extension in one click.
- **Read** — interactive outline with scroll-synced active heading. Section folding. Code syntax highlighting with copy button. Horizontal table scrolling. Full-text search with match count and navigation. Dark (default) and light themes. Adjustable font size.
- **Annotate** — select text, a floating toolbar appears. Six highlight colors. Add notes linked to the passage with semantic context (quote, prefix, suffix, heading path, offset). Notes panel with locate, delete, and export actions. All data persisted locally in IndexedDB with localStorage fallback.
- **Export** — self-contained HTML with document structure, TOC, code blocks, highlights, and notes preserved. JSON export for AI workflow handoff (optional — you decide whether to involve AI). Live preview before download.

### Chrome Extension (`bg4abs/wowmd-ext`)

A free, lightweight extension for reading Markdown on GitHub.

- One-click Better View on public GitHub `.md` pages.
- Full Reader with outline navigation, H2 folding, code highlighting, and table scrolling.
- Continue in Pro — open the same document in the full workspace.

---

## Website (`website/`)

Static HTML/CSS/JS site served via Cloudflare Pages.

| Page | URL | Purpose |
|---|---|---|
| Landing (Loop Canvas) | `/` | Visual workflow diagram |
| Pro product page | `/pro.html` | Detailed feature showcase |
| Extension product page | `/extension.html` | Free Chrome extension details |
| WebApp SPA | `/app/` | The product itself |

6 locales: English, Chinese, Japanese, Korean, German, French.

---

## Architecture

```
wowmd-app/
  website/          Static marketing site + Cloudflare Pages config
    index.html      Loop Canvas landing page
    pro.html        Pro product page
    extension.html  Extension product page
    styles.css      CSS design tokens + all page styles
    script.js       Language picker, scroll reveal, FAQ accordion
    i18n/           6 locale JSON translation files
    app/            Built WebApp output (from app/dist)
  app/              React + Vite + TypeScript SPA
    src/
      App.tsx       Main component (Reader, Export, License views)
      App.css       All WebApp styling
      i18n.ts       6-locale UI translations
      markdown.ts   markdown-it rendering, TOC, SHA-256 fingerprint
      annotations.ts  Annotation model, IndexedDB + localStorage CRUD, 3-tier re-anchoring
      exportHtml.ts   Self-contained HTML export builder
      importService.ts  GitHub raw URL import + allowlist validation
      localDocuments.ts  IndexedDB document storage (wowmd_local)
      license.ts    Trial state model + feature gates
      search.ts     In-document search with highlighting
      fold.ts       H2 section folding
  docs/             Product specs, design docs, implementation guides
```

---

## Tech Stack

| Component | Stack |
|---|---|
| WebApp | React 19, Vite 8, TypeScript 6, pure CSS |
| Website | Static HTML/CSS/JS (zero external dependencies) |
| Fonts (WebApp) | DM Sans + DM Mono (Google Fonts) |
| Icons | Tabler Icons (CDN, WebApp) + inline SVGs (Website) |
| Markdown | markdown-it + highlight.js + DOMPurify |
| Storage | IndexedDB + localStorage |
| Deployment | Cloudflare Pages + Cloudflare Workers + D1 |
