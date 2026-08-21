'use server'

import { createClient } from '../../../../utils/supabase/server'
import { getSatusehatToken, lookupPatientIhs } from '../../../../lib/satusehat'

// Look up the IHS number for a patient by NIK and cache it on the patient.
// Skips when the patient has no NIK or the IHS number is already cached.
// Never throws to the client: returns { ok, message }.
export async function lookupIhsForPatient(
  patientId: string
): Promise<{ ok: boolean; message: string }> {
  if (!patientId) return { ok: false, message: 'No patient selected.' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  // SAFETY: asserted value is validated before use or known from the source.
  const tenantId = user?.app_metadata?.tenant_id as string | undefined
  if (!tenantId) return { ok: false, message: 'No tenant context.' }

  const { data: patient } = await supabase
    .from('patients')
    .select('nik, ihs_number')
    .eq('tenant_id', tenantId)
    .eq('id', patientId)
    .single()
  if (!patient?.nik) {
    return { ok: false, message: 'Patient has no NIK — add NIK to enable SATUSEHAT.' }
  }
  if (patient.ihs_number) return { ok: true, message: 'IHS OK' }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('satusehat_client_id, satusehat_client_secret')
    .eq('id', tenantId)
    .single()
  if (!tenant?.satusehat_client_id || !tenant?.satusehat_client_secret) {
    return { ok: false, message: 'SATUSEHAT credentials not set — add them in Settings.' }
  }

  try {
    const { accessToken } = await getSatusehatToken({
      clientId: tenant.satusehat_client_id,
      clientSecret: tenant.satusehat_client_secret,
    })
    const ihs = await lookupPatientIhs({ token: accessToken, nik: patient.nik })
    if (!ihs) {
      return { ok: false, message: 'IHS not found — sale can proceed, submission may be skipped.' }
    }
    await supabase
      .from('patients')
      .update({ ihs_number: ihs })
      .eq('tenant_id', tenantId)
      .eq('id', patientId)
    return { ok: true, message: 'IHS OK' }
  } catch {
    return { ok: false, message: 'SATUSEHAT lookup failed — sale can proceed.' }
  }
}
