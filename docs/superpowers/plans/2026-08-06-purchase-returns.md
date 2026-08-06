# Purchase Returns, Aging, and Supplier Statement — Implementation Plan (AP v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend AP v1 with purchase returns (retur pembelian) as supplier credit notes, an aging summary on the payables page, and a per-supplier statement ledger.

**Architecture:** Same as v1. Two new tables (`purchase_returns`, `purchase_return_items`) plus one new column on `accounts_payable_payments`. Web reads/writes Supabase directly via SSR client and server actions. No NestJS.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres (RLS), TypeScript 6.x, pnpm 11.

## Global Constraints

- ASD-STE100 Simplified Technical English in all code, comments, docs, and chat.
- One tenant = one store branch. RLS via `app_metadata.tenant_id`. No `service_role` in request paths.
- TypeScript stays on 6.x. No new dependencies (CSV via Blob; print via `@media print`).
- Keep `pnpm -r test` and `pnpm -r build` green.
- Locked decisions (map `pharmacy-erp-vault/accounts-payable-v2/map.md`):
  - Return = separate credit note. Never mutate the original `accounts_payables` row.
  - Payout applies unapplied credit first; payment row stores `credit_applied_amount`.
  - Batch = user choice; decrement `product_batches.current_qty` in the server action (matches the receive flow, no trigger).
  - Aging buckets: Belum Jatuh Tempo / 1-30 / 31-60 / 61-90 / >90. Cards on `/finance/payables`. CSV of open payables with bucket column. Count all open payables.
  - Statement at `/suppliers/[id]`: opening, invoices (+), payments (− cash only), returns (− full total), closing; print-to-PDF A4; invoice rows link to `/procurement/[po_id]`.

---

### Task 1: Add purchase returns schema

**Files:**
- Create: `supabase/migrations/20260806000000_purchase_returns.sql`

**Interfaces:**
- Consumes: `suppliers`, `products`, `product_batches`, `accounts_payable_payments`
- Produces: `purchase_returns`, `purchase_return_items`, `accounts_payable_payments.credit_applied_amount`

- [ ] **Step 1: Write the migration**

Follow the guard pattern of `20260805000000_ap_auto_payable_from_receipt.sql` (`IF NOT EXISTS`, `DO` blocks for policies, `CREATE INDEX IF NOT EXISTS`).

```sql
-- AP v2: purchase returns act as supplier credit notes.
-- The credit offsets the supplier's global balance; it never mutates
-- the original accounts_payables row.

CREATE TABLE IF NOT EXISTS public.purchase_returns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    return_number VARCHAR(50) NOT NULL,
    reason TEXT NOT NULL,
    pbf_credit_note_number VARCHAR(100),
    total_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    applied_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    returned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, return_number)
);

CREATE TABLE IF NOT EXISTS public.purchase_return_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_return_id UUID NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE,
    qty_returned NUMERIC(14,3) NOT NULL,
    unit_cost NUMERIC(18,2) NOT NULL DEFAULT 0,
    line_total NUMERIC(18,2) NOT NULL DEFAULT 0
);

-- Payouts may settle part of an amount with unapplied supplier credit.
ALTER TABLE public.accounts_payable_payments
    ADD COLUMN IF NOT EXISTS credit_applied_amount NUMERIC(18,2) NOT NULL DEFAULT 0;

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

-- Policy: tenant isolation (same pattern as accounts_payables).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'purchase_returns'
          AND policyname = 'Tenant isolation for purchase_returns'
    ) THEN
        CREATE POLICY "Tenant isolation for purchase_returns" ON public.purchase_returns
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'purchase_return_items'
          AND policyname = 'Tenant isolation for purchase_return_items'
    ) THEN
        CREATE POLICY "Tenant isolation for purchase_return_items" ON public.purchase_return_items
            FOR ALL
            USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_purchase_returns_tenant_id ON public.purchase_returns (tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_returns_supplier_id ON public.purchase_returns (supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_return_id ON public.purchase_return_items (purchase_return_id);
CREATE INDEX IF NOT EXISTS idx_purchase_return_items_batch_id ON public.purchase_return_items (batch_id);
```

- [ ] **Step 2: Apply to remote and smoke-test**

`ssh -o ConnectTimeout=10 mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase -v ON_ERROR_STOP=1' < supabase/migrations/20260806000000_purchase_returns.sql` (the `-i` is REQUIRED).

