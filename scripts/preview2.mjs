import { chromium } from 'playwright';
import { join } from 'path';
import { mkdirSync } from 'fs';

const baseUrl = 'file:///D:/GitHub/wowmd-app/website';
const screenshotDir = 'D:/GitHub/wowmd-app/website/screenshots';
mkdirSync(screenshotDir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });

// Landing page - full page
const p1 = await ctx.newPage();
p1.on('pageerror', e => console.log('ERR:', e.message));
await p1.goto(baseUrl + '/index.html', { waitUntil: 'networkidle' });
await p1.waitForTimeout(800);
await p1.screenshot({ path: join(screenshotDir, 'v2-landing-full.png'), fullPage: true });
console.log('OK: landing-full');

// Landing page - click source node
await p1.locator('[data-node="source"]').click();
await p1.waitForTimeout(500);
await p1.screenshot({ path: join(screenshotDir, 'v2-landing-source.png'), fullPage: true });
console.log('OK: landing-source');
await p1.locator('[data-node="source"]').click();

// Landing page - click judge node
await p1.waitForTimeout(200);
await p1.locator('[data-node="judge"]').click();
await p1.waitForTimeout(500);
await p1.screenshot({ path: join(screenshotDir, 'v2-landing-judge.png'), fullPage: true });
console.log('OK: landing-judge');
await p1.close();

// Pro page - hero
const p2 = await ctx.newPage();
await p2.goto(baseUrl + '/pro.html', { waitUntil: 'networkidle' });
await p2.waitForTimeout(500);
await p2.screenshot({ path: join(screenshotDir, 'v2-pro-hero.png'), fullPage: false });
console.log('OK: pro-hero');

// Pro page - loop section
await p2.evaluate(() => document.querySelector('#loop')?.scrollIntoView());
await p2.waitForTimeout(500);
await p2.screenshot({ path: join(screenshotDir, 'v2-pro-loop.png'), fullPage: false });
console.log('OK: pro-loop');

// Pro page - export section
await p2.evaluate(() => document.querySelector('#export')?.scrollIntoView());
await p2.waitForTimeout(500);
await p2.screenshot({ path: join(screenshotDir, 'v2-pro-export.png'), fullPage: false });
console.log('OK: pro-export');

// Pro page - full
await p2.screenshot({ path: join(screenshotDir, 'v2-pro-full.png'), fullPage: true });
console.log('OK: pro-full');
await p2.close();

console.log('\nAll screenshots in:', screenshotDir);
await b.close();
process.exit(0);
