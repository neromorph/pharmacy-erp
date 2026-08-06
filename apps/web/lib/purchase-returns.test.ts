import { describe, it, expect } from 'vitest'
import {
  getAgingBucket,
  splitPayout,
  applyCreditFifo,
  computeSupplierBalance,
  buildStatementLedger,
} from './purchase-returns'

const T = '2026-09-01' // fixed "today" for the test

describe('getAgingBucket', () => {
  it('labels due and overdue payables by days past due', () => {
    expect(getAgingBucket('2026-09-05', T)).toBe('CURRENT')
    expect(getAgingBucket('2026-09-01', T)).toBe('CURRENT')
    expect(getAgingBucket('2026-08-20', T)).toBe('1-30')
    expect(getAgingBucket('2026-07-25', T)).toBe('31-60')
    expect(getAgingBucket('2026-06-20', T)).toBe('61-90')
    expect(getAgingBucket('2026-05-01', T)).toBe('90+')
  })
})

describe('splitPayout', () => {
  it('applies unapplied credit first, capped at the amount', () => {
    expect(splitPayout(10000, 3000)).toEqual({ creditApplied: 3000, cash: 7000 })
    expect(splitPayout(10000, 15000)).toEqual({ creditApplied: 10000, cash: 0 })
    expect(splitPayout(10000, 0)).toEqual({ creditApplied: 0, cash: 10000 })
  })
})

describe('applyCreditFifo', () => {
  it('consumes credits oldest first and returns updated applied amounts', () => {
    const notes = [
      { id: 'a', total: 10000, applied: 0 },
      { id: 'b', total: 20000, applied: 5000 },
    ]
    const updated = applyCreditFifo(notes, 12000)
    expect(updated).toEqual([
      { id: 'a', total: 10000, applied: 10000 },
      { id: 'b', total: 20000, applied: 7000 },
    ])
  })
})

describe('computeSupplierBalance', () => {
  it('subtracts unapplied credit from remaining payable totals', () => {
    const payables = [{ remaining: 50000 }, { remaining: 10000 }]
    const returns = [{ total: 15000, applied: 5000 }]
    expect(computeSupplierBalance(payables, returns)).toBe(50000)
  })
})

describe('buildStatementLedger', () => {
  it('produces a running balance with debit and credit columns', () => {
    const ledger = buildStatementLedger({
      invoices: [{ date: '2026-08-01', ref: 'INV-1', amount: 60000 }],
      payments: [{ date: '2026-08-20', ref: 'PAY-1', amount: 40000, creditApplied: 0 }],
      returns: [{ date: '2026-08-25', ref: 'RTR-1', amount: 20000 }],
    })
    expect(ledger[0]).toMatchObject({ balance: 60000, debit: 60000 })
    expect(ledger[1]).toMatchObject({ balance: 20000, credit: 40000 })
    expect(ledger[2]).toMatchObject({ balance: 0, credit: 20000 })
  })
})
