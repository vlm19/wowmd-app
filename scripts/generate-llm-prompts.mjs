/**
 * Generates LLM prompts for the 10 regression test cases.
 * Usage: npx tsx scripts/generate-llm-prompts.mjs > prompts.txt
 */
import { createTicketExport } from '../app/src/annotations.ts'

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
}

function a(overrides) {
  return { ...baseAnnotation, ...overrides }
}

function buildSystemPrompt(contract) {
  return [
    'You are a Markdown document revision assistant who strictly follows structured execution contracts.',
    '',
    '=== EXECUTION INSTRUCTION ===',
    contract.executionInstruction,
    '',
    '=== COORDINATE GUIDE ===',
    contract.coordinateGuide,
    '',
    '=== TYPE OPERATIONS ===',
    `- confirmed: ${contract.typeOperations.confirmed}`,
    `- important: ${contract.typeOperations.important}`,
    `- clarify: ${contract.typeOperations.clarify}`,
    `- dispute: ${contract.typeOperations.dispute}`,
    '',
    '=== UNANNOTATED POLICY ===',
    contract.unannotatedPolicy,
    '',
    '=== EXECUTION STRATEGY ===',
    contract.executionStrategy,
    '',
    '=== OUTPUT REQUIREMENTS ===',
    contract.outputRequirements,
    '',
    '=== LANGUAGE CONSTRAINT ===',
    `Document language: ${contract.languageConstraint.documentLanguage}`,
    `Output language:   ${contract.languageConstraint.outputLanguage}`,
    `Foreign terms:     ${contract.languageConstraint.foreignTermPolicy}`,
    '',
    'Do NOT add any preamble, explanation, or commentary before the revised Markdown.',
    'Start directly with the first heading or paragraph of the revised document.',
  ].join('\n')
}

function buildUserMessage(ticket) {
  const ticketList = ticket.tickets.map(t =>
    [
      `[${t.sequence}] ${t.type || 'untyped'} ticket ${t.id}`,
      `  headingPath: ${t.headingPath.join(' > ')}`,
      `  quote: "${t.quote}"`,
      t.prefix ? `  prefix: "${t.prefix}"` : '',
      t.suffix ? `  suffix: "${t.suffix}"` : '',
      t.note ? `  note: ${t.note}` : '',
      t.suggestedReplacement ? `  suggestedReplacement: "${t.suggestedReplacement}"` : '',
    ].filter(Boolean).join('\n')
  ).join('\n\n')

  const confirmedList = ticket.confirmedZones.map(z =>
    `  headingPath: ${z.headingPath.join(' > ')}\n  quote: "${z.quote}"`
  ).join('\n\n  ---\n')

  const sectionList = ticket.sections.map(s =>
    [
      `Section: ${s.headingPath.join(' > ')}`,
      `Ticket IDs: ${s.ticketIds.join(', ')}`,
      s.sectionBody ? `Section body:\n\`\`\`\n${s.sectionBody}\n\`\`\`` : '',
    ].join('\n')
  ).join('\n\n')

  const lineagePart = ticket.lineageOutput
    ? ticket.lineageOutput.template
        .replace(/\{([^}]+)\}/g, (_, key) => {
          const m = {
            'sourceDocument.lineageId': ticket.sourceDocument?.lineageId || '',
            'sourceDocument.documentId': ticket.sourceDocument?.documentId || '',
            'sourceDocument.filename': ticket.sourceDocument?.filename || '',
            'ticketId': ticket.ticketId,
            'new doc_ id': 'doc_llm_regression_test',
            'current ISO 8601 time': new Date().toISOString(),
          }
          return m[key.trim()] ?? key
        })
    : '(no lineage output required)'

  return [
    '=== ORIGINAL DOCUMENT ===',
    ticket.document.markdownSnapshot,
    '',
    '=== TICKETS ===',
    ticketList || '(none)',
    '',
    '=== CONFIRMED ZONES (DO NOT MODIFY) ===',
    confirmedList || '(none)',
    '',
    '=== SECTIONS ===',
    sectionList || '(none)',
    '',
    '=== LINEAGE OUTPUT ===',
    lineagePart,
  ].join('\n')
}

// ---- Cases ----

const cases = []

// 01: confirmed survival
cases.push(['01-confirmed-survival',
  '# Plan\n\n## Strategy\n\nWe will focus on enterprise sales in Q1.\n\nThe current pipeline covers three verticals.\n\n## Budget\n\nAllocation remains unchanged from last quarter.\n',
  [
    a({ id: 'c1', quote: 'Allocation remains unchanged from last quarter.', headingPath: ['Budget'], type: 'confirmed', color: 'green' }),
    a({ id: 'd1', quote: 'We will focus on enterprise sales in Q1.', headingPath: ['Strategy'], type: 'dispute', color: 'rose', note: 'Change to take effect in Q2.', suggestedReplacement: 'We will focus on enterprise sales starting Q2.' }),
  ]
])

