import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getRoleLabel } from '../../features/auth/domain/roles.js'

test('getRoleLabel falls back to trimmed unknown role text', () => {
  assert.equal(getRoleLabel('  Support Lead  '), 'Support Lead')
})