Then verify: `SELECT to_regclass('public.purchase_returns');` returns the table name, and `SELECT credit_applied_amount FROM public.accounts_payable_payments LIMIT 1;` does not error (empty result is fine).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260806000000_purchase_returns.sql
git commit -m "feat(db): add purchase returns schema and credit applied column"
```

### Task 2: Add purchase return helpers and tests

**Files:**
- Create: `apps/web/lib/purchase-returns.ts`
- Create: `apps/web/lib/purchase-returns.test.ts`

**Interfaces:**
- Consumes: plain rows from Supabase
- Produces: `getAgingBucket()`, `splitPayout()`, `applyCreditFifo()`, `computeSupplierBalance()`, `buildAgingCsv()`, `buildStatementLedger()`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import {
  getAgingBucket,
  splitPayout,
  applyCreditFifo,
  computeSupplierBalance,
  buildStatementLedger,
} from './purchase-returns'

const T = '2026-09-01' // fixed "today" for the test

describe('getAgingBucket', () => {
  it('labels due and overdue payables by days past due', () => {
    expect(getAgingBucket('2026-09-05', T)).toBe('CURRENT')
    expect(getAgingBucket('2026-09-01', T)).toBe('CURRENT')
    expect(getAgingBucket('2026-08-20', T)).toBe('1-30')
    expect(getAgingBucket('2026-07-25', T)).toBe('31-60')
    expect(getAgingBucket('2026-06-20', T)).toBe('61-90')
    expect(getAgingBucket('2026-05-01', T)).toBe('90+')
  })
})

describe('splitPayout', () => {
  it('applies unapplied credit first, capped at the amount', () => {
    expect(splitPayout(10000, 3000)).toEqual({ creditApplied: 3000, cash: 7000 })
    expect(splitPayout(10000, 15000)).toEqual({ creditApplied: 10000, cash: 0 })
    expect(splitPayout(10000, 0)).toEqual({ creditApplied: 0, cash: 10000 })
  })
})

describe('applyCreditFifo', () => {
  it('consumes credits oldest first and returns updated applied amounts', () => {
    const notes = [
      { id: 'a', total: 10000, applied: 0 },
      { id: 'b', total: 20000, applied: 5000 },
    ]
    const updated = applyCreditFifo(notes, 12000)
    expect(updated).toEqual([
      { id: 'a', total: 10000, applied: 10000 },
      { id: 'b', total: 20000, applied: 7000 },
    ])
  })
})

describe('computeSupplierBalance', () => {
  it('subtracts unapplied credit from remaining payable totals', () => {
    const payables = [{ remaining: 50000 }, { remaining: 10000 }]
    const returns = [{ total: 15000, applied: 5000 }]
    expect(computeSupplierBalance(payables, returns)).toBe(50000)
  })
})

describe('buildStatementLedger', () => {
  it('produces a running balance with debit and credit columns', () => {
    const ledger = buildStatementLedger({
      invoices: [{ date: '2026-08-01', ref: 'INV-1', amount: 60000 }],
      payments: [{ date: '2026-08-20', ref: 'PAY-1', amount: 40000, creditApplied: 0 }],
      returns: [{ date: '2026-08-25', ref: 'RTR-1', amount: 20000 }],
    })
    expect(ledger[0]).toMatchObject({ balance: 60000, debit: 60000 })
    expect(ledger[1]).toMatchObject({ balance: 20000, credit: 40000 })
    expect(ledger[2]).toMatchObject({ balance: 0, credit: 20000 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @pharmacy/web test -- --run apps/web/lib/purchase-returns.test.ts`
Expected: fail — module does not exist.

- [ ] **Step 3: Implement the helpers**

