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
 * Looks up a product in the KFA catalog by KFA code or BPOM NIE number.
 * Returns the `result` object from the API response.
 */
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
