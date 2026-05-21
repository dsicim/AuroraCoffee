import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizeReviewPrivacyMode } from './reviewPrivacy.js'

test('normalizeReviewPrivacyMode falls back to initials for unknown modes', () => {
  assert.equal(normalizeReviewPrivacyMode('friends-only'), 'initials')
})
