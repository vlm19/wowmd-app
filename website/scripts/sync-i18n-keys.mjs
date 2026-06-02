import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const baseDir = join(__dirname, '..')
const i18nDir = join(baseDir, 'i18n')

// Extract data-i18n keys WITH their English fallback text from templates
const templates = ['landing-template.html', 'template.html', 'pro-template.html', 'support-template.html',
  'privacy-template.html', 'terms-template.html', 'feedback-template.html']
const allKeys = {} // key -> fallback text

for (const tpl of templates) {
  try {
    const html = readFileSync(join(baseDir, tpl), 'utf8')
    const re = /data-i18n(?:-content|-placeholder)?="([^"]+)"[^>]*>([\s\S]*?)<\//g
    let m
    while ((m = re.exec(html)) !== null) {
      const text = m[2].replace(/<[^>]+>/g, '').trim()
      if (text && !text.startsWith('{{') && !text.match(/^\s*$/)) allKeys[m[1]] = text
    }
    // Also match self-closing meta tags
    const metaRe = /data-i18n-content="([^"]+)" content="([^"]+)"/g
    while ((m = metaRe.exec(html)) !== null) allKeys[m[1]] = m[2]
  } catch(e) { console.warn(`WARN: ${tpl} - ${e.message}`) }
}

// Update en.json: remove old keys, add new from templates
const enPath = join(i18nDir, 'en.json')
const en = JSON.parse(readFileSync(enPath, 'utf8'))

let added = 0, kept = 0, removed = 0
const newEn = {}

// Only keep keys used by templates
for (const [key, text] of Object.entries(allKeys)) {
  newEn[key] = en[key] || text // prefer existing translation, fallback to template text
  if (en[key]) kept++
  else added++
}
removed = Object.keys(en).length - kept

writeFileSync(enPath, JSON.stringify(newEn, null, 2) + '\n', 'utf8')
console.log(`en.json: ${added} new from templates, ${kept} kept, ${removed} dead removed, ${Object.keys(newEn).length} total`)

// Sync other locales
const LOCALES = ['zh', 'ja', 'ko', 'de', 'fr']
for (const loc of LOCALES) {
  const path = join(i18nDir, `${loc}.json`)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  const synced = {}
  for (const key of Object.keys(newEn)) {
    synced[key] = data[key] || newEn[key]
  }
  const netAdded = Object.keys(synced).length - Object.keys(data).length
  writeFileSync(path, JSON.stringify(synced, null, 2) + '\n', 'utf8')
  console.log(`${loc}.json: ${Object.keys(synced).length} keys (${netAdded >= 0 ? '+' : ''}${netAdded} net)`)
}
