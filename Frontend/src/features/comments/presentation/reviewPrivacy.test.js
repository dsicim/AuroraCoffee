import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getDisplayNameWords,
  normalizeReviewPrivacyMode,
} from './reviewPrivacy.js'

test('normalizeReviewPrivacyMode falls back to initials for unknown modes', () => {
  assert.equal(normalizeReviewPrivacyMode('friends-only'), 'initials')
})

test('getDisplayNameWords collapses extra whitespace in customer display names', () => {
  assert.deepEqual(getDisplayNameWords('  Ege   Bulutoglu  '), ['Ege', 'Bulutoglu'])
})
