# wowMD Web App

[English](#english) · [简体中文](#简体中文)

## English

### Purpose

wowMD Web App is the local-first Markdown reader and review workspace deployed
under `/app/`. It opens browser-side reading copies of local Markdown files and
explicitly imported public GitHub Markdown; it does not overwrite the original
local file.

### Implemented scope

- Open local `.md` and `.markdown` by picker or drag-and-drop.
- Import only allowlisted public raw GitHub URLs and persist the imported copy
  in IndexedDB for later reopening.
- Read using outline navigation, search, rendered code/table/image/link
  handling, code-copy buttons, H2 folding, themes, and reader settings.
- Create typed annotations, notes, suggested replacements, and protected
  `confirmed` passages; save them locally and re-anchor them across versions.
- Review the whole document through the review map and version-history views.
- Export standalone HTML, reviewed Markdown, annotation backup JSON, and
  structured ticket JSON for an optional external revision workflow.
- Provide six locales: English, Simplified Chinese, Japanese, Korean, German,
  and French.

The beta build keeps `LICENSE_FEATURE_ENABLED = false`. License/trial helpers
exist but do not currently gate local opening or the supported exports. EPUB
export code is experimental and not exposed as a supported UI path.

### Privacy boundary

The reader does not upload an opened local document. Browser storage can retain
local document copies, annotations, reviewed copies, versions, and settings.
GitHub content is fetched only after the user explicitly imports an allowlisted
raw GitHub URL.

### Development

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Vite writes the production build to `../website/app/`. Do not edit that output
directly. Use `npm.cmd run dev` for local development and `npm.cmd run preview`
to preview the built app.

## 简体中文

### 项目定位

wowMD Web App 是部署在 `/app/` 下的本地优先 Markdown 阅读与审阅工作区。它为本地
Markdown 和用户明确导入的公开 GitHub Markdown 创建浏览器侧阅读副本，不会改写磁盘上的
原始本地文件。

### 已实现范围

- 通过文件选择器或拖放打开本地 `.md`、`.markdown` 文件。
- 仅导入受白名单限制的公开 GitHub 原始链接，并将导入副本保存到 IndexedDB，供之后再次打开。
- 提供目录导航、搜索、代码/表格/图片/链接渲染、代码复制、H2 折叠、主题与阅读设置。
- 创建带类型的标注、附注、建议替换文本和受保护的 `confirmed` 段落；在本地保存，并可跨版本
  重新锚定。
- 通过整体审阅地图和版本历史查看整篇文档的审阅状态。
- 导出独立 HTML、已审阅 Markdown、标注备份 JSON，以及面向可选外部修订工作流的结构化
  工单 JSON。
- 支持英语、简体中文、日语、韩语、德语和法语。

Beta 构建中 `LICENSE_FEATURE_ENABLED = false`。授权/试用辅助代码仍在，但当前不会限制
本地文件打开或已支持的导出。EPUB 导出代码为实验性实现，当前不作为受支持的 UI 功能开放。

### 隐私边界

阅读器不会上传用户打开的本地文档。浏览器存储可能保留本地文档副本、标注、已审阅副本、版本
和设置。只有用户明确导入通过白名单校验的 GitHub 原始链接时，才会请求 GitHub 内容。

### 开发

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

Vite 会将生产构建写入 `../website/app/`。不要直接编辑该目录；本地开发使用
`npm.cmd run dev`，预览构建使用 `npm.cmd run preview`。
