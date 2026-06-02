/**
 * Capture real wowMD app preview screenshots for website material.
 *
 * CI-ready. Env vars:
 *   APP_URL        app server base URL          (default http://localhost:5173)
 *   SHOTS_OUT      output base dir              (default website/assets/shots)
 *   SHOTS_LOCALES  comma list, e.g. "en,zh"     (default "en")
 *
 * Single locale -> flat files in SHOTS_OUT. Multiple -> SHOTS_OUT/<locale>/.
 * Captures: reader.png, annotate.png (4 real typed annotations), map.png, export.png, settings.png.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const APP = process.env.APP_URL || 'http://localhost:5173';
const OUT_BASE = process.env.SHOTS_OUT || join(__dirname, '..', 'website', 'assets', 'shots');
const LOCALES = (process.env.SHOTS_LOCALES || 'en').split(',').map((s) => s.trim()).filter(Boolean);

// Phrases live in the (English) sample document; the same anchors work in every UI locale.
const MARKS = [
  ['process Markdown in the browser', 'dispute'],
  ['Documents should not be uploaded', 'important'],
  ['outline generation, safe rendering', 'clarify'],
  ['Stored locally by document fingerprint', 'confirmed'],
  ['Clean offline single-file export', 'important'],
];

async function selectPhrase(page, needle) {
  return page.evaluate((n) => {
    const root = document.querySelector('.markdown-body');
    if (!root) return false;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = w.nextNode())) {
      const i = (node.textContent || '').indexOf(n);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(node, i); r.setEnd(node, i + n.length);
        const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        return true;
      }
    }
    return false;
  }, needle);
}

async function annotate(page, phrase, type) {
  if (!(await selectPhrase(page, phrase))) { console.warn('  phrase not found:', phrase); return; }
  await page.waitForSelector('.floating-markup', { timeout: 3000 });
  await page.click(`.type-chip.chip-${type}`);
  await page.click('.toolbar-confirm');
  await page.waitForTimeout(250);
}

async function captureLocale(browser, locale, outDir) {
  mkdirSync(outDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.evaluate((loc) => localStorage.setItem('wowmd.locale', loc), locale);
  await page.reload({ waitUntil: 'domcontentloaded' });

  await page.getByRole('button', { name: /sample|示例|サンプル|샘플|Beispiel|exemple/i }).click();
  await page.waitForSelector('.markdown-body');
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(outDir, 'reader.png') });

  for (const [phrase, type] of MARKS) await annotate(page, phrase, type);
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, 'annotate.png') });

  const mapBtn = page.locator('.map-action');
  if (await mapBtn.count()) {
    await mapBtn.first().click();
    await page.waitForSelector('.understanding-map', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(450);
    await page.screenshot({ path: join(outDir, 'map.png') });
    await page.keyboard.press('Escape').catch(() => {});
    await page.click('.modal-close').catch(() => {});
  }

  const settingsBtn = page.locator('.toolbar-settings-action');
  if (await settingsBtn.count()) {
    await settingsBtn.first().click();
    await page.waitForSelector('.settings-panel', { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(outDir, 'settings.png') });
    await page.keyboard.press('Escape').catch(() => {});
    await page.click('.modal-close').catch(() => {});
  }
  const exp = page.getByRole('button', { name: /^Export HTML$|导出 HTML|HTML を書き出し|HTML 내보내기|HTML exportieren|Exporter HTML/i });
  if (await exp.count()) {
    await exp.first().click();
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(outDir, 'export.png') });
  }

  await ctx.close();
  console.log(`captured: ${locale} -> ${outDir}`);
}

const browser = await chromium.launch();
for (const locale of LOCALES) {
  const outDir = LOCALES.length > 1 ? join(OUT_BASE, locale) : OUT_BASE;
  await captureLocale(browser, locale, outDir);
}
await browser.close();
console.log('done');
