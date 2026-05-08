import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sanitizePostalCode } from '../address.js'

test('sanitizePostalCode keeps only the first five digits', () => {
  assert.equal(sanitizePostalCode('TR 34-56789'), '34567')
})
