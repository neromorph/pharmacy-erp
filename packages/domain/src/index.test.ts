import { test } from 'node:test'
import assert from 'node:assert/strict'
import { TENANT_SCOPE, STOCK_RULE } from './index.ts'

test('exports core domain constants', () => {
  assert.equal(TENANT_SCOPE, 'branch')
  assert.equal(STOCK_RULE, 'fefo')
})