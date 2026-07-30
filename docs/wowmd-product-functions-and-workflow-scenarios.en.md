# wowMD Product Functions And Workflow Scenarios

## 1. Product Positioning

wowMD is a local-first toolset for reading and reviewing long Markdown. It is not a generic Markdown converter or a cloud document platform. It acts as a review layer between a Markdown draft, often written by a person or AI, and the final material that needs to be understood, revised, shared, or archived.

The product family has two focused parts:

- **wowMD Chrome Extension**: a free browser extension for reading public GitHub Markdown pages with better structure.
- **wowMD Pro Web App**: a local-first web app for local Markdown files, structured reading, typed annotations, notes, cross-version review, and export.

The boundary is intentional. The extension helps users quickly read long Markdown on GitHub. The Web App turns Markdown into a deeper review workspace with annotations and deliverables.

## 2. Core Value

Long Markdown often loses structure in a normal browser, GitHub view, or plain editor. Users have to scroll repeatedly, locate headings, inspect code blocks, handle wide tables, remember open questions, and then communicate their review to another person or an AI tool.

wowMD connects those steps into one workflow:

1. **Open** Markdown from GitHub or local files.
2. **Read** with outline navigation, folding, search, code rendering, table handling, and theme controls.
3. **Judge** selected passages with four semantic review types.
4. **Preserve** annotations, notes, suggested replacements, and section context locally in the browser.
5. **Deliver** the result as HTML, Obsidian-ready reviewed Markdown, Backup JSON, or Ticket JSON for AI/editor workflows.

The result is not just "I read the document." It becomes "I completed a review that can be revisited, shared, backed up, or acted on."

## 3. Chrome Extension Features

### 3.1 Supported Content

The Chrome extension is focused on public GitHub Markdown pages:

- Public repository README pages.
- Public `.md` file pages.
- Public `.markdown` file pages.

The extension does not handle local files, private repository integration, Issues, Pull Requests, Wiki pages, or non-GitHub websites. It also does not include annotations, the Overall Review Map, version survival, or export. Those belong to the Web App.

### 3.2 Reading Enhancements

The extension turns native GitHub Markdown into a calmer reading view:

- **Outline navigation**: builds a table of contents from headings so users can understand the document structure and jump between sections.
- **Section folding**: collapses large sections when the user wants to focus on one part of the document.
- **Code readability**: improves code block spacing and syntax highlighting for technical content.
- **Wide table handling**: keeps wide tables usable through internal horizontal scrolling.
- **Long README reading mode**: makes project docs, setup instructions, architecture notes, changelogs, and configuration guides easier to scan.

### 3.3 Privacy Boundary

The extension is designed as an open-and-read tool:

- It does not collect personal information.
- It does not upload document content to third-party services.
- It does not provide AI summaries, cloud analysis, or remote document processing.
- It processes the current GitHub page locally in the browser when the user chooses the enhanced reader view.

### 3.4 Best-Fit Extension Scenarios

The extension is best for low-friction GitHub reading:

- Understanding an open-source project README.
- Reading framework, SDK, or CLI documentation.
- Browsing repository design notes, architecture documents, or changelogs.
- Quickly finding commands, parameters, table rows, or section-level explanations.

It improves workflow efficiency by reducing time spent finding position and recovering context. Users can navigate by outline, collapse irrelevant sections, and read technical blocks without wrestling with the default page layout.

## 4. Web App Features

### 4.1 Local Markdown Open And GitHub Import

The Web App supports deeper review work:

- Open local `.md` and `.markdown` files.
- Support file picker and drag-and-drop workflows.
- Import public GitHub Markdown from extension-provided raw URLs.
- Validate imports so only `https://raw.githubusercontent.com/...` URLs are fetched.
- Save imported GitHub Markdown as browser-local document copies and restore them through `/app/reader/:docId`.
- Open a bundled sample document without starting a real trial.

The opened Markdown is not uploaded. Reading, annotation, export, trial state, and local persistence happen in the browser.

### 4.2 Structured Reader

The Web App reader is built for long technical Markdown and AI-generated documents:

