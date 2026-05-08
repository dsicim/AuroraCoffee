import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatTaxRate } from '../tax.js'

test('formatTaxRate renders decimal tax rates as percentages', () => {
  assert.equal(formatTaxRate(0.2), '20%')
})
