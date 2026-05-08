import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getRoleLandingPath, userRoles } from '../../features/auth/domain/roles.js'

test('getRoleLandingPath routes sales managers to the sales manager console', () => {
  assert.equal(getRoleLandingPath(userRoles.salesManager), '/sales-manager')
})
