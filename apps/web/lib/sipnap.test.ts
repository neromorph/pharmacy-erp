import { describe, it, expect } from 'vitest'
import { isSipnapReady, buildSipnapCsv, parseSipnapReport } from './sipnap'

describe('sipnap helpers', () => {
  it('marks a report ready only when no missing rows exist', () => {
    // SAFETY: asserted value is validated before use or known from the source.
    expect(isSipnapReady({ missing: [] } as any)).toBe(true)
    // SAFETY: asserted value is validated before use or known from the source.
    expect(isSipnapReady({ missing: [{ sale_number: 'S1', missing_fields: ['Patient Address'] }] } as any)).toBe(false)
  })

  it('builds a csv with product and transaction sections', () => {
    const report = {
      month: 8,
      year: 2026,
      ready: true,
      transactions: [
        {
          sale_id: 'a',
          sale_number: 'S1',
          sold_at: '2026-08-01T09:00:00Z',
          doctor_name: 'Dr A',
          doctor_sip: 'SIP.1',
          patient_name: 'P A',
          patient_address: 'Jl A',
          product_name: 'Drug X',
          qty_sold: 10,
        },
      ],
      missing: [],
      products: [
        {
          product_name: 'Drug X',
          saldo_awal: 5,
          pemasukan: 100,
          pengeluaran: 10,
          status_pemusnahan: 'TIDAK ADA',
          saldo_akhir: 95,
        },
      ],
    }
    const csv = buildSipnapCsv(report)
    expect(csv).toContain('SALDO AWAL')
    expect(csv).toContain('Drug X')
    expect(csv).toContain('S1')
  })

  it('parses the rpc json payload', () => {
    // SAFETY: asserted value is validated before use or known from the source.
    const parsed = parseSipnapReport({ ready: true } as any)
    expect(parsed.ready).toBe(true)
    expect(parsed.transactions).toEqual([])
  })
})
