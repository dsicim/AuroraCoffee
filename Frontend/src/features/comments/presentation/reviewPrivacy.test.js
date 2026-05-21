import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildReviewPrivacyWordPreview,
  getDisplayNameWords,
  normalizeReviewPrivacyMode,
} from './reviewPrivacy.js'

test('normalizeReviewPrivacyMode falls back to initials for unknown modes', () => {
  assert.equal(normalizeReviewPrivacyMode('friends-only'), 'initials')
})

test('getDisplayNameWords collapses extra whitespace in customer display names', () => {
  assert.deepEqual(getDisplayNameWords('  Ege   Bulutoglu  '), ['Ege', 'Bulutoglu'])
})

test('buildReviewPrivacyWordPreview shows full words when full privacy is selected', () => {
  assert.equal(buildReviewPrivacyWordPreview('Ege', 'full'), 'Ege')
})

test('buildReviewPrivacyWordPreview hides words when anonymous privacy is selected', () => {
  assert.equal(buildReviewPrivacyWordPreview('Ege', 'anonymous'), '-')
})
