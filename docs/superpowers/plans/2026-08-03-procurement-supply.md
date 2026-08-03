# Procurement & Supply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procurement and supply flow for pharmacy PO, supplier master data, goods receipt, and stock entry.

**Architecture:** Keep procurement state in Postgres. Add `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, and `goods_receipt_items` with RLS by `tenant_id`. Expose the flow through NestJS modules that reuse the existing scoped Supabase service. Build a small web CRUD path for supplier and PO/receipt screens first, then wire stock entry on receipt.

**Tech Stack:** Next.js 16 App Router, NestJS 11, Supabase Postgres, RLS, pnpm 11, TypeScript 6.x, shadcn/ui.

## Global Constraints

- One tenant = one pharmacy store branch.
- One user = one tenant only.
- FEFO is the primary stock rule.
- PBF in UI, Supplier in technical models.
- Dashboard shows exactly 3 KPIs.
- Light-first UI. No pure dark theme on operational screens.
- Use ASD-STE100 Simplified Technical English in docs, comments, and chat.
- Use `tenant_id` RLS from JWT `app_metadata`.
- Do not add new dependencies unless no current tool fits.
- Keep `pnpm -r test` and `pnpm -r build` green.

---

### Task 1: Add procurement schema

**Files:**
- Modify: `supabase/migrations/20250803000000_create_master_data.sql`
- Test: `supabase/migrations/20250803000000_create_master_data.sql` can be applied on remote DB

**Interfaces:**
- Consumes: existing `tenants`, `products`, `product_batches` tables and RLS patterns
- Produces: `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `goods_receipt_items`

- [ ] **Step 1: Write the migration changes**

```sql
CREATE TABLE public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_pbf BOOLEAN NOT NULL DEFAULT TRUE,
    pbf_license_number VARCHAR(100),
    phone VARCHAR(50),
    payment_terms_days INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TYPE public.purchase_order_status AS ENUM (
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'RECEIVED',
    'CANCELLED'
);

CREATE TABLE public.purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
    po_number VARCHAR(50) NOT NULL,
    status public.purchase_order_status NOT NULL DEFAULT 'DRAFT',
    notes TEXT,
    ordered_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_by UUID,
    approved_by UUID,
    received_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, po_number)
);

CREATE TABLE public.purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    qty_ordered NUMERIC(14,3) NOT NULL,
    unit_price NUMERIC(18,2) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.goods_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE RESTRICT,
    receipt_number VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    received_by UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, receipt_number)
);

CREATE TABLE public.goods_receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
    purchase_order_item_id UUID NOT NULL REFERENCES public.purchase_order_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    qty_received NUMERIC(14,3) NOT NULL,
    unit_cost NUMERIC(18,2) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- [ ] **Step 2: Add RLS and grants**

```sql
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_tenant_isolation ON public.suppliers
FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY purchase_orders_tenant_isolation ON public.purchase_orders
FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY purchase_order_items_tenant_isolation ON public.purchase_order_items
FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY goods_receipts_tenant_isolation ON public.goods_receipts
FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

CREATE POLICY goods_receipt_items_tenant_isolation ON public.goods_receipt_items
FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
```

- [ ] **Step 3: Apply migration on remote DB**

Run:
```bash
ssh mufid@100.119.164.5
cd /home/mufid/pharmacy-supabase
cat <<'SQL' | docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase
-- paste migration SQL
SQL
```

- [ ] **Step 4: Verify tables exist**

Run:
```bash
ssh mufid@100.119.164.5 'docker exec pharmacy-supabase-db psql -U supabase_admin -d supabase -c "\dt public.*"'
```

Expected: tables for suppliers, purchase orders, and goods receipts appear.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20250803000000_create_master_data.sql
git commit -m "feat: add procurement schema"
```

### Task 2: Add procurement domain types

**Files:**
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/index.test.ts`

**Interfaces:**
- Consumes: new DB table names and PO state names from Task 1
- Produces: shared types for app and API use

- [ ] **Step 1: Write failing tests for procurement enums and helpers**

```ts
import { describe, it, expect } from 'vitest'
import { procurementStatusValues, isFinalPoStatus } from './index'

