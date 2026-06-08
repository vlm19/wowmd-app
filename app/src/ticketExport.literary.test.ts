import { describe, expect, test } from 'vitest'
import { createTicketExport, type Annotation } from './annotations'

const baseAnnotation = {
  documentId: 'doc-literary',
  documentFingerprint: 'fp-literary',
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

describe('Ticket JSON literary style execution cases', () => {
  test('Pride and Prejudice ticket can target a hardboiled-noir rewrite without changing unannotated prose', () => {
    const markdown = [
      '# Pride and Prejudice',
      '',
      '## Opening',
      '',
      'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
      '',
      'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.',
      '',
    ].join('\n')
    const untouched = 'However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.'
    const annotations: Annotation[] = [
      {
        ...baseAnnotation,
        id: 'austen-noir-1',
        quote: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
        headingPath: ['Opening'],
        type: 'dispute',
        color: 'rose',
        note: 'Rewrite only this sentence in a hardboiled noir voice; preserve the social premise.',
        suggestedReplacement: 'Everybody in town knew the rule: a rich single man was fair game for matrimony.',
      },
      {
        ...baseAnnotation,
        id: 'austen-confirmed-2',
        quote: untouched,
        headingPath: ['Opening'],
        type: 'confirmed',
        color: 'green',
      },
    ]

    const ticket = createTicketExport('Pride and Prejudice', 'public-domain fixture', 'fp-austen', markdown, annotations)
    const revised = applySuggestedReplacements(ticket)

    expect(ticket.sections).toEqual([
      {
        headingPath: ['Opening'],
        sectionBody: expect.stringContaining('truth universally acknowledged'),
        ticketIds: ['austen-noir-1'],
      },
    ])
    expect(ticket.confirmedZones).toEqual([
      expect.objectContaining({ ticketId: 'austen-confirmed-2', quote: untouched }),
    ])
    expect(ticket.executionContract.typeOperations.dispute).toContain('Prefer suggestedReplacement')
    expect(ticket.executionContract.unannotatedPolicy).toContain('Preserve unannotated content exactly')
    expect(revised).toContain('Everybody in town knew the rule: a rich single man was fair game for matrimony.')
    expect(revised).toContain(untouched)
    expect(revised).not.toContain('It is a truth universally acknowledged')
  })

  test('Alice ticket can target a whimsical field-note style while preserving another section', () => {
    const markdown = [
      "# Alice's Adventures in Wonderland",
      '',
      '## Down the Rabbit-Hole',
      '',
      'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.',
      '',
      'Once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it.',
      '',
      '## The Hall',
      '',
      'There were doors all round the hall, but they were all locked.',
      '',
    ].join('\n')
    const hall = 'There were doors all round the hall, but they were all locked.'
    const annotations: Annotation[] = [
      {
        ...baseAnnotation,
        id: 'alice-field-note-1',
        quote: 'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do.',
        headingPath: ['Down the Rabbit-Hole'],
        type: 'clarify',
        color: 'blue',
        note: 'Clarify the boredom in a whimsical field-naturalist style without changing the plot.',
        suggestedReplacement: 'Alice, having observed the bank with the patience of a small naturalist, was beginning to record a severe scarcity of wonder and occupation.',
      },
      {
        ...baseAnnotation,
        id: 'alice-hall-confirmed',
        quote: hall,
        headingPath: ['The Hall'],
        type: 'confirmed',
        color: 'green',
      },
    ]

    const ticket = createTicketExport("Alice's Adventures in Wonderland", 'public-domain fixture', 'fp-alice', markdown, annotations)
    const revised = applySuggestedReplacements(ticket)

    expect(ticket.sections).toEqual([
      {
        headingPath: ['Down the Rabbit-Hole'],
        sectionBody: expect.stringContaining('peeped into the book'),
        ticketIds: ['alice-field-note-1'],
      },
    ])
    expect(ticket.confirmedZones).toEqual([
      expect.objectContaining({ ticketId: 'alice-hall-confirmed', quote: hall }),
    ])
    expect(ticket.executionContract.typeOperations.clarify).toContain('smallest clarification')
    expect(revised).toContain('patience of a small naturalist')
    expect(revised).toContain('severe scarcity of wonder and occupation')
    expect(revised).toContain(hall)
    expect(revised).not.toContain('Alice was beginning to get very tired')
  })
})

function applySuggestedReplacements(ticket: ReturnType<typeof createTicketExport>) {
  let output = ticket.document.markdownSnapshot
  for (const section of ticket.sections) {
    for (const ticketId of section.ticketIds) {
      const item = ticket.tickets.find((candidate) => candidate.id === ticketId)
      if (!item?.suggestedReplacement) continue
      const index = output.indexOf(item.quote)
      if (index < 0) continue
      output = `${output.slice(0, index)}${item.suggestedReplacement}${output.slice(index + item.quote.length)}`
    }
  }
  return output
}