- **Document outline** from headings.
- **Scroll-aware navigation** for orientation in long documents.
- **H2 folding** for large sections.
- **Full-text search** with match count and previous/next controls.
- **Code block rendering** with syntax highlighting and copy controls.
- **Table rendering** with inner scrolling for wide tables.
- **Links and images** rendered from Markdown, with local/relative image support where the browser allows it.
- **Themes and font controls** for light, dark, and comfortable long-form reading.
- **Independent scroll regions** for outline, document, and notes.

The goal is to make Markdown feel like a working review surface rather than a flat blob of text.

### 4.3 Four Semantic Review Types

Annotations are not just colors. Each type records a judgment:

| Type | Meaning | Typical Action |
|---|---|---|
| Clarify | This needs explanation or more context | Ask an AI or author to clarify without changing the core meaning |
| Dispute | This may be wrong or needs review | Check facts, logic, implementation details, or assumptions |
| Important | This is a key point | Preserve and emphasize it in later delivery |
| Confirmed | This has been reviewed and is trusted | Keep it as-is and avoid repeated review |

When users select text, a floating toolbar lets them choose a review type, add a short note, or provide a suggested replacement. Suggested replacements are review data only. They do not directly modify the original Markdown.

### 4.4 Anchoring And Cross-Version Survival

Annotations store more than a visual position:

- Document fingerprint.
- Selected quote.
- Prefix and suffix context.
- Heading path.
- Offset fallback.
- Review type.
- Note body.
- Suggested replacement.
- Created and updated timestamps.

This lets wowMD re-anchor annotations when a source document changes slightly. If a passage cannot be found automatically, users can use the Notes panel and Find flow to recover context manually.

### 4.5 Notes Panel

The Notes panel is the control surface for review work:

- Shows all annotations and notes.
- Filters by review type.
- Jumps back to the source passage.
- Organizes confusion, disputes, key points, and confirmed content.
- Provides the source data for HTML export, reviewed Markdown, Backup JSON, and Ticket JSON.

It helps users answer: What do I still not understand? What needs correction? What must be preserved? What is already confirmed?

### 4.6 Overall Review Map

The Overall Review Map turns typed annotations into a document-level review overview:

- **Coverage** shows how many sections have received typed review.
- **Review confidence** shows the share of Confirmed and Important judgments.
- **Risk focus** highlights sections that need attention next.
- **Document Overview** shows the annotation mix for every section.
- **Needs attention** explains why specific sections should be reviewed next.

It does not judge the document's inherent quality or generate an AI summary. It visualizes the user's review state and provides direct navigation back to the relevant sections.

### 4.7 Export Outputs

Export is the final step of the review loop, not a secondary feature.

#### HTML Export

For human readers:

- Exports a single offline-readable HTML file.
- Preserves structure, table of contents, heading anchors, content, code blocks, tables, links, images, highlights, and notes.
- Opens in any browser.
- Does not include the app runtime, tracking scripts, or license logic.

Use it when teammates, clients, reviewers, or future-you need a polished reading artifact.

#### Reviewed Markdown For Obsidian

For knowledge management:

- Creates a new `.md` copy.
- Includes Obsidian-readable review callouts, wowMD tags, and review properties.
- Does not overwrite the original file.
- Does not apply suggested replacements.
- Does not call AI.

Use it when a reviewed document should live in an Obsidian vault or long-term knowledge base.

#### Backup JSON

For backup and portability:

- Exports raw annotation data.
- Supports backup, re-import, and programmatic handling.
- Is not the best format for direct AI editing because it mainly stores annotation records.

Use it to protect important local review data from browser storage loss.

#### Ticket JSON

For AI or editor execution:

- Includes the document snapshot.
- Includes a bilingual legend for the four review types.
- Includes each annotation's heading path, quote, prefix/suffix context, note, and suggested replacement.
- Acts as a structured work order.

Use it when the user has already judged the document and wants an AI or editor to revise it according to those judgments.

### 4.8 Local Storage And Privacy

The Web App uses browser site data, not ordinary HTTP cache:

- Saved annotations persist primarily through `localStorage`, with IndexedDB fallback/store logic.
- Imported GitHub Markdown copies are stored in IndexedDB.
- Local files are usually session inputs; the app stores annotation data by document fingerprint rather than permanently storing the full local file.
- Unsaved toolbar drafts are not the same as saved annotations.

Important boundaries:

