import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getCityPostalPrefix } from '../address.js'

test('getCityPostalPrefix returns null for unknown city names', () => {
  assert.equal(getCityPostalPrefix('Kadikoy'), null)
})
