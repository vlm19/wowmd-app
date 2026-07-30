# 功能解释与 UI 引导设计

> 面向产品/设计/前端，说明 WOWMD 阅读器中三类「非 HTML 输出」功能的本质、价值，以及如何在 UI 层让新用户低成本地理解并上手。
>
> 适用版本：beta（全功能免费）。涉及代码：
> [`NotesPanel.tsx`](../app/src/NotesPanel.tsx)、[`UnderstandingMap.tsx`](../app/src/UnderstandingMap.tsx)、[`useAnnotations.ts`](../app/src/hooks/useAnnotations.ts)、[`annotations.ts`](../app/src/annotations.ts)、[`i18n.ts`](../app/src/i18n.ts)。

---

## 0. 一句话定位

WOWMD 的核心闭环是：**读 → 标 → 交付**。
用户在正文上做有类型的标注（澄清/争议/重点/已确认），系统再把这些标注转化为三种可交付物：

- **理解地图** —— 把标注*可视化*，帮用户看清自己的理解分布。
- **备份标注 JSON** —— 把标注*存档*，用于备份与再导入。
- **工单 JSON** —— 把标注*转成可执行指令*，交给 AI 或人工编辑去修订全文。

新用户的学习成本几乎全部集中在「交付」这一端：按钮文案近似、产出不可见、用途不直观。本文给出诊断与 UI 引导方案。

---

## 1. 标注体系：四种类型即四种「指令」

标注是一切输出的原料。四种类型在 [`createTicketExport`](../app/src/annotations.ts:549) 的 `typeLegend` 中已被定义为明确的处理指令（双语）：

| 类型 | 中文 | 指令含义（写入工单 typeLegend） |
|---|---|---|
| `clarify` | 澄清 | 解释、澄清此处，勿动实质。 |
| `dispute` | 争议 | 复核此处，可能有误，实质可能需要修改。 |
| `important` | 重点 | 保留并强调此关键点。 |
| `confirmed` | 已确认 | 已审、正确，无需动作。 |

> 设计要点：用户标注时心里想的是「我对这句话的态度」，但系统已经把这份态度翻译成了「AI/编辑应执行的动作」。**这层「态度 → 指令」的转化是产品最大的价值，也最不被新用户感知。** UI 引导的重心就在于把它显性化。

每条标注还携带可定位与可修订的元数据：
- `quote` / `prefix` / `suffix` —— 命中的文本及前后锚点，用于在原文中精确定位。
- `headingPath` —— 所在章节路径。
- `note` —— 用户自己的批注文字（可选）。
- `suggestedReplacement` —— 用户给出的建议替换文本（可选）。注意：它只写入工单，**不会改动源文件**（见 i18n 键 `suggestedReplacementHint`）。

---

## 2. 三类输出的本质、产出与受众

### 2.1 理解地图（Understanding Map）

- **代码**：[`UnderstandingMap.tsx`](../app/src/UnderstandingMap.tsx)，入口在 [`ReaderToolbar`](../app/src/ReaderToolbar.tsx) 的 `map` 按钮。
- **产出**：按章节统计四种标注的密度，渲染为热力条；点章节名可跳转到正文对应位置。
- **价值**：一眼看出困惑（澄清）、争议集中在哪些章节，从而决定先处理哪里。
- **受众**：用户本人，用于审阅与决策。
- **触发条件**：文档已打开且至少有一条标注；否则按钮禁用并提示 `mapEmptyHint`。

### 2.2 备份标注 JSON（Export JSON）

- **代码**：[`exportAnnotationsAsJson`](../app/src/hooks/useAnnotations.ts:193)。
- **产出**：原始 `annotations[]` 数组，`JSON.stringify` 后下载。
- **价值**：备份、跨设备迁移、日后重新导入、或开发者程序化处理。
- **受众**：用户（存档）/ 开发者（程序）。
- **特点**：只含标注本身，不含原文，**不适合直接喂给 AI**。

