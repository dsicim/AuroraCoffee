import assert from 'node:assert/strict'
import { test } from 'node:test'

import { formatCurrency } from '../currency.js'

test('formatCurrency renders numeric TRY amounts with Turkish separators', () => {
  assert.equal(formatCurrency(129.9), '₺129,90')
})
