// SATUSEHAT API helpers. Server-side only: never import this in client components.
// Live-verified facts (2026-08-06, sandbox):
//   token TTL 14399s, Patient NIK search, KFA product lookup.

const SATUSEHAT_BASE_URL =
  process.env.SATUSEHAT_BASE_URL ??
  'https://api-satusehat-stg.dto.kemkes.go.id'

const TOKEN_ENDPOINT = `${SATUSEHAT_BASE_URL}/oauth2/v1/accesstoken?grant_type=client_credentials`

/** Refresh threshold: 60 seconds before expiry. */
const REFRESH_MARGIN_MS = 60_000

/**
 * Returns true when the token expires soon enough to require a refresh.
 */
export function needsTokenRefresh(expiresAt: Date): boolean {
  return expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS
}

/**
 * Fetches a SATUSEHAT OAuth2 access token (client_credentials grant).
 * The response `expires_in` is in seconds; convert to a Date.
 */
export async function getSatusehatToken(input: {
  clientId: string
  clientSecret: string
}): Promise<{ accessToken: string; expiresAt: Date }> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: input.clientId,
      client_secret: input.clientSecret,
    }),
  })
  if (!res.ok) {
    throw new Error(`SATUSEHAT token request failed: ${res.status}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: string | number }
  const expiresInSeconds = Number(data.expires_in)
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
  }
}

/**
 * Looks up a patient's IHS number from their NIK via the SATUSEHAT MPI.
 * Returns null when the patient has no NIK or the search is empty.
 */
export async function lookupPatientIhs(input: {
  token: string
  nik: string
}): Promise<string | null> {
  const { token, nik } = input
  if (!nik.trim()) return null

  const url = new URL(`${SATUSEHAT_BASE_URL}/fhir-r4/v1/Patient`)
  url.searchParams.set(
    'identifier',
    `https://fhir.kemkes.go.id/id/nik|${nik.trim()}`
  )
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`SATUSEHAT patient lookup failed: ${res.status}`)
  }
  const bundle = (await res.json()) as {
    entry?: Array<{ resource?: { id?: string } }>
  }
  const first = bundle.entry?.[0]?.resource?.id
  return first ?? null
}

/**
 * Looks up a practitioner's IHS number from their NIK via the SATUSEHAT MPI.
 * Returns null when the doctor has no NIK or the search is empty.
 */
export async function lookupPractitionerIhs(input: {
  token: string
  nik: string
}): Promise<string | null> {
  const { token, nik } = input
  if (!nik.trim()) return null

  const url = new URL(`${SATUSEHAT_BASE_URL}/fhir-r4/v1/Practitioner`)
  url.searchParams.set(
    'identifier',
    `https://fhir.kemkes.go.id/id/nik|${nik.trim()}`
  )
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`SATUSEHAT practitioner lookup failed: ${res.status}`)
  }
  const bundle = (await res.json()) as {
    entry?: Array<{ resource?: { id?: string } }>
  }
  const first = bundle.entry?.[0]?.resource?.id
  return first ?? null
}

// ============================================================
// FHIR payload builders (Task 5.5). Pure functions; no I/O.
// Payload shapes live-verified on the sandbox 2026-08-06
// (all four POSTs returned 201). See ticket 07 in the vault.
// ============================================================

/**
 * Maps a product base unit to an orderableDrugForm code (v3-ODF).
 * Returns null when the unit is unknown; the caller omits the code then.
 */
export function mapBaseUnitToOdf(
  unit: string | null | undefined
): string | null {
  const u = (unit || '').trim().toLowerCase()
  const map: Record<string, string> = {
    tablet: 'TAB',
    kapsul: 'CAP',
    botol: 'BOT',
    vial: 'VIAL',
    tube: 'TUBE',
    sachet: 'SACH',
    ampul: 'AMP',
    suppositoria: 'SUPP',
  }
  return map[u] ?? null
}

const MEDICATION_PROFILE = 'https://fhir.kemkes.go.id/r4/StructureDefinition/Medication'
const KFA_SYSTEM = 'http://sys-ids.kemkes.go.id/kfa'
const FORM_SYSTEM = 'http://terminology.kemkes.go.id/CodeSystem/medication-form'
const MED_TYPE_SYSTEM = 'http://terminology.kemkes.go.id/CodeSystem/medication-type'
const MED_TYPE_URL = 'https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType'
const ODF_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm'

