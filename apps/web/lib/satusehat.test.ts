import { describe, expect, it, vi } from 'vitest'
import {
  lookupKfaProduct,
  lookupPatientIhs,
  needsTokenRefresh,
} from './satusehat'

describe('needsTokenRefresh', () => {
  it('returns true when expiry is within 60 seconds', () => {
    expect(needsTokenRefresh(new Date(Date.now() + 59_000))).toBe(true)
  })
  it('returns true when expiry is in the past', () => {
    expect(needsTokenRefresh(new Date(Date.now() - 1000))).toBe(true)
  })
  it('returns false when expiry is far enough away', () => {
    expect(needsTokenRefresh(new Date(Date.now() + 120_000))).toBe(false)
  })
})

describe('lookupPatientIhs', () => {
  it('returns null when the patient has no NIK', async () => {
    // No fetch call happens; empty nik returns null.
    expect(await lookupPatientIhs({ token: 't', nik: '' })).toBeNull()
  })

  it('returns null when the response bundle is empty', async () => {
    const emptyBundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 0,
      entry: [],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => emptyBundle })
    vi.stubGlobal('fetch', fetchMock)

    const result = await lookupPatientIhs({
      token: 'tok',
      nik: '3273010203900001',
    })
    expect(result).toBeNull()

    // The request must target the NIK identifier search (URL-encoded).
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('identifier=')
    expect(decodeURIComponent(url)).toContain(
      'identifier=https://fhir.kemkes.go.id/id/nik|3273010203900001'
    )
    vi.unstubAllGlobals()
  })

  it('returns the IHS number from the first bundle entry', async () => {
    const bundle = {
      resourceType: 'Bundle',
      type: 'searchset',
      total: 1,
      entry: [{ resource: { resourceType: 'Patient', id: '100000030009' } }],
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => bundle })
    vi.stubGlobal('fetch', fetchMock)

    const result = await lookupPatientIhs({
      token: 'tok',
      nik: '3273010203900001',
    })
    expect(result).toBe('100000030009')
    vi.unstubAllGlobals()
  })

  it('throws when the response is not ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, text: async () => 'boom' })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      lookupPatientIhs({ token: 'tok', nik: '3273010203900001' })
    ).rejects.toThrow()
    vi.unstubAllGlobals()
  })
})

describe('lookupKfaProduct', () => {
  it('throws when the product type param is missing in the URL', async () => {
    // The URL must carry product_type=Obat and code.
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ result: {} }) })
    vi.stubGlobal('fetch', fetchMock)

    await lookupKfaProduct({ token: 'tok', code: '93000515' })
    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('product_type=Obat')
    expect(url).toContain('code=93000515')
    vi.unstubAllGlobals()
  })

  it('returns the result object from the API', async () => {
    const payload = {
      result: {
        kfa_code: '93000515',
        name: 'Diazepam 5 mg Tablet',
        nie: 'GPL1433311910A1',
      },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => payload })
    vi.stubGlobal('fetch', fetchMock)

    const result = await lookupKfaProduct({ token: 'tok', code: '93000515' })
    expect(result.kfa_code).toBe('93000515')
    expect(result.nie).toBe('GPL1433311910A1')
    vi.unstubAllGlobals()
  })

  it('throws when the response is not ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 400, text: async () => 'bad' })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      lookupKfaProduct({ token: 'tok', code: '93000515' })
    ).rejects.toThrow()
    vi.unstubAllGlobals()
  })
})
