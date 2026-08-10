# Production credentials

Type: task
Status: open

## Question

How do we move the SATUSEHAT dispensing integration from sandbox to production?

## Answer

The integration chain is built and verified against the sandbox API. Production needs three values from the Kemenkes Partner System portal: `client_id`, `client_secret`, `org_id`. These come from a human-portal registration, not from code. There is no architectural decision left.

### Human checklist

1. Open the Kemenkes SATUSEHAT Platform portal: `https://satusehat.kemkes.go.id/platform` (login with the same account used for sandbox).
2. On the Beranda page, switch the environment toggle (top-left) from Sandbox(Staging) to Production.
3. In the sidebar, open Kode Akses API → Production endpoint.
4. Copy the production `client_id`, `client_secret`, and `org_id`.
5. Save the values into `apps/web/.env.local` (never commit).
6. Tell the agent the production values are ready.

Note: the fasyankes + partner system must be verified in DFO/REGFASYANKES/RS ONLINE. If the Production codes do not appear, verification has not propagated to Production yet.

Docs: <https://satusehat.kemkes.go.id/platform/docs/id/api-code/access-production/>

### Agent steps after keys arrive

1. Add the production values to the tenant row (`satusehat_client_id`, `satusehat_client_secret`, `satusehat_org_id`) or local env as the code expects.
2. Flip the base URL for the tenant from sandbox to `https://api-satusehat.kemkes.go.id/fhir-r4/v1` (using the environment flag pattern already in `lib/satusehat.ts`).
3. Verify one live RESEP sale: queue row reaches `SENT` and `fhir_ids` is populated.
4. Confirm the submission appears in the SATUSEHAT portal.

## Comments

- 2026-08-07 — Created. Destination reframed to (c): production go-live first, then a new wayfinder map for Compliance Completeness (BPJS eligibility check + KFA data hygiene). Soft-gate rules from map decisions stay.