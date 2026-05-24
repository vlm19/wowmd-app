import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "template.html");
const privacyTemplatePath = path.join(root, "privacy-template.html");
const feedbackTemplatePath = path.join(root, "feedback-template.html");
const i18nDir = path.join(root, "i18n");
const siteUrl = "https://wowmd.app";

const languages = [
  { code: "en", dir: "", flag: "gb.svg" },
  { code: "zh", dir: "zh", flag: "cn.svg" },
  { code: "ja", dir: "ja", flag: "jp.svg" },
  { code: "ko", dir: "ko", flag: "kr.svg" },
  { code: "de", dir: "de", flag: "de.svg" },
  { code: "fr", dir: "fr", flag: "fr.svg" }
];

const template = fs.readFileSync(templatePath, "utf8");
const privacyTemplate = fs.readFileSync(privacyTemplatePath, "utf8");
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

const localeUrl = (currentDir, targetDir) => {
  const prefix = currentDir ? "../" : "";
  return targetDir ? `${prefix}${targetDir}/index.html` : `${prefix}index.html`;
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

const writePage = ({ code, dir, flag }, fileName = "index.html") => {
  const dataPath = path.join(i18nDir, `${code}.json`);
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const base = dir ? "../" : "";
  const isPrivacyPage = fileName === "privacy.html";
  const canonicalUrl = isPrivacyPage
    ? `${siteUrl}/${pagePath(dir, "privacy.html")}`
    : dir ? `${siteUrl}/${dir}/` : `${siteUrl}/`;
  const outputDir = dir ? path.join(root, dir) : root;
  const outputPath = path.join(outputDir, fileName);
  const metaTitle = isPrivacyPage ? data["privacyPage.metaTitle"] : data["meta.title"];
  const metaDescription = isPrivacyPage ? data["privacyPage.metaDescription"] : data["meta.description"];

  let html = isPrivacyPage ? privacyTemplate : template;
  for (const [key, value] of Object.entries(data)) {
    html = replaceElementText(html, key, value);
    html = replaceContentAttr(html, key, value);
    html = replacePlaceholderAttr(html, key, value);
  }

  html = applyTemplateVars(html, {
    lang: code,
    base,
    canonicalUrl,
    homeUrl: "index.html",
    privacyUrl: "privacy.html",
    feedbackUrl: feedbackUrl(dir),
    currentFlag: `${base}assets/flags/${flag}`,
    localeUrlEn: localeUrl(dir, ""),
    localeUrlZh: localeUrl(dir, "zh"),
    localeUrlJa: localeUrl(dir, "ja"),
    localeUrlKo: localeUrl(dir, "ko"),
    localeUrlDe: localeUrl(dir, "de"),
    localeUrlFr: localeUrl(dir, "fr"),
    metaTitle: escapeAttr(metaTitle),
    metaDescription: escapeAttr(metaDescription),
    privacyMetaTitle: escapeAttr(metaTitle),
    privacyMetaDescription: escapeAttr(metaDescription),
    jsonDescription: String(metaDescription).replaceAll("\\", "\\\\").replaceAll('"', '\\"')
  });
  html = setSelectedLanguage(html, code);
  html = html.replaceAll(" data-i18n-content=\"meta.description\"", "");
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
    homeUrl: "index.html",
    privacyUrl: "privacy.html",
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
  writePage(language);
  writePage(language, "privacy.html");
  writeFeedbackPage(language);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${languages
  .flatMap(({ dir }) => [
    { loc: dir ? `${siteUrl}/${dir}/` : `${siteUrl}/`, priority: dir ? "0.8" : "1.0" },
    { loc: `${siteUrl}/${pagePath(dir, "privacy.html")}`, priority: "0.6" },
    { loc: `${siteUrl}/${pagePath(dir, "feedback.html")}`, priority: "0.7" }
  ])
  .map(({ loc, priority }) => {
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>2026-05-18</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>
`;

fs.writeFileSync(path.join(root, "sitemap.xml"), sitemap, "utf8");

console.log(`Generated ${languages.length * 3} localized pages.`);
