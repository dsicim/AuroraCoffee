import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getUnitPriceBreakdown } from '../tax.js'

test('getUnitPriceBreakdown splits gross accessory prices into net and tax', () => {
  assert.deepEqual(getUnitPriceBreakdown({
    categoryName: 'Accessories',
    price: 120,
  }), {
    taxClass: 'accessory_general',
    taxRate: 0.2,
    priceGross: 120,
    priceNet: 100,
    taxAmount: 20,
  })
})
