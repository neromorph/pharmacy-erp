# 04 Racikan bundle schema and FEFO guards

Type: task
Status: resolved

## Question

Mutate `sale_items` to support parent/child compound bundles and add the FEFO allocation guards.

## Scope

- Migration: `sale_items.product_id` nullable (parent compound rows); `sale_items.parent_item_id UUID` self-FK `ON DELETE CASCADE`; `sale_items.embalase_amount NUMERIC(18,2) NOT NULL DEFAULT 0`; DB CHECK `(parent_item_id IS NULL OR embalase_amount = 0)`.
- FEFO allocation / pay flow (`apps/web/app/sales/[id]/page.tsx` and `apps/api/src/sales/sales.service.ts`): skip parent rows in batch allocation → add `product_id IS NOT NULL` guard when grouping `sale_items`; children remain ordinary rows and deduce stock normally.
- Aggregation at pay: sum parent `embalase_amount` into `sales.embalase_amount`.

## Acceptance

- A compound sale persists one parent row (compound price, dosage-unit qty) + N child rows (0 price, real ingredient qty on real batches).
- PAY/void consume/restore batch `current_qty` from children only; parent rows never enter allocation.
- DB CHECK rejects a child row that carries embalase.

Blocked by: none

## Answer

Resolved in session. Migration `20260804000006_racikan_bundle_schema.sql` makes `sale_items.product_id` nullable, adds `parent_item_id` self-FK (ON DELETE CASCADE), `embalase_amount` default 0, and `check_child_no_embalase` (parent_item_id IS NULL OR embalase_amount = 0). Applied to remote; the CHECK was verified functionally — parent row with embalase 3000 accepted, child row with embalase 500 rejected. Pay/void flows (web `apps/web/app/sales/[id]/page.tsx` + API `sales.service.ts`) now skip parent rows in FEFO allocation via a `product_id IS NOT NULL` guard and aggregate parent embalase into `sales.embalase_amount` at pay; void already skipped null-batch rows. Pure helpers `perProductQuantities` + `sumEmbalase` in `apps/web/lib/compound.ts` with unit tests (web 33/33, api 6/6, all builds green). Commit `b313869`, both containers deployed and healthy.