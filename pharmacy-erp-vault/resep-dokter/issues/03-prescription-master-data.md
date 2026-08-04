# 03 Prescription master data and sales refactor

Type: task
Status: 

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