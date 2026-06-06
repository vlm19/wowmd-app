const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const readHtml = (file) => fs.readFileSync(path.join(root, file), "utf8");

const htmlFiles = [
  "website/index.html",
  "website/pro.html",
  "website/extension.html",
  "website/support.html",
  "website/zh/index.html",
  "website/zh/pro.html",
  "website/zh/extension.html",
  "website/zh/support.html"
];

const forbidden = [
  /six colors/i,
  /six highlight/i,
  /trial/i,
  /trial-expiry/i,
  /planned next/i,
  /chrome\.google\.com\/webstore/i,
  /JSON export for AI/i
];

const requiredByFile = {
  "website/index.html": ["Ticket JSON", "HTML", "Local-first", "Your Markdown is never uploaded"],
  "website/pro.html": ["Ticket JSON", "Backup JSON", "Reviewed Markdown", "Obsidian-ready reviewed Markdown", "Overall Review Map", "Clarify needed", "Disputed", "Important", "Confirmed", "Free during beta"],
  "website/extension.html": ["Add to Chrome", "Open and Read only", "https://chromewebstore.google.com/detail/wowmd/lphibgbpadkfdmhilejjcomoomgkkjmh"],
  "website/support.html": ["Open Markdown without changing the original", "browser site data", "Typical workflows", "Agent skill", "Typed review", "Cross-version survival", "Reviewed Markdown", "Ticket JSON", "Backup JSON", "Overall Review Map", "Feedback"],
  "website/zh/support.html": ["打开 Markdown，不改动原文", "浏览器站点数据", "Obsidian", "Overall Review Map", "Feedback"]
};

const mustHaveIds = {
  "website/pro.html": ["read", "annotate", "map", "deliver", "versions", "compare", "faq"],
  "website/support.html": ["open", "typed-review", "reanchor", "ticket", "storage", "workflows", "reader", "annotate", "map", "export", "settings", "feedback", "faq"],
  "website/zh/support.html": ["open", "typed-review", "reanchor", "ticket", "storage", "workflows", "reader", "annotate", "map", "export", "settings", "feedback", "faq"]
};

const failures = [];

for (const file of htmlFiles) {
  const html = readHtml(file);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));

  for (const match of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.has(match[1])) failures.push(`${file}: missing anchor #${match[1]}`);
  }

  for (const pattern of forbidden) {
    if (pattern.test(html)) failures.push(`${file}: forbidden text ${pattern}`);
  }

  for (const id of mustHaveIds[file] || []) {
    if (!ids.has(id)) failures.push(`${file}: missing required section #${id}`);
  }
}

for (const [file, terms] of Object.entries(requiredByFile)) {
  const html = readHtml(file);
  for (const term of terms) {
    if (!html.includes(term)) failures.push(`${file}: missing required text "${term}"`);
  }
}

const landing = readHtml("website/index.html");
const loopButtonCount = (landing.match(/<(button|a)\b[^>]*class="[^"]*aflow-node[^"]*"/g) || []).length;
if (loopButtonCount < 7) failures.push(`website/index.html: expected keyboard-reachable loop nodes and output fork, found ${loopButtonCount}`);
if (!/<a class="nav-pro" href="app\/">wowMD Pro App<\/a>/.test(landing)) {
  failures.push("website/index.html: header Pro app CTA must link directly to app/");
}
if (!/<a class="flow-stage-label flow-stage-label-pro" href="pro\.html">Explore wowMD Pro<\/a>/.test(landing)) {
  failures.push("website/index.html: Pro flow card CTA must link to pro.html");
}

const extension = readHtml("website/extension.html");
for (const term of ["Ticket JSON", "Backup JSON", "Clarify needed", "Disputed", "Important", "Confirmed"]) {
  if (extension.includes(term)) failures.push(`website/extension.html: Pro-only term "${term}"`);
}

for (const shot of ["reader.png", "annotate.png", "map.png", "export.png", "versions.png", "settings.png"]) {
  const shotPath = path.join(root, "website", "assets", "shots", shot);
  if (!fs.existsSync(shotPath)) failures.push(`website/assets/shots/${shot}: missing screenshot`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("website verification passed");
