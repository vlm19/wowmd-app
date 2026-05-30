import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const websiteDir = 'D:/GitHub/wowmd-app/website';
const screenshotDir = join(websiteDir, 'screenshots');
mkdirSync(screenshotDir, { recursive: true });

const mime = { '.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webm':'video/webm','.mp4':'video/mp4','.json':'application/json','.xml':'application/xml','.txt':'text/plain' };
const srv = createServer((req, res) => {
  let p = new URL(req.url, 'http://localhost:3002').pathname;
  if (p === '/') p = '/index.html';
  let fp = join(websiteDir, p);
  if (!fp.startsWith(websiteDir)) { res.writeHead(403); return res.end(); }
  if (existsSync(fp)) { const st = statSync(fp); if (st.isDirectory()) fp = join(fp, 'index.html'); }
  if (!existsSync(fp)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': mime[extname(fp).toLowerCase()] || 'text/plain' });
  res.end(readFileSync(fp));
});
srv.listen(3002, async () => {
  console.log('Server ready');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });

  const p1 = await ctx.newPage();
  await p1.goto('http://localhost:3002/', { waitUntil: 'networkidle' });
  await p1.waitForTimeout(500);
  await p1.screenshot({ path: join(screenshotDir, 'preview-landing.png'), fullPage: true });
  console.log('OK: landing-page');

  await p1.locator('[data-node="source"]').click();
  await p1.waitForTimeout(400);
  await p1.screenshot({ path: join(screenshotDir, 'preview-landing-expanded.png'), fullPage: true });
  console.log('OK: landing-expanded');

  await p1.locator('[data-node="source"]').click();
  await p1.waitForTimeout(200);
  await p1.locator('[data-node="judge"]').click();
  await p1.waitForTimeout(400);
  await p1.screenshot({ path: join(screenshotDir, 'preview-landing-judge.png'), fullPage: true });
  console.log('OK: landing-judge');
  await p1.close();

  const p2 = await ctx.newPage();
  await p2.goto('http://localhost:3002/pro.html', { waitUntil: 'networkidle' });
  await p2.waitForTimeout(500);
  await p2.screenshot({ path: join(screenshotDir, 'preview-pro-hero.png'), fullPage: false });
  await p2.evaluate(() => document.querySelector('#loop')?.scrollIntoView());
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: join(screenshotDir, 'preview-pro-loop.png'), fullPage: false });
  await p2.evaluate(() => document.querySelector('#export')?.scrollIntoView());
  await p2.waitForTimeout(300);
  await p2.screenshot({ path: join(screenshotDir, 'preview-pro-export.png'), fullPage: false });
  console.log('OK: pro-page');
  await p2.close();

  await b.close();
  srv.close();
  process.exit(0);
});
