# wowMD Web App

Closed-source local-first Markdown reader and HTML export app.

闭源的本地优先 Markdown 阅读与 HTML 导出应用。

## English

### Purpose

wowMD Web App turns local Markdown files and public GitHub Markdown imports into a structured reading workspace. It is designed for long technical documents, product specs, implementation notes, and other Markdown files that benefit from outline navigation, readable layout, highlights, and notes.

The app does not upload the opened document. Reading, annotation, trial state, and local storage all happen in the browser.

### Current Scope

- Open local `.md` / `.markdown` files.
- Import public GitHub Markdown from the wowMD extension via `/app/import?source=github&rawUrl=...`.
- Validate imported URLs so only `https://raw.githubusercontent.com/...` is fetched.
- Save imported GitHub Markdown as a browser-local document copy and restore it from `/app/reader/:docId`.
- Open a bundled sample document without starting the trial.
- Generate a document outline from headings.
- Read in light or dark mode with independent scrolling for outline, document, and notes.
- Adjust document font size and outline font size.
- Render code blocks, tables, links, images, and H2 folding controls.
- Add highlights and short notes to selected text.
- Locate highlights and notes back in the document.
- Store annotations locally per document fingerprint.
- Preview and export a self-contained HTML reading document with table of contents, document content, highlights, and notes.
- Support localized UI text for English, Chinese, Japanese, Korean, German, and French.
- Gate local-file opening and export with trial/license state.

The extension import flow passes only source metadata. It does not send Markdown content, license keys, emails, tokens, highlights, or notes in the URL.

EPUB export code exists as an experimental path, but the UI currently hides EPUB because HTML export is the stable supported format.

### Project Structure

```text
app/
  public/
    assets/
      brand/       Brand logo and mark used by the app UI.
      flags/       Language selector flag assets.
      icons/       Small UI icons.
  src/
    App.tsx        Main application shell, reader, export preview, and license views.
    App.css        Product UI styling, themes, responsive layout, and component states.
    annotations.ts Local annotation model, storage, and highlight injection.
    exportHtml.ts  Stable HTML export generator.
    exportEpub.ts  Experimental EPUB exporter, currently hidden from the UI.
    fold.ts        H2 section folding behavior.
    i18n.ts        UI translations and locale persistence.
    importService.ts GitHub raw URL import parsing, allowlist validation, fetch, and local document creation.
    license.ts     Local trial/license state helpers.
    localDocuments.ts IndexedDB persistence for imported browser-local document copies.
    markdown.ts    Markdown rendering, sanitization, table wrapping, TOC, stats, sample doc.
    search.ts      Search highlight helpers.
```

### Design Principles

- Local first: no document upload during reading or export.
- Content first: UI should support reading, not compete with the document.
- Restrained motion: hover feedback should be perceptible but quiet.
- Stable layout: outline, document, and notes scroll independently.
- Consistent brand surface: app pages should feel connected to the wowMD website.
- Export fidelity: exported HTML should preserve the reading experience as closely as possible.
- Conservative feature surface: hide unstable or unclear features until they are reliable.

### Development

```bash
npm install
npm run dev
npm run build
```

Build output is written to `../website/app/` by Vite.

## 中文

### 项目定位

wowMD Web App 用于把本地 Markdown 文件和公开 GitHub Markdown 导入转换成结构化阅读工作区。它主要面向较长的技术文档、产品规格、实现说明，以及其他需要目录导航、清晰排版、高亮和附注的 Markdown 文档。

应用不会上传用户打开的文档。阅读、标注、试用状态和本地存储都在浏览器中完成。

### 当前功能

- 打开本地 `.md` / `.markdown` 文件。
- 通过 `/app/import?source=github&rawUrl=...` 接收 wowMD 扩展传来的公开 GitHub Markdown。
- 校验导入 URL，只允许抓取 `https://raw.githubusercontent.com/...`。
- 将导入的 GitHub Markdown 保存为浏览器本地文档副本，并支持从 `/app/reader/:docId` 恢复。
- 打开内置示例文档，且不消耗试用。
- 根据标题生成文档目录。
- 支持浅色/深色阅读模式，目录、正文、附注区域分别滚动。
- 支持正文和目录字号调整。
- 渲染代码块、表格、链接、图片和 H2 折叠控件。
- 对选中文本添加高亮和短附注。
- 从高亮/附注标签定位回正文上下文。
- 按文档指纹在浏览器本地保存标注。
- 预览并导出 HTML 阅读文档，包含目录、正文、高亮和附注。
- 支持英文、中文、日文、韩文、德文、法文界面文案。
- 通过试用/授权状态控制本地文件打开和导出能力。

扩展导入流程只传来源 metadata。URL 中不传 Markdown 全文、License Key、邮箱、token、高亮或附注。

EPUB 导出代码仍作为实验路径保留，但当前界面隐藏 EPUB。现阶段稳定支持的导出格式是 HTML。

### 项目结构

```text
app/
  public/
    assets/
      brand/       应用界面使用的品牌 logo 和图标。
      flags/       语言切换使用的旗帜素材。
      icons/       小型 UI 图标。
  src/
    App.tsx        应用主壳、阅读页、导出预览页和授权页。
    App.css        产品 UI 样式、主题、响应式布局和组件状态。
    annotations.ts 标注模型、本地存储和高亮注入逻辑。
    exportHtml.ts  稳定的 HTML 导出生成器。
    exportEpub.ts  实验性 EPUB 导出器，当前不在界面展示。
    fold.ts        H2 章节折叠行为。
    i18n.ts        界面翻译和语言偏好保存。
    importService.ts GitHub raw URL 导入参数解析、allowlist 校验、fetch 和本地文档创建。
    license.ts     本地试用/授权状态辅助逻辑。
    localDocuments.ts 导入文档本地副本的 IndexedDB 持久化。
    markdown.ts    Markdown 渲染、清洗、表格包装、目录、统计和示例文档。
    search.ts      搜索高亮辅助逻辑。
```

### 设计原则

- 本地优先：阅读和导出过程中不上传文档。
- 内容优先：界面服务于阅读，不抢正文注意力。
- 动效克制：悬停反馈可感知，但不强调存在感。
- 布局稳定：目录、正文、附注分别滚动，减少互相干扰。
- 品牌一致：Web App 与 wowMD 网站保持统一的视觉气质。
- 导出一致：导出的 HTML 尽量还原阅读界面的体验。
- 功能保守：不稳定或意义不清的功能先隐藏，稳定后再开放。

### 开发命令

```bash
npm install
npm run dev
npm run build
```

Vite 构建产物会输出到 `../website/app/`。