```ts
export type AgingBucket = 'CURRENT' | '1-30' | '31-60' | '61-90' | '90+'

export function getAgingBucket(dueDate: string, today: string): AgingBucket {
  const due = new Date(dueDate)
  const now = new Date(today)
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate())
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((startOfToday.getTime() - startOfDue.getTime()) / 86400000)
  if (days <= 0) return 'CURRENT'
  if (days <= 30) return '1-30'
  if (days <= 60) return '31-60'
  if (days <= 90) return '61-90'
  return '90+'
}

export interface CreditSplit {
  creditApplied: number
  cash: number
}

export function splitPayout(total: number, unappliedCredit: number): CreditSplit {
  const creditApplied = Math.max(0, Math.min(unappliedCredit, total))
  return { creditApplied, cash: total - creditApplied }
}

export interface CreditNote {
  id: string
  total: number
  applied: number
}

export function applyCreditFifo(notes: CreditNote[], amount: number): CreditNote[] {
  let remaining = amount
  return notes.map((n) => {
    const available = n.total - n.applied
    const use = Math.max(0, Math.min(remaining, available))
    remaining -= use
    return { ...n, applied: n.applied + use }
  })
}

export function computeSupplierBalance(
  payables: { remaining: number }[],
  returns: { total: number; applied: number }[]
): number {
  const owed = payables.reduce((s, p) => s + Number(p.remaining || 0), 0)
  const unapplied = returns.reduce((s, r) => s + (Number(r.total || 0) - Number(r.applied || 0)), 0)
  return owed - unapplied
}

export interface LedgerRow {
  date: string
  ref: string
  description: string
  debit: number
  credit: number
  balance: number
}

export function buildStatementLedger(input: {
  invoices: { date: string; ref: string; description?: string; amount: number }[]
  payments: { date: string; ref: string; description?: string; amount: number; creditApplied: number }[]
  returns: { date: string; ref: string; description?: string; amount: number }[]
}): LedgerRow[] {
  const rows: Omit<LedgerRow, 'balance'>[] = [
    ...input.invoices.map((r) => ({
      date: r.date, ref: r.ref, description: r.description || 'Invoice', debit: Number(r.amount), credit: 0,
    })),
    ...input.payments.map((r) => ({
      date: r.date, ref: r.ref, description: r.description || 'Payment', debit: 0,
      credit: Number(r.amount) - Number(r.creditApplied || 0),
    })),
    ...input.returns.map((r) => ({
      date: r.date, ref: r.ref, description: r.description || 'Return', debit: 0, credit: Number(r.amount),
    })),
  ]
  rows.sort((a, b) => a.date.localeCompare(b.date))
  let balance = 0
  return rows.map((r) => {
    balance += r.debit - r.credit
    return { ...r, balance }
  })
}
```

- [ ] **Step 4: Run test and build**

Run: `pnpm --filter @pharmacy/web test -- --run apps/web/lib/purchase-returns.test.ts` then `pnpm -r build`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/purchase-returns.ts apps/web/lib/purchase-returns.test.ts
git commit -m "feat(web): add purchase return and aging helpers"
```

### Task 3: Build the purchase return UI

**Files:**
- Create: `apps/web/app/procurement/returns/page.tsx` (list)
- Create: `apps/web/app/procurement/returns/new/page.tsx` (form)
- Create: `apps/web/app/procurement/returns/new/actions.ts` (`createPurchaseReturn`)
- Create: `apps/web/app/procurement/returns/[id]/page.tsx` (detail)
- Modify: `apps/web/app/layout.tsx` (nav link)

**Interfaces:**
- Consumes: `purchase_returns`, `purchase_return_items`, `products`, `product_batches`, `suppliers`
- Produces: server pages + one server action

- [ ] **Step 1: Write the server action**

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'

export async function createPurchaseReturn(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const tenantId = user.app_metadata?.tenant_id
  if (!tenantId) throw new Error('No tenant context')

  const supplierId = String(formData.get('supplier_id') || '')
  const returnNumber = String(formData.get('return_number') || '').trim()
  const reason = String(formData.get('reason') || '').trim()
  const pbfCreditNoteNumber = String(formData.get('pbf_credit_note_number') || '').trim() || null
  const returnedAt = String(formData.get('returned_at') || new Date().toISOString())
  const notes = String(formData.get('notes') || '').trim() || null

  if (!supplierId) throw new Error('Missing supplier')
  if (!returnNumber) throw new Error('Missing return number')
  if (!reason) throw new Error('Missing reason')

  // Items arrive as parallel arrays (same pattern as the receive form).
  const productIds = formData.getAll('product_id')
  const batchIds = formData.getAll('batch_id')
  const qtyReturned = formData.getAll('qty_returned').map(Number)
  const unitCosts = formData.getAll('unit_cost').map(Number)

  if (productIds.length === 0) throw new Error('Add at least one item')

  const items = productIds.map((productId, i) => ({
    tenant_id: tenantId,
    product_id: String(productId),
    batch_id: String(batchIds[i] || ''),
    qty_returned: qtyReturned[i] || 0,
    unit_cost: unitCosts[i] || 0,
  }))

  const total = items.reduce((s, it) => s + it.qty_returned * it.unit_cost, 0)
  if (total <= 0) throw new Error('Return total must be positive')

  // Check stock before insert: qty_returned <= batch current_qty.
  const batchIdsToCheck = [...new Set(items.map((it) => it.batch_id))]
  const { data: batches, error: batchErr } = await supabase
    .from('product_batches')
    .select('id, batch_number, expiry_date, current_qty')
    .in('id', batchIdsToCheck)
  if (batchErr || !batches) throw new Error('Failed to load batches')

  const batchMap = new Map(batches.map((b) => [b.id, b]))
  for (const it of items) {
    const batch = batchMap.get(it.batch_id)
    if (!batch) throw new Error('Batch not found')
    if (Number(it.qty_returned) > Number(batch.current_qty)) {
      throw new Error(`Return exceeds stock for batch ${batch.batch_number}`)
    }
  }

  // Insert header first, then items (matches the receive flow).
  const { data: header, error: hErr } = await supabase
    .from('purchase_returns')
    .insert({
      tenant_id: tenantId,
      supplier_id: supplierId,
      return_number: returnNumber,
      reason,
      pbf_credit_note_number: pbfCreditNoteNumber,
      total_amount: total,
      returned_at: returnedAt,
      notes,
    })
    .select()
    .single()
  if (hErr) throw new Error(hErr.message)

  const itemRows = items.map((it) => {
    const batch = batchMap.get(it.batch_id)!
    return {
      tenant_id: tenantId,
      purchase_return_id: header.id,
      product_id: it.product_id,
      batch_id: it.batch_id,
      batch_number: batch.batch_number,
      expiry_date: batch.expiry_date,
      qty_returned: it.qty_returned,
      unit_cost: it.unit_cost,
      line_total: it.qty_returned * it.unit_cost,
    }
  })
  const { error: iErr } = await supabase.from('purchase_return_items').insert(itemRows)
  if (iErr) throw new Error(iErr.message)

  // Decrement each batch by the returned quantity.
  for (const it of items) {
    const { error: uErr } = await supabase
      .from('product_batches')
      .update({ current_qty: Number(batchMap.get(it.batch_id)!.current_qty) - it.qty_returned })
      .eq('id', it.batch_id)
    if (uErr) throw new Error(uErr.message)
  }

  redirect(`/procurement/returns/${header.id}`)
}
```

