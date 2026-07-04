import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const landingTemplatePath = path.join(root, "landing-template.html");
const templatePath = path.join(root, "template.html");
const proTemplatePath = path.join(root, "pro-template.html");
const privacyTemplatePath = path.join(root, "privacy-template.html");
const termsTemplatePath = path.join(root, "terms-template.html");
const supportTemplatePath = path.join(root, "support-template.html");
const i18nDir = path.join(root, "i18n");
const siteUrl = "https://wowmd.app";
const sitemapLastmod = "2026-06-29";

const languages = [
  { code: "en", dir: "", flag: "gb.svg", name: "EN" },
  { code: "zh", dir: "zh", flag: "cn.svg", name: "ZH" },
  { code: "ja", dir: "ja", flag: "jp.svg", name: "JA" },
  { code: "ko", dir: "ko", flag: "kr.svg", name: "KO" },
  { code: "de", dir: "de", flag: "de.svg", name: "DE" },
  { code: "fr", dir: "fr", flag: "fr.svg", name: "FR" }
];

const landingTemplate = fs.readFileSync(landingTemplatePath, "utf8");
const template = fs.readFileSync(templatePath, "utf8");
const proTemplate = fs.readFileSync(proTemplatePath, "utf8");
const privacyTemplate = fs.readFileSync(privacyTemplatePath, "utf8");
const termsTemplate = fs.readFileSync(termsTemplatePath, "utf8");
const supportTemplate = fs.readFileSync(supportTemplatePath, "utf8");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeAttr = (value) =>
  escapeHtml(value).replaceAll('"', "&quot;");

const replaceElementText = (html, key, value) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<([a-z0-9]+)\\b[^>]*data-i18n="${escapedKey}"[^>]*>)[\\s\\S]*?(<\\/\\2>)`, "gi");
  return html.replace(pattern, `$1${escapeHtml(value)}$3`);
};

const replaceContentAttr = (html, key, value) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Match the whole <meta> tag carrying data-i18n-content="key" (attribute order
  // independent), then replace its content="..." value.
  const tagPattern = new RegExp(`<meta\\b[^>]*\\bdata-i18n-content="${escapedKey}"[^>]*>`, "gi");
  // Require whitespace before `content=` so it targets the real content attribute,
  // not the `content=` substring inside `data-i18n-content=`.
  return html.replace(tagPattern, (tag) =>
    tag.replace(/(\scontent=")[^"]*(")/i, `$1${escapeAttr(value)}$2`),
  );
};

const replacePlaceholderAttr = (html, key, value) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<(?:input|textarea)\\b(?=[^>]*data-i18n-placeholder="${escapedKey}")[^>]*placeholder=")[^"]*(")`, "gi");
  return html.replace(pattern, `$1${escapeAttr(value)}$2`);
};

const setSelectedLanguage = (html, code) =>
  html.replace(
    /(<a role="option" data-language-option="[^"]+"[^>]*?) aria-selected="true"([^>]*>)/g,
    "$1$2",
  ).replace(
    new RegExp(`(<a role="option" data-language-option="${code}"[^>]*)(>)`),
    '$1 aria-selected="true"$2'
  );

const applyTemplateVars = (html, vars) => {
  let output = html;
  for (const [key, value] of Object.entries(vars)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }
  return output;
};

const localeUrl = (currentDir, targetDir, fileName = "index.html") => {
  const prefix = currentDir ? "../" : "";
  if (fileName === "index.html") {
    if (targetDir) return `${prefix}${targetDir}/`;
    return currentDir ? "../" : "./";
  }
  const clean = fileName.replace(/\.html$/, "");
  return targetDir ? `${prefix}${targetDir}/${clean}` : `${prefix}${clean}`;
};

const localeFileUrl = (currentDir, targetDir, fileName) => {
  const prefix = currentDir ? "../" : "";
  const clean = fileName.replace(/\.html$/, "");
  return targetDir ? `${prefix}${targetDir}/${clean}` : `${prefix}${clean}`;
};

const pagePath = (dir, fileName = "index.html") => {
  const prefix = dir ? `${dir}/` : "";
  const clean = fileName.replace(/\.html$/, "");
  return `${prefix}${clean}`;
};

const supportUrlFor = (dir, code) => (code === "zh" || !dir ? "support" : "../support");

const marketingPages = {
  "index.html": {
    template: landingTemplate,
    metaTitleKey: "landing.metaTitle",
    metaDescriptionKey: "landing.metaDescription",
    type: "WebSite",
    priority: "1.0"
  },
  "extension.html": {
    template,
    metaTitleKey: "extension.metaTitle",
    metaDescriptionKey: "extension.metaDescription",
    type: "SoftwareApplication",
    priority: "0.9"
  },
  "pro.html": {
    template: proTemplate,
    metaTitleKey: "pro.metaTitle",
    metaDescriptionKey: "pro.metaDescription",
    type: "SoftwareApplication",
    priority: "0.9"
  }
};

