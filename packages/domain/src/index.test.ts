import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TENANT_SCOPE, STOCK_RULE } from './index.ts'
import { procurementStatusValues, isFinalPoStatus } from './index.ts'
import { saleStatusValues, isFinalSaleStatus, paymentMethodValues } from './index.ts'
import { userRoleValues } from './index.ts'
import { opnameStatusValues, opnameTypeValues, opnameReasonValues } from './index.ts'

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

test('lists sale statuses in order', () => {
  assert.deepEqual(saleStatusValues, ['DRAFT', 'PAID', 'VOID'])
})

test('lists payment methods', () => {
  assert.deepEqual(paymentMethodValues, ['CASH', 'CARD', 'TRANSFER', 'QRIS'])
})

test('identifies final sale statuses', () => {
  assert.equal(isFinalSaleStatus('PAID'), true)
  assert.equal(isFinalSaleStatus('VOID'), true)
  assert.equal(isFinalSaleStatus('DRAFT'), false)
})

test('lists user roles in order', () => {
  assert.deepEqual(userRoleValues, ['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'])
})

test('lists opname statuses in order', () => {
  assert.deepEqual(opnameStatusValues, [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'CANCELLED',
  ])
})

test('lists opname types in order', () => {
  assert.deepEqual(opnameTypeValues, ['FULL_STORE', 'RACK_BASED', 'AD_HOC_SINGLE'])
})

test('lists opname reasons in order', () => {
  assert.deepEqual(opnameReasonValues, ['DAMAGE', 'EXPIRED', 'LOST', 'COUNT_ERROR', 'MISC'])
})