import { describe, expect, it } from 'vitest'
import { perProductQuantities, sumEmbalase } from './compound'

describe('perProductQuantities', () => {
  it('groups real product quantities and skips parent rows', () => {
    const items = [
      { product_id: null, qty_sold: 10 }, // parent compound row — skipped
      { product_id: 'p1', qty_sold: 0.5 }, // child ingredient
      { product_id: 'p2', qty_sold: 3 },
      { product_id: 'p1', qty_sold: 0.333 }, // same ingredient another child
    ]
    const map = perProductQuantities(items)
    expect(map.get('p1')).toBeCloseTo(0.833)
    expect(map.get('p2')).toBe(3)
    expect(map.has(null as any)).toBe(false)
    expect(map.size).toBe(2)
  })
})

describe('sumEmbalase', () => {
  it('sums embalase only from parent rows', () => {
    const items = [
      { parent_item_id: null, embalase_amount: 3000 }, // parent
      { parent_item_id: 'abc', embalase_amount: 0 }, // child — excluded
      { parent_item_id: null, embalase_amount: 2000 }, // second parent
    ]
    expect(sumEmbalase(items)).toBe(5000)
  })

  it('returns zero when no parent rows exist', () => {
    const items = [{ parent_item_id: 'abc', embalase_amount: 0 }]
    expect(sumEmbalase(items)).toBe(0)
  })
})