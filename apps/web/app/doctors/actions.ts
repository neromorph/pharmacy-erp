'use server'

import { createClient } from '../../utils/supabase/server'
import { getUserRole } from '../../utils/auth'

// Only OWNER may manage prescriber/patient master data (clinical identity).
async function assertOwner(supabase: Awaited<ReturnType<typeof createClient>>) {
  const role = await getUserRole(supabase)
  if (role !== 'OWNER') throw new Error('Owner only')
}

export async function createDoctor(formData: FormData) {
  const supabase = await createClient()
  await assertOwner(supabase)
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const { error } = await supabase.from('doctors').insert({
    tenant_id: tenantId,
    name: String(formData.get('name') || '').trim(),
    sip_number: String(formData.get('sip_number') || '').trim() || null,
    phone: String(formData.get('phone') || '').trim() || null,
  })
  if (error) throw new Error(error.message)
}

export async function updateDoctor(formData: FormData) {
  const supabase = await createClient()
  await assertOwner(supabase)
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')
  const id = String(formData.get('id'))
  if (!id) throw new Error('Missing id')

  const { error } = await supabase
    .from('doctors')
    .update({
      name: String(formData.get('name') || '').trim(),
      sip_number: String(formData.get('sip_number') || '').trim() || null,
      phone: String(formData.get('phone') || '').trim() || null,
    })
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteDoctor(formData: FormData) {
  const supabase = await createClient()
  await assertOwner(supabase)
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')
  const id = String(formData.get('id'))
  if (!id) throw new Error('Missing id')

  const { error } = await supabase
    .from('doctors')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}