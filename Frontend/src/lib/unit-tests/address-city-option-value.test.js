import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getCityOptionValue } from '../address.js'

test('getCityOptionValue removes the existing-value marker', () => {
  assert.equal(getCityOptionValue('Kadikoy (Existing value)'), 'Kadikoy')
})
