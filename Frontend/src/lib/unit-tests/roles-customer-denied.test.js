import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canAccessRole, userRoles } from '../../features/auth/domain/roles.js'

test('canAccessRole keeps customers out of sales manager pages', () => {
  assert.equal(canAccessRole(userRoles.customer, userRoles.salesManager), false)
})
