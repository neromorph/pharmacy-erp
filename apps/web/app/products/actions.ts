'use server'

import { createClient } from '../../utils/supabase/server'
import { getUserRole } from '../../utils/auth'

// Create or update a product. Only OWNER, PHARMACIST, and INVENTORY may manage
// master data. CASHIER can search products but not edit them.
async function assertCanEdit(supabase: Awaited<ReturnType<typeof createClient>>) {
  const role = await getUserRole(supabase)
  if (role !== 'OWNER' && role !== 'PHARMACIST' && role !== 'INVENTORY') {
    throw new Error('Not authorized')
  }
}

function enrich(formData: FormData) {
  return {
    name: String(formData.get('name') || '').trim(),
    sku: String(formData.get('sku') || '').trim(),
    base_unit: String(formData.get('base_unit') || '').trim(),
    category: String(formData.get('category') || '').trim(),
    min_stock_level: Number(formData.get('min_stock_level') || 0),
    rack_location: String(formData.get('rack_location') || '') || null,
    allow_fractional:
      formData.get('allow_fractional') === 'on',
    regulatory_category: String(formData.get('regulatory_category') || 'BEBAS') as
      | 'BEBAS'
      | 'BEBAS_TERBATAS'
      | 'KERAS'
      | 'PSIKOTROPIKA'
      | 'NARKOTIKA',
    kfa_code: String(formData.get('kfa_code') || '').trim() || null,
  }
}

export async function createProduct(formData: FormData) {
  const supabase = await createClient()
  await assertCanEdit(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const { error } = await supabase
    .from('products')
    .insert([{ ...enrich(formData), tenant_id: tenantId }])

  if (error) throw new Error(error.message)
}

export async function updateProduct(formData: FormData) {
  const supabase = await createClient()
  await assertCanEdit(supabase)

  const { data: { user } } = await supabase.auth.getUser()
  const tenantId = user!.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const id = String(formData.get('id'))
  if (!id) throw new Error('Missing product id')

  const { error } = await supabase
    .from('products')
    .update(enrich(formData))
    .eq('tenant_id', tenantId)
    .eq('id', id)

  if (error) throw new Error(error.message)
}