- [ ] **Step 2: Write the new-return form page**

`/procurement/returns/new/page.tsx`:
- Role gate: `getUserRole(supabase)`; deny `CASHIER`.
- Fetch suppliers and products (with batches where `current_qty > 0`) as props.
- Client component `return-form.tsx` (inline in the same file as `'use client'` is not possible with server fetch — create `apps/web/app/procurement/returns/new/return-form.tsx`) with:
  - Supplier select, return_number input (placeholder `RTR-2608-001`), reason select (EXPIRED / DAMAGED / RECALL), pbf_credit_note_number input, returned_at date input.
  - Dynamic item rows: product select → batch select (filtered to that product, showing `batch_number (ED date, qty)`), qty input, unit_cost input. "Add item" button.
  - Submit calls `createPurchaseReturn`.

- [ ] **Step 3: Write the list and detail pages**

List `/procurement/returns/page.tsx`: table of returns (return_number, supplier name, reason, returned_at, total, applied, status = derived `applied >= total ? 'APPLIED' : 'OPEN'`), each row links to detail.

Detail `/procurement/returns/[id]/page.tsx`: header info + items table (product name, batch, expiry, qty, unit cost, line total) + applied/remaining credit display.

- [ ] **Step 4: Add nav link**

In `apps/web/app/layout.tsx` under the Procurement area: `{ href: '/procurement/returns', label: 'Returns' }`.

- [ ] **Step 5: Run tests and build**

Run: `pnpm -r test` then `pnpm -r build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/procurement/returns apps/web/app/layout.tsx
git commit -m "feat(web): add purchase return pages and create action"
```

### Task 4: Add aging cards, CSV, and credit-first payout

**Files:**
- Modify: `apps/web/app/finance/payables/page.tsx`
- Modify: `apps/web/app/finance/payables/actions.ts`
- Create: `apps/web/app/finance/payables/aging-cards.tsx` (server render of bucket cards)
- Create: `apps/web/app/finance/payables/aging-csv-button.tsx` (client)

**Interfaces:**
- Consumes: helpers from Task 2
- Produces: aging summary + CSV download + credit-aware payout

- [ ] **Step 1: Rewrite the payables page**

