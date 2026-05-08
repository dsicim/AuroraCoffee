import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCartErrorMessage } from '../cartErrors.js'

test('buildCartErrorMessage falls back when structured errors have no useful fields', () => {
  assert.equal(buildCartErrorMessage({}), 'Could not add this item to cart.')
})
