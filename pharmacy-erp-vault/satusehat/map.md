# SATUSEHAT Dispensing Integration — Wayfinder Map

Type: wayfinder:map

## Destination

A spec + plan ready to hand off to the worker pipeline.
Every design decision for the SATUSEHAT dispensing integration is resolved:
FHIR resource shape, OAuth2 token flow, async submission job, IHS patient lookup at POS-time, KFA soft-gate, per-tenant credentials in `/settings`, and error/retry model.
Nothing is built inside this map.

## Notes

- Domain: `pharmacy-erp-vault/CONTEXT.md` + `pharmacy-erp-vault/adr/`
- Skills every session should consult: `/grilling`, `/domain-modeling`, `/research`
- SATUSEHAT API: FHIR R4, OAuth2 client credentials (per-tenant `client_id` / `client_secret` / `org_id`), base URL `https://api-satusehat.kemkes.go.id/fhir-r4/v1` (production), `https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1` (sandbox)
- Token endpoint (production): `https://api-satusehat.kemkes.go.id/oauth2/v1/accesstoken?grant_type=client_credentials`
- Token TTL: live sandbox call returned 14399s (4 hours); no refresh token; re-fetch on expiry; cache per tenant
- Relevant regulation: Permenkes 24/2022 — mandatory dispensing reporting for pharmacies (Apotek)
- KFA API (v2): `https://api-satusehat.kemkes.go.id/kfa-v2/products` — same OAuth2 token; search by `nie` (BPOM number) or `kfa_code` or name
- ASD-STE100 writing rules apply to all specs and docs

## Decisions so far

- [Destination grilling](issues/01-destination-grilling.md) — RESEP+BPJS only; per-tenant credentials; async POS-safe; KFA soft-gate; IHS lookup at patient-select with NIK→ihs_number cached; extend `/settings`; sandbox credentials are a human task.
- [Sandbox credentials](issues/02-sandbox-credentials.md) — ✅ Obtained via Partner System registration. Stored in `apps/web/.env.local`. Sandbox base URL: `https://api-satusehat-stg.dto.kemkes.go.id`.
- [Research: OAuth2 + FHIR MedicationDispense API](issues/03-research-oauth-fhir-api.md) — Live sandbox token TTL 14399s (4 hours), no refresh, cache per tenant. Submission = paired `Medication` + `MedicationDispense` per drug line (transaction Bundle). Required fields: `status=completed`, `subject=Patient/{ihs}`, `performer=Practitioner/{ihs}+Organization/{org_id}`, `medicationReference`, `quantity`, `whenHandedOver`. Practitioner (doctor) IHS number IS required — doctors table needs `nik`+`ihs_number`. Racikan: one Medication+MedicationDispense pair per compounded batch; ingredients in `Medication.ingredient[]`.
- [Research: KFA catalog](issues/04-research-kfa-catalog.md) — KFA codes are 8-digit numeric (93xxxxxx = branded/actual product). Full REST API at `/kfa-v2/products`; look up by `product_type=Obat&code=<KFA or NIE>`. KFA is mandatory for non-racikan Medication.code; submission rejected without it. Recommendation: add `kfa_code TEXT NULL` to `products`; KFA button on product edit resolves via BPOM number; skip submission for products without KFA (SKIPPED status).
- [Research: IHS patient lookup API](issues/05-research-ihs-lookup.md) — `GET /Patient?identifier=https://fhir.kemkes.go.id/id/nik|<nik>` returns FHIR Bundle; IHS number is `Patient.id`. If not found: `POST Patient` to create in MPI (returns new IHS number). Schema: `patients.nik TEXT NULL`, `patients.ihs_number TEXT NULL`. Same pattern for doctors: `doctors.nik TEXT NULL`, `doctors.ihs_number TEXT NULL` (Practitioner lookup).
- [Design: IHS lookup integration at POS](issues/08-design-ihs-integration.md) — add `patients.nik` + `patients.ihs_number`; lookup fires on patient select for RESEP/BPJS; missing NIK or API error warns only; cached IHS skips re-call unless NIK changes; `/patients` NIK field is OWNER/PHARMACIST only.
- [Design: credential storage + submission status UI](issues/09-design-credentials-status-ui.md) — 3 nullable tenant columns (`satusehat_client_id`, `satusehat_client_secret`, `satusehat_org_id`); no JSONB, no custom encryption in v1; `/settings` gets 3 fields + Test connection; submission status lives on `/sales/[id]`; FAILED rows can retry for OWNER/PHARMACIST.- [Design: async submission job](issues/06-design-async-job.md) — DB trigger on `sales.status='PAID'` inserts into `satusehat_submissions` queue table. `pg_cron` polls every 60s via `pg_net` → Next.js `GET /api/satusehat/process-queue`. `FOR UPDATE SKIP LOCKED` for concurrency. Token cached in `satusehat_tokens (tenant_id, access_token, expires_at)`; re-fetch when `expires_at - now() < 60s`. Retry: 4 attempts at +2/+8/+32 min → FAILED. SKIPPED (no KFA items): row created with `status='SKIPPED'`, muted badge on sale page linking to missing-KFA products.

## Not yet specified

- Bundle vs sequential POST for Medication+MedicationDispense — gap from research; resolve in ticket 07 (FHIR mapping design)
- Whether `authorizingPrescription` can be omitted for Apotek-only RESEP (no upstream MedicationRequest) — resolve in ticket 07
- Doctors table migration (`nik`, `ihs_number` columns) — resolved in ticket 08 (IHS integration design, covers both patients and doctors)

## Out of scope

- OTC sale reporting (ruled out Q4 — not required by Permenkes 24/2022)
- Platform-level (shared) credentials (ruled out Q5 — each Apotek is a distinct legal entity)
- Blocking POS on SATUSEHAT response (ruled out Q6 — async only)
- KFA hard-gate on POS (ruled out Q7 — soft-gate with skip/warning)
- Manual IHS number entry without NIK lookup (ruled out Q8 — POS-time API lookup with cache)