// 02: unannotated preservation
cases.push(['02-unannotated',
  '# Pride and Prejudice\n\n## Opening\n\nIt is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.\n',
  [
    a({ id: 'd1', quote: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.', headingPath: ['Opening'], type: 'dispute', color: 'rose', note: 'Rewrite in modern plain English.', suggestedReplacement: 'Everyone knew that a wealthy single man needed a wife.' }),
  ]
])

// 03: dispute replacement
cases.push(['03-dispute-replacement',
  '# Report\n\nRevenue was $1.2M.\n',
  [
    a({ id: 'd1', quote: 'Revenue was $1.2M.', headingPath: ['Report'], type: 'dispute', color: 'rose', note: 'Revenue figure is outdated.', suggestedReplacement: 'Revenue reached $1.45M, exceeding the $1.2M target.' }),
  ]
])

// 04: dispute note-only
cases.push(['04-dispute-note-only',
  '# Plan\n\nWe will deploy on Friday evening at 5 PM.\n',
  [
    a({ id: 'd1', quote: 'We will deploy on Friday evening at 5 PM.', headingPath: ['Plan'], type: 'dispute', color: 'rose', note: 'Friday deployments are against policy. Change to Wednesday morning.' }),
  ]
])

// 05: clarify note-only
cases.push(['05-clarify',
  '# Glossary\n\nIdempotency: an operation that produces the same result when applied multiple times.\n',
  [
    a({ id: 'c1', quote: 'Idempotency: an operation that produces the same result when applied multiple times.', headingPath: ['Glossary'], type: 'clarify', color: 'blue', note: 'Add an example: `PUT /users/1` is idempotent, `POST /users` is not.' }),
  ]
])

// 06: important preservation
cases.push(['06-important',
  '# Risks\n\nData loss is the primary concern if the migration is not validated.\n\nWe should also consider cost overruns.\n',
  [
    a({ id: 'i1', quote: 'Data loss is the primary concern if the migration is not validated.', headingPath: ['Risks'], type: 'important', color: 'amber' }),
    a({ id: 'd1', quote: 'We should also consider cost overruns.', headingPath: ['Risks'], type: 'dispute', color: 'rose', note: 'Cost overrun risk is overstated; remove or reduce.', suggestedReplacement: 'Cost overruns are unlikely given the fixed-price contract.' }),
  ]
])

// 07: multi-section
cases.push(['07-multi-section',
  '# Plan\n\n## Revenue\n\nQ1 revenue was $500k.\n\n## Costs\n\nInfra costs grew 15%.\n\n## Hiring\n\nWe plan to hire three engineers.\n',
  [
    a({ id: 'd1', quote: 'Q1 revenue was $500k.', headingPath: ['Revenue'], type: 'dispute', color: 'rose', note: 'Revenue was $520k.', suggestedReplacement: 'Q1 revenue was $520k.' }),
    a({ id: 'd2', quote: 'Infra costs grew 15%.', headingPath: ['Costs'], type: 'dispute', color: 'rose', note: 'Infra costs grew 12%.', suggestedReplacement: 'Infra costs grew 12%.' }),
    a({ id: 'i1', quote: 'We plan to hire three engineers.', headingPath: ['Hiring'], type: 'important', color: 'amber' }),
  ]
])

// 08: foreign term preservation
cases.push(['08-foreign-terms',
  '# API Guide\n\nThe `createUser` endpoint accepts a POST with `application/json` body containing `email` and `name`.\n',
  [
    a({ id: 'c1', quote: 'The `createUser` endpoint accepts a POST with `application/json` body containing `email` and `name`.', headingPath: ['API Guide'], type: 'clarify', color: 'blue', note: 'The documentation uses English for code terms. Clarify that `email` must be unique.' }),
  ]
])

// 09: zero tickets
cases.push(['09-zero-tickets',
  '# Notes\n\nThese are raw notes. They should stay exactly as written.\n\nNo modifications allowed.\n',
  []
])

// 10: high-density
cases.push(['10-high-density',
  '# Policy\n\nRule A: All commits require review.\nRule B: Deployments happen on Tuesdays.\nRule C: Feature flags must have a sunset date.\nRule D: Logs are retained for 90 days.\nRule E: Passwords must be at least 12 characters.\nRule F: API keys rotate every 30 days.\n',
  [
    a({ id: 'a1', quote: 'Rule A: All commits require review.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: 'Two reviewers, not one.', suggestedReplacement: 'Rule A: All commits require approval from two reviewers.' }),
    a({ id: 'a2', quote: 'Rule B: Deployments happen on Tuesdays.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: 'Wednesday deploys only.', suggestedReplacement: 'Rule B: Deployments happen on Wednesdays only.' }),
    a({ id: 'a3', quote: 'Rule C: Feature flags must have a sunset date.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: 'Max lifespan 90 days.', suggestedReplacement: 'Rule C: Feature flags must have a sunset date no more than 90 days from creation.' }),
    a({ id: 'a4', quote: 'Rule D: Logs are retained for 90 days.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: '120 days for compliance.', suggestedReplacement: 'Rule D: Logs are retained for 120 days.' }),
    a({ id: 'a5', quote: 'Rule E: Passwords must be at least 12 characters.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: '16 characters per new policy.', suggestedReplacement: 'Rule E: Passwords must be at least 16 characters.' }),
    a({ id: 'a6', quote: 'Rule F: API keys rotate every 30 days.', headingPath: ['Policy'], type: 'dispute', color: 'rose', note: '14 days for production.', suggestedReplacement: 'Rule F: Production API keys rotate every 14 days.' }),
  ]
])

// Generate
for (const [name, md, anns] of cases) {
  const ticket = createTicketExport(name, 'local', `fp-${name}`, md, anns)
  const system = buildSystemPrompt(ticket.executionContract)
  const user = buildUserMessage(ticket)

  console.log(`\n═══════════════════════════════════════════════════════`)
  console.log(`CASE: ${name}`)
  console.log(`═══════════════════════════════════════════════════════`)
  console.log(`\n--- SYSTEM PROMPT ---\n${system}\n`)
  console.log(`--- USER MESSAGE ---\n${user}\n`)
  console.log(`--- EXPECT REVISED MARKDOWN BELOW ---`)
}
