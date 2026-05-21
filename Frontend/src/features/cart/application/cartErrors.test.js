import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildCartErrorMessage } from './cartErrors.js'

test('buildCartErrorMessage trims direct backend error strings before showing them', () => {
  assert.equal(buildCartErrorMessage('  Stock is no longer available.  '), 'Stock is no longer available.')
})

test('buildCartErrorMessage unwraps nested backend e payloads', () => {
  assert.equal(buildCartErrorMessage({ e: { msg: 'Choose a size first.' } }), 'Choose a size first.')
})

test('buildCartErrorMessage combines structured what why and resolution fields', () => {
  assert.equal(
    buildCartErrorMessage({
      what: 'Variant unavailable',
      why: 'Only two bags remain',
      resolution: 'Reduce quantity',
    }),
    'Variant unavailable - Only two bags remain - Reduce quantity',
  )
})

test('buildCartErrorMessage uses the supplied fallback for blank backend strings', () => {
  assert.equal(buildCartErrorMessage('   ', 'Cart update failed.'), 'Cart update failed.')
})