- Saved annotations usually survive normal refresh, close, and reopen as long as browser site data remains intact.
- Clearing site data, using private/incognito mode, changing browser/profile/device, or browser storage eviction can remove local data.
- Important annotations and finished review artifacts should still be exported as backups.
- Browser-local data may contain sensitive information such as document fragments, notes, suggested replacements, source URLs, titles, and version context.

## 5. How The Extension And Web App Work Together

The extension and Web App represent different stages of the same product family:

| Stage | Tool | User Goal |
|---|---|---|
| Quick reading | Chrome Extension | Read public GitHub Markdown with structure |
| Deep review | Web App | Open local/imported Markdown, annotate, take notes, inspect the map |
| Delivery | Web App | Export HTML, reviewed Markdown, Backup JSON, or Ticket JSON |

Typical path:

1. A user finds a long README or design document on GitHub.
2. The extension opens a cleaner reader so the user can decide whether the document needs deeper work.
3. If annotations, notes, export, or AI handoff are needed, the user continues in wowMD Pro.
4. The Web App handles review, persistence, map inspection, and export.

This keeps the extension lightweight while giving serious review work a proper workspace.

## 6. Typical Workflow Scenarios

### Scenario 1: Developer Reading A Large Open-Source README

User goal:

- Understand a project's purpose, setup, configuration, and limitations.
- Find key commands, APIs, compatibility notes, or warnings.

Workflow:

1. Open the GitHub README with the Chrome extension.
2. Use the outline to understand the document structure.
3. Fold irrelevant sections.
4. Inspect code blocks and tables for setup commands and parameters.
5. Stop at the extension if the task is temporary reading.
6. Move the Markdown into the Web App if it needs long-term notes or review.

Efficiency gain:

- Less repeated scrolling.
- Faster section-level navigation.
- Fewer missed parameters in wide tables or dense code blocks.

### Scenario 2: Product Manager Reviewing An AI-Written Product Spec

User goal:

- Check whether an AI-generated spec is complete, accurate, and actionable.
- Mark what needs clarification, correction, preservation, or confirmation.
- Produce a work order that an AI can use to revise the document.

Workflow:

1. Open the spec Markdown in the Web App.
2. Scan the outline and fold sections to understand structure.
3. Mark vague passages as Clarify.
4. Mark questionable scope, constraints, user stories, or assumptions as Dispute.
5. Mark must-keep details as Important.
6. Mark verified passages as Confirmed.
7. Use the Overall Review Map to find review gaps, risk focus, and sections with heavy dispute or clarification density.
8. Export Ticket JSON and paste it into an AI tool for revision.
9. Export HTML if the reviewed state needs to be shared with the team.

Efficiency gain:

- The user's judgment becomes structured data.
- AI receives exact instructions with context instead of vague rewrite requests.
- Team review can focus on disputed and unclear sections first.

### Scenario 3: Engineer Reviewing A Technical Implementation Plan

User goal:

- Review architecture, APIs, migration steps, and risk areas.
- Send precise correction tasks to the author or AI.

Workflow:

1. Open the implementation plan in the Web App.
2. Use search to locate key modules, APIs, tables, and config terms.
3. Mark incorrect assumptions, missing edge cases, or performance risks as Dispute.
4. Mark invariants, migration order, and security requirements as Important.
5. Add notes or suggested replacements where needed.
6. Export Ticket JSON for action.
7. Export HTML as the review record.

Efficiency gain:

- Review feedback is tied to exact source passages.
- Each issue carries section path, quote, and context.
- Handoff becomes a structured task list rather than scattered comments.

### Scenario 4: Knowledge Worker Moving Reviewed Markdown Into Obsidian

User goal:

- Read a long Markdown document and preserve personal judgments in a knowledge base.

Workflow:

1. Open the local Markdown in the Web App.
2. Mark core ideas as Important.
3. Mark future research questions as Clarify.
4. Mark trusted sections as Confirmed.
5. Export Reviewed Markdown for Obsidian.
6. Store the new `.md` file in the Obsidian vault.

Efficiency gain:

- No manual copy/paste of quotes and notes.
- The source file remains unchanged.
- Review callouts and tags remain visible in Obsidian.

### Scenario 5: Sharing A Reviewed Document With Non-Technical Readers

User goal:

- Share a long Markdown review with people who should not need a code editor or Markdown tool.

Workflow:

1. Complete annotations and notes in the Web App.
2. Export a single HTML file.
3. Send or archive the HTML artifact.
4. Recipients open it directly in a browser.

