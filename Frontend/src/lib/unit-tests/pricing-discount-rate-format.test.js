import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatDiscountRate } from '../pricing.js'

test('formatDiscountRate keeps one decimal for fractional discounts', () => {
  assert.equal(formatDiscountRate(12.5), '12.5')
})

test('formatDiscountRate preserves cent-percent discounts below one hundred', () => {
  assert.equal(formatDiscountRate(99.99), '99.99')
})

test('formatDiscountRate does not round discounts below one hundred up', () => {
  assert.equal(formatDiscountRate(99.999), '99.99')
})
