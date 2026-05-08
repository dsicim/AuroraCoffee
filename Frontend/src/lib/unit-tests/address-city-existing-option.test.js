import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getCityOptions } from '../address.js'

test('getCityOptions preserves an unknown existing city as the first option', () => {
  assert.deepEqual(getCityOptions('Kadikoy').slice(0, 2), [
    'Kadikoy (Existing value)',
    'Adana',
  ])
})
