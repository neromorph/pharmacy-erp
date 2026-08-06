# 01 — Destination grilling

Type: grilling
Status: resolved

## Question

What is the destination for the SATUSEHAT effort, and what are the key scoping decisions that govern the whole map?

## Answer

Resolved in the opening grilling session (Q1–Q10). Decisions locked:

1. **Submission scope**: RESEP + BPJS only (Permenkes 24/2022; OTC excluded).
2. **Credentials model**: Per-tenant — each Apotek registers independently with Kemenkes; stores own `client_id`, `client_secret`, `org_id`.
3. **Submission timing**: Async / fire-and-forget — SATUSEHAT call fires after PAID; POS never waits.
4. **KFA code stance**: Soft gate — products without KFA code are skipped from submission (sale not blocked); warning shown on product screen.
5. **IHS patient lookup**: POS-time — at patient-select in RESEP/BPJS cart, call SATUSEHAT IHS API with NIK; store `ihs_number` on `patients`. Requires adding `nik` and `ihs_number` to `patients`.
6. **Credentials entry**: Extend `/settings` (OWNER-only SATUSEHAT section).
7. **Sandbox credentials**: Not yet obtained. First human task — register at `platform.satusehat.kemkes.go.id`; this unblocks all development work.
8. **Destination**: Spec + plan only — nothing built in-map. Worker pipeline builds from the produced spec.
