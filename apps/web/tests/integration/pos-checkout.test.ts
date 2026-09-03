import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'

// Next framework plumbing only — never Supabase or business logic.
const mocks = vi.hoisted(() => {
  class RedirectError extends Error {
    url: string
    constructor(url: string) {
      super(`NEXT_REDIRECT: ${url}`)
      this.url = url
    }
  }
  // In-memory stand-in for the browser cookie jar.
  const store = {
    cookies: new Map<string, string>(),
    getAll() {
      return [...this.cookies].map(([name, value]) => ({ name, value }))
    },
    set(name: string, value: string) {
      this.cookies.set(name, value)
    },
  }
  return { RedirectError, store }
})
// Next plumbing only (approved test design); Supabase and logic stay real.
// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock('next/headers', () => ({ cookies: async () => mocks.store }))
// oxlint-disable-next-line anti-slop/no-module-mocking
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new mocks.RedirectError(url)
  },
}))

import { createDraftSale } from '../../app/(app)/sales/new/actions'
import { forceCloseShift, openShift } from '../../app/(app)/shifts/actions'
import { paySale } from '../../app/(app)/sales/[id]/actions'
import { admin, destroyTenant, provisionTenant, seedProduct, signIn } from './helpers'

const PRICE = 10000

function fd(fields: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(fields)) f.set(k, v)
  return f
}

async function cartLines(fields: Record<string, string>): Promise<FormData> {
  return fd({
    sale_type: 'OTC',
    lines: JSON.stringify([{ kind: 'item', product_id: productId, qty: 8, unit_price: PRICE }]),
    ...fields,
  })
}

// Extract the sale id from a redirect to /sales/<id> (success contract).
function saleIdOf(url: string): string {
  const m = url.match(/\/sales\/([0-9a-f-]{36})/)
  if (!m) throw new Error(`Expected redirect to /sales/<id>, got: ${url}`)
  return m[1]
}

// Narrow a rejection to a redirect; fails the test on anything else.
function asRedirect(error: Error): { url: string } {
  if (!(error instanceof mocks.RedirectError)) throw new Error(`Expected redirect, got: ${error}`)
  return error
}

// Server actions end in redirect (they never resolve); return its URL.
async function redirectUrl(action: Promise<unknown>): Promise<string> {
  const outcome = await action.then(
    () => {
      throw new Error('Expected redirect')
    },
    (error: Error) => error
  )
  return asRedirect(outcome).url
}

let fx!: Awaited<ReturnType<typeof provisionTenant>>
let productId: string
let batchOldId: string // expiry 2026-09-30, qty 5 — FEFO picks this first
let batchNewId: string // expiry 2027-03-31, qty 5
let shiftId: string

beforeAll(async () => {
  fx = await provisionTenant('pos-checkout')
  await signIn(fx.email, fx.password)

  const product = await seedProduct(fx.tenantId, 'Paracetamol IT', [
    { batch_number: 'B-OLD', expiry_date: '2026-09-30', current_qty: 5 },
    { batch_number: 'B-NEW', expiry_date: '2027-03-31', current_qty: 5 },
  ])
  productId = product.id
  const a = admin()
  const { data: batches } = await a
    .from('product_batches')
    .select('id, batch_number')
    .eq('product_id', productId)
  batchOldId = batches!.find((b) => b.batch_number === 'B-OLD')!.id
  batchNewId = batches!.find((b) => b.batch_number === 'B-NEW')!.id
})

afterAll(async () => {
  // beforeAll can fail between tenant and user creation; still clean up.
  if (fx) await destroyTenant(fx)
})

