import { describe, expect, it } from 'vitest'
import { buildKartuStokRows, formatKartuStokMovement, movementSign } from './kartu-stok'

describe('kartu stok helpers', () => {
  it('keeps running balance', () => {
    const rows = buildKartuStokRows([
      { type: 'IN', product_id: 'p1', batch_number: 'B1', expiry_date: null, qty: 10, occurred_at: '2025-01-01T00:00:00Z', source_id: 's1' },
      { type: 'OUT', product_id: 'p1', batch_number: 'B1', expiry_date: null, qty: -3, occurred_at: '2025-01-02T00:00:00Z', source_id: 's2' },
      { type: 'ADJUSTMENT', product_id: 'p1', batch_number: 'B1', expiry_date: null, qty: -1, occurred_at: '2025-01-03T00:00:00Z', source_id: 's3' },
    ])
    expect(rows.at(-1)?.balance).toBe(6)
    // check intermediate
    expect(rows[0].balance).toBe(10)
    expect(rows[1].balance).toBe(7)
  })

  it('returns empty for empty input', () => {
    expect(buildKartuStokRows([])).toEqual([])
  })

  it('maps signs correctly', () => {
    expect(movementSign('IN')).toBe(1)
    expect(movementSign('OUT')).toBe(-1)
    expect(movementSign('ADJUSTMENT')).toBe(1)
    expect(movementSign('VOID')).toBe(-1)
  })

  it('formats movement types', () => {
    expect(formatKartuStokMovement('IN')).toBe('Masuk')
    expect(formatKartuStokMovement('OUT')).toBe('Keluar')
    expect(formatKartuStokMovement('ADJUSTMENT')).toBe('Penyesuaian')
    expect(formatKartuStokMovement('VOID')).toBe('Void')
  })
})