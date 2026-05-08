import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getTaxRate } from '../tax.js'

test('getTaxRate normalizes whole-number tax percentages', () => {
  assert.equal(getTaxRate({ taxRate: 20 }), 0.2)
})
