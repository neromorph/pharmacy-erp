import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TENANT_SCOPE, STOCK_RULE } from './index.ts'
import { procurementStatusValues, isFinalPoStatus } from './index.ts'

test('exports core domain constants', () => {
  assert.equal(TENANT_SCOPE, 'branch')
  assert.equal(STOCK_RULE, 'fefo')
})

test('lists po statuses in order', () => {
  assert.deepEqual(procurementStatusValues, [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'RECEIVED',
    'CANCELLED',
  ])
})

test('identifies final po statuses', () => {
  assert.equal(isFinalPoStatus('RECEIVED'), true)
  assert.equal(isFinalPoStatus('CANCELLED'), true)
  assert.equal(isFinalPoStatus('APPROVED'), false)
  assert.equal(isFinalPoStatus('DRAFT'), false)
})