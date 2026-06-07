import { describe, expect, test } from 'vitest'
import { createTranslator, type Locale } from './i18n'

const associationKeys = [
  'associationDialogLabel',
  'associationEyebrow',
  'associationExternalTitle',
  'associationFoundTitle',
  'associationMayContinueFrom',
  'associationNothingLinked',
  'associationCandidateParent',
  'associationReasonParent',
  'associationReasonLineage',
  'associationReasonDocument',
  'associationReasonBody',
  'associationReasonSimilarity',
  'associationReady',
  'associationCheck',
  'associationNeedLocating',
  'associationViewDifferences',
  'associationHideDifferences',
  'associationLines',
  'associationNoVisibleChanges',
  'associationBoundary',
  'associationOpenAsNew',
  'associationConfirm',
  'associationReviewLater',
]

describe('file lineage association translations', () => {
  test.each<Locale>(['zh', 'ja', 'ko', 'de', 'fr'])('%s does not fall back to English', (locale) => {
    const local = createTranslator(locale)
    const english = createTranslator('en')
    for (const key of associationKeys) {
      expect(local(key), `${locale}.${key}`).not.toBe(english(key))
    }
  })
})

