import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoDir = join(__dirname, '..');
const websiteDir = join(repoDir, 'website');
const PORT = 3001;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webm': 'video/webm',
  '.mp4': 'video/mp4', '.json': 'application/json', '.xml': 'application/xml',
  '.txt': 'text/plain',
};

const server = createServer((req, res) => {
  let urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = join(websiteDir, urlPath);
  if (!filePath.startsWith(websiteDir)) { res.writeHead(403); res.end('Forbidden'); return; }
  if (existsSync(filePath)) { const s = statSync(filePath); if (s.isDirectory()) filePath = join(filePath, 'index.html'); }
  if (!existsSync(filePath)) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
});
server.listen(PORT);

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const results = [];
let pass = 0, fail = 0;

async function check(path, name, tests) {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  for (const [label, fn] of tests) {
    try {
      const ok = await fn(page);
      const status = ok ? 'PASS' : 'FAIL';
      results.push({ page: name, test: label, status, detail: typeof ok === 'string' ? ok : '' });
      if (ok) pass++; else fail++;
    } catch (e) {
      results.push({ page: name, test: label, status: 'ERR', detail: e.message });
      fail++;
    }
  }
  await page.close();
}

// ---------- Landing Page (Loop Canvas - /)
await check('/', 'Landing', [
  ['Hero: Open Markdown', async (p) => (await p.textContent('h1')).includes('Open Markdown')],
  ['Loop nodes exist (6+)', async (p) => (await p.locator('.loop-node[data-node]').count()) >= 6],
  ['HTML export node visible', async (p) => await p.locator('[data-node="html"]').count() > 0],
  ['JSON export node visible', async (p) => await p.locator('[data-node="json"]').count() > 0],
  ['Node click expands detail', async (p) => {
    await p.locator('[data-node="source"]').click();
    await p.waitForTimeout(300);
    return (await p.locator('.loop-node-detail.is-visible').count()) > 0;
  }],
  ['Privacy line: Nothing is uploaded', async (p) => (await p.textContent('.loop-privacy')).includes('Nothing is uploaded')],
  ['Dark background', async (p) => { const bg = await p.evaluate(() => getComputedStyle(document.body).backgroundColor); return bg === 'rgb(30, 30, 28)'; }],
  ['No trial text', async (p) => { const text = await p.textContent('body'); return !text.includes('trial') && !text.includes('14-day'); }],
]);

// ---------- Pro Page (/pro.html)
await check('/pro.html', 'Pro', [
  ['Hero: Open Markdown', async (p) => (await p.textContent('h1')).includes('Open Markdown')],
  ['Hero CTA goes to app/', async (p) => (await p.locator('.hero-actions .button-primary').getAttribute('href')).includes('app/')],
  ['Reader section: 6 feature cards', async (p) => (await p.locator('#reader .feature-card').count()) === 6],
  ['Annotate section: 4 feature cards', async (p) => (await p.locator('#annotate .feature-card').count()) === 4],
  ['Export section: 3 checklist items', async (p) => (await p.locator('.export-detail-list li').count()) === 3],
  ['Comparison table has rows', async (p) => (await p.locator('.compare-table tbody tr').count()) >= 8],
  ['FAQ present', async (p) => (await p.locator('.faq-item').count()) >= 4],
  ['Bottom CTA visible', async (p) => await p.locator('.bottom-cta').count() > 0],
  ['No trial text', async (p) => (await p.locator('.trial-note').count()) === 0],
  ['No price shown', async (p) => !(await p.textContent('body')).includes('$')],
]);

// ---------- Extension Page (/extension.html)
await check('/extension.html', 'Extension', [
  ['Hero title', async (p) => (await p.textContent('h1')).includes('Long Markdown')],
  ['Pro nav link exists', async (p) => await p.locator('.nav-pro').count() > 0],
  ['Demo video loaded', async (p) => await p.locator('.demo-video').count() > 0],
  ['Features: 4 cards', async (p) => (await p.locator('.feature-card').count()) === 4],
  ['Bottom Pro CTA visible', async (p) => await p.locator('.extension-pro-cta').count() > 0],
  ['Bottom CTA links to pro.html', async (p) => (await p.locator('.extension-pro-cta .button-primary').getAttribute('href')).includes('pro.html')],
]);

// ---------- WebApp (/app/)
await check('/app/', 'WebApp', [
  ['App loads (topbar visible)', async (p) => await p.locator('.topbar').count() > 0],
  ['Dark theme active', async (p) => (await p.locator('.theme-dark').count()) > 0],
  ['Choose Markdown button', async (p) => await p.locator('.primary-action').count() > 0],
  ['Open Sample button', async (p) => await p.locator('.ghost-action').count() > 0],
]);

// ---------- CSS Sanity
await check('/pro.html', 'CSS-Sanity', [
  ['FAQ accordion JS loaded', async (p) => {
    await p.locator('.faq-question').first().click();
    await p.waitForTimeout(200);
    return (await p.locator('.faq-item.is-open').count()) > 0;
  }],
  ['Toolbar sticky on WebApp', async (p) => {
    await p.goto(`http://localhost:${PORT}/app/`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    const sticky = await p.evaluate(() => {
      const el = document.querySelector('.tool-row');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.position === 'sticky';
    });
    return sticky;
  }],
]);

// ---------- Print results
console.log('\n=== AUDIT RESULTS ===\n');
for (const r of results) {
  const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} [${r.page}] ${r.test}${r.detail ? ' — ' + r.detail : ''}`);
}
console.log(`\nPass: ${pass}  Fail: ${fail}  Total: ${pass + fail}`);

await browser.close();
server.close();
process.exit(fail > 0 ? 1 : 0);
