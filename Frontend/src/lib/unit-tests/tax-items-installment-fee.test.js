import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getItemsPriceBreakdown } from '../tax.js'

test('getItemsPriceBreakdown separates installment fee from item gross total', () => {
  assert.equal(getItemsPriceBreakdown([{ price: 100 }], { payableTotal: 112 }).installmentFee, 12)
})
