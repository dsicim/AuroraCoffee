import assert from 'node:assert/strict'
import { test } from 'node:test'

import { maskSavedCard } from './payment.js'

test('maskSavedCard renders the stored last four digits for saved payment methods', () => {
  assert.equal(maskSavedCard({ last4dig: '1234' }), '•••• 1234')
})
