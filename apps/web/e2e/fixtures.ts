import { createClient } from '@supabase/supabase-js'
import type { Page } from '@playwright/test'

// Admin client for test setup only.
// It never runs inside app request paths.
export function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export type TenantFixture = {
  tenantId: string
  userId: string
  email: string
  password: string
}

// Make one tenant plus one user.
// Use role OWNER or CASHIER per test need.
export async function provisionTenant(
  label: string,
  role: 'OWNER' | 'CASHIER' = 'OWNER'
): Promise<TenantFixture> {
  const a = admin()
  const runId = `e2e-${label}-${Date.now()}`
  const { data: tenant, error } = await a
    .from('tenants')
    .insert({ name: `E2E ${runId}` })
    .select()
    .single()
  if (error) throw error

  const password = 'Test1234!'
  try {
    const { data, error: uErr } = await a.auth.admin.createUser({
      email: `${runId}@e2e.test`,
      password,
      email_confirm: true,
      app_metadata: { tenant_id: tenant.id, role },
    })
    if (uErr) throw uErr
    return { tenantId: tenant.id, userId: data.user.id, email: data.user.email!, password }
  } catch (e) {
    await a.from('tenants').delete().eq('id', tenant.id)
    throw e
  }
}

// Delete all rows the run made.
// Order follows foreign keys so deletes never block.
export async function destroyTenant(fx: TenantFixture) {
  const a = admin()
  const { tenantId, userId } = fx
  await a.from('sale_payments').delete().eq('tenant_id', tenantId)
  await a.from('sale_items').delete().eq('tenant_id', tenantId)
  await a.from('sales').delete().eq('tenant_id', tenantId)
  await a.from('shifts').delete().eq('tenant_id', tenantId)
  await a.from('purchase_order_items').delete().eq('tenant_id', tenantId)
  await a.from('purchase_orders').delete().eq('tenant_id', tenantId)
  await a.from('suppliers').delete().eq('tenant_id', tenantId)
  await a.from('staff').delete().eq('tenant_id', tenantId)
  await a.from('product_batches').delete().eq('tenant_id', tenantId)
  await a.from('products').delete().eq('tenant_id', tenantId)
  await a.from('tenants').delete().eq('id', tenantId)
  await a.auth.admin.deleteUser(userId)
}

// Add one product with batches.
// Tests use the product name to find the row.
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
  const { error: bErr } = await a
    .from('product_batches')
    .insert(batches.map((b) => ({ ...b, tenant_id: tenantId, product_id: product.id })))
  if (bErr) throw bErr
  return product
}

// Add one supplier.
// Tests use the supplier name to find the row.
export async function seedSupplier(tenantId: string, name: string) {
  const a = admin()
  const { data, error } = await a
    .from('suppliers')
    .insert({ tenant_id: tenantId, name })
    .select()
    .single()
  if (error) throw error
  return data
}

// Pick a dropdown option by its shown text.
// selectOption takes exact values only, so read the value first.
// Match by text keeps tests green when option suffixes change.
export async function selectOptionByText(page: Page, label: string, text: string) {
  const select = page.getByLabel(label)
  const value = await select.locator('option', { hasText: text }).first().getAttribute('value')
  await select.selectOption(value!)
}

// Sign in through the real login form.
// Uses labels only, so layout changes keep it green.
export async function loginViaUi(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Masuk' }).click()
}
