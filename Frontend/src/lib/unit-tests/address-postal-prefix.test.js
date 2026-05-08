import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getCityPostalPrefix } from '../address.js'

test('getCityPostalPrefix returns the configured city prefix', () => {
  assert.equal(getCityPostalPrefix('İzmir'), '35')
})
