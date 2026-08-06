import { describe, expect, it, vi } from 'vitest'
import {
  buildContainedMedication,
  buildMedicationDispense,
  lookupKfaProduct,
  lookupPatientIhs,
  mapBaseUnitToOdf,
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

describe('mapBaseUnitToOdf', () => {
  it('maps common units to orderableDrugForm codes', () => {
    expect(mapBaseUnitToOdf('Tablet')).toBe('TAB')
    expect(mapBaseUnitToOdf('KAPSUL')).toBe('CAP')
    expect(mapBaseUnitToOdf('botol')).toBe('BOT')
    expect(mapBaseUnitToOdf('  vial ')).toBe('VIAL')
  })
  it('returns null for unknown units', () => {
    expect(mapBaseUnitToOdf('strip')).toBeNull()
    expect(mapBaseUnitToOdf('')).toBeNull()
    expect(mapBaseUnitToOdf(null)).toBeNull()
    expect(mapBaseUnitToOdf(undefined)).toBeNull()
  })
})

describe('buildContainedMedication', () => {
  it('sets the KFA code and NC type for a non-compound', () => {
    const med: any = buildContainedMedication({
      orgId: 'org-1',
      localId: 'RX-1-1-med',
      kfaCode: '93000515',
      displayName: 'Diazepam 5 mg Tablet',
      baseUnit: 'Tablet',
    })
    expect(med.code.coding[0].code).toBe('93000515')
    expect(med.code.coding[0].system).toBe('http://sys-ids.kemkes.go.id/kfa')
    expect(med.extension[0].valueCodeableConcept.coding[0].code).toBe('NC')
    expect(med.form.coding[0].code).toBe('TAB')
    expect(med.identifier[0].system).toContain('org-1')
  })
  it('omits code and adds ingredients for a compound', () => {
    const med: any = buildContainedMedication({
      orgId: 'org-1',
      localId: 'RX-2-1-med',
      medicationType: 'EP',
      ingredients: [
        { kfaCode: '91000314', displayName: 'Acarbose' },
      ],
    })
    expect(med.code).toBeUndefined()
    expect(med.extension[0].valueCodeableConcept.coding[0].code).toBe('EP')
    expect(med.ingredient[0].itemCodeableConcept.coding[0].code).toBe('91000314')
    expect(med.ingredient[0].isActive).toBe(true)
  })
  it('omits form when the base unit is unknown', () => {
    const med: any = buildContainedMedication({
      orgId: 'org-1',
      localId: 'RX-3-1-med',
      kfaCode: '93000515',
      baseUnit: 'strip',
    })
    expect(med.form).toBeUndefined()
  })
})

describe('buildMedicationDispense', () => {
  it('references the medication request, encounter, and org', () => {
    const md: any = buildMedicationDispense({
      orgId: 'org-1',
      localId: 'RX-1-1-disp',
      medication: { resourceType: 'Medication', id: 'med-1' },
      patientIhs: '100000030009',
      encounterId: 'enc-1',
      medicationRequestId: 'mr-1',
      quantity: 10,
      odfCode: 'TAB',
      whenHandedOver: '2026-08-06T03:00:00.000Z',
    })
    expect(md.authorizingPrescription[0].reference).toBe('MedicationRequest/mr-1')
    expect(md.context.reference).toBe('Encounter/enc-1')
    expect(md.subject.reference).toBe('Patient/100000030009')
    expect(md.performer[0].actor.reference).toBe('Organization/org-1')
    expect(md.identifier[0].system).toContain('org-1')
    expect(md.quantity.system).toBe(
      'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm'
    )
    expect(md.quantity.code).toBe('TAB')
    expect(md.medicationReference.reference).toBe('#med-1')
  })
  it('omits quantity unit when the ODF code is null', () => {
    const md: any = buildMedicationDispense({
      orgId: 'org-1',
      localId: 'RX-1-1-disp',
      medication: { resourceType: 'Medication', id: 'med-1' },
      patientIhs: '100000030009',
      encounterId: 'enc-1',
      medicationRequestId: 'mr-1',
      quantity: 5,
      odfCode: null,
      whenHandedOver: '2026-08-06T03:00:00.000Z',
    })
    expect(md.quantity).toEqual({ value: 5 })
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
    expect(result?.kfa_code).toBe('93000515')
    expect(result?.nie).toBe('GPL1433311910A1')
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
