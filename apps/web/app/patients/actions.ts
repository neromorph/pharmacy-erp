'use server'

import { createClient } from '../../utils/supabase/server'
import { getUserRole } from '../../utils/auth'

async function assertOwner(supabase: Awaited<ReturnType<typeof createClient>>) {
  const role = await getUserRole(supabase)
  if (role !== 'OWNER') throw new Error('Owner only')
}

function fields(formData: FormData) {
  const birth = String(formData.get('birth_date') || '').trim()
  return {
    name: String(formData.get('name') || '').trim(),
    address: String(formData.get('address') || '').trim() || null,
    phone: String(formData.get('phone') || '').trim() || null,
    birth_date: birth ? new Date(birth).toISOString().slice(0, 10) : null,
    bpjs_number: String(formData.get('bpjs_number') || '').trim() || null,
  }
}

export async function createPatient(formData: FormData) {
  const supabase = await createClient()
  await assertOwner(supabase)
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const { error } = await supabase.from('patients').insert({
    tenant_id: tenantId,
    ...fields(formData),
  })
  if (error) throw new Error(error.message)
}

export async function updatePatient(formData: FormData) {
  const supabase = await createClient()
  await assertOwner(supabase)
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')
  const id = String(formData.get('id'))
  if (!id) throw new Error('Missing id')

  const { error } = await supabase
    .from('patients')
    .update(fields(formData))
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletePatient(formData: FormData) {
  const supabase = await createClient()
  await assertOwner(supabase)
  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')
  const id = String(formData.get('id'))
  if (!id) throw new Error('Missing id')

  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('id', id)
  if (error) throw new Error(error.message)
}