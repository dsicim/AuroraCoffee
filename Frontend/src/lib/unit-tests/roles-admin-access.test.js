import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canAccessRole, userRoles } from '../../features/auth/domain/roles.js'

test('canAccessRole allows admins to reach product manager pages', () => {
  assert.equal(canAccessRole(userRoles.admin, userRoles.productManager), true)
})
