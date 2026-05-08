import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  formatDiscountRate,
  getDiscountPricing,
  getProductStartingPrice,
  hasPriceChangingChoices,
} from './pricing.js'

describe('pricing helpers', () => {
  it('calculates current price from a percentage discount', () => {
    assert.deepEqual(getDiscountPricing({ price: 120, discountRate: 25 }), {
      hasDiscount: true,
      originalPrice: 120,
      currentPrice: 90,
      discountRate: 25,
    })
  })
})
