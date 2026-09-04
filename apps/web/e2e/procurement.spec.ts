import { test, expect } from '@playwright/test'
import {
  provisionTenant,
  destroyTenant,
  seedProduct,
  seedSupplier,
  loginViaUi,
  selectOptionByText,
  type TenantFixture,
} from './fixtures'

// Phase 3: procurement draft PO.
// Selectors use roles, labels, placeholders, and text only.
let fx: TenantFixture

test.beforeAll(async () => {
  fx = await provisionTenant('po', 'OWNER')
  await seedSupplier(fx.tenantId, 'E2E Supplier')
  await seedProduct(fx.tenantId, 'E2E Amoxicillin', [
    { batch_number: 'E2E-PO-B1', expiry_date: '2028-06-01', current_qty: 50 },
  ])
})

test.afterAll(async () => {
  await destroyTenant(fx)
})

test('happy path: owner creates a draft PO', async ({ page }) => {
  await loginViaUi(page, fx.email, fx.password)
  await page.goto('/procurement/new')
  await expect(page.getByRole('heading', { name: 'Pesanan Pembelian Baru' })).toBeVisible()

  const poNumber = `PO-E2E-${Date.now()}`
  await page.getByLabel('Nomor PO').fill(poNumber)
  await selectOptionByText(page, 'Pemasok', 'E2E Supplier')
  await selectOptionByText(page, 'Produk', 'E2E Amoxicillin')
  await page.getByPlaceholder('Jumlah').fill('10')
  await page.getByPlaceholder('Harga').fill('8000')
  await page.getByRole('button', { name: 'Buat PO (Draft)' }).click()

  // Creation sends the user to the PO detail page with the PO number shown.
  await expect(page).toHaveURL(/\/procurement\/.+/)
  await expect(page.getByText(poNumber)).toBeVisible()
})

test('failure path: empty form does not create a PO', async ({ page }) => {
  await loginViaUi(page, fx.email, fx.password)
  await page.goto('/procurement/new')
  // Required fields block submit, so the page stays on the form.
  await page.getByRole('button', { name: 'Buat PO (Draft)' }).click()
  await expect(page).toHaveURL(/\/procurement\/new/)
  await expect(page.getByRole('heading', { name: 'Pesanan Pembelian Baru' })).toBeVisible()
})
