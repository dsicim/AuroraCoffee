import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getTaxClass } from '../tax.js'

test('getTaxClass infers packaged coffee from origin metadata', () => {
  assert.equal(getTaxClass({ origin: 'Ethiopia' }), 'coffee_packaged')
})
