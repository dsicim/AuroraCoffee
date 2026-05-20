import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canAccessRole, getAccessibleRoleLevels, userRoles } from '../../features/auth/domain/roles.js'

test('canAccessRole keeps customers out of sales manager pages', () => {
  assert.equal(canAccessRole(userRoles.customer, userRoles.salesManager), false)
})

test('canAccessRole lets managers use customer account pages', () => {
  assert.equal(canAccessRole(userRoles.productManager, userRoles.customer), true)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.customer), true)
})

test('canAccessRole keeps managers out of other manager pages', () => {
  assert.equal(canAccessRole(userRoles.productManager, userRoles.salesManager), false)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.productManager), false)
})

test('getAccessibleRoleLevels returns customer plus the matching manager role', () => {
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.productManager).map(({ role }) => role),
    [userRoles.customer, userRoles.productManager],
  )
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.salesManager).map(({ role }) => role),
    [userRoles.customer, userRoles.salesManager],
  )
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.customer).map(({ role }) => role),
    [userRoles.customer],
  )
})
