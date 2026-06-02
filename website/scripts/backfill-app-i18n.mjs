import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appI18nPath = join(__dirname, '..', '..', 'app', 'src', 'i18n.ts')
const websiteI18nDir = join(__dirname, '..', 'i18n')

const src = readFileSync(appI18nPath, 'utf8')

// Extract locale translations by tracking the Messages object scope
function extractLocale(name) {
  const lines = src.split('\n')
  const re = new RegExp(`^const ${name}: Messages = \\{`)
  let inObj = false, depth = 0
  const obj = {}

  for (const line of lines) {
    if (re.test(line)) { inObj = true; continue }
    if (!inObj) continue

    if (line.includes('{')) depth++
    if (line.includes('}')) { depth--; if (depth <= 0) break }

    if (depth === 1 && !line.includes('{') && !line.includes('}')) {
      const m = line.match(/^\s*(\w+):\s*['"](.+?)['"](?:,)?\s*$/)
      if (m) obj[m[1]] = m[2]
    }
  }
  return obj
}

// Load EN as source of truth for fallback
const appEn = extractLocale('en')

// Load website locale JSONs
const websiteEn = JSON.parse(readFileSync(join(websiteI18nDir, 'en.json'), 'utf8'))

// Map: website pro.* key suffix → app key name
function buildKeyMapping() {
  const map = {}
  for (const webKey of Object.keys(websiteEn)) {
    if (!webKey.startsWith('pro.')) continue
    const suffix = webKey.slice(4) // remove "pro."
    if (suffix in appEn) map[webKey] = suffix
  }
  // Manual overrides for mappings that don't follow the pro.X = X pattern
  map['pro.mapLabel'] = 'map'
  map['pro.annotateTitle'] = 'notes'
  return map
}

const keyMap = buildKeyMapping()

const locales = ['zh', 'ja', 'ko', 'de', 'fr']
let totalFilled = 0

for (const loc of locales) {
  const appLoc = extractLocale(loc)
  // Merge EN fallback for keys the app doesn't translate
  for (const [k, v] of Object.entries(appEn)) {
    if (!(k in appLoc)) appLoc[k] = v
  }

  const path = join(websiteI18nDir, `${loc}.json`)
  const data = JSON.parse(readFileSync(path, 'utf8'))
  let filled = 0

  for (const [webKey, appKey] of Object.entries(keyMap)) {
    const appVal = appLoc[appKey]
    if (!appVal) continue
    const currentVal = data[webKey]
    // Only fill if current value is English (matches EN) or empty
    const isEnFallback = currentVal === websiteEn[webKey] || currentVal === ''
    if (isEnFallback && currentVal !== appVal) {
      data[webKey] = appVal
      filled++
    }
  }

  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8')
  console.log(`${loc}: ${filled} keys backfilled`)
  totalFilled += filled
}

console.log(`\nTotal: ${totalFilled} backfilled across 5 locales`)
console.log(`Mapping used: ${Object.keys(keyMap).length} website keys -> app keys`)
