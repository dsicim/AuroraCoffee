import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCartErrorMessage } from './cartErrors.js'

test('buildCartErrorMessage trims direct backend error strings before showing them', () => {
  assert.equal(buildCartErrorMessage('  Stock is no longer available.  '), 'Stock is no longer available.')
})
