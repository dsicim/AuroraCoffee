import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getProductStartingPrice } from '../pricing.js'

test('getProductStartingPrice ignores negative variant prices', () => {
  assert.equal(getProductStartingPrice({
    price: 42,
    variants: [{ price: -5 }, { price: 39 }],
  }), 39)
})