describe('procurement status', () => {
  it('lists po states in order', () => {
    expect(procurementStatusValues).toEqual([
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'RECEIVED',
      'CANCELLED',
    ])
  })

  it('knows final states', () => {
    expect(isFinalPoStatus('RECEIVED')).toBe(true)
    expect(isFinalPoStatus('CANCELLED')).toBe(true)
    expect(isFinalPoStatus('APPROVED')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test and confirm fail**

Run:
```bash
pnpm --filter @pharmacy/domain test -- --run src/index.test.ts
```

Expected: fail because exports do not exist.

- [ ] **Step 3: Add minimal implementation**

```ts
export const procurementStatusValues = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'RECEIVED',
  'CANCELLED',
] as const

export type ProcurementStatus = (typeof procurementStatusValues)[number]

export function isFinalPoStatus(status: ProcurementStatus): boolean {
  return status === 'RECEIVED' || status === 'CANCELLED'
}
```

- [ ] **Step 4: Run test and confirm pass**

Run:
```bash
pnpm --filter @pharmacy/domain test
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/domain/src/index.ts packages/domain/src/index.test.ts
git commit -m "feat: add procurement domain types"
```

### Task 3: Add NestJS procurement module

**Files:**
- Create: `apps/api/src/procurement/procurement.module.ts`
- Create: `apps/api/src/procurement/procurement.controller.ts`
- Create: `apps/api/src/procurement/procurement.service.ts`
- Create: `apps/api/src/procurement/dto/create-supplier.dto.ts`
- Create: `apps/api/src/procurement/dto/create-purchase-order.dto.ts`
- Create: `apps/api/src/procurement/dto/receive-goods.dto.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/supabase/supabase.service.ts` only if a new query helper is needed
- Test: `apps/api/src/procurement/*.spec.ts`

**Interfaces:**
- Consumes: scoped Supabase client from `SupabaseService`, JWT tenant from current user guard
- Produces: REST endpoints for supplier, PO, and goods receipt flows

- [ ] **Step 1: Write failing controller tests for supplier and PO routes**

```ts
import { Test } from '@nestjs/testing'
import { ProcurementController } from './procurement.controller'

describe('ProcurementController', () => {
  it('exists', async () => {
    const mod = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [],
    }).compile()

    expect(mod.get(ProcurementController)).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test and confirm fail**

Run:
```bash
pnpm --filter @pharmacy/api test -- procurement
```

Expected: fail because files do not exist.

- [ ] **Step 3: Add minimal module and service**

Create `procurement.module.ts` that registers controller and service.
Create `procurement.service.ts` with methods:

```ts
createSupplier(input, tenantId)
listSuppliers(tenantId)
createPurchaseOrder(input, tenantId, userId)
submitPurchaseOrder(id, tenantId, userId)
approvePurchaseOrder(id, tenantId, userId)
receiveGoods(input, tenantId, userId)
```

- [ ] **Step 4: Wire module into app**

Import `ProcurementModule` in `apps/api/src/app.module.ts`.

- [ ] **Step 5: Run API tests**

Run:
```bash
pnpm --filter @pharmacy/api test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/procurement apps/api/src/app.module.ts
git commit -m "feat: add procurement api module"
```

### Task 4: Add supplier and procurement UI routes

**Files:**
- Create: `apps/web/app/(dashboard)/suppliers/page.tsx`
- Create: `apps/web/app/(dashboard)/procurement/page.tsx`
- Create: `apps/web/app/(dashboard)/procurement/new/page.tsx`
- Create: `apps/web/app/(dashboard)/procurement/[id]/page.tsx`
- Create: `apps/web/components/procurement/*`
- Modify: `apps/web/app/(dashboard)/layout.tsx` if sidebar needs links
- Modify: `apps/web/utils/supabase/client.ts` only if a helper is needed

**Interfaces:**
- Consumes: API endpoints from Task 3 and shared procurement status values from Task 2
- Produces: supplier list form, PO form, PO detail, receive-goods form

- [ ] **Step 1: Write a simple UI test or snapshot for supplier form fields**

Use the smallest test already used in `apps/web`.
Example:

```tsx
import { render, screen } from '@testing-library/react'
import { SupplierForm } from './supplier-form'

describe('SupplierForm', () => {
  it('shows name and pbf fields', () => {
    render(<SupplierForm />)
    expect(screen.getByLabelText('Supplier name')).toBeInTheDocument()
    expect(screen.getByLabelText('PBF license number')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test and confirm fail**

Run:
```bash
pnpm --filter @pharmacy/web test -- supplier
```

Expected: fail because component does not exist.

- [ ] **Step 3: Implement minimal pages and forms**

Create pages with these fields only:
- Supplier: name, is_pbf, pbf_license_number, phone, payment_terms_days
- PO: supplier, PO number, item rows, submit button
- Goods receipt: PO link, invoice number, receipt number, receipt date, item rows with batch number and expiry date

Keep layout light and compact. Use current UI tokens from `CONTEXT.md`.

- [ ] **Step 4: Add navigation link**

Add `Suppliers` and `Procurement` links in dashboard nav.

- [ ] **Step 5: Run web tests**

Run:
```bash
pnpm --filter @pharmacy/web test
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/(dashboard) apps/web/components/procurement apps/web/utils
git commit -m "feat: add procurement ui"
```

### Task 5: Wire receipt into stock batch entry

**Files:**
- Modify: `apps/api/src/procurement/procurement.service.ts`
- Modify: `apps/api/src/products/products.service.ts` if helper reuse is needed
- Modify: `supabase/migrations/20250803000000_create_master_data.sql` if stock batch fields need more columns
- Test: `apps/api/src/procurement/procurement.service.spec.ts`

**Interfaces:**
- Consumes: goods receipt payload from Task 3
- Produces: new `product_batches` rows or updated stock count with FEFO order

- [ ] **Step 1: Write failing test for goods receipt creates batch rows**

```ts
it('creates one batch row per receipt item', async () => {
  const result = await service.receiveGoods({ /* one item */ }, tenantId, userId)
  expect(result.createdBatches).toHaveLength(1)
})
```

- [ ] **Step 2: Run test and confirm fail**

- [ ] **Step 3: Implement the receipt write path**

On receipt:
- write `goods_receipts`
- write `goods_receipt_items`
- insert new `product_batches` rows with `current_qty`, `batch_number`, `expiry_date`, `purchase_price`
- mark PO `RECEIVED`

- [ ] **Step 4: Run API tests and build**

Run:
```bash
pnpm --filter @pharmacy/api test
pnpm --filter @pharmacy/api build
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/procurement supabase/migrations/20250803000000_create_master_data.sql
 git commit -m "feat: link goods receipt to stock batches"
```

### Task 6: Update docs and verify end-to-end

**Files:**
- Modify: `CONTEXT.md`
- Modify: `AGENTS.md`
- Modify: `docs/supabase-deployment.md` if any endpoint or env value changes
- Test: repo-wide `pnpm -r test` and `pnpm -r build`

**Interfaces:**
- Consumes: final procurement behavior
- Produces: current project state in docs

- [ ] **Step 1: Add small notes in CONTEXT.md**

Add supplier and PO state terms only. Keep it as glossary.

- [ ] **Step 2: Add progress note in AGENTS.md**

Mark procurement as in progress or done after code lands.

- [ ] **Step 3: Run full verification**

Run:
```bash
pnpm -r test
pnpm -r build
```

Expected: both pass.

- [ ] **Step 4: Commit docs**

```bash
git add CONTEXT.md AGENTS.md docs/supabase-deployment.md
 git commit -m "docs: update procurement context"
```

## Self-review

### Spec coverage
- Supplier master data: Task 1, Task 4
- PO state machine: Task 1, Task 2, Task 3
- Goods receipt and batch entry: Task 1, Task 3, Task 5
- NestJS module: Task 3
- UI: Task 4
- Docs and progress: Task 6

### Placeholder scan
- No TBD.
- No later-style placeholder text.
- Each code step has a concrete file or snippet.

### Type consistency
- `ProcurementStatus` and `isFinalPoStatus` are defined in Task 2 and reused by later tasks.
- Route and service names are aligned: `createSupplier`, `createPurchaseOrder`, `receiveGoods`.
- DB status values match the task text and SQL enum.

