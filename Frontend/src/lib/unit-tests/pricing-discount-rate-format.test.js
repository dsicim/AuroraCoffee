import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatDiscountRate } from '../pricing.js'

test('formatDiscountRate keeps one decimal for fractional discounts', () => {
  assert.equal(formatDiscountRate(12.5), '12.5')
})