const writePage = ({ code, dir, flag, name }, fileName = "index.html") => {
  const dataPath = path.join(i18nDir, `${code}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const base = dir ? "../" : "";
  const isPrivacyPage = fileName === "privacy.html";
  const isTermsPage = fileName === "terms.html";
  const isIndexPage = fileName === "index.html";
  const pageConfig = marketingPages[fileName];
  const canonicalUrl = isIndexPage
    ? dir ? `${siteUrl}/${dir}/` : `${siteUrl}/`
    : `${siteUrl}/${pagePath(dir, fileName)}`;
  const outputDir = dir ? path.join(root, dir) : root;
  const outputPath = path.join(outputDir, fileName);
  const metaTitle = isPrivacyPage
    ? data["privacyPage.metaTitle"]
    : isTermsPage
      ? data["termsPage.metaTitle"]
      : data[pageConfig?.metaTitleKey] || data["meta.title"];
  const metaDescription = isPrivacyPage
    ? data["privacyPage.metaDescription"]
    : isTermsPage
      ? data["termsPage.metaDescription"]
      : data[pageConfig?.metaDescriptionKey] || data["meta.description"];

  let html = isPrivacyPage ? privacyTemplate : isTermsPage ? termsTemplate : pageConfig.template;
  for (const [key, value] of Object.entries(data)) {
    html = replaceElementText(html, key, value);
    html = replaceContentAttr(html, key, value);
    html = replacePlaceholderAttr(html, key, value);
  }

  html = applyTemplateVars(html, {
    lang: code,
    base,
    canonicalUrl,
    homeUrl: "./",
    extensionUrl: "extension",
    proUrl: "pro",
    appUrl: `${base}app/`,
    privacyUrl: "privacy",
    termsUrl: "terms",
    supportUrl: supportUrlFor(dir, code),
    currentFlag: `${base}assets/flags/${flag}`,
    languageName: name,
    localeUrlEn: localeUrl(dir, "", fileName),
    localeUrlZh: localeUrl(dir, "zh", fileName),
    localeUrlJa: localeUrl(dir, "ja", fileName),
    localeUrlKo: localeUrl(dir, "ko", fileName),
    localeUrlDe: localeUrl(dir, "de", fileName),
    localeUrlFr: localeUrl(dir, "fr", fileName),
    localeSupportUrlEn: localeFileUrl(dir, "", "support.html"),
    localeSupportUrlZh: localeFileUrl(dir, "zh", "support.html"),
    metaTitle: escapeAttr(metaTitle),
    metaDescription: escapeAttr(metaDescription),
    privacyMetaTitle: escapeAttr(metaTitle),
    privacyMetaDescription: escapeAttr(metaDescription),
    termsMetaTitle: escapeAttr(metaTitle),
    termsMetaDescription: escapeAttr(metaDescription),
    jsonDescription: String(metaDescription).replaceAll("\\", "\\\\").replaceAll('"', '\\"'),
    schemaType: pageConfig?.type || "WebPage"
  });
  html = setSelectedLanguage(html, code);
  html = html.replaceAll(/ data-i18n-content="[^"]+"/g, "");
  html = html.replaceAll(/ data-i18n-placeholder="[^"]+"/g, "");
  html = html.replaceAll(/ data-i18n="[^"]+"/g, "");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
};

const writeSupportPage = ({ code, dir, flag, name }) => {
  const data = JSON.parse(fs.readFileSync(path.join(i18nDir, `${code}.json`), "utf8"));
  const base = dir ? "../" : "";
  const outputDir = dir ? path.join(root, dir) : root;
  const outputPath = path.join(outputDir, "support.html");
  const canonicalUrl = `${siteUrl}/${pagePath(dir, "support.html")}`;

  let html = supportTemplate;
  for (const [key, value] of Object.entries(data)) {
    html = replaceElementText(html, key, value);
    html = replaceContentAttr(html, key, value);
    html = replacePlaceholderAttr(html, key, value);
  }
  html = applyTemplateVars(html, {
    lang: code,
    base,
    canonicalUrl,
    homeUrl: "./",
    extensionUrl: "extension",
    proUrl: "pro",
    appUrl: `${base}app/`,
    privacyUrl: "privacy",
    termsUrl: "terms",
    supportUrl: "support",
    currentFlag: `${base}assets/flags/${flag}`,
    languageName: name,
    localeUrlEn: localeFileUrl(dir, "", "support.html"),
    localeUrlZh: localeFileUrl(dir, "zh", "support.html"),
    localeUrlJa: localeFileUrl(dir, "ja", "support.html"),
    localeUrlKo: localeFileUrl(dir, "ko", "support.html"),
    localeUrlDe: localeFileUrl(dir, "de", "support.html"),
    localeUrlFr: localeFileUrl(dir, "fr", "support.html")
  });
  html = setSelectedLanguage(html, code);
  html = html.replaceAll(/ data-i18n-content="[^"]+"/g, "");
  html = html.replaceAll(/ data-i18n-placeholder="[^"]+"/g, "");
  html = html.replaceAll(/ data-i18n="[^"]+"/g, "");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
};

for (const language of languages) {
  for (const fileName of Object.keys(marketingPages)) {
    writePage(language, fileName);
  }
  writePage(language, "privacy.html");
  writePage(language, "terms.html");
  writeSupportPage(language);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/app/</loc>
    <lastmod>${sitemapLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.95</priority>
  </url>
${languages
  .flatMap(({ dir }) => [
    { loc: dir ? `${siteUrl}/${dir}/` : `${siteUrl}/`, priority: dir ? "0.8" : "1.0" },
    { loc: `${siteUrl}/${pagePath(dir, "extension.html")}`, priority: "0.9" },
    { loc: `${siteUrl}/${pagePath(dir, "pro.html")}`, priority: "0.9" },
    { loc: `${siteUrl}/${pagePath(dir, "support.html")}`, priority: "0.7" },
    { loc: `${siteUrl}/${pagePath(dir, "privacy.html")}`, priority: "0.6" },
    { loc: `${siteUrl}/${pagePath(dir, "terms.html")}`, priority: "0.6" }
  ])
  .map(({ loc, priority }) => {
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${sitemapLastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap, "utf8");

console.log(`Generated ${languages.length * 6} localized pages.`);
