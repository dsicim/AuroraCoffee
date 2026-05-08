import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canAccessRole, getAccessibleRoleLevels, userRoles } from '../../features/auth/domain/roles.js'

test('canAccessRole allows admins to reach product manager pages', () => {
  assert.equal(canAccessRole(userRoles.admin, userRoles.productManager), true)
})

test('getAccessibleRoleLevels allows admins to see every role destination', () => {
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.admin).map(({ role }) => role),
    [
      userRoles.customer,
      userRoles.productManager,
      userRoles.salesManager,
      userRoles.admin,
    ],
  )
})