const MED_TYPE_LABEL: Record<'NC' | 'SD' | 'EP', string> = {
  NC: 'Non-compound',
  SD: 'Compound d.t.d',
  EP: 'Compound non-d.t.d',
}

/**
 * Builds the contained Medication resource shared by MedicationRequest
 * and MedicationDispense. Non-racikan: code set + NC type.
 * Racikan parent (no kfaCode): code omitted + EP type + ingredients.
 */
export function buildContainedMedication(input: {
  orgId: string
  localId: string
  kfaCode?: string | null
  displayName?: string | null
  baseUnit?: string | null
  medicationType?: 'NC' | 'SD' | 'EP'
  ingredients?: Array<{ kfaCode: string; displayName?: string | null }>
}): object {
  const type = input.medicationType ?? 'NC'
  const odf = mapBaseUnitToOdf(input.baseUnit)
  const medication: Record<string, unknown> = {
    resourceType: 'Medication',
    id: 'med-1',
    meta: { profile: [MEDICATION_PROFILE] },
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/medication/${input.orgId}`,
        use: 'official',
        value: input.localId,
      },
    ],
    status: 'active',
    extension: [
      {
        url: MED_TYPE_URL,
        valueCodeableConcept: {
          coding: [
            {
              system: MED_TYPE_SYSTEM,
              code: type,
              display: MED_TYPE_LABEL[type],
            },
          ],
        },
      },
    ],
  }
  if (input.kfaCode) {
    medication.code = {
      coding: [
        {
          system: KFA_SYSTEM,
          code: input.kfaCode,
          display: input.displayName ?? '',
        },
      ],
    }
  }
  if (odf) {
    medication.form = {
      coding: [
        {
          system: FORM_SYSTEM,
          code: odf,
          display: input.baseUnit ?? odf,
        },
      ],
    }
  }
  if (input.ingredients && input.ingredients.length > 0) {
    medication.ingredient = input.ingredients.map((ing) => ({
      itemCodeableConcept: {
        coding: [
          {
            system: KFA_SYSTEM,
            code: ing.kfaCode,
            display: ing.displayName ?? '',
          },
        ],
      },
      isActive: true,
    }))
  }
  return medication
}

/**
 * Builds a MedicationRequest for one drug line.
 */
export function buildMedicationRequest(input: {
  orgId: string
  localId: string
  medication: object
  patientIhs: string
  encounterId: string
  doctorIhs: string
  authoredOn: string
}): object {
  return {
    resourceType: 'MedicationRequest',
    meta: {
      profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationRequest'],
    },
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/prescription/${input.orgId}`,
        use: 'official',
        value: input.localId,
      },
    ],
    status: 'completed',
    intent: 'order',
    medicationReference: { reference: '#med-1' },
    contained: [input.medication],
    subject: { reference: `Patient/${input.patientIhs}` },
    encounter: { reference: `Encounter/${input.encounterId}` },
    authoredOn: input.authoredOn,
    requester: { reference: `Practitioner/${input.doctorIhs}` },
  }
}

/**
 * Builds a MedicationDispense for one drug line.
 */
