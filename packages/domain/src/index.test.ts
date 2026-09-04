import { test } from 'node:test'
import assert from 'node:assert/strict'
import { userRoleValues } from './index.ts'

test('lists user roles in order', () => {
  assert.deepEqual(userRoleValues, ['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'])
})
