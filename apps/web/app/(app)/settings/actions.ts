'use server'

import { createClient, toPublicUrl } from '../../../utils/supabase/server'
import { getUserRole } from '../../../utils/auth'
import { buildSatusehatPatch, buildTenantPatch, logoPath } from '../../../lib/settings'

// Save tenant profile — OWNER only.
export async function saveTenantProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const role = await getUserRole(supabase)
  if (role !== 'OWNER') throw new Error('Owner only')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const patch = buildTenantPatch({
    name: (formData.get('name') as string) || '',
    address: (formData.get('address') as string) || '',
    phone: (formData.get('phone') as string) || '',
    sia_number: (formData.get('sia_number') as string) || '',
    sipa_number: (formData.get('sipa_number') as string) || '',
    receipt_footer: (formData.get('receipt_footer') as string) || '',
  })

  // Blank SATUSEHAT fields keep their stored values.
  const satusehatPatch = buildSatusehatPatch({
    satusehat_client_id: (formData.get('satusehat_client_id') as string) || '',
    satusehat_client_secret: (formData.get('satusehat_client_secret') as string) || '',
    satusehat_org_id: (formData.get('satusehat_org_id') as string) || '',
  })

  const { error } = await supabase
    .from('tenants')
    .update({ ...patch, ...satusehatPatch })
    .eq('id', tenantId)

  if (error) throw new Error(error.message)
}

// Upload logo to tenant-logos bucket and persist URL in tenants table.
// Uses the signed-in user's session — Storage RLS enforces tenant isolation.
export async function uploadLogo(file: File) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const role = await getUserRole(supabase)
  if (role !== 'OWNER') throw new Error('Owner only')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const path = logoPath(tenantId, file.name)
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('tenant-logos')
    .upload(path, arrayBuffer, {
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) throw new Error(uploadError.message)

  const { data: urlData } = supabase.storage
    .from('tenant-logos')
    .getPublicUrl(path)

  const logoUrl = toPublicUrl(urlData.publicUrl)

  const { error: updateError } = await supabase
    .from('tenants')
    .update({ logo_url: logoUrl })
    .eq('id', tenantId)

  if (updateError) throw new Error(updateError.message)
  return logoUrl
}

// Remove logo — set logo_url back to null.
export async function removeLogo() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const role = await getUserRole(supabase)
  if (role !== 'OWNER') throw new Error('Owner only')

  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const { error } = await supabase
    .from('tenants')
    .update({ logo_url: null })
    .eq('id', tenantId)

  if (error) throw new Error(error.message)
}