export function buildMedicationDispense(input: {
  orgId: string
  localId: string
  medication: object
  patientIhs: string
  encounterId: string
  medicationRequestId: string
  quantity: number
  odfCode: string | null
  whenHandedOver: string
}): object {
  const quantity: Record<string, unknown> = { value: input.quantity }
  if (input.odfCode) {
    quantity.unit = input.odfCode
    quantity.system = ODF_SYSTEM
    quantity.code = input.odfCode
  }
  return {
    resourceType: 'MedicationDispense',
    meta: {
      profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationDispense'],
    },
    status: 'completed',
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/prescription/${input.orgId}`,
        use: 'official',
        value: input.localId,
      },
    ],
    authorizingPrescription: [
      { reference: `MedicationRequest/${input.medicationRequestId}` },
    ],
    contained: [input.medication],
    medicationReference: { reference: '#med-1' },
    subject: { reference: `Patient/${input.patientIhs}` },
    context: { reference: `Encounter/${input.encounterId}` },
    performer: [
      { actor: { reference: `Organization/${input.orgId}` } },
    ],
    quantity,
    whenHandedOver: input.whenHandedOver,
  }
}

/**
 * Builds an Encounter for one sale.
 * Period = start to end; statusHistory splits it into three phases.
 */
export function buildEncounter(input: {
  orgId: string
  localId: string
  patientIhs: string
  patientName?: string | null
  doctorIhs: string
  locationId: string
  conditionId: string
  start: string
  end: string
}): object {
  const classCoding = {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: 'AMB',
    display: 'ambulatory',
  }
  const startMs = new Date(input.start).getTime()
  const endMs = new Date(input.end).getTime()
  const t1 = new Date(startMs + (endMs - startMs) / 3).toISOString()
  const t2 = new Date(startMs + ((endMs - startMs) * 2) / 3).toISOString()
  return {
    resourceType: 'Encounter',
    meta: {
      profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Encounter'],
    },
    identifier: [
      {
        system: `http://sys-ids.kemkes.go.id/encounter/${input.orgId}`,
        use: 'official',
        value: input.localId,
      },
    ],
    status: 'finished',
    statusHistory: [
      { status: 'arrived', period: { start: input.start, end: t1 } },
      { status: 'in-progress', period: { start: t1, end: t2 } },
      { status: 'finished', period: { start: t2, end: input.end } },
    ],
    class: classCoding,
    classHistory: [{ class: classCoding, period: { start: input.start, end: input.end } }],
    subject: { reference: `Patient/${input.patientIhs}`, display: input.patientName ?? '' },
    participant: [
      {
        type: [
          {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                code: 'ATND',
                display: 'attender',
              },
            ],
          },
        ],
        individual: { reference: `Practitioner/${input.doctorIhs}` },
      },
    ],
    period: { start: input.start, end: input.end },
    location: [{ location: { reference: `Location/${input.locationId}` } }],
    diagnosis: [
      {
        condition: { reference: `Condition/${input.conditionId}` },
        use: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role',
              code: 'AD',
              display: 'Admission diagnosis',
            },
          ],
        },
        rank: 1,
      },
    ],
    serviceProvider: { reference: `Organization/${input.orgId}` },
  }
}

/**
 * Builds a Location for the tenant organization.
 */
export function buildLocation(input: {
  orgId: string
  name: string
}): object {
  return {
    resourceType: 'Location',
    meta: {
      profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Location'],
    },
    status: 'active',
    name: input.name,
    managingOrganization: { reference: `Organization/${input.orgId}` },
  }
}

/**
 * POSTs one FHIR resource to the SATUSEHAT server.
 * Returns the created resource id. Throws with the OperationOutcome text.
 */
export async function postFhirResource(input: {
  token: string
  baseUrl: string
  resource: { resourceType: string }
}): Promise<string> {
  const { token, baseUrl, resource } = input
  const res = await fetch(
    `${baseUrl}/fhir-r4/v1/${resource.resourceType}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resource),
    }
  )
  if (!res.ok) {
    const text = await res.text()
    let detail = `HTTP ${res.status}`
    try {
      const body = JSON.parse(text) as {
        issue?: Array<{ details?: { text?: string } }>
      }
      if (body.issue && body.issue.length > 0) {
        detail = body.issue
          .map((i) => i.details?.text ?? '')
          .filter(Boolean)
          .join('; ')
      }
    } catch {
      // non-JSON body; keep HTTP status
    }
    throw new Error(`SATUSEHAT ${resource.resourceType} failed: ${detail}`)
  }
  const body = (await res.json()) as { id?: string }
  return body.id ?? ''
}

export async function lookupKfaProduct(input: {
  token: string
  code: string
}): Promise<{ kfa_code?: string; name?: string; nie?: string; [k: string]: unknown } | null> {
  const { token, code } = input
  if (!code.trim()) return null

  const url = new URL(`${SATUSEHAT_BASE_URL}/kfa-v2/products`)
  url.searchParams.set('product_type', 'Obat')
  url.searchParams.set('code', code.trim())
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`SATUSEHAT KFA lookup failed: ${res.status}`)
  }
  const data = (await res.json()) as { result?: Record<string, unknown> | null }
  return data.result ?? null
}
