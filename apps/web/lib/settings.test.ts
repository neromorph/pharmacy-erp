import { describe, expect, it } from 'vitest'
import { buildSatusehatPatch, buildTenantPatch, logoPath } from './settings'

describe('buildTenantPatch', () => {
  it('drops empty receipt_footer', () => {
    expect(buildTenantPatch({
      name: 'Apotek Sehat',
      address: 'Jl. Merdeka 1',
      phone: '021-123456',
      sia_number: 'SIA-001',
      sipa_number: 'SIPA-001',
      receipt_footer: '   ',
    }).receipt_footer).toBeNull()
  })

  it('preserves filled receipt_footer', () => {
    expect(buildTenantPatch({
      name: 'Apotek Sehat',
      address: '',
      phone: '',
      sia_number: '',
      sipa_number: '',
      receipt_footer: 'Produk tidak bisa ditukar.',
    }).receipt_footer).toBe('Produk tidak bisa ditukar.')
  })

  it('sets empty address/phone/sia/sipa to null', () => {
    const patch = buildTenantPatch({
      name: 'Apotek Sehat',
      address: '   ',
      phone: '',
      sia_number: 'SIA-001',
      sipa_number: '',
      receipt_footer: '',
    })
    expect(patch.address).toBeNull()
    expect(patch.phone).toBeNull()
    expect(patch.sia_number).toBe('SIA-001')
    expect(patch.sipa_number).toBeNull()
  })

  it('rejects empty tenant name', () => {
    expect(() =>
      buildTenantPatch({
        name: '   ',
        address: '',
        phone: '',
        sia_number: '',
        sipa_number: '',
        receipt_footer: '',
      })
    ).toThrow('Tenant name is required')
  })
})

describe('buildSatusehatPatch', () => {
  it('omits blank fields so an empty input never erases stored values', () => {
    const patch = buildSatusehatPatch({
      satusehat_client_id: '  ',
      satusehat_client_secret: '',
      satusehat_org_id: 'org-123',
    })
    expect(patch).toEqual({ satusehat_org_id: 'org-123' })
  })

  it('keeps trimmed non-blank values', () => {
    const patch = buildSatusehatPatch({
      satusehat_client_id: ' client-1 ',
      satusehat_org_id: '',
    })
    expect(patch).toEqual({ satusehat_client_id: 'client-1' })
  })

  it('returns empty object when all fields are blank', () => {
    expect(buildSatusehatPatch({})).toEqual({})
  })
})

describe('logoPath', () => {
  it('returns tenant-scoped path with timestamp prefix', () => {
    const path = logoPath('abc-123', 'logo.png')
    expect(path).toMatch(/^abc-123\/\d+-.+\.png$/)
  })

  it('strips unsafe characters from filename', () => {
    const path = logoPath('tenant-1', 'my logo (1).jpg')
    expect(path).toContain('tenant-1/')
    expect(path).not.toContain(' ')
    expect(path).not.toContain('(')
  })
})