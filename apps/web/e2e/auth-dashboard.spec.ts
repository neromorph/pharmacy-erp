import { test, expect } from '@playwright/test'
import { provisionTenant, destroyTenant, loginViaUi, type TenantFixture } from './fixtures'

// Phase 1: auth plus dashboard smoke.
// Selectors use roles and text only.
// Layout or class changes keep these tests green.
let fx: TenantFixture

test.beforeAll(async () => {
  fx = await provisionTenant('auth')
})

test.afterAll(async () => {
  await destroyTenant(fx)
})

test('happy path: valid user signs in and sees the dashboard', async ({ page }) => {
  await loginViaUi(page, fx.email, fx.password)
  // Login sends the user to the home page.
  await expect(page.getByRole('heading', { name: 'Dasbor' })).toBeVisible()
  // The home page shows all three KPI cards.
  await expect(page.getByText('Penjualan Harian')).toBeVisible()
  await expect(page.getByText('Stok Menipis')).toBeVisible()
  await expect(page.getByText('Mendekati Kedaluwarsa')).toBeVisible()
})

test('failure path: wrong password stays on login with an error', async ({ page }) => {
  await loginViaUi(page, fx.email, 'WrongPassword123!')
  // The app shows the error and stays on the login page.
  await expect(page.getByRole('alert')).toContainText('Invalid credentials')
  await expect(page.getByRole('heading', { name: 'Masuk' })).toBeVisible()
})
