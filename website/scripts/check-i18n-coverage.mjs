import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatesDir = join(__dirname, '..')
const i18nDir = join(templatesDir, 'i18n')

const TEMPLATES = [
  'landing-template.html', 'template.html', 'pro-template.html',
  'support-template.html', 'privacy-template.html', 'terms-template.html',
  'feedback-template.html'
]
const LOCALES = ['en', 'zh', 'ja', 'ko', 'de', 'fr']

function extractKeys(html) {
  const keys = new Set()
  const re = /data-i18n(?:-content|-placeholder)?="([^"]+)"/g
  let m
  while ((m = re.exec(html)) !== null) keys.add(m[1])
  return [...keys].sort()
}

const templateKeys = {}
for (const tpl of TEMPLATES) {
  const path = join(templatesDir, tpl)
  try { templateKeys[tpl] = extractKeys(readFileSync(path, 'utf8')) }
  catch { templateKeys[tpl] = [] }
}

const allTemplateKeys = new Set(Object.values(templateKeys).flat())

const localeKeys = {}
for (const loc of LOCALES) {
  try {
    const raw = readFileSync(join(i18nDir, `${loc}.json`), 'utf8')
    localeKeys[loc] = new Set(Object.keys(JSON.parse(raw)))
  } catch { localeKeys[loc] = new Set() }
}

let exitCode = 0

console.log('=== Missing from locale JSON (template has it, JSON does not) ===')
for (const loc of LOCALES) {
  const missing = [...allTemplateKeys].filter(k => !localeKeys[loc].has(k))
  if (missing.length) {
    exitCode = 1
    console.log(`\n[${loc}] ${missing.length} missing:`)
    missing.forEach(k => console.log(`  - ${k}`))
  }
}

console.log('\n=== Unused in templates (JSON has it, no template references) ===')
for (const loc of LOCALES) {
  const unused = [...localeKeys[loc]].filter(k => !allTemplateKeys.has(k))
  if (unused.length) {
    console.log(`\n[${loc}] ${unused.length} unused:`)
    unused.forEach(k => console.log(`  - ${k}`))
  }
}

console.log('\n=== Per-template key counts ===')
for (const [tpl, keys] of Object.entries(templateKeys)) {
  console.log(`  ${tpl}: ${keys.length} keys`)
}

console.log(`\nTotal unique keys across all templates: ${allTemplateKeys.size}`)
for (const loc of LOCALES) {
  const coverage = [...allTemplateKeys].filter(k => localeKeys[loc].has(k)).length
  console.log(`  ${loc}: ${coverage}/${allTemplateKeys.size} (${Math.round(coverage/allTemplateKeys.size*100)}%)`)
}

process.exit(exitCode)
