import { describe, expect, it } from 'vitest'
import {
  computeSaleTotals,
  ingredientTotalQty,
  isBpjsCheckoutBlocked,
  requiresAddress,
  requiresResep,
  type CartLine,
} from './sale-cart'

describe('requiresResep', () => {
  it('is false for only OTC classes', () => {
    expect(requiresResep(['BEBAS', 'BEBAS_TERBATAS'])).toBe(false)
  })
  it('is true for KERAS', () => {
    expect(requiresResep(['BEBAS', 'KERAS'])).toBe(true)
  })
  it('is true for narcotic classes', () => {
    expect(requiresResep(['PSIKOTROPIKA'])).toBe(true)
    expect(requiresResep(['NARKOTIKA'])).toBe(true)
  })
})

describe('requiresAddress', () => {
  it('is false for KERAS only', () => {
    expect(requiresAddress(['KERAS'])).toBe(false)
  })
  it('is true for PSIKOTROPIKA and NARKOTIKA', () => {
    expect(requiresAddress(['PSIKOTROPIKA'])).toBe(true)
    expect(requiresAddress(['NARKOTIKA'])).toBe(true)
  })
  it('is false when no narcotic', () => {
    expect(requiresAddress(['BEBAS', 'KERAS'])).toBe(false)
  })
})

describe('computeSaleTotals', () => {
  it('sums item qty x price, racikan price, embalase, and tuslah', () => {
    const lines: CartLine[] = [
      { kind: 'item', product_id: 'i', qty: 2, unit_price: 1000 },
      { kind: 'racikan', name: 'R1', price: 50000, dosage_count: 10, embalase: 3000 },
    ]
    const totals = computeSaleTotals(lines, 2000)
    expect(totals.subtotal).toBe(52000)
    expect(totals.embalaseTotal).toBe(3000)
    expect(totals.grandTotal).toBe(57000)
  })
  it('treats racikan children as zero-cost', () => {
    const totals = computeSaleTotals([
      { kind: 'racikan', price: 40000, embalase: 2000 },
    ])
    expect(totals.subtotal).toBe(40000)
    expect(totals.grandTotal).toBe(42000)
  })
})

describe('ingredientTotalQty', () => {
  it('multiplies per-dose fraction by dosage count', () => {
    expect(ingredientTotalQty(0.5, 10)).toBe(5)
    expect(ingredientTotalQty(0.333, 10)).toBeCloseTo(3.33)
  })
})

describe('isBpjsCheckoutBlocked', () => {
  it('blocks when sale_type is BPJS and patient has no bpjs_number', () => {
    expect(isBpjsCheckoutBlocked('BPJS', { bpjs_number: null })).toBe(true)
    expect(isBpjsCheckoutBlocked('BPJS', { bpjs_number: '' })).toBe(true)
    expect(isBpjsCheckoutBlocked('BPJS', null)).toBe(true)
  })
  it('does not block when sale_type is BPJS and patient has a bpjs_number', () => {
    expect(isBpjsCheckoutBlocked('BPJS', { bpjs_number: '0001234567890' })).toBe(false)
  })
  it('does not block for non-BPJS sale types regardless of bpjs_number', () => {
    expect(isBpjsCheckoutBlocked('RESEP', { bpjs_number: null })).toBe(false)
    expect(isBpjsCheckoutBlocked('OTC', null)).toBe(false)
  })
})

describe('computeSaleTotals', () => {
  it('BPJS: tuslah 0 and embalase 0 produce correct grand total', () => {
    const lines: CartLine[] = [
      { kind: 'item', product_id: 'i', qty: 3, unit_price: 10000 },
      { kind: 'racikan', name: 'R', price: 20000, dosage_count: 5, embalase: 0 },
    ]
    const totals = computeSaleTotals(lines, 0)
    expect(totals.subtotal).toBe(50000)
    expect(totals.embalaseTotal).toBe(0)
    expect(totals.grandTotal).toBe(50000)
  })
})
