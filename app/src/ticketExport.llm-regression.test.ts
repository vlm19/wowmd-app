/**
 * @vitest-environment jsdom
 *
 * Golden-file regression: verifies executionContract produces correct
 * results by re-anchoring annotations against known-good LLM outputs.
 */
import { afterAll, describe, expect, test } from 'vitest'
import { type Annotation } from './annotations'
import { reanchorAgainstMarkdown } from './hooks/useAnnotations'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tier = 'exact' | 'context' | 'lost'
type CaseResult = {
  name: string
  tiers: Tier[]
  contractPass: boolean
  failures: string[]
  bodyRetainedPct: number
}

const results: CaseResult[] = []

function tier(a: Annotation): Tier {
  return a.orphaned ? 'lost' : a.needsReview ? 'context' : 'exact'
}

function bodyRetentionPct(original: string, revised: string): number {
  const normalize = (s: string) =>
    s.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, '').trim().toLowerCase()
  const o = normalize(original)
  const r = normalize(revised)
  if (!o) return 100
  let matches = 0
  for (const ch of o) {
    if (r.includes(ch)) matches += 1
  }
  return Math.round((matches / o.length) * 100)
}

function runCase(
  name: string,
  original: string,
  annotations: Annotation[],
  golden: string,
  checks: (revised: string, reanchored: Annotation[], original: string) => void,
) {
  const reanchored = reanchorAgainstMarkdown(annotations, golden, `fp-${name}`)
  const tiers = reanchored.map(tier)
  const retained = bodyRetentionPct(original, golden)
  const failures: string[] = []

  try {
    checks(golden, reanchored, original)
  } catch (err) {
    failures.push((err as Error).message)
  }

  results.push({ name, tiers, contractPass: failures.length === 0, failures, bodyRetainedPct: retained })
  expect(failures, name).toEqual([])
}

// ---------------------------------------------------------------------------
// Test annotation factory
// ---------------------------------------------------------------------------

const baseAnnotation = {
  documentId: 'doc-regression',
  documentFingerprint: 'fp-regression',
  prefix: '',
  suffix: '',
  offset: 0,
  note: '',
  suggestedReplacement: '',
  legacyColor: null,
  orphaned: false,
  createdAt: '2026-06-08T00:00:00.000Z',
  updatedAt: '2026-06-08T00:00:00.000Z',
} satisfies Omit<Annotation, 'id' | 'quote' | 'headingPath' | 'type' | 'color'>

function a(
  overrides: Partial<Annotation> & { id: string; quote: string; headingPath: string[]; type: Annotation['type']; color: Annotation['color'] },
): Annotation {
  return { ...baseAnnotation, ...overrides } as Annotation
}

// ===========================================================================
// Cases
// ===========================================================================

