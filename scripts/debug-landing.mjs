import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', err => console.log('PAGE ERROR:', err.message));
await p.goto('file:///D:/GitHub/wowmd-app/website/index.html', { waitUntil: 'networkidle' });
await p.waitForTimeout(1000);

const nodeCount = await p.locator('.loop-node[data-node]').count();
const svgCount = await p.locator('.loop-svg').count();
const heroText = await p.textContent('h1');
console.log('Nodes:', nodeCount, 'SVG:', svgCount, 'Hero:', heroText?.slice(0, 80));

if (nodeCount > 0) {
  const vis = await p.locator('[data-node="source"]').isVisible();
  console.log('Source visible:', vis);
  const cs = await p.evaluate(() => {
    const el = document.querySelector('.loop-node-source');
    if (!el) return { error: 'NOT_FOUND', html: document.querySelector('.loop-stage')?.innerHTML?.slice(0, 200) };
    const s = getComputedStyle(el);
    return { display: s.display, position: s.position, visibility: s.visibility, width: s.width };
  });
  console.log('Source node CSS:', JSON.stringify(cs));
}

// Check CSS loading
const styleCount = await p.evaluate(() => document.styleSheets.length);
console.log('StyleSheets:', styleCount);

await p.screenshot({ path: 'D:/GitHub/wowmd-app/website/screenshots/debug-landing.png', fullPage: true });
console.log('Screenshot saved');
await b.close();
process.exit(0);
