import { describe, expect, it } from 'vitest'
import {
  computeSaleTotals,
  ingredientTotalQty,
  requiresAddress,
  requiresResep,
} from './cart'

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
    const lines = [
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