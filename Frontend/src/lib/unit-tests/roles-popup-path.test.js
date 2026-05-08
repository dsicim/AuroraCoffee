import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getRolePopupPath, userRoles } from '../../features/auth/domain/roles.js'

test('getRolePopupPath exposes the restart popup only for admins', () => {
  assert.equal(getRolePopupPath(userRoles.admin), '/api/restart')
})
