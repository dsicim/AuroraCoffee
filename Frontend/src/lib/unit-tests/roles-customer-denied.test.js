import assert from 'node:assert/strict'
import { test } from 'node:test'

import { canAccessRole, getAccessibleRoleLevels, userRoles } from '../../features/auth/domain/roles.js'

test('canAccessRole keeps customers out of sales manager pages', () => {
  assert.equal(canAccessRole(userRoles.customer, userRoles.salesManager), false)
})

test('canAccessRole keeps product managers focused on product manager pages', () => {
  assert.equal(canAccessRole(userRoles.productManager, userRoles.productManager), true)
  assert.equal(canAccessRole(userRoles.productManager, userRoles.customer), false)
  assert.equal(canAccessRole(userRoles.productManager, userRoles.salesManager), false)
})

test('canAccessRole keeps sales managers focused on sales manager pages', () => {
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.salesManager), true)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.customer), false)
  assert.equal(canAccessRole(userRoles.salesManager, userRoles.productManager), false)
})

test('getAccessibleRoleLevels returns the matching product manager destination', () => {
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.productManager).map(({ role }) => role),
    [userRoles.productManager],
  )
})

test('getAccessibleRoleLevels returns the matching sales manager and customer destinations', () => {
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.salesManager).map(({ role }) => role),
    [userRoles.salesManager],
  )
  assert.deepEqual(
    getAccessibleRoleLevels(userRoles.customer).map(({ role }) => role),
    [userRoles.customer],
  )
})
