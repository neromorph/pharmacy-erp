import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '../../utils/supabase/server'

// Admin (service_role) helper: provisioning, seeding, cleanup. Never used
// inside request paths — here it stands in for the provision script + a DB console.
export function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Real password sign-in. The session cookies land in the in-memory store
// that the mocked next/headers returns, exactly like a browser session.
export async function signIn(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export type TenantFixture = { tenantId: string; userId: string; email: string; password: string }

// Fresh tenant + OWNER user per run. Unique names keep runs isolated.
export async function provisionTenant(label: string): Promise<TenantFixture> {
  const a = admin()
  const runId = `it-${label}-${Date.now()}`
  const { data: tenant, error } = await a
    .from('tenants')
    .insert({ name: `IT ${runId}` })
    .select()
    .single()
  if (error) throw error

  const password = 'Test1234!'
  try {
    const { data, error: uErr } = await a.auth.admin.createUser({
      email: `${runId}@integration.test`,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: tenant.id, role: 'OWNER' },
    })
    if (uErr) throw uErr

    return { tenantId: tenant.id, userId: data.user.id, email: data.user.email!, password }
  } catch (e) {
    // Don't leak the tenant when user creation fails.
    await a.from('tenants').delete().eq('id', tenant.id)
    throw e
  }
}

// Delete every row the run created. Ordered so FKs never block.
export async function destroyTenant(fx: TenantFixture) {
  const a = admin()
  const { tenantId, userId } = fx
  await a.from('satusehat_submissions').delete().eq('tenant_id', tenantId)
  await a.from('sale_payments').delete().eq('tenant_id', tenantId)
  await a.from('sale_items').delete().eq('tenant_id', tenantId)
  await a.from('sales').delete().eq('tenant_id', tenantId)
  await a.from('shifts').delete().eq('tenant_id', tenantId)
  await a.from('staff').delete().eq('tenant_id', tenantId)
  await a.from('product_batches').delete().eq('tenant_id', tenantId)
  await a.from('products').delete().eq('tenant_id', tenantId)
  await a.from('tenants').delete().eq('id', tenantId)
  await a.auth.admin.deleteUser(userId)
}

// Product + batches seeded through the service role (bypasses RLS).
export async function seedProduct(
  tenantId: string,
  name: string,
  batches: { batch_number: string; expiry_date: string; current_qty: number }[]
) {
  const a = admin()
  const { data: product, error } = await a
    .from('products')
    .insert({
      tenant_id: tenantId,
      name,
      sku: name.toUpperCase().replace(/\s+/g, '-'),
      base_unit: 'TABLET',
      category: 'OBAT BEBAS',
    })
    .select()
    .single()
  if (error) throw error

  const { error: bErr } = await a.from('product_batches').insert(
    batches.map((b) => ({ ...b, tenant_id: tenantId, product_id: product.id }))
  )
  if (bErr) throw bErr
  return product
}
