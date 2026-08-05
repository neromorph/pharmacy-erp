import { describe, it, expect } from 'vitest'
import { getPayableStatus, isPayableOverdue } from './accounts-payable'

describe('accounts payable', () => {
  it('marks unpaid, partial, paid, overdue', () => {
    expect(getPayableStatus({ paidAmount: 0, remainingAmount: 100, dueDate: '2026-08-01', now: '2026-08-02' })).toBe('OVERDUE')
    expect(getPayableStatus({ paidAmount: 20, remainingAmount: 80, dueDate: '2026-08-10', now: '2026-08-01' })).toBe('PARTIAL')
    expect(getPayableStatus({ paidAmount: 0, remainingAmount: 100, dueDate: '2026-08-10', now: '2026-08-01' })).toBe('UNPAID')
    expect(getPayableStatus({ paidAmount: 100, remainingAmount: 0, dueDate: '2026-08-10', now: '2026-08-01' })).toBe('PAID')
  })

  it('flags overdue only when balance remains', () => {
    expect(isPayableOverdue({ remainingAmount: 0, dueDate: '2026-08-01', now: '2026-08-02' })).toBe(false)
    expect(isPayableOverdue({ remainingAmount: 50, dueDate: '2026-08-01', now: '2026-08-02' })).toBe(true)
  })
})
