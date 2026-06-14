/**
 * Render-layer i18n guard. Run AFTER build (npm run verify = build && guard).
 *
 * Catches the failure class that JSON key-coverage checks miss:
 *   1) Residual data-i18n attributes in a generated page  -> that page never went
 *      through the i18n replacement loop (e.g. the support-page build bug).
 *   2) A translated English string leaking into a localized page -> a specific
 *      element's data-i18n key was missing/wrong, or the page wasn't rebuilt.
 *
 * Exits non-zero on any failure so it can gate the Cloudflare build.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const i18nDir = path.join(root, "i18n");
const LOCALES = ["zh", "ja", "ko", "de", "fr"];
const GENERATED_ROOT = [
  "index.html", "extension.html", "pro.html",
  "privacy.html", "terms.html", "support.html",
];

const escapeHtml = (v) =>
  String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const read = (p) => fs.readFileSync(p, "utf8");
const htmlFiles = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".html")) : [];

const failures = [];

// ---- Check 1: residual data-i18n in any generated page ----
const scanResidual = (relFile) => {
  const abs = path.join(root, relFile);
  if (!fs.existsSync(abs)) { failures.push(`MISSING generated page: ${relFile}`); return; }
  const html = read(abs);
  const n = (html.match(/data-i18n(-content|-placeholder)?=/g) || []).length;
  if (n > 0) failures.push(`RESIDUAL data-i18n (${n}) in ${relFile} — page skipped the i18n pipeline`);
};

for (const f of GENERATED_ROOT) scanResidual(f);
for (const loc of LOCALES) for (const f of htmlFiles(path.join(root, loc))) scanResidual(`${loc}/${f}`);

// ---- Check 2: translated English leaking into a localized page ----
const en = JSON.parse(read(path.join(i18nDir, "en.json")));
for (const loc of LOCALES) {
  const locData = JSON.parse(read(path.join(i18nDir, `${loc}.json`)));
  // long prose strings that ARE translated in this locale (value differs from EN)
  const probes = Object.keys(en)
    .filter((k) => locData[k] && locData[k] !== en[k] && en[k].length > 20)
    .map((k) => ({ k, enHtml: escapeHtml(en[k]) }));

  for (const f of htmlFiles(path.join(root, loc))) {
    const html = read(path.join(root, loc, f));
    for (const { k, enHtml } of probes) {
      if (html.includes(enHtml)) {
        failures.push(`ENGLISH LEAK in ${loc}/${f}: key "${k}" shows EN -> "${en[k].slice(0, 50)}..."`);
        break; // one report per file is enough
      }
    }
  }
}

// ---- Report ----
if (failures.length) {
  console.error(`\n✗ i18n guard FAILED (${failures.length}):`);
  for (const m of failures) console.error(`  - ${m}`);
  console.error("");
  process.exit(1);
}
console.log("✓ i18n guard passed: no residual data-i18n, no English leaks in localized pages.");
