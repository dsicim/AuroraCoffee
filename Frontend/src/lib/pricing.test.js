import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
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

  it('caps product discounts at one hundred percent', () => {
    assert.deepEqual(getDiscountPricing({ price: 80, discountRate: 150 }), {
      hasDiscount: true,
      originalPrice: 80,
      currentPrice: 0,
      discountRate: 100,
    })
  })

  it('does not apply discounts to zero-priced products', () => {
    assert.deepEqual(getDiscountPricing({ price: 0, discountRate: 30 }), {
      hasDiscount: false,
      originalPrice: 0,
      currentPrice: 0,
      discountRate: 0,
    })
  })

  it('uses the cheapest variant as the product starting price', () => {
    assert.equal(getProductStartingPrice({
      price: 24,
      variants: [{ price: 22 }, { price: 18 }],
    }), 18)
  })

  it('ignores invalid variant prices when finding the starting price', () => {
    assert.equal(getProductStartingPrice({
      price: 'not set',
      variants: [{ price: '32.50' }, { price: undefined }],
    }), 32.5)
  })

  it('detects price-changing variant choices', () => {
    assert.equal(hasPriceChangingChoices({
      variants: [{ price: 15 }, { price: 18 }],
    }), true)
  })
})