- Fetch payables with `supplier_id` and supplier name (join or separate fetch).
- Compute bucket per row with `getAgingBucket(due_date, today)`; render `aging-cards.tsx` with five cards: Belum Jatuh Tempo, 1-30, 31-60, 61-90, >90 (count + total amount each), above the invoice table.
- Fetch unapplied credit per supplier (sum of `total_amount − applied_amount` over that supplier's `purchase_returns`); show a small "Credit Rp X" chip on rows whose supplier has unapplied credit, so the cashier knows the payout will apply credit first.
- Pass the payables to `aging-csv-button.tsx` (client) which builds the CSV with `buildAgingCsv` (columns: supplier, invoice, due date, total, paid, remaining, status, bucket) and downloads as `aging-YYYY-MM-DD.csv`.

- [ ] **Step 2: Update `postPayout` for credit-first**

In `apps/web/app/finance/payables/actions.ts`:
- Fetch the payable with `supplier_id` added.
- Fetch `purchase_returns` for that supplier (`total_amount, applied_amount`), sum unapplied credit.
- `const { creditApplied, cash } = splitPayout(amount, unappliedCredit)`.
- Insert payment with `credit_applied_amount: creditApplied`.
- If `creditApplied > 0`: load the supplier's credit notes ordered by `returned_at`, run `applyCreditFifo(notes, creditApplied)`, and update each changed note's `applied_amount`.
- Keep the existing recompute of `paid_amount` / `remaining_amount` / `status` (paid total = sum of `amount`, which includes credit — correct, since the invoice is settled).

- [ ] **Step 3: Run tests and build**

Run: `pnpm -r test` then `pnpm -r build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/finance/payables
git commit -m "feat(web): add aging summary, csv export, and credit-first payout"
```

### Task 5: Add supplier statement

**Files:**
- Create: `apps/web/app/suppliers/[id]/page.tsx`

**Interfaces:**
- Consumes: helpers from Task 2
- Produces: supplier profile + statement ledger page with A4 print

- [ ] **Step 1: Implement the page**

`/suppliers/[id]/page.tsx`:
- Role gate: `getUserRole(supabase)`; deny `CASHIER`.
- Fetch: supplier row; payables for supplier with `invoice_number`, `due_date`, `receipt_total_amount`, and `goods_receipts(received_at, purchase_order_id)`; payments joined to payables; `purchase_returns` for supplier with `returned_at`.
- Build the ledger with `buildStatementLedger`:
  - invoices → `{ date: received_at, ref: invoice_number, description: 'Invoice', amount: receipt_total_amount }`
  - payments → `{ date: paid_at, ref: method, description: notes, amount, creditApplied: credit_applied_amount }`
  - returns → `{ date: returned_at, ref: return_number, description: reason, amount: total_amount }`
- Render two tabs (client-side tab switch or two sections; simplest: one page, "Statement" section below profile):
  - Profile: name, phone, payment terms, license.
  - Statement table: Date / Reference / Description / Debit / Credit / Balance. Closing balance row; if negative show "(credit balance)".
- Each invoice row links to `/procurement/${purchase_order_id}`.
- Print: add a Print button (client, `window.print()`) and an A4 `@media print` stylesheet (match the receipt page pattern: hide nav/buttons, monospace-adjacent table, no overflow).

- [ ] **Step 2: Link suppliers list to the statement**

In `apps/web/app/suppliers/page.tsx`, make each supplier row name link to `/suppliers/${id}`.

- [ ] **Step 3: Run tests and build**

Run: `pnpm -r test` then `pnpm -r build`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/suppliers
git commit -m "feat(web): add supplier statement with print layout"
```

## Self-review

### Spec coverage

- Credit note model (Q1) = Task 1 schema + Task 3 action (no payable mutation) + Task 4 credit-first payout.
- Already-PAID credit (Q1.2) = unapplied credit persists on `purchase_returns`; payout applies it later (Task 4).
- Number + reason + pbf credit note number (Q1.3) = Task 3 form fields.
- User-choice batch (Q1.4) = Task 3 batch picker + stock guard + decrement.
- Aging (Q2) = Task 4 cards, buckets, CSV, all open payables.
- Statement (Q3) = Task 5: five rows, linked invoices, A4 print.

### Placeholder scan

- No TBD, no TODO. All SQL and TS inline.
- Task 4 Step 2 describes changes to an existing action; the worker must read the current `postPayout` and keep its validations.

### Type consistency

- Helper names (`getAgingBucket`, `splitPayout`, `applyCreditFifo`, `computeSupplierBalance`, `buildStatementLedger`) defined once in Task 2, used in Tasks 3-5.
- Ledger rule matches the locked decision: payments credit = `amount − creditApplied`; returns credit = full total.

### Known simplification

- No approval workflow for returns (direct insert by non-cashier roles). Add when PBF credit notes need sign-off.
- Statement is full history with opening = 0; no date-range filter. Add when statements grow large.
- `return_number` is manual input with a DB uniqueness guard. Auto-sequence when numbering rules change.
