# Stock Dashboard, Opname, and Role Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the dashboard's 3 KPIs (via a single RPC), stock opname flow, role-based access control in `app_metadata`, and reverse-FEFO on sale void.

**Architecture:** 
- Domain: Export `UserRole` and `JWTAppMetadata`.
- Database: New `stock_opnames` + `stock_opname_items` tables. One `get_dashboard_kpis` RPC (SECURITY INVOKER).
- API/Service: Update `sales.service.ts` to restore stock on VOID.
- Frontend: Dashboard page queries the RPC. Web UI uses a new `getUserRole()` helper from the Supabase client to gate the Void and Opname-Approve buttons.

**Tech Stack:** Next.js 16 (App Router), NestJS 11, Supabase (PostgreSQL), TypeScript 6.x.

## Global Constraints

- ASD-STE100 Simplified Technical English in all code, comments, and docs.
- No `service_role` in request paths. RLS strictly via `app_metadata.tenant_id`.
- Typescript pinned to 6.x (do not upgrade to 7).
- pnpm workspace (`apps/web`, `apps/api`, `packages/domain`). Run `pnpm -r test` and `pnpm -r build` frequently.

---

### Task 1: Domain Models for Roles and Opname

**Files:**
- Modify: `packages/domain/src/tenant.ts`
- Create: `packages/domain/src/opname.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/index.test.ts`

**Interfaces:**
- Produces: `UserRole`, `JWTAppMetadata`, `OpnameStatus`, `OpnameType`, `OpnameReason`

- [ ] **Step 1: Write tests for new domain exports**
```typescript
// in packages/domain/src/index.test.ts
import { userRoleValues, opnameStatusValues, opnameTypeValues, opnameReasonValues } from './index.ts'
// assert deepEquals for all of them
```
- [ ] **Step 2: Implement tenant roles**
```typescript
// in packages/domain/src/tenant.ts
export const userRoleValues = ['OWNER', 'PHARMACIST', 'INVENTORY', 'CASHIER'] as const
export type UserRole = typeof userRoleValues[number]

export interface JWTAppMetadata {
  tenant_id: string
  role: UserRole
}
```
- [ ] **Step 3: Implement opname domain types**
```typescript
// in packages/domain/src/opname.ts
export const opnameStatusValues = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED'] as const
export type OpnameStatus = typeof opnameStatusValues[number]

export const opnameTypeValues = ['FULL_STORE', 'RACK_BASED', 'AD_HOC_SINGLE'] as const
export type OpnameType = typeof opnameTypeValues[number]

export const opnameReasonValues = ['DAMAGE', 'EXPIRED', 'LOST', 'COUNT_ERROR', 'MISC'] as const
export type OpnameReason = typeof opnameReasonValues[number]
```
- [ ] **Step 4: Export from index and run tests**
Export `opname.ts` in `index.ts`. Run `pnpm -r test`. Ensure it passes.
- [ ] **Step 5: Commit**
`git commit -m "feat(domain): add user roles and stock opname types"`

---

### Task 2: Provisioning Script Updates

**Files:**
- Modify: `scripts/provision-tenant.ts`

**Interfaces:**
- Consumes: `UserRole` from `@pharmacy/domain`

- [ ] **Step 1: Update provision-tenant.ts**
Change the `createUser` call in `run()` to include `role: 'OWNER'` in `app_metadata`.
```typescript
    app_metadata: { tenant_id: tenantId, role: 'OWNER' },
```
- [ ] **Step 2: Commit**
`git commit -m "chore: provision first tenant user as OWNER"`

---

### Task 3: Database Migrations for Opname & Dashboard RPC

**Files:**
- Create: `supabase/migrations/20250804000000_create_opname_and_dashboard.sql`

**Interfaces:**
- Produces: `stock_opnames`, `stock_opname_items` tables, `get_dashboard_kpis()` function.

