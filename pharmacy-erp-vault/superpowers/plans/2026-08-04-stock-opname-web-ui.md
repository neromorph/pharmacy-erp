# Stock Opname Web UI and Void Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build web screens for stock opname and wire sale void UI gating to role helpers.

**Architecture:**
- Keep UI in Next.js App Router pages and server actions.
- Reuse existing Supabase server client and inline style pattern.
- Use `apps/web/utils/auth.ts` for role checks so opname approval and void buttons stay aligned with `app_metadata.role`.

**Tech Stack:** Next.js 16, React 19, Supabase SSR, TypeScript 6.x, inline CSS styles, existing CSS variables.

## Global Constraints

- ASD-STE100 Simplified Technical English in all written output, comments, and user-facing copy.
- TypeScript stays on 6.x.
- No `service_role` in request paths.
- Keep UI light-first, compact, and data-dense. Use existing CSS variables from `apps/web/app/globals.css`.
- Use existing Supabase server client from `apps/web/utils/supabase/server.ts`.
- Do not add new dependencies unless the plan forces it. Prefer existing app patterns.
- Keep `pnpm -r test` and `pnpm -r build` green.

---

### Task 1: Stock Opname List Page

**Files:**
- Create: `apps/web/app/stock-opname/page.tsx`
- Modify: `apps/web/app/layout.tsx` or `apps/web/app/page.tsx` only if a nav link is needed

**Interfaces:**
- Consumes: `stock_opnames`, `canApproveOpname()`.
- Produces: opener page for opname flow.

- [x] **Step 1: Write page with empty and list states**
```tsx
import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

export default async function StockOpnamePage() {
  const supabase = await createClient()
  const { data: opnames, error } = await supabase
    .from('stock_opnames')
    .select('*, stock_opname_items (id)')
    .order('created_at', { ascending: false })

  if (error) return <p style={{ color: 'var(--danger)' }}>Stock opname unavailable</p>

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: 20, margin: '0 0 16px' }}>Stock Opname</h1>
        <Link href="/stock-opname/new" style={{ background: 'var(--primary)', color: '#fff', padding: '8px 16px', borderRadius: 6, textDecoration: 'none' }}>
          New Opname
        </Link>
      </div>
      {/* render table or empty state */}
    </section>
  )
}
```
- [x] **Step 2: Render status badges and counts**
Show opname number, type, status, item count, creator/approver timestamps.
- [x] **Step 3: Commit**
`git commit -m "feat(web): add stock opname list page"`

---

### Task 2: Create Stock Opname Page

**Files:**
- Create: `apps/web/app/stock-opname/new/page.tsx`

**Interfaces:**
- Consumes: `products`, `product_batches`, `stock_opnames`, `stock_opname_items`.
- Produces: new DRAFT opname and item rows.

- [x] **Step 1: Build server action to create draft opname**
```tsx
async function createStockOpname(formData: FormData) {
  'use server'
  // read type, opname_number, product/batch ids, system/physical qty, reason
  // insert header then items, keep status DRAFT
}
```
- [x] **Step 2: Build entry form**
Use a compact table form with one row per batch, fields for `physical_qty_base` and `reason`.
- [x] **Step 3: Commit**
`git commit -m "feat(web): add stock opname create page"`

---

### Task 3: Stock Opname Detail and Approval Page

**Files:**
- Create: `apps/web/app/stock-opname/[id]/page.tsx`

**Interfaces:**
- Consumes: `canApproveOpname(role)`, `getUserRole()`, `stock_opnames`, `stock_opname_items`.
- Produces: submit and approve actions.

- [x] **Step 1: Add server actions for submit, approve, cancel**
```tsx
async function submitStockOpname(formData: FormData) { 'use server' }
async function approveStockOpname(formData: FormData) { 'use server' }
async function cancelStockOpname(formData: FormData) { 'use server' }
```
- [x] **Step 2: Render variance table and action buttons**
Show `system_qty_base`, `physical_qty_base`, `variance_qty_base`, `reason`.
Only show approve button when role allows it.
- [x] **Step 3: On approve, update `product_batches.current_qty` from opname items**
Use the same fetch-then-update pattern as `paySale` and `voidSale`.
- [x] **Step 4: Commit**
`git commit -m "feat(web): add stock opname detail approval page"`

---

### Task 4: Wire Sale Void Button Gating

**Files:**
- Modify: `apps/web/app/sales/[id]/page.tsx`

**Interfaces:**
- Consumes: `canVoidSale()`.
- Produces: gated void action in sale detail UI.

- [x] **Step 1: Add a server action for void**
```tsx
async function voidSale(formData: FormData) {
  'use server'
  // call the existing data path that sets status VOID
}
```
- [x] **Step 2: Gate the button**
Only show the void button when role is OWNER or PHARMACIST.
- [x] **Step 3: Show a simple denial message for others**
If role is CASHIER or INVENTORY, do not render the button.
- [x] **Step 4: Commit**
`git commit -m "feat(web): gate sale void by role"`

---

### Task 5: Navigation and Small UX Polish

**Files:**
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/page.tsx` if needed for a link or dashboard hint

**Interfaces:**
- Consumes: stock opname page and sale detail page routes.

- [x] **Step 1: Add nav link for Stock Opname**
```tsx
{ href: '/stock-opname', label: 'Stock Opname' }
```
- [x] **Step 2: Check layout fit**
Keep nav compact and consistent with existing links.
- [x] **Step 3: Commit**
`git commit -m "feat(web): add stock opname navigation"`