### 2.3 工单 JSON（Export Ticket JSON）—— 核心交付物

- **代码**：[`exportTicketJson`](../app/src/hooks/useAnnotations.ts:202) → [`createTicketExport`](../app/src/annotations.ts:549)。
- **产出结构**：

  ```jsonc
  {
    "document": {
      "title": "...",
      "source": "...",
      "fingerprint": "...",
      "markdownSnapshot": "<导出时的全文 Markdown>"
    },
    "typeLegend": { "clarify": "...", "dispute": "...", "important": "...", "confirmed": "..." },
    "tickets": [
      {
        "type": "dispute",
        "quote": "命中的原文",
        "prefix": "前文锚点", "suffix": "后文锚点",
        "headingPath": ["一级标题", "二级标题"],
        "sectionBody": "该标注所在章节的正文（含上下文）",
        "note": "用户批注（可选）",
        "suggestedReplacement": "建议替换文本（可选）"
      }
    ]
  }
  ```

- **价值**：把「读者在页边写的批注」打包成一份**自带原文、自带处理指令、自带定位信息**的工单，交给 AI 或人工编辑即可逐条执行、产出修订全文。这是 WOWMD 区别于普通批注工具的关键能力。
- **受众**：AI 大模型 / 人工编辑。

---

## 3. 问题诊断：学习成本卡在哪

1. **撞名**：NotesPanel 里「导出 JSON」与「导出工单 JSON」并排，文案近似、都带「JSON」，新用户分不清差异。
2. **产出不可见**：点了按钮只是下载一个文件，用户不知道里面是什么、能拿它做什么。工单 JSON 的全部价值都藏在文件内部。
3. **工作流隐形**：「标注 → 导出工单 → 喂给 AI → 拿回修订稿」这条主链路在 UI 上没有任何提示，用户不会自发想到。
4. **地图无导读**：[`UnderstandingMap`](../app/src/UnderstandingMap.tsx) 打开后只有标题「Section density by type」，四种类型仅以单字母 C/D/I/Co 呈现，新用户不知如何解读。

---

## 4. UI 引导方案：四层渐进式信息

原则：**成本递增、按需展开**，复用现有 UI 模式（`title` 悬停、modal、导出选项面板的 `<small>` 说明），避免一次性堆文字。

### 第 1 层 · 悬停微提示（title）
给 NotesPanel 三个按钮各加 `title`（沿用 Map 按钮已有的 `title` 写法）：
- 备份标注：「导出全部标注的原始数据，用于备份或日后重新导入。」
- 导出工单：「把你的批注打包成可执行工单——含原文、章节上下文和每条批注的处理指令，可直接交给 AI 或编辑。」

### 第 2 层 · NotesPanel 空状态全链路引导
现状只显示 `selectToNote`。扩为一句完整路径：
> 选中正文 → 标为 澄清 / 争议 / 重点 / 已确认 → 导出工单，交给 AI 按你的批注修订全文。

让用户在产生第一条标注前就建立心智模型。

### 第 3 层 · 工单 ⓘ 说明弹层（投入产出比最高）
在「导出工单」按钮旁加 **ⓘ** 图标，点开轻量弹层（可复用 `annotation-modal` 结构），三段式：

> **什么是工单？**
> 一份结构化 JSON，包含：原文快照、四种标注类型的指令含义、以及每条批注的所在章节、上下文锚点、你的批注与建议替换。
>
> **怎么用？**
> 把整个文件内容粘贴给 ChatGPT / Claude 等，让它按你的批注逐条修订全文——你只需读和标，重活交给 AI。
>
> **和「备份标注」的区别？**
> 备份只存标注本身（给程序用）；工单额外带上原文和处理指令（给 AI / 人读）。
>
> `[复制提示词模板]`  `[关闭]`

