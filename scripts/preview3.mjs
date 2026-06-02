import { chromium } from 'playwright';
import { join } from 'path';
import { mkdirSync } from 'fs';

const baseUrl = 'file:///D:/GitHub/wowmd-app/website';
const screenshotDir = 'D:/GitHub/wowmd-app/website/screenshots';
mkdirSync(screenshotDir, { recursive: true });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });

// Landing page - full
const p1 = await ctx.newPage();
p1.on('pageerror', e => console.log('ERR:', e.message));
await p1.goto(baseUrl + '/index.html', { waitUntil: 'networkidle' });
await p1.waitForTimeout(800);
await p1.screenshot({ path: join(screenshotDir, 'v3-landing-full.png'), fullPage: true });
console.log('OK: landing-full');

// Landing page - hover aflow node to trigger tooltip
await p1.locator('.aflow-node').first().hover();
await p1.waitForTimeout(500);
await p1.screenshot({ path: join(screenshotDir, 'v3-landing-aflow-hover.png'), fullPage: true });
console.log('OK: landing-aflow-hover');
await p1.close();

// Landing page - ZH locale
const p2 = await ctx.newPage();
await p2.goto(baseUrl + '/zh/index.html', { waitUntil: 'networkidle' });
await p2.waitForTimeout(800);
await p2.screenshot({ path: join(screenshotDir, 'v3-landing-zh.png'), fullPage: true });
console.log('OK: landing-zh');
await p2.close();

console.log('\nDone. Screenshots in:', screenshotDir);
await b.close();
process.exit(0);
