import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canAccessRole, getAccessibleRoleLevels, userRoles } from '../../features/auth/domain/roles.js'

test('canAccessRole keeps customers out of sales manager pages', () => {
  assert.equal(canAccessRole(userRoles.customer, userRoles.salesManager), false)
})

test('canAccessRole keeps managers out of other role pages', () => {
  assert.equal(canAccessRole(userRoles.productManager, userRoles.customer), false)
  assert.equal(canAccessRole(userRoles.productManager, userRoles.salesManager), false)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.customer), false)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.productManager), false)
})

test('getAccessibleRoleLevels returns only the matching non-admin role', () => {
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.productManager).map(({ role }) => role),
    [userRoles.productManager],
  )
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.salesManager).map(({ role }) => role),
    [userRoles.salesManager],
  )
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.customer).map(({ role }) => role),
    [userRoles.customer],
  )
})