Efficiency gain:

- Recipients do not need Markdown tooling.
- The structure, highlights, and notes are preserved in one file.
- The artifact is easier to revisit than screenshots or chat excerpts.

### Scenario 6: Turning Long AI Output Into An Executable Revision Loop

User goal:

- An AI produced a long plan, report, or explanation, but quality is uneven.
- The user wants to judge the content while letting AI handle mechanical revision.

Workflow:

1. Save the AI output as Markdown.
2. Open it in the Web App.
3. Use the four review types to mark judgments.
4. Add suggested replacements for passages that should change.
5. Export Ticket JSON.
6. Paste the ticket and prompt into an AI tool.
7. Re-import or reopen the revised Markdown for another review pass.

Efficiency gain:

- The user does not need to rewrite the whole document.
- The AI receives precise, passage-level instructions.
- Cross-version annotation anchoring reduces repeat work across review rounds.

### Scenario 7: Iterating Agent Skills And Workflow Instructions

User goal:

- Improve a `SKILL.md`, prompt guide, agent instruction file, or tool workflow document.
- Make the instruction set more accurate, less ambiguous, and easier for an AI agent to execute.
- Preserve verified rules while identifying unclear triggers, tool-order problems, missing failure handling, and weak acceptance criteria.

Workflow:

1. Open the skill or instruction Markdown in the Web App.
2. Use the outline to inspect the structure: trigger conditions, required tools, sequencing, constraints, fallback behavior, and verification steps.
3. Mark vague or under-specified rules as Clarify.
4. Mark rules that conflict with real tool behavior, product boundaries, or prior failures as Dispute.
5. Mark non-negotiable constraints, safety rules, and proven workflows as Important.
6. Mark verified instructions as Confirmed so they are not accidentally weakened during rewriting.
7. Add notes or suggested replacements for exact wording changes.
8. Use the Overall Review Map to find review gaps and sections with dense ambiguity or conflict.
9. Export Ticket JSON and ask an AI to revise the skill according to the typed review.
10. Open the revised Markdown in wowMD for another review pass before committing it back to the repo.

Efficiency gain:

- Skill iteration becomes a structured review loop instead of ad hoc prompt editing.
- Important constraints and verified instructions stay visible during rewrites.
- Ambiguity, contradictions, and missing edge cases are tied to exact passages.
- AI receives passage-level change instructions, reducing the chance that it rewrites the wrong rule or drops a critical constraint.
- Cross-version anchoring helps reviewers compare the old and revised skill without restarting the review from scratch.

## 7. Efficiency Summary

wowMD improves workflow efficiency by connecting reading, judgment, and delivery:

- **Faster navigation** through outline, search, folding, and independent scroll regions.
- **Less context loss** because annotations store quote, heading path, and surrounding text.
- **Clearer review semantics** through four typed judgments instead of generic colors.
- **Shorter delivery path** with separate outputs for people, Obsidian, backup, and AI/editor handoff.
- **Safer defaults** through local-first processing and non-destructive source handling.
- **Better AI collaboration** because users provide structured judgment and AI executes the revision task.
- **More reliable instruction iteration** for skills, prompts, and workflow documents because verified constraints, disputed rules, and suggested rewrites stay attached to the exact source text.

## 8. Current Boundaries And Non-Goals

wowMD should stay focused:

- No cloud sync.
- No account-first document platform.
- No collaborative annotation workspace.
- No enterprise licensing system for v1.
- No private repository integration.
- No multi-file batch processing.
- No v1 promise of AI summary, translation, or automatic rewriting.
- No deep review/export workload inside the extension.
- No direct modification of source Markdown unless a future explicit write-back feature is designed.

These boundaries keep the product clear: open long Markdown, read with structure, make judgments, and deliver the result to people, a knowledge base, or AI.

## 9. Suggested External Description

Short version:

> wowMD turns long Markdown into a local-first review workspace: read with structure, mark what matters, keep annotations anchored, and export clean outputs for people, Obsidian, or AI.

Expanded version:

> wowMD helps you turn long Markdown into a structured review workflow. Read with outline navigation, folding, search, code and table support; mark passages with four semantic review types; keep notes anchored locally; then export HTML for people, reviewed Markdown for Obsidian, Backup JSON for yourself, or Ticket JSON for an AI/editor to execute.