describe('LLM executionContract golden regression', () => {
  test('01: confirmed passage survives verbatim', () => {
    const md = '# Plan\n\n## Strategy\n\nWe will focus on enterprise sales in Q1.\n\nThe current pipeline covers three verticals.\n\n## Budget\n\nAllocation remains unchanged from last quarter.\n'
    const confirmedQuote = 'Allocation remains unchanged from last quarter.'
    const anns = [
      a({ id: 'c1', quote: confirmedQuote, headingPath: ['Budget'], type: 'confirmed', color: 'green' }),
      a({ id: 'd1', quote: 'We will focus on enterprise sales in Q1.', headingPath: ['Strategy'], type: 'dispute', color: 'rose', note: 'Change to take effect in Q2.', suggestedReplacement: 'We will focus on enterprise sales starting Q2.' }),
    ]
    const golden = '# Plan\n\n## Strategy\n\nWe will focus on enterprise sales starting Q2.\n\nThe current pipeline covers three verticals.\n\n## Budget\n\nAllocation remains unchanged from last quarter.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_01-confirmed-survival",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('confirmed-survival', md, anns, golden, (revised) => {
      if (!revised.includes(confirmedQuote)) throw new Error('confirmed passage was modified')
      if (!revised.includes('starting Q2')) throw new Error('dispute replacement not applied')
    })
  })

  test('02: unannotated content stays unchanged', () => {
    const untouched = 'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.'
    const md = `# Pride and Prejudice\n\n## Opening\n\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\n${untouched}\n`
    const anns = [
      a({ id: 'd1', quote: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', headingPath: ['Opening'], type: 'dispute', color: 'rose', note: 'Rewrite in modern plain English.', suggestedReplacement: 'Everyone knew that a wealthy single man needed a wife.' }),
    ]
    const golden = '# Pride and Prejudice\n\n## Opening\n\nEveryone knew that a wealthy single man needed a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_02-unannotated",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('unannotated-preservation', md, anns, golden, (revised) => {
      if (!revised.includes(untouched)) throw new Error('unannotated passage was modified')
      if (!revised.includes('wealthy single man')) throw new Error('dispute replacement not applied')
    })
  })

  test('03: dispute replacement is applied', () => {
    const md = '# Report\n\nRevenue was $1.2M.\n'
    const replacement = 'Revenue reached $1.45M, exceeding the $1.2M target.'
    const anns = [
      a({ id: 'd1', quote: 'Revenue was $1.2M.', headingPath: ['Report'], type: 'dispute', color: 'rose', note: 'Revenue figure is outdated.', suggestedReplacement: replacement }),
    ]
    const golden = '# Report\n\nRevenue reached $1.45M, exceeding the $1.2M target.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_03-dispute-replacement",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('dispute-replacement', md, anns, golden, (revised) => {
      if (!revised.includes(replacement)) throw new Error('suggestedReplacement not applied')
    })
  })

  test('04: dispute note-only triggers correction', () => {
    const md = '# Plan\n\nWe will deploy on Friday evening at 5 PM.\n'
    const anns = [
      a({ id: 'd1', quote: 'We will deploy on Friday evening at 5 PM.', headingPath: ['Plan'], type: 'dispute', color: 'rose', note: 'Friday deployments are against policy. Change to Wednesday morning.' }),
    ]
    const golden = '# Plan\n\nWe will deploy on Wednesday morning at 9 AM.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_04-dispute-note-only",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('dispute-note-only', md, anns, golden, (revised) => {
      if (revised.includes('Friday evening at 5 PM')) throw new Error('dispute note was ignored — Friday text still present')
      if (!revised.includes('Wednesday')) throw new Error('correction not applied')
    })
  })

  test('05: clarify adds explanation without deleting original', () => {
    const md = '# Glossary\n\nIdempotency: an operation that produces the same result when applied multiple times.\n'
    const anns = [
      a({ id: 'c1', quote: 'Idempotency: an operation that produces the same result when applied multiple times.', headingPath: ['Glossary'], type: 'clarify', color: 'blue', note: 'Add an example: `PUT /users/1` is idempotent, `POST /users` is not.' }),
    ]
    const golden = '# Glossary\n\nIdempotency: an operation that produces the same result when applied multiple times. For example, `PUT /users/1` is idempotent because repeated requests produce the same resource state, whereas `POST /users` is not idempotent because each request creates a new resource.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_05-clarify",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('clarify-note-only', md, anns, golden, (revised) => {
      if (!revised.includes('Idempotency')) throw new Error('original definition was removed')
      if (!revised.includes('PUT')) throw new Error('requested example not added')
      if (!revised.includes('POST')) throw new Error('requested example not added')
    })
  })

  test('06: important annotation preserves the key point', () => {
    const md = '# Risks\n\nData loss is the primary concern if the migration is not validated.\n\nWe should also consider cost overruns.\n'
    const keyQuote = 'Data loss is the primary concern if the migration is not validated.'
    const anns = [
      a({ id: 'i1', quote: keyQuote, headingPath: ['Risks'], type: 'important', color: 'amber' }),
      a({ id: 'd1', quote: 'We should also consider cost overruns.', headingPath: ['Risks'], type: 'dispute', color: 'rose', note: 'Cost overrun risk is overstated; remove or reduce.', suggestedReplacement: 'Cost overruns are unlikely given the fixed-price contract.' }),
    ]
    const golden = '# Risks\n\nData loss is the primary concern if the migration is not validated.\n\nCost overruns are unlikely given the fixed-price contract.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_06-important",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('important-preservation', md, anns, golden, (revised) => {
      if (!revised.includes(keyQuote)) throw new Error('important passage was removed or rewritten')
      if (!revised.includes('fixed-price contract')) throw new Error('dispute replacement not applied')
    })
  })

  test('07: multi-section execution covers all sections', () => {
    const md = '# Plan\n\n## Revenue\n\nQ1 revenue was $500k.\n\n## Costs\n\nInfra costs grew 15%.\n\n## Hiring\n\nWe plan to hire three engineers.\n'
    const anns = [
      a({ id: 'd1', quote: 'Q1 revenue was $500k.', headingPath: ['Revenue'], type: 'dispute', color: 'rose', note: 'Revenue was $520k.', suggestedReplacement: 'Q1 revenue was $520k.' }),
      a({ id: 'd2', quote: 'Infra costs grew 15%.', headingPath: ['Costs'], type: 'dispute', color: 'rose', note: 'Infra costs grew 12%.', suggestedReplacement: 'Infra costs grew 12%.' }),
      a({ id: 'i1', quote: 'We plan to hire three engineers.', headingPath: ['Hiring'], type: 'important', color: 'amber' }),
    ]
    const golden = '# Plan\n\n## Revenue\n\nQ1 revenue was $520k.\n\n## Costs\n\nInfra costs grew 12%.\n\n## Hiring\n\nWe plan to hire three engineers.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_07-multi-section",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('multi-section', md, anns, golden, (revised) => {
      if (!revised.includes('$520k')) throw new Error('Revenue dispute not applied')
      if (!revised.includes('12%')) throw new Error('Costs dispute not applied')
      if (!revised.includes('three engineers')) throw new Error('Hiring important passage lost: is "three engineers" still present?')
    })
  })

  test('08: foreign terms and code stay untranslated', () => {
    const md = '# API Guide\n\nThe `createUser` endpoint accepts a POST with `application/json` body containing `email` and `name`.\n'
    const anns = [
      a({ id: 'c1', quote: 'The `createUser` endpoint accepts a POST with `application/json` body containing `email` and `name`.', headingPath: ['API Guide'], type: 'clarify', color: 'blue', note: 'The documentation uses English for code terms. Clarify that `email` must be unique.' }),
    ]
    const golden = '# API Guide\n\nThe `createUser` endpoint accepts a POST with `application/json` body containing `email` and `name`. Note that the `email` field must be unique across all users.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_08-foreign-terms",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('foreign-term-preservation', md, anns, golden, (revised) => {
      if (!revised.includes('`createUser`')) throw new Error('code identifier translated')
      if (!revised.includes('`application/json`')) throw new Error('content type translated')
      if (!revised.includes('unique across all users')) throw new Error('clarify note not applied')
    })
  })

  test('09: document with zero tickets stays unchanged', () => {
    const md = '# Notes\n\nThese are raw notes. They should stay exactly as written.\n\nNo modifications allowed.\n'
    const golden = '# Notes\n\nThese are raw notes. They should stay exactly as written.\n\nNo modifications allowed.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_09-zero-tickets",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('zero-tickets', md, [], golden, (revised, _reanchored, original) => {
      const normalize = (s: string) => s.replace(/\r\n/g, '\n').replace(/\n{2,}/g, '\n').trim()
      const o = normalize(original)
      // Body only: strip the metadata block
      const rBody = revised.replace(/<!--[\s\S]*?-->/, '').trim()
      const r = normalize(rBody)
      if (o !== r) throw new Error(`unannotated document was modified:\n  expected: "${o}"\n  actual:   "${r}"`)
    })
  })

  test('10: high-density single-section drops no tickets', () => {
    const md = '# Policy\n\nRule A: All commits require review.\nRule B: Deployments happen on Tuesdays.\nRule C: Feature flags must have a sunset date.\nRule D: Logs are retained for 90 days.\nRule E: Passwords must be at least 12 characters.\nRule F: API keys rotate every 30 days.\n'
    const anns = [
      a({ id: 'a1', quote: 'Rule A: All commits require review.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: 'Two reviewers, not one.', suggestedReplacement: 'Rule A: All commits require approval from two reviewers.' }),
      a({ id: 'a2', quote: 'Rule B: Deployments happen on Tuesdays.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: 'Wednesday deploys only.', suggestedReplacement: 'Rule B: Deployments happen on Wednesdays only.' }),
      a({ id: 'a3', quote: 'Rule C: Feature flags must have a sunset date.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: 'Max lifespan 90 days.', suggestedReplacement: 'Rule C: Feature flags must have a sunset date no more than 90 days from creation.' }),
      a({ id: 'a4', quote: 'Rule D: Logs are retained for 90 days.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: '120 days for compliance.', suggestedReplacement: 'Rule D: Logs are retained for 120 days.' }),
      a({ id: 'a5', quote: 'Rule E: Passwords must be at least 12 characters.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: '16 characters per new policy.', suggestedReplacement: 'Rule E: Passwords must be at least 16 characters.' }),
      a({ id: 'a6', quote: 'Rule F: API keys rotate every 30 days.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: '14 days for production.', suggestedReplacement: 'Rule F: Production API keys rotate every 14 days.' }),
    ]
    const golden = '# Policy\n\nRule A: All commits require approval from two reviewers.\nRule B: Deployments happen on Wednesdays only.\nRule C: Feature flags must have a sunset date no more than 90 days from creation.\nRule D: Logs are retained for 120 days.\nRule E: Passwords must be at least 16 characters.\nRule F: Production API keys rotate every 14 days.\n\n<!-- wowmd:document-meta:v1\n{\n  "lineageId": "",\n  "documentId": "doc_llm_regression_test",\n  "parentDocumentId": "",\n  "sourceTicketId": "ticket_10-high-density",\n  "originalFilename": "",\n  "savedAt": "2026-06-08T00:00:00.000Z",\n  "producer": {\n    "app": "External AI"\n  }\n}\nwowmd:document-meta:end -->\n'

    runCase('high-density', md, anns, golden, (revised) => {
      if (!revised.includes('two reviewers')) throw new Error('ticket A1 dropped')
      if (!revised.includes('Wednesdays')) throw new Error('ticket A2 dropped')
      if (!revised.includes('90 days from creation')) throw new Error('ticket A3 dropped')
      if (!revised.includes('120 days')) throw new Error('ticket A4 dropped')
      if (!revised.includes('16 characters')) throw new Error('ticket A5 dropped')
      if (!revised.includes('14 days')) throw new Error('ticket A6 dropped')
    })
  })
})

// ---------------------------------------------------------------------------
// Summary report
// ---------------------------------------------------------------------------

afterAll(() => {
  console.log('\n══════════════════════════════════════════════')
  console.log('LLM executionContract golden regression report')
  console.log(`Cases: ${results.length}`)
  console.log('──────────────────────────────────────────────')

  let pass = 0
  let totalExact = 0
  let totalContext = 0
  let totalLost = 0

  for (const r of results) {
    const flag = r.contractPass ? 'PASS' : 'FAIL'
    const exactCount = r.tiers.filter((t) => t === 'exact').length
    const contextCount = r.tiers.filter((t) => t === 'context').length
    const lostCount = r.tiers.filter((t) => t === 'lost').length
    const tiers = `${exactCount}E ${contextCount}C ${lostCount}L`
    const retain = `body:${r.bodyRetainedPct}%`
    console.log(`  ${flag}  ${r.name.padEnd(34)} ${tiers.padEnd(14)} ${retain}`)
    if (r.failures.length) {
      for (const f of r.failures) console.log(`        ${f}`)
    }
    if (r.contractPass) pass += 1
    totalExact += exactCount
    totalContext += contextCount
    totalLost += lostCount
  }

  console.log('──────────────────────────────────────────────')
  console.log(`  Contract: ${pass}/${results.length} passed`)
  const tierTotal = totalExact + totalContext + totalLost
  if (tierTotal) {
    const ep = tierTotal ? Math.round((totalExact / tierTotal) * 100) : 0
    const cp = tierTotal ? Math.round((totalContext / tierTotal) * 100) : 0
    const lp = tierTotal ? Math.round((totalLost / tierTotal) * 100) : 0
    console.log(`  Re-anchor: ${totalExact} exact (${ep}%)  ${totalContext} context (${cp}%)  ${totalLost} lost (${lp}%)`)
  }
  console.log('══════════════════════════════════════════════\n')
})