### 第 4 层 · 理解地图加图例 + 导读
在 [`UnderstandingMap`](../app/src/UnderstandingMap.tsx) 标题下加一行导读：
> 看出困惑与争议集中在哪些章节。点击章节名可跳转。

并把单字母 C/D/I/Co 配上四色图例：
- 🔵 澄清 · 🔴 争议 · 🟡 重点 · 🟢 已确认

（颜色与 `TYPE_COLORS` 一致：clarify=blue、dispute=rose、important=amber、confirmed=green。）

---

## 5. 工单弹层附带的「复制提示词模板」

点击 `[复制提示词模板]` 写入剪贴板的内容（复用 [`appUtils`](../app/src/appUtils.ts) 的 `copyTextWithFallback`）。字段名与 [`createTicketExport`](../app/src/annotations.ts:549) 实际产出一一对应：

```
你是一位严谨的文稿编辑。我会给你一份 JSON 工单，里面是我对一篇文档的批注。
请按每条批注的 type 处理，并输出修订后的完整全文：

- clarify（澄清）：解释或讲清此处，但不改变实质内容。
- dispute（争议）：复核此处，可能有误，必要时修正，并说明改动理由。
- important（重点）：保留并强调此关键点。
- confirmed（已确认）：已审核无误，保持原样。

规则：
1. 以 document.markdownSnapshot 为底稿，仅改动批注命中的部分，其余原样保留。
2. 每条批注用 headingPath + quote + prefix/suffix 定位；如有 suggestedReplacement 优先采用。
3. 先输出修订后的完整 Markdown 全文，再附一份「改动清单」逐条说明你做了什么。

工单如下：
<在此粘贴导出的工单 JSON 文件内容>
```

---

## 6. 命名调整建议

| 现按钮（i18n 键） | 建议文案 | 理由 |
|---|---|---|
| 导出 JSON（`exportJson`） | **备份标注 (.json)** | 点明用途，与工单划清界限 |
| 导出工单 JSON（`exportTicketJson`） | **导出工单 (.json)** + 旁加 ⓘ | 名字保留，靠 ⓘ 承载解释 |
| 理解地图（`map`） | 不变 | 已够直观，问题在打开后的导读 |

---

## 7. 落地清单（实现时参考）

1. **i18n**：上述新文案在 [`i18n.ts`](../app/src/i18n.ts) 六种语言各加 key（建议：`backupJsonLabel`、`backupJsonTitle`、`ticketJsonTitle`、`ticketInfoTitle`/`ticketInfoBody`、`ticketPromptTemplate`、`notesEmptyFlow`、`mapLegend`、`mapIntro`）。
   - 提示词模板含字段名，可各语言共用同一份，或仅翻译说明、保留英文字段名。
2. **NotesPanel**：三按钮加 `title`；工单按钮旁加 ⓘ；空状态文案改为全链路引导。
3. **工单说明弹层**：新增轻量组件，复用 `UnderstandingMap` 的 modal 结构与关闭按钮；含「复制提示词模板」按钮。
4. **UnderstandingMap**：标题下加导读行 + 四色图例（字母→颜色+中文标签）。
5. **复制**：统一走 `copyTextWithFallback`。

### 优先级
- **P0**：第 3 层（工单 ⓘ 弹层 + 提示词模板）—— 直击最有价值却最不被理解的功能。
- **P0**：第 1 层（title 微提示）+ 命名调整 —— 近乎零成本。
- **P1**：第 4 层（地图图例/导读）。
- **P2**：第 2 层（空状态全链路引导）。

---

## 8. 验收标准

- 新用户**未打开任何文件**时，能从空状态文案理解「标注 → 工单 → AI 修订」的主链路。
- 新用户**悬停**任一导出按钮，能在一句话内分清「备份」与「工单」。
- 新用户点开工单 ⓘ 后，能在不读源码的情况下知道工单里有什么、怎么用，并可一键复制提示词直接试用。
- 新用户打开理解地图，无需猜测即可读懂四种颜色的含义和「点击跳转」的交互。
