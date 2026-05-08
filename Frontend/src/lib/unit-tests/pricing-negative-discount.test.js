import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getDiscountPricing } from '../pricing.js'

test('getDiscountPricing ignores negative discount rates', () => {
  assert.deepEqual(getDiscountPricing({ price: 80, discountRate: -10 }), {
    hasDiscount: false,
    originalPrice: 80,
    currentPrice: 80,
    discountRate: 0,
  })
})
