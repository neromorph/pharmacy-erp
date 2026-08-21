import { describe, it, expect } from 'vitest'
import { isSipnapV2Ready, buildSipnapV2Csv, parseSipnapV2Report, checksToLines } from './sipnap-v2'

describe('sipnap v2 helpers', () => {
  it('is ready only when missing and checks are empty', () => {
    // SAFETY: asserted value is validated before use or known from the source.
    expect(isSipnapV2Ready({ missing: [], checks: [] } as any)).toBe(true)
    // SAFETY: asserted value is validated before use or known from the source.
    expect(isSipnapV2Ready({ missing: [], checks: [{ type: 'NEGATIVE' }] } as any)).toBe(false)
    // SAFETY: asserted value is validated before use or known from the source.
    expect(isSipnapV2Ready({ missing: [{ sale_number: 'S1' }], checks: [] } as any)).toBe(false)
  })

  it('renders checks as human lines', () => {
    const lines = checksToLines([
      { type: 'NEGATIVE', product_name: 'Drug X' },
      { type: 'BAP' },
      { type: 'CONTINUITY', product_name: 'Drug Y', expected: 10, actual: 8 },
    ])
    expect(lines[0]).toContain('Drug X')
    expect(lines[1]).toContain('BAP')
    expect(lines[2]).toContain('Drug Y')
  })

  it('builds a csv with the four split columns', () => {
    const report = {
      month: 8,
      year: 2026,
      ready: true,
      missing: [],
      checks: [],
      transactions: [],
      products: [
        {
          product_id: 'p1',
          product_name: 'Drug X',
          saldo_awal: 5,
          pemasukan_dari_pbf: 100,
          pemasukan_dari_sarana: 0,
          pengeluaran_untuk_resep: 10,
          pengeluaran_untuk_sarana: 0,
          jumlah_dimusnahkan: 0,
          status_pemusnahan: 'TIDAK ADA',
          bap_number: null,
          bap_date: null,
          saldo_akhir: 95,
        },
      ],
    }
    const csv = buildSipnapV2Csv(report)
    expect(csv).toContain('PEMASUKAN DARI PBF')
    expect(csv).toContain('PENGELUARAN UNTUK SARANA')
    expect(csv).toContain('Drug X')
  })

  it('parses the rpc payload', () => {
    // SAFETY: asserted value is validated before use or known from the source.
    const parsed = parseSipnapV2Report({ ready: true } as any)
    expect(parsed.ready).toBe(true)
    expect(parsed.checks).toEqual([])
  })
})
