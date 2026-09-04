import { test, expect } from '@playwright/test'
import {
  provisionTenant,
  destroyTenant,
  seedProduct,
  loginViaUi,
  selectOptionByText,
  type TenantFixture,
} from './fixtures'

// Phase 2: POS sale from shift open to paid.
// Selectors use roles, labels, placeholders, and text only.
let fx: TenantFixture

test.beforeAll(async () => {
  fx = await provisionTenant('pos', 'CASHIER')
  await seedProduct(fx.tenantId, 'E2E Paracetamol', [
    { batch_number: 'E2E-B1', expiry_date: '2028-01-01', current_qty: 100 },
  ])
})

test.afterAll(async () => {
  await destroyTenant(fx)
})

test('happy path: cashier opens a shift, drafts a sale, and takes payment', async ({
  page,
}) => {
  await loginViaUi(page, fx.email, fx.password)

  // Open a shift first. POS blocks sales with no open shift.
  await page.goto('/shifts/new')
  await page.getByLabel(/Opening Cash/).fill('100000')
  await page.getByRole('button', { name: 'Start Shift' }).click()
  await expect(page).toHaveURL(/\/shifts/)

  // Build the cart.
  await page.goto('/sales/new')
  await expect(page.getByRole('heading', { name: 'Transaksi Baru' })).toBeVisible()
  await selectOptionByText(page, 'Produk', 'E2E Paracetamol')
  await page.getByPlaceholder('Jumlah').fill('2')
  await page.getByPlaceholder('Harga').fill('5000')
  await page.getByRole('button', { name: 'Buat Draft Transaksi' }).click()

  // Draft creation sends the user to the sale detail page.
  await expect(page).toHaveURL(/\/sales\/.+/)

  // Pay the draft in full with cash.
  await page.getByLabel('Metode pembayaran').selectOption('CASH')
  await page.getByLabel('Jumlah dibayar').fill('10000')
  await page.getByRole('button', { name: /Selesaikan Transaksi/ }).click()

  // The sale now shows the PAID badge.
  await expect(page.getByText('PAID').first()).toBeVisible()
})

test('failure path: POS with no open shift shows the open-shift block', async ({
  page,
  browser,
}) => {
  // Use a fresh tenant with no shift, in a clean session.
  const bare = await provisionTenant('pos-noshift', 'CASHIER')
  const ctx = await browser.newContext()
  const solo = await ctx.newPage()
  try {
    await loginViaUi(solo, bare.email, bare.password)
    await solo.goto('/sales/new')
    // The page blocks the sale and points to shift open.
    await expect(solo.getByRole('heading', { name: 'Tidak Ada Shift Aktif' })).toBeVisible()
    await expect(solo.getByRole('link', { name: 'Buka Shift' })).toBeVisible()
  } finally {
    await ctx.close()
    await destroyTenant(bare)
  }
  void page
})
