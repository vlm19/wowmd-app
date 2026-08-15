# wowMD

[English](#english) · [简体中文](#简体中文)

## English

### What it is

wowMD is a local-first Markdown reader and review workspace. This repository
contains the public website, the wowMD Pro web app, Cloudflare Pages Functions,
and the generated `/app/` deployment output. The product is in beta and is free
during beta.

### Open source and trademarks

The source code is licensed under [Apache License 2.0](LICENSE). See
[NOTICE](NOTICE) for required attribution and [TRADEMARKS.md](TRADEMARKS.md)
for the separate rules for the wowMD name and visual identity. The license does
not grant permission to represent a fork as the official wowMD product.

### Current capabilities

#### wowMD Pro web app (`app/`)

- Open local `.md` and `.markdown` files by picker or drag-and-drop.
- Import public GitHub Markdown only through an explicit, allowlisted
  `https://raw.githubusercontent.com/...` route.
- Read with an outline, in-document search, code highlighting and copy,
  table scrolling, H2 folding, light/dark themes, and adjustable reader,
  outline, and font settings.
- Add typed review annotations (`clarify`, `dispute`, `important`, and
  `confirmed`), notes, suggested replacements, and document context.
- Persist browser-local document copies, annotations, settings, and version
  lineage; re-anchor annotations when a document changes.
- Inspect an overall review map and version relationships.
- Export self-contained HTML, reviewed Markdown for an Obsidian-compatible
  workflow, annotation backup JSON, and structured ticket JSON for an optional
  external revision workflow.
- Use English, Simplified Chinese, Japanese, Korean, German, or French.

License and trial helper code remains in the app, but the feature gate is
currently disabled for beta (`LICENSE_FEATURE_ENABLED = false`). It does not
currently restrict local-file opening or supported exports. EPUB export code is
experimental and is not exposed as a supported UI path; HTML is the supported
document export format.

#### Public website (`website/`)

The static Cloudflare Pages site has generated localized pages for English,
Simplified Chinese, Japanese, Korean, German, and French. It includes landing,
Pro, extension, support/feedback, privacy, terms, and 404 pages, plus SEO
assets (`robots.txt`, `sitemap.xml`, `llms.txt`). A small, dismissible
open-source notice links to this repository on the landing, Pro, and support
pages.

The Chrome extension is maintained outside this repository. The website
describes it as a public-GitHub-Markdown entry point that can hand a document
off to the web app.

The web app's SPA routes (`/import`, `/reader/*`) are served by Pages
Functions that return the app shell with a `noindex` tag; legacy feedback URLs
redirect to the support page.

### Data and network boundaries

- Local Markdown is processed in the browser; the web app does not overwrite
  the original file on disk.
- Local reading copies, annotations, reviewed copies, versions, and settings
  can be stored in browser storage.
- GitHub content is fetched only after an explicit import request for an
  allowlisted raw GitHub URL.
- The public website uses Google Analytics and its feedback form submits to
  Cloudflare Pages Functions backed by Cloudflare D1. See the published
  [privacy policy](website/privacy.html) for the current disclosure.

### Repository layout

```text
wowmd-app/
  app/                         React, Vite, and TypeScript web-app source
  website/                     Cloudflare Pages source and deployment root
    app/                       Generated web-app build output
    assets/                    Brand, screenshot, and product-demo assets
    docs/                      Feedback-backend and upgrade notes
    functions/                 Pages Functions: feedback API and SPA routes
    i18n/                      Website locale dictionaries
    scripts/                   Localized-page generator and guards
    404.html, llms.txt, robots.txt, sitemap.xml, schema.sql, wrangler.toml
  docs/                        Product notes and implementation plans
  scripts/                     Browser and local verification helpers
```

### Build and verification

From `app/`:

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

The app build writes production assets to `website/app/` with Vite's
`base: "/app/"`.

From `website/`:

```powershell
npm.cmd install
npm.cmd run verify
```

`verify` regenerates localized HTML, the sitemap, and validates locale key
coverage. For a local static preview:

```powershell
python -m http.server 4174 --bind 127.0.0.1 --directory website
```

Then open `http://127.0.0.1:4174/` or `http://127.0.0.1:4174/app/`.

### Deployment

- Cloudflare Pages root: `website/`.
- Do not edit `website/app/` directly; build it from `app/`.
- Localized website HTML and `sitemap.xml` are generated from templates and
  `website/i18n/*.json`.
- `wrangler.toml` declares the Pages project and the D1 binding (`DB`);
  `website/schema.sql` defines the feedback table schema.
- Feedback API route: `/api/feedback`.
- `_redirects` maps `/app/*`, `/import`, and `/reader/*` to the app shell and
  redirects legacy feedback URLs to the support page; `_headers` applies the
  CSP, HSTS, and other security headers.

### Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow. Report
security issues according to [SECURITY.md](SECURITY.md), rather than publishing
exploitable details in a public issue.

## 简体中文

### 项目简介

wowMD 是一款本地优先的 Markdown 阅读与审阅工作区。本仓库包含公开网站、wowMD
Pro Web 应用、Cloudflare Pages Functions，以及用于部署的生成产物 `/app/`。产品目前
处于 Beta 阶段，Beta 期间免费使用。

### 开源许可与商标

本仓库源码采用 [Apache License 2.0](LICENSE) 许可；必要的署名说明见
[NOTICE](NOTICE)。wowMD 名称和视觉标识另受 [TRADEMARKS.md](TRADEMARKS.md) 约束；
该许可证不授予将分支版本宣称为官方 wowMD 产品的权利。

### 当前功能

#### wowMD Pro Web 应用（`app/`）

- 通过文件选择器或拖放打开本地 `.md`、`.markdown` 文件。
- 仅通过明确触发且受白名单限制的
  `https://raw.githubusercontent.com/...` 路径导入公开 GitHub Markdown。
- 提供目录、文内搜索、代码高亮与复制、表格横向滚动、H2 折叠、明暗主题，以及阅读区、
  目录和字号设置。
- 对选中文本添加 `clarify`、`dispute`、`important`、`confirmed` 四类审阅标记、
  附注、建议替换文本和文档上下文。
- 在浏览器本地保存文档副本、标注、设置和版本关系；文档变更后可重新锚定标注。
- 查看整体审阅地图和版本关系。
- 导出独立 HTML、适用于 Obsidian 工作流的已审阅 Markdown、标注备份 JSON，以及可选的
  外部修订工作流所需的结构化工单 JSON。
- 支持英语、简体中文、日语、韩语、德语和法语界面。

应用中仍保留授权与试用相关的辅助代码，但 Beta 阶段的功能开关当前为关闭状态
（`LICENSE_FEATURE_ENABLED = false`），不会限制本地文件打开或已支持的导出功能。
EPUB 导出代码属于实验性实现，当前不作为受支持的 UI 功能开放；稳定支持的文档导出格式
为 HTML。

#### 公开网站（`website/`）

静态 Cloudflare Pages 网站会生成英语、简体中文、日语、韩语、德语和法语页面，包含首页、
Pro、扩展、支持/反馈、隐私、条款和 404 页面，以及 `robots.txt`、`sitemap.xml`、
`llms.txt` 等 SEO 资源。首页、Pro 与支持页会显示一条可关闭的开源公告，并链接到本仓库。

Chrome 扩展不在此仓库维护。网站将其描述为公开 GitHub Markdown 的入口，可将文档交给
Web 应用继续阅读和审阅。

Web 应用的 SPA 路由（`/import`、`/reader/*`）由 Pages Functions 提供应用外壳并标记
`noindex`；旧的反馈链接会重定向到支持页。

### 数据与网络边界

- 本地 Markdown 在浏览器内处理；Web 应用不会改写磁盘上的原始文件。
- 本地阅读副本、标注、已审阅副本、版本和设置可保存到浏览器存储中。
- 仅当用户明确导入经过白名单校验的 GitHub 原始链接时，才会请求 GitHub 内容。
- 公开网站使用 Google Analytics；反馈表单会提交到由 Cloudflare D1 支持的
  Cloudflare Pages Functions。以已发布的[隐私政策](website/privacy.html)为准。

### 仓库结构

```text
wowmd-app/
  app/                         React、Vite、TypeScript Web 应用源码
  website/                     Cloudflare Pages 源码与部署根目录
    app/                       生成的 Web 应用构建产物
    assets/                    品牌、截图与产品演示资源
    docs/                      反馈后端与升级说明
    functions/                 Pages Functions：反馈 API 与 SPA 路由
    i18n/                      网站多语言字典
    scripts/                   多语言页面生成与校验脚本
    404.html、llms.txt、robots.txt、sitemap.xml、schema.sql、wrangler.toml
  docs/                        产品说明与实现计划
  scripts/                     浏览器与本地验证工具
```

### 构建与验证

在 `app/` 中执行：

```powershell
npm.cmd install
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```

应用构建会通过 Vite 的 `base: "/app/"` 写入生产资源到 `website/app/`。

在 `website/` 中执行：

```powershell
npm.cmd install
npm.cmd run verify
```

`verify` 会重新生成多语言 HTML 和站点地图，并校验翻译键覆盖率。若需本地静态预览：

```powershell
python -m http.server 4174 --bind 127.0.0.1 --directory website
```

然后打开 `http://127.0.0.1:4174/` 或 `http://127.0.0.1:4174/app/`。

### 部署

- Cloudflare Pages 根目录：`website/`。
- 不要直接编辑 `website/app/`；应从 `app/` 构建生成。
- 多语言网站 HTML 与 `sitemap.xml` 由模板和 `website/i18n/*.json` 生成。
- `wrangler.toml` 声明 Pages 项目与 D1 绑定（`DB`）；`website/schema.sql` 定义
  反馈数据表结构。
- 反馈 API 路径：`/api/feedback`。
- `_redirects` 将 `/app/*`、`/import`、`/reader/*` 映射到应用外壳，并把旧的反馈
  链接重定向到支持页；`_headers` 应用 CSP、HSTS 等安全响应头。

### 参与贡献与安全报告

开发与贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按
[SECURITY.md](SECURITY.md) 报告，不要在公开 issue 中披露可被利用的细节。
