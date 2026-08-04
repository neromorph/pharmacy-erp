import { describe, expect, it } from 'vitest'
import { formatReceiptTender, formatRupiah } from './receipt'

describe('formatReceiptTender', () => {
  it('returns CASH fallback for empty payments', () => {
    const result = formatReceiptTender([], 50000)
    expect(result.label).toBe('CASH')
    expect(result.amount).toBe(50000)
    expect(result.change).toBe(0)
  })

  it('returns the single tender method', () => {
    const result = formatReceiptTender([{ payment_method: 'CASH', amount: 75000 }], 50000)
    expect(result.label).toBe('CASH')
    expect(result.amount).toBe(75000)
    expect(result.change).toBe(25000)
  })

  it('returns QRIS for single QRIS payment', () => {
    const result = formatReceiptTender([{ payment_method: 'QRIS', amount: 100000 }], 100000)
    expect(result.label).toBe('QRIS')
    expect(result.amount).toBe(100000)
    expect(result.change).toBe(0)
  })

  it('returns SPLIT for two tenders', () => {
    const result = formatReceiptTender(
      [{ payment_method: 'CASH', amount: 30000 }, { payment_method: 'QRIS', amount: 20000 }],
      50000
    )
    expect(result.label).toBe('SPLIT')
    expect(result.amount).toBe(50000) // sum of both
    expect(result.change).toBe(0)
  })

  it('returns MULTI for three tenders', () => {
    const result = formatReceiptTender(
      [
        { payment_method: 'CASH', amount: 20000 },
        { payment_method: 'DEBIT', amount: 20000 },
        { payment_method: 'QRIS', amount: 10000 },
      ],
      50000
    )
    expect(result.label).toBe('MULTI')
    expect(result.amount).toBe(50000)
    expect(result.change).toBe(0)
  })

  it('returns change when overpaid', () => {
    const result = formatReceiptTender([{ payment_method: 'CASH', amount: 60000 }], 50000)
    expect(result.change).toBe(10000)
  })

  it('returns zero change when exact', () => {
    const result = formatReceiptTender([{ payment_method: 'CASH', amount: 50000 }], 50000)
    expect(result.change).toBe(0)
  })

  it('handles numeric strings in amounts', () => {
    const result = formatReceiptTender([{ payment_method: 'CARD', amount: '50000' }], 40000)
    expect(result.amount).toBe(50000)
    expect(result.change).toBe(10000)
  })
})

describe('formatRupiah', () => {
  it('formats exact thousands', () => {
    expect(formatRupiah(50000)).toBe('Rp 50.000')
  })

  it('formats millions', () => {
    expect(formatRupiah(1500000)).toBe('Rp 1.500.000')
  })

  it('formats decimal values (rounds)', () => {
    // toLocaleString with 0 decimal places rounds
    expect(formatRupiah(12345)).toBe('Rp 12.345')
  })

  it('formats zero', () => {
    expect(formatRupiah(0)).toBe('Rp 0')
  })

  it('formats with thousands separators', () => {
    const result = formatRupiah(999999)
    expect(result).toContain('.')
    expect(result).toContain('999.999')
  })
})