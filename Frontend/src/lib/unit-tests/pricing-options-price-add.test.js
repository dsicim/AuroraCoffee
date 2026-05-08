import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hasPriceChangingChoices } from '../pricing.js'

test('hasPriceChangingChoices detects option price additions', () => {
  assert.equal(hasPriceChangingChoices({
    options: [{ values: [{ priceAdd: 4 }] }],
  }), true)
})
