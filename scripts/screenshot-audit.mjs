import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoDir = join(__dirname, '..');
const websiteDir = join(repoDir, 'website');
const screenshotDir = join(repoDir, 'website', 'screenshots');
const PORT = 3001;

mkdirSync(screenshotDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};

const server = createServer((req, res) => {
  let urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
  if (urlPath === '/') urlPath = '/index.html';
  let filePath = join(websiteDir, urlPath);

  if (!filePath.startsWith(websiteDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (existsSync(filePath)) {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      filePath = join(filePath, 'index.html');
    }
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  res.end(readFileSync(filePath));
});

server.listen(PORT, () => console.log(`Server: http://localhost:${PORT}`));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

async function screenshot(path, name, scrollTo = 0) {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
  if (scrollTo > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollTo);
    await page.waitForTimeout(500);
  }
  const filePath = join(screenshotDir, name);
  await page.screenshot({ path: filePath, fullPage: scrollTo === -1 });
  console.log(`[OK] ${name}`);
  await page.close();
}

try {
  // Landing page
  await screenshot('/', '01-landing.png', 0);

  // Extension page
  await screenshot('/extension.html', '02-extension-hero.png', 0);
  await screenshot('/extension.html', '03-extension-demo.png', 700);
  await screenshot('/extension.html', '04-extension-features.png', 1400);
  await screenshot('/extension.html', '05-extension-cta.png', -1);

  // Pro page
  await screenshot('/pro.html', '06-pro-hero.png', 0);
  await screenshot('/pro.html', '07-pro-features-highlight.png', 600);
  await screenshot('/pro.html', '08-pro-features-grid.png', 950);
  await screenshot('/pro.html', '09-pro-steps.png', 1300);
  await screenshot('/pro.html', '10-pro-export.png', 1700);
  await screenshot('/pro.html', '11-pro-comparison.png', 2200);
  await screenshot('/pro.html', '12-pro-faq.png', 2600);
  await screenshot('/pro.html', '13-pro-bottom-cta.png', -1);

  // WebApp entry page
  await screenshot('/app/', '14-webapp-entry.png', 0);

  console.log(`\nAll screenshots saved to: ${screenshotDir}`);
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await browser.close();
  server.close();
  process.exit(0);
}