- [ ] **Step 1: Write SQL for Opname Tables**
```sql
CREATE TYPE public.opname_status AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'CANCELLED');
CREATE TYPE public.opname_type AS ENUM ('FULL_STORE', 'RACK_BASED', 'AD_HOC_SINGLE');
CREATE TYPE public.opname_reason AS ENUM ('DAMAGE', 'EXPIRED', 'LOST', 'COUNT_ERROR', 'MISC');

CREATE TABLE public.stock_opnames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    opname_number VARCHAR(50) NOT NULL,
    type public.opname_type NOT NULL,
    status public.opname_status NOT NULL DEFAULT 'DRAFT',
    created_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, opname_number)
);

CREATE TABLE public.stock_opname_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL,
    opname_id UUID NOT NULL REFERENCES public.stock_opnames(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE RESTRICT,
    system_qty_base NUMERIC(14,3) NOT NULL,
    physical_qty_base NUMERIC(14,3) NOT NULL,
    variance_qty_base NUMERIC(14,3) NOT NULL,
    reason public.opname_reason NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for stock_opnames" ON public.stock_opnames
    FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);

ALTER TABLE public.stock_opname_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation for stock_opname_items" ON public.stock_opname_items
    FOR ALL USING (tenant_id = (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'tenant_id')::uuid);
```

- [ ] **Step 2: Write SQL for Dashboard RPC**
The function `get_dashboard_kpis()` must be `SECURITY INVOKER`. It calculates:
1. Daily Sales: `SUM(grand_total)` of `sales` where `status = 'PAID'` and `sold_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jakarta'::date = CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Jakarta'::date`. Subtract `sales` where `status = 'VOID'`.
2. Low Stock: count of `products` where `COALESCE((SELECT SUM(current_qty) FROM product_batches WHERE product_id = products.id), 0) <= min_stock_level`.
3. Near Expiry: count of distinct `products` where ANY of its `product_batches` has `expiry_date` <= CURRENT_DATE + (CASE WHEN product.is_expired_sensitive THEN 30 ELSE 60 END). A product with no batches is not near-expiry (it is low-stock instead).

(Write this as a clean PL/pgSQL function returning `json`).

- [ ] **Step 3: Commit**
`git commit -m "feat(db): add stock opname tables and dashboard kpi rpc"`

---

### Task 4: Reverse-FEFO on Void Sale

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts`

**Interfaces:**
- Consumes: Existing `voidSale` method.

- [ ] **Step 1: Update `voidSale` to restore stock**
Modify `voidSale(id: string)`. Before updating the status to VOID, select all `sale_items` for the sale. Loop over them, and add `qty_sold` back to `product_batches.current_qty` for the matching `product_batch_id`.
Note: The transaction logic (fetch then update) used in `paySale` should be mirrored here.

- [ ] **Step 2: Verify build**
Run `pnpm -r build` to ensure `sales.service.ts` compiles.

- [ ] **Step 3: Commit**
`git commit -m "feat(api): restore batch quantities on sale void"`

---

### Task 5: Web UI Role Utilities and Gating

**Files:**
- Create: `apps/web/utils/auth.ts`

**Interfaces:**
- Produces: `getUserRole(supabase)` helper.

- [ ] **Step 1: Create auth helper**
```typescript
import { SupabaseClient } from '@supabase/supabase-js'
import { UserRole } from '@pharmacy/domain'

export async function getUserRole(supabase: SupabaseClient): Promise<UserRole | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user.app_metadata?.role as UserRole | null
}

export function canApproveOpname(role: UserRole | null): boolean {
  return role === 'OWNER' || role === 'PHARMACIST'
}

export function canVoidSale(role: UserRole | null): boolean {
  return role === 'OWNER' || role === 'PHARMACIST'
}
```

- [ ] **Step 2: Commit**
`git commit -m "feat(web): add role authorization helpers"`

---

### Task 6: Implement Dashboard Page

**Files:**
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `get_dashboard_kpis` RPC.

- [ ] **Step 1: Fetch KPI data on the server component**
```tsx
import { createClient } from '@/utils/supabase/server'

export default async function HomePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_dashboard_kpis')
  // Parse data
  // Render 3 metric cards (Daily Sales, Low Stock, Near Expiry)
}
```

- [ ] **Step 2: Render clean, data-dense UI**
Follow the Teal/Emerald light-first styling. 

- [ ] **Step 3: Commit**
`git commit -m "feat(web): implement 3-kpi dashboard"`
