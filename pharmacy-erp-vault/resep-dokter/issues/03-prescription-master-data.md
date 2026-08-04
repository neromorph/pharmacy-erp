# 03 Prescription master data and sales refactor

Type: task
Status: resolved

## Question

Create the `doctors` and `patients` master-data tables, and mutate `sales` to carry prescription identity and service fees.

## Scope

- Migration: `doctors` (id, tenant_id, name, sip_number, phone) and `patients` (id, tenant_id, name, address, phone, birth_date). RLS tenant-scoped, `uuid_generate_v4()`, `ON DELETE CASCADE` on tenant FK. Audit-safe: `sales.doctor_id` / `sales.patient_id` use `ON DELETE SET NULL`.
- Migration: `sales.sale_type` enum `OTC`/`RESEP` default OTC; `sales.doctor_id`/`sales.patient_id` nullable FKs SET NULL; `sales.tuslah_amount` + `sales.embalase_amount` `NUMERIC(18,2) NOT NULL DEFAULT 0`.
- Deterministic UI for pick-or-create doctor/patient (search by name/SIP; create inline) used by the POS cart.
- Doctor and Patient management screens (OWNER-gated, CRUD).

## Acceptance

- Migrations applied to remote; RLS verified (owner sees own records).
- `sales` rows default OTC with zero fees; RESEP sale persists doctor/patient FKs.

Blocked by: none

## Answer

Resolved in session. Migration `20260804000005_prescription_master_data.sql` adds `sale_type` enum (OTC/RESEP, default OTC), `doctors` + `patients` tables (RLS tenant-scoped, tenant FK CASCADE), and `sales.doctor_id`/`sales.patient_id` (SET NULL, audit-safe) + `tuslah_amount`/`embalase_amount` (default 0). Applied to remote, verified: tables exist, columns landed, anon sees 0 rows on both new tables. New `/doctors` and `/patients` pages (OWNER-gated CRUD with inline edit/remove). Live-verified in browser as owner: created Dr. Andi Wijaya (SIP.02.3456) and Budi Santoso (Jl. Melati No. 12, 1990-05-14) — both persist; birth_date round-trips correctly (earlier `-` was a duplicate test row). Repo green (api 6/6, web 30/30, all builds). Commit `922e91d`, deployed.

Note: the POS cart pick-or-create UI (search by name/SIP, create inline) is a cart-surface concern — it ships with ticket 05 where the cart RESEP flow lands, reusing these tables.