import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isKnownTurkishCity } from '../address.js'

test('isKnownTurkishCity accepts cities with postal prefixes', () => {
  assert.equal(isKnownTurkishCity('İstanbul'), true)
})
