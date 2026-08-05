# Accounts Payable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AP v1 for payable balance, due date, and partial or full payout from goods receipts.

**Architecture:** Keep AP as a small finance layer on top of existing procurement data. Create one payable header row per `goods_receipts` row, plus one payout table for cash movement history. The web app reads from Supabase directly, uses one finance page, and keeps return handling out of scope.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres, Supabase SSR client, TypeScript 6.x, pnpm 11.

## Global Constraints

- ASD-STE100 Simplified Technical English in all code, comments, docs, and chat.
- One tenant = one pharmacy store branch.
- RLS via `app_metadata.tenant_id`; no `service_role` in request paths.
- TypeScript stays on 6.x.
- Do not add new dependencies for what current tools can do.
- Keep `pnpm -r test` and `pnpm -r build` green.

---

### Task 1: Add AP schema and RLS

**Files:**
- Modify: `supabase/migrations/20250803000000_create_master_data.sql`
- Test: remote DB apply check against `accounts_payables` and `accounts_payable_payments`

**Interfaces:**
- Consumes: `goods_receipts`, `suppliers`, `payment_terms_days`
- Produces: `accounts_payables`, `accounts_payable_payments`

- [ ] **Step 1: Write failing schema check in comments first**

```sql
-- AP v1 needs one payable header row per goods receipt.
-- AP v1 needs one payout row per partial or full payment.
```

- [ ] **Step 2: Add AP tables and constraints**

```sql
CREATE TYPE public.accounts_payable_status AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'OVERDUE');

CREATE TABLE public.accounts_payables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE RESTRICT,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(100) NOT NULL,
    receipt_total_amount NUMERIC(18,2) NOT NULL,
    paid_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    remaining_amount NUMERIC(18,2) NOT NULL,
    due_date DATE NOT NULL,
    status public.accounts_payable_status NOT NULL DEFAULT 'UNPAID',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (goods_receipt_id)
);

CREATE TABLE public.accounts_payable_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    accounts_payable_id UUID NOT NULL REFERENCES public.accounts_payables(id) ON DELETE CASCADE,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    amount NUMERIC(18,2) NOT NULL,
    method TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 3: Add RLS and indexes**

```sql
ALTER TABLE public.accounts_payables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_payable_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for accounts_payables" ON public.accounts_payables
    FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY "Tenant isolation for accounts_payable_payments" ON public.accounts_payable_payments
    FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE INDEX idx_accounts_payables_tenant_id ON public.accounts_payables (tenant_id);
CREATE INDEX idx_accounts_payables_supplier_id ON public.accounts_payables (supplier_id);
CREATE INDEX idx_accounts_payables_due_date ON public.accounts_payables (due_date);
CREATE INDEX idx_accounts_payables_status ON public.accounts_payables (status);
CREATE INDEX idx_accounts_payable_payments_payable_id ON public.accounts_payable_payments (accounts_payable_id);
```

- [ ] **Step 4: Add due date rule comments**

```sql
-- due_date = goods_receipts.received_at::date + suppliers.payment_terms_days
-- remaining_amount = receipt_total_amount - SUM(payments.amount)
```

- [ ] **Step 5: Apply migration and verify tables**

Run:
```bash
pnpm -r test
pnpm -r build
```
Then apply migration on remote DB and verify the two new tables exist.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20250803000000_create_master_data.sql
git commit -m "feat(db): add accounts payable schema"
```

### Task 2: Add AP helper logic and tests

**Files:**
- Create: `apps/web/lib/accounts-payable.ts`
- Create: `apps/web/lib/accounts-payable.test.ts`

**Interfaces:**
- Consumes: AP rows from Supabase
- Produces: `getPayableStatus()`, `formatPayableSummary()`, `isPayableOverdue()`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from 'vitest'
import { getPayableStatus, isPayableOverdue } from './accounts-payable'

