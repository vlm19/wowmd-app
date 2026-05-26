import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const landingTemplatePath = path.join(root, "landing-template.html");
const templatePath = path.join(root, "template.html");
const proTemplatePath = path.join(root, "pro-template.html");
const privacyTemplatePath = path.join(root, "privacy-template.html");
const termsTemplatePath = path.join(root, "terms-template.html");
const feedbackTemplatePath = path.join(root, "feedback-template.html");
const i18nDir = path.join(root, "i18n");
const siteUrl = "https://wowmd.app";
const sitemapLastmod = "2026-05-27";

const languages = [
  { code: "en", dir: "", flag: "gb.svg" },
  { code: "zh", dir: "zh", flag: "cn.svg" },
  { code: "ja", dir: "ja", flag: "jp.svg" },
  { code: "ko", dir: "ko", flag: "kr.svg" },
  { code: "de", dir: "de", flag: "de.svg" },
  { code: "fr", dir: "fr", flag: "fr.svg" }
];

const landingTemplate = fs.readFileSync(landingTemplatePath, "utf8");
const template = fs.readFileSync(templatePath, "utf8");
const proTemplate = fs.readFileSync(proTemplatePath, "utf8");
const privacyTemplate = fs.readFileSync(privacyTemplatePath, "utf8");
const termsTemplate = fs.readFileSync(termsTemplatePath, "utf8");
const feedbackTemplate = fs.readFileSync(feedbackTemplatePath, "utf8");

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
  const pattern = new RegExp(`(<meta\\b[^>]*content=")[^"]*("[^>]*data-i18n-content="${escapedKey}"[^>]*>)`, "gi");
  return html.replace(pattern, `$1${escapeAttr(value)}$2`);
};

const replacePlaceholderAttr = (html, key, value) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(<(?:input|textarea)\\b(?=[^>]*data-i18n-placeholder="${escapedKey}")[^>]*placeholder=")[^"]*(")`, "gi");
  return html.replace(pattern, `$1${escapeAttr(value)}$2`);
};

const setSelectedLanguage = (html, code) =>
  html.replaceAll(' aria-selected="true"', "").replace(
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
  return targetDir ? `${prefix}${targetDir}/${fileName}` : `${prefix}${fileName}`;
};

const localeFileUrl = (currentDir, targetDir, fileName) => {
  const prefix = currentDir ? "../" : "";
  return targetDir ? `${prefix}${targetDir}/${fileName}` : `${prefix}${fileName}`;
};

const pagePath = (dir, fileName = "index.html") => {
  const prefix = dir ? `${dir}/` : "";
  return `${prefix}${fileName}`;
};

const feedbackUrl = () => "feedback.html";

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

const writePage = ({ code, dir, flag }, fileName = "index.html") => {
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
    extensionUrl: "extension.html",
    proUrl: "pro.html",
    appUrl: `${base}app/`,
    privacyUrl: "privacy.html",
    termsUrl: "terms.html",
    feedbackUrl: feedbackUrl(dir),
    currentFlag: `${base}assets/flags/${flag}`,
    localeUrlEn: localeUrl(dir, "", fileName),
    localeUrlZh: localeUrl(dir, "zh", fileName),
    localeUrlJa: localeUrl(dir, "ja", fileName),
    localeUrlKo: localeUrl(dir, "ko", fileName),
    localeUrlDe: localeUrl(dir, "de", fileName),
    localeUrlFr: localeUrl(dir, "fr", fileName),
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

const writeFeedbackPage = ({ code, dir, flag }) => {
  const data = JSON.parse(fs.readFileSync(path.join(i18nDir, `${code}.json`), "utf8"));
  const base = dir ? "../" : "";
  const outputDir = dir ? path.join(root, dir) : root;
  const outputPath = path.join(outputDir, "feedback.html");
  const canonicalUrl = `${siteUrl}/${pagePath(dir, "feedback.html")}`;
  const metaTitle = data["feedback.metaTitle"];
  const metaDescription = data["feedback.metaDescription"];

  let html = feedbackTemplate;
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
    privacyUrl: "privacy.html",
    termsUrl: "terms.html",
    currentFlag: `${base}assets/flags/${flag}`,
    localeFeedbackUrlEn: localeFileUrl(dir, "", "feedback.html"),
    localeFeedbackUrlZh: localeFileUrl(dir, "zh", "feedback.html"),
    localeFeedbackUrlJa: localeFileUrl(dir, "ja", "feedback.html"),
    localeFeedbackUrlKo: localeFileUrl(dir, "ko", "feedback.html"),
    localeFeedbackUrlDe: localeFileUrl(dir, "de", "feedback.html"),
    localeFeedbackUrlFr: localeFileUrl(dir, "fr", "feedback.html"),
    feedbackMetaTitle: escapeAttr(metaTitle),
    feedbackMetaDescription: escapeAttr(metaDescription)
  });
  html = setSelectedLanguage(html, code);
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
  writeFeedbackPage(language);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${languages
  .flatMap(({ dir }) => [
    { loc: dir ? `${siteUrl}/${dir}/` : `${siteUrl}/`, priority: dir ? "0.8" : "1.0" },
    { loc: `${siteUrl}/${pagePath(dir, "extension.html")}`, priority: "0.9" },
    { loc: `${siteUrl}/${pagePath(dir, "pro.html")}`, priority: "0.9" },
    { loc: `${siteUrl}/${pagePath(dir, "privacy.html")}`, priority: "0.6" },
    { loc: `${siteUrl}/${pagePath(dir, "terms.html")}`, priority: "0.6" },
    { loc: `${siteUrl}/${pagePath(dir, "feedback.html")}`, priority: "0.7" }
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
