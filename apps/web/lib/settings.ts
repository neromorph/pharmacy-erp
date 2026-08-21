export interface TenantProfile {
  id: string
  name: string
  address: string | null
  phone: string | null
  sia_number: string | null
  sipa_number: string | null
  logo_url: string | null
  receipt_footer: string | null
  // SATUSEHAT credential fields. client_secret is NEVER part of page data.
  satusehat_client_id: string | null
  satusehat_org_id: string | null
}

// Strip empty receipt_footer so it becomes NULL in the DB.
export function buildTenantPatch(input: {
  name: string
  address: string
  phone: string
  sia_number: string
  sipa_number: string
  receipt_footer: string
}) {
  const trim = (v: string) => (v.trim() ? v.trim() : null)
  const name = input.name.trim()
  if (!name) {
    throw new Error('Tenant name is required')
  }
  return {
    name,
    address: trim(input.address),
    phone: trim(input.phone),
    sia_number: trim(input.sia_number),
    sipa_number: trim(input.sipa_number),
    receipt_footer: trim(input.receipt_footer),
  }
}

// Build a patch for the SATUSEHAT credential columns.
// Blank fields are omitted so an empty input never erases a stored value.
export function buildSatusehatPatch(input: {
  satusehat_client_id?: string | null
  satusehat_client_secret?: string | null
  satusehat_org_id?: string | null
}) {
  const patch: Record<string, string> = {}
  const fields: Array<[string, string | null | undefined]> = [
    ['satusehat_client_id', input.satusehat_client_id],
    ['satusehat_client_secret', input.satusehat_client_secret],
    ['satusehat_org_id', input.satusehat_org_id],
  ]
  for (const [key, value] of fields) {
    const trimmed = value?.trim() ?? ''
    if (trimmed) patch[key] = trimmed
  }
  return patch
}

// Build the storage path for a logo upload.
export function logoPath(tenantId: string, filename: string): string {
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${tenantId}/${Date.now()}-${sanitized}`
}