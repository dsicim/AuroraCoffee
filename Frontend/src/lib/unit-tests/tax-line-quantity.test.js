import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getLinePriceBreakdown } from '../tax.js'

test('getLinePriceBreakdown multiplies rounded unit totals by quantity', () => {
  assert.equal(getLinePriceBreakdown({ price: 12, taxRate: 20 }, 3).lineGross, 36)
})
