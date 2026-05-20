# wowMD Feedback Backend: Cloudflare Workers + D1

This guide describes how to collect feedback and waiting-list submissions from `website/feedback.html` with a Cloudflare Worker and D1 database.

## 1. Target Architecture

```text
feedback.html
  POST /api/feedback
      |
      v
Cloudflare Worker
  validate / normalize / rate limit
      |
      v
Cloudflare D1
```

The frontend already sends JSON to:

```text
POST /api/feedback
```

The Worker should return:

```json
{ "ok": true }
```

or:

```json
{ "ok": false, "error": "invalid_email" }
```

## 2. Create The D1 Database

Install Wrangler if needed:

```bash
npm install -g wrangler
```

Log in:

```bash
wrangler login
```

Create the database:

```bash
wrangler d1 create wowmd-feedback
```

Wrangler will print a `database_id`. Keep it for `wrangler.toml`.

Current production database:

```text
database_name: wowmd-feedback
database_id: 1b79c79d-a81b-4e1a-a20e-f5d3c21a0c01
region: APAC
binding: DB
```

## 3. D1 Schema

Create `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS feedback_entries (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('feedback', 'waiting_list')),
  email TEXT,
  message TEXT,
  features_json TEXT,
  custom_feature TEXT,
  source TEXT,
  locale TEXT,
  page_url TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_type_created
ON feedback_entries (type, created_at);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_email
ON feedback_entries (email);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_ip_created
ON feedback_entries (ip_hash, created_at);
```

Apply it locally:

```bash
wrangler d1 execute wowmd-feedback --local --file=./schema.sql
```

Apply it remotely:

```bash
wrangler d1 execute wowmd-feedback --remote --file=./schema.sql
```

## 4. Worker Configuration

Example `wrangler.toml`:

```toml
name = "wowmd-feedback-api"
main = "src/worker.js"
compatibility_date = "2026-05-19"

[[d1_databases]]
binding = "DB"
database_name = "wowmd-feedback"
database_id = "1b79c79d-a81b-4e1a-a20e-f5d3c21a0c01"
```

If the Worker is deployed separately from Pages, route it under the same domain:

```text
wowmd.app/api/*
```

If using Cloudflare Pages Functions instead, place the handler at:

```text
website/functions/api/feedback.js
```

Then Pages can serve `/api/feedback` directly.

For GitHub-connected Cloudflare Pages, confirm the Pages project has a D1 binding:

```text
Pages project -> Settings -> Functions -> D1 database bindings
Variable name: DB
D1 database: wowmd-feedback
```

If the Cloudflare Pages root directory is `/website`, use:

```text
Build command: node scripts/build-i18n-pages.mjs
Output directory: .
```

If the Pages root directory is the repository root, use:

```text
Build command: node website/scripts/build-i18n-pages.mjs
Output directory: website
```

## 5. Worker Handler Example

```js
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const allowedFeatures = new Set([
  "local_md",
  "shareable_html",
  "highlight_annotate",
  "export_pdf"
]);

const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "POST" || url.pathname !== "/api/feedback") {
      return json({ ok: false, error: "not_found" }, 404);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "invalid_json" }, 400);
    }

    const type = String(body.type || "");
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    const customFeature = String(body.customFeature || "").trim();
    const features = Array.isArray(body.features)
      ? body.features.filter((item) => allowedFeatures.has(item))
      : [];

    if (!["feedback", "waiting_list"].includes(type)) {
      return json({ ok: false, error: "invalid_type" }, 400);
    }

    if (type === "feedback" && (message.length < 1 || message.length > 500)) {
      return json({ ok: false, error: "invalid_message" }, 400);
    }

    if (type === "waiting_list") {
      if (!isEmail(email) || email.length > 120) {
        return json({ ok: false, error: "invalid_email" }, 400);
      }

      if (features.length === 0 && customFeature.length === 0) {
        return json({ ok: false, error: "empty_interest" }, 400);
      }
    }

    if (customFeature.length > 150) {
      return json({ ok: false, error: "custom_feature_too_long" }, 400);
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const userAgent = request.headers.get("user-agent") || "";

    await env.DB.prepare(
      `INSERT INTO feedback_entries (
        id, type, email, message, features_json, custom_feature,
        source, locale, page_url, user_agent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        type,
        email || null,
        message || null,
        JSON.stringify(features),
        customFeature || null,
        String(body.source || "website_feedback_page").slice(0, 80),
        String(body.locale || "en").slice(0, 16),
        String(body.pageUrl || "").slice(0, 500),
        userAgent.slice(0, 500),
        createdAt
      )
      .run();

    return json({ ok: true });
  }
};
```

## 6. Frontend Validation Rules

The current page uses:

```text
Quick feedback message: required, max 500 characters
Anything else: optional, max 150 characters
Email: required for waiting list, valid email, max 120 characters
Waiting list: requires at least one selected feature or custom idea
```

The Worker must keep the same validation. Frontend validation is only for user experience.

## 7. Simple Anti-Spam Measures

Recommended first version:

```text
Honeypot field from frontend
Field length limits
Allowed feature IDs only
Basic IP or user-agent rate limiting
No HTML rendering of submitted text
```

For stronger protection later:

```text
Cloudflare Turnstile
D1 table for per-IP submission windows
Queue-based async processing
```

## 8. Query And Export Data

Read recent entries:

```bash
wrangler d1 execute wowmd-feedback --remote --command="SELECT type, email, message, features_json, custom_feature, created_at FROM feedback_entries ORDER BY created_at DESC LIMIT 50;"
```

Export as JSON:

```bash
wrangler d1 execute wowmd-feedback --remote --json --command="SELECT * FROM feedback_entries ORDER BY created_at DESC;" > feedback_entries.json
```

Export as CSV with a small script later if needed.

## 9. Deployment Notes

For Cloudflare Pages, use the build settings from section 4 depending on whether the project root is `/website` or the repository root.

If using Pages Functions, commit the function under:

```text
website/functions/api/feedback.js
```

If using a separate Worker, deploy it and add a route:

```bash
wrangler deploy
```

Then configure the route in Cloudflare:

```text
wowmd.app/api/*
```

## 10. Privacy Copy To Keep In Sync

The feedback page promises:

```text
Only used to notify you when your picks ship. Nothing else.
```

Do not use submitted emails for newsletters, marketing, or unrelated product messages unless the page copy and privacy policy are updated first.