describe('POS checkout: openShift → createDraftSale → paySale', () => {
  it('opens a shift for the cashier', async () => {
    await openShift(fd({ opening_cash: '500000' }))

    const { data } = await admin()
      .from('shifts')
      .select('id, status, opening_cash')
      .eq('tenant_id', fx.tenantId)
      .single()
    expect(data!.status).toBe('OPEN')
    expect(Number(data!.opening_cash)).toBe(500000)
    shiftId = data!.id
  })

  it('creates a DRAFT sale with correct totals, shift and items', async () => {
    const saleId = saleIdOf(await redirectUrl(createDraftSale(await cartLines({}))))

    const { data: sale } = await admin().from('sales').select('*').eq('id', saleId).single()
    expect(sale!.status).toBe('DRAFT')
    expect(Number(sale!.subtotal)).toBe(8 * PRICE)
    expect(Number(sale!.grand_total)).toBe(8 * PRICE)
    expect(sale!.shift_id).toBe(shiftId)
    expect(sale!.cashier_id).toBe(fx.userId)

    const { data: items } = await admin()
      .from('sale_items')
      .select('*')
      .eq('sale_id', saleId)
    expect(items).toHaveLength(1)
    expect(Number(items![0].qty_sold)).toBe(8)
    expect(items![0].product_batch_id).toBeNull() // backfilled at pay
  })

  it('pays the sale: FEFO allocation, batch deduction, payment row, PAID status', async () => {
    // Draft from the previous test.
    const { data: draft } = await admin()
      .from('sales')
      .select('id')
      .eq('tenant_id', fx.tenantId)
      .eq('status', 'DRAFT')
      .single()
    const saleId = draft!.id

    const payUrl = await redirectUrl(
      paySale(fd({ sale_id: saleId, payment_method: 'CASH', paid_amount: '100000' }))
    )
    expect(payUrl).toBe(`/sales/${saleId}`)

    const a = admin()
    const { data: sale } = await a.from('sales').select('*').eq('id', saleId).single()
    expect(sale!.status).toBe('PAID')
    expect(Number(sale!.paid_amount)).toBe(100000)
    expect(Number(sale!.change_amount)).toBe(100000 - 8 * PRICE)
    expect(sale!.sold_at).toBeTruthy()

    // FEFO: oldest expiry drained first, remainder from the newer batch.
    const { data: batches } = await a
      .from('product_batches')
      .select('id, current_qty')
      .in('id', [batchOldId, batchNewId])
    const old = batches!.find((b) => b.id === batchOldId)!
    const fresh = batches!.find((b) => b.id === batchNewId)!
    expect(Number(old.current_qty)).toBe(0)
    expect(Number(fresh.current_qty)).toBe(2)

    // Sale items backfilled with the first (FEFO) batch.
    const { data: items } = await a
      .from('sale_items')
      .select('product_batch_id, batch_number')
      .eq('sale_id', saleId)
    expect(items![0].product_batch_id).toBe(batchOldId)
    expect(items![0].batch_number).toBe('B-OLD')

    const { data: payments } = await a
      .from('sale_payments')
      .select('*')
      .eq('sale_id', saleId)
    expect(payments).toHaveLength(1)
    expect(payments![0].payment_method).toBe('CASH')
    expect(Number(payments![0].amount)).toBe(100000)
  })

  it('rejects a sale with insufficient stock and mutates nothing', async () => {
    const saleId = saleIdOf(await redirectUrl(createDraftSale(await cartLines({})))) // 8 units, 2 left in stock

    const payUrl = await redirectUrl(
      paySale(fd({ sale_id: saleId, payment_method: 'CASH', paid_amount: '999999' }))
    )
    expect(payUrl).toContain('Insufficient')

    // Stock untouched, sale still unpaid.
    const a = admin()
    const { data: batches } = await a
      .from('product_batches')
      .select('current_qty')
      .in('id', [batchOldId, batchNewId])
    expect(batches!.map((b) => Number(b.current_qty)).sort()).toEqual([0, 2])
    const { data: sale } = await a.from('sales').select('status').eq('id', saleId).single()
    expect(sale!.status).toBe('DRAFT')
  })

  it('blocks createDraftSale with no open shift', async () => {
    await expect(forceCloseShift(shiftId, 0)).resolves.toBeUndefined()
    await expect(createDraftSale(await cartLines({}))).rejects.toThrow('NO_OPEN_SHIFT')
  })
})
