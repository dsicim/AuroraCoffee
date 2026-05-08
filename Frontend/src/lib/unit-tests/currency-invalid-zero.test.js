import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatCurrency } from '../currency.js'

test('formatCurrency falls back to zero for non-numeric input', () => {
  assert.equal(formatCurrency('not a price'), '₺0,00')
})