describe('accounts payable', () => {
  it('marks unpaid, partial, paid, overdue', () => {
    expect(getPayableStatus({ paidAmount: 0, remainingAmount: 100, dueDate: '2026-08-01', now: '2026-08-02' })).toBe('OVERDUE')
    expect(getPayableStatus({ paidAmount: 20, remainingAmount: 80, dueDate: '2026-08-10', now: '2026-08-01' })).toBe('PARTIAL')
    expect(getPayableStatus({ paidAmount: 0, remainingAmount: 100, dueDate: '2026-08-10', now: '2026-08-01' })).toBe('UNPAID')
    expect(getPayableStatus({ paidAmount: 100, remainingAmount: 0, dueDate: '2026-08-10', now: '2026-08-01' })).toBe('PAID')
  })

  it('flags overdue only when balance remains', () => {
    expect(isPayableOverdue({ remainingAmount: 0, dueDate: '2026-08-01', now: '2026-08-02' })).toBe(false)
    expect(isPayableOverdue({ remainingAmount: 50, dueDate: '2026-08-01', now: '2026-08-02' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify fail**

Run:
```bash
pnpm --filter @pharmacy/web test -- --run apps/web/lib/accounts-payable.test.ts
```
Expected: fail because file and exports do not exist.

- [ ] **Step 3: Write minimal helper code**

```ts
export type PayableStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'

export function isPayableOverdue(input: { remainingAmount: number; dueDate: string; now: string }): boolean {
  return input.remainingAmount > 0 && new Date(input.now).toDateString() > new Date(input.dueDate).toDateString()
}

export function getPayableStatus(input: { paidAmount: number; remainingAmount: number; dueDate: string; now: string }): PayableStatus {
  if (input.remainingAmount <= 0) return 'PAID'
  if (isPayableOverdue(input)) return 'OVERDUE'
  if (input.paidAmount > 0) return 'PARTIAL'
  return 'UNPAID'
}
```

- [ ] **Step 4: Run test and build**

Run:
```bash
pnpm --filter @pharmacy/web test -- --run apps/web/lib/accounts-payable.test.ts
pnpm -r build
```
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/accounts-payable.ts apps/web/lib/accounts-payable.test.ts
git commit -m "feat(web): add payable status helpers"
```

### Task 3: Build `/finance/payables` screen

**Files:**
- Create: `apps/web/app/finance/payables/page.tsx`
- Create: `apps/web/app/finance/payables/actions.ts`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: `accounts_payables`, `accounts_payable_payments`, `suppliers`
- Produces: list view, detail row, payout action, nav link

- [ ] **Step 1: Write page test with one render target**

Use a small server component test or route smoke test that checks the page renders the month filter and the `Download`-less AP controls. Keep it local to the page.

- [ ] **Step 2: Implement list view**

```tsx
export default async function PayablesPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase
    .from('accounts_payables')
    .select('id, invoice_number, due_date, status, receipt_total_amount, paid_amount, remaining_amount, supplier:suppliers(name)')
    .order('due_date', { ascending: true })

  return (
    <div>
      <h1>Accounts Payable</h1>
      {/* month filter + table + payout form */}
    </div>
  )
}
```

- [ ] **Step 3: Add payout server action**

```ts
'use server'

export async function postPayout(formData: FormData) {
  const payableId = String(formData.get('accounts_payable_id') || '')
  const amount = Number(formData.get('amount') || 0)
  const method = String(formData.get('method') || 'CASH')
  const notes = String(formData.get('notes') || '').trim() || null
  // insert payment row, then refresh payable balances
}
```

- [ ] **Step 4: Add nav link**

```ts
{ href: '/finance/payables', label: 'Payables' },
```

- [ ] **Step 5: Run tests and build**

Run:
```bash
pnpm -r test
pnpm -r build
```
Expected: AP page renders and build stays green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/finance/payables/page.tsx apps/web/app/finance/payables/actions.ts apps/web/app/layout.tsx
git commit -m "feat(web): add accounts payable screen"
```

### Task 4: Wire payable balance refresh

**Files:**
- Modify: `apps/web/app/finance/payables/actions.ts`
- Modify: `apps/web/app/finance/payables/page.tsx`

**Interfaces:**
- Consumes: payout row insert
- Produces: refreshed payable balance and status after payout

- [ ] **Step 1: Add balance recompute after payout**

```ts
const { data: payments } = await supabase
  .from('accounts_payable_payments')
  .select('amount')
  .eq('accounts_payable_id', payableId)

const paidAmount = (payments || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
const remainingAmount = receiptTotalAmount - paidAmount
```

- [ ] **Step 2: Update status rules**

```ts
const status = remainingAmount <= 0
  ? 'PAID'
  : isOverdue
    ? 'OVERDUE'
    : paidAmount > 0
      ? 'PARTIAL'
      : 'UNPAID'
```

- [ ] **Step 3: Verify payout flow**

Run:
```bash
pnpm -r test
pnpm -r build
```
Expected: payable row updates after partial payout and full payout.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/finance/payables/actions.ts apps/web/app/finance/payables/page.tsx
git commit -m "feat(web): refresh payable status after payout"
```

## Self-review

### Spec coverage

- AP v1 scope = done in Task 1 and Task 3.
- Source = `goods_receipts` = done in Task 1.
- Partial and full payout = done in Task 1, 3, 4.
- Exclude retur pembelian = locked in Global Constraints and Task 1 notes.
- Finance UI at `/finance/payables` = done in Task 3.
- Due date from supplier terms = done in Task 1.

### Placeholder scan

- No TBD.
- No TODO.
- No vague validation steps.
- No undefined helper names.

### Type consistency

- `PayableStatus` is defined once in Task 2 and reused in Task 4.
- `postPayout()` is the only action name in Task 3 and Task 4.
- File names match task interfaces.
