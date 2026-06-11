import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canAccessRole, getAccessibleRoleLevels, userRoles } from '../../features/auth/domain/roles.js'

test('canAccessRole keeps customers out of sales manager pages', () => {
  assert.equal(canAccessRole(userRoles.customer, userRoles.salesManager), false)
})

test('canAccessRole lets product managers use customer pages by default', () => {
  assert.equal(canAccessRole(userRoles.productManager, userRoles.productManager), true)
  assert.equal(canAccessRole(userRoles.productManager, userRoles.customer), true)
  assert.equal(canAccessRole(userRoles.productManager, userRoles.salesManager), false)
})

test('canAccessRole lets sales managers use customer pages by default', () => {
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.salesManager), true)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.customer), true)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.productManager), false)
})

test('getAccessibleRoleLevels returns customer and product manager destinations', () => {
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.productManager).map(({ role }) => role),
    [userRoles.customer, userRoles.productManager],
  )
})

test('getAccessibleRoleLevels returns the matching sales manager and customer destinations', () => {
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.salesManager).map(({ role }) => role),
    [userRoles.customer, userRoles.salesManager],
  )
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.customer).map(({ role }) => role),
    [userRoles.customer],
  )
})
