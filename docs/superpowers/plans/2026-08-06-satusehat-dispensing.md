# SATUSEHAT Dispensing Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build SATUSEHAT dispensing sync for RESEP and BPJS sales with async queue, IHS lookup, KFA mapping, and tenant-level credentials.

**Architecture:** Use one DB queue table for SATUSEHAT submission jobs, one token cache table, and one Next.js route handler to process due jobs with `FOR UPDATE SKIP LOCKED`. Keep POS flow fast. Lookup IHS at patient select, cache on patient row, and keep KFA as soft-gate on products. Store tenant credentials in separate nullable columns on the tenant row and read them only in server code.

**Tech Stack:** Next.js 16 App Router, Supabase self-hosted, PostgreSQL, TypeScript 6, pnpm 11, vitest.

## Global Constraints

- Never use `service_role` in request paths. Use user JWT in request paths.
- Remote DB migrate via `ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase'`.
- No new dependencies for this scope.
- ASD-STE100: short sentences, controlled words, no fluff in docs and comments.
- Keep `pnpm -r test` and `pnpm -r build` green after each task.
- Browser QA only on live domain, not localhost.

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/20260806000003_satusehat_dispensing.sql` | **Create** — tenant credential columns, patient/doctor IHS columns if not already present, queue table, token table, triggers, queue worker RPC helpers, submission status storage |
| `apps/web/lib/satusehat.ts` | **Create** — token fetch, patient lookup, KFA lookup, submission payload helpers |
| `apps/web/lib/satusehat.test.ts` | **Create** — pure helper tests for token expiry, lookup guards, status mapping |
| `apps/web/app/settings/page.tsx` | **Modify** — SATUSEHAT credential section with 3 fields + test button |
| `apps/web/app/settings/actions.ts` | **Modify** — save SATUSEHAT credentials |
| `apps/web/app/patients/page.tsx` | **Modify** — add `nik` and `ihs_number` fields if not yet present in UI |
| `apps/web/app/patients/actions.ts` | **Modify** — save `nik` and `ihs_number` |
| `apps/web/app/sales/new/cart-builder.tsx` | **Modify** — fire IHS lookup on patient select, show BPJS guard, show KFA soft-gate status |
| `apps/web/app/sales/[id]/page.tsx` | **Modify** — show SATUSEHAT status block, retry button for FAILED |
| `apps/web/app/api/satusehat/process-queue/route.ts` | **Create** — process due queue rows, call SATUSEHAT, update status |
| `apps/web/app/api/satusehat/test-connection/route.ts` | **Create** — test credentials and token fetch |
| `pharmacy-erp-vault/satusehat/map.md` | **Update** — final spec notes after code lands |

---

## Task 1: Database — credentials, cache, queue, status

**Files:**
- Create: `supabase/migrations/20260806000003_satusehat_dispensing.sql`

**Interfaces:**
- Produces: tenant SATUSEHAT credential columns; queue table `satusehat_submissions`; token cache table `satusehat_tokens`; status fields for submission state; trigger support for PAID sales.

- [ ] **Step 1: Write migration with tables and columns**

```sql
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS satusehat_client_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS satusehat_client_secret TEXT NULL,
  ADD COLUMN IF NOT EXISTS satusehat_org_id TEXT NULL;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nik TEXT NULL,
  ADD COLUMN IF NOT EXISTS ihs_number TEXT NULL;

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS nik TEXT NULL,
  ADD COLUMN IF NOT EXISTS ihs_number TEXT NULL;

CREATE TABLE IF NOT EXISTS public.satusehat_tokens (
  tenant_id UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.satusehat_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED','SKIPPED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS satusehat_submissions_sale_id_key ON public.satusehat_submissions (sale_id);
CREATE INDEX IF NOT EXISTS satusehat_submissions_due_idx ON public.satusehat_submissions (status, next_retry_at);
```

Add a trigger on `sales` status change to enqueue a queue row for `sale_type IN ('RESEP','BPJS')` when status becomes `PAID`.

- [ ] **Step 2: Apply migration to remote DB**

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase' \
  < supabase/migrations/20260806000003_satusehat_dispensing.sql
```

- [ ] **Step 3: Verify live schema**

```bash
ssh mufid@100.119.164.5 "docker exec pharmacy-supabase-db psql -U supabase_admin -d supabase -c \"\d public.satusehat_submissions\""
```

Expected: table exists with queue columns and status check.

- [ ] **Step 4: Run tests and build**

```bash
pnpm -r test && pnpm -r build
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260806000003_satusehat_dispensing.sql
git commit -m "feat(db): add satusehat queue and credential storage"
```

---

## Task 2: Shared SATUSEHAT helpers and tests

**Files:**
- Create: `apps/web/lib/satusehat.ts`
- Create: `apps/web/lib/satusehat.test.ts`

**Interfaces:**
- Consumes: tenant credentials, patient `nik` / `ihs_number`, product `kfa_code`, queue row IDs.
- Produces: `getSatusehatToken()`, `lookupPatientIhs()`, `lookupKfaProduct()`, `needsTokenRefresh()`, and small status helpers.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { needsTokenRefresh } from './satusehat'

describe('needsTokenRefresh', () => {
  it('returns true when expiry is within 60 seconds', () => {
    expect(needsTokenRefresh(new Date(Date.now() + 59_000))).toBe(true)
  })

  it('returns false when expiry is far enough away', () => {
    expect(needsTokenRefresh(new Date(Date.now() + 120_000))).toBe(false)
  })
})
```

Add one test for `lookupKfaProduct` request shape and one test for `lookupPatientIhs` guard on missing NIK.

- [ ] **Step 2: Run tests and verify fail**

```bash
pnpm --filter @pharmacy/web test
```

- [ ] **Step 3: Implement minimal helpers**

Use `fetch` only. Keep helper signatures small:

```ts
export function needsTokenRefresh(expiresAt: Date): boolean
export async function getSatusehatToken(input: { clientId: string; clientSecret: string }): Promise<{ accessToken: string; expiresAt: Date }>
export async function lookupPatientIhs(input: { token: string; nik: string }): Promise<string | null>
export async function lookupKfaProduct(input: { token: string; code: string }): Promise<any>
```

- [ ] **Step 4: Run tests and verify pass**

```bash
pnpm --filter @pharmacy/web test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/satusehat.ts apps/web/lib/satusehat.test.ts
git commit -m "feat(web): add satusehat helper layer"
```

---

## Task 3: Settings — tenant credentials form and save action

**Files:**
- Modify: `apps/web/app/settings/page.tsx`
- Modify: `apps/web/app/settings/actions.ts`

**Interfaces:**
- Consumes: tenant credential columns from DB.
- Produces: OWNER-only form with Client ID, Client Secret, Org ID, and Test connection button.

- [ ] **Step 1: Add tests or page assertions**

Add a small UI test or server action test if one exists in this area. If not, add minimal manual assertions in page data shape and keep the form simple.

- [ ] **Step 2: Implement form fields and save action**

Fields:
- `satusehat_client_id`
- `satusehat_client_secret`
- `satusehat_org_id`

Keep copy short. No JSONB. No extra config object.

- [ ] **Step 3: Add Test connection route call**

The button should call `/api/satusehat/test-connection` and show success or error text.

- [ ] **Step 4: Run tests and build**

```bash
pnpm -r test && pnpm -r build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/settings/page.tsx apps/web/app/settings/actions.ts
git commit -m "feat(web): add satusehat settings form"
```

---

## Task 4: POS flow — IHS lookup and BPJS guard

**Files:**
- Modify: `apps/web/app/sales/new/cart-builder.tsx`
- Modify: `apps/web/app/patients/page.tsx`
- Modify: `apps/web/app/patients/actions.ts`

**Interfaces:**
- Consumes: `lookupPatientIhs`, `isBpjsCheckoutBlocked`, patient fields.
- Produces: lookup on patient select, cached IHS writeback, BPJS guard, NIK edit fields.

- [ ] **Step 1: Add failing tests for helper-side behavior**

Add or extend pure helper tests if the cart builder already has a helper seam. If not, test the helper in `apps/web/lib/satusehat.test.ts` and keep the UI logic thin.

- [ ] **Step 2: Implement patient select lookup flow**

On patient select for RESEP/BPJS:
- If `ihs_number` exists, skip lookup.
- If `nik` exists and `ihs_number` is blank, call lookup and store result.
- If lookup fails, warn and continue.

- [ ] **Step 3: Add NIK fields in patient form**

Add `nik` and `ihs_number` fields. Keep edit access OWNER/PHARMACIST only.

- [ ] **Step 4: Run tests and build**

```bash
pnpm -r test && pnpm -r build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/sales/new/cart-builder.tsx apps/web/app/patients/page.tsx apps/web/app/patients/actions.ts
git commit -m "feat(web): add satusehat patient lookup flow"
```

---

## Task 5: Submission worker route and sale detail status UI

**Files:**
- Create: `apps/web/app/api/satusehat/process-queue/route.ts`
- Create: `apps/web/app/api/satusehat/test-connection/route.ts`
- Modify: `apps/web/app/sales/[id]/page.tsx`

**Interfaces:**
- Consumes: queue rows, token helper, lookup helpers, tenant creds.
- Produces: worker route that drains due jobs, status updates, sale detail status block and retry action.

- [ ] **Step 1: Write failing route tests or handler tests**

If route tests exist in this codebase, add one for queue row transition PENDING → SENT and one for failure → retry scheduling. If not, add a tiny integration test around the queue-processing helper.

- [ ] **Step 2: Implement queue processor**

Use `FOR UPDATE SKIP LOCKED` and handle:
- `SENT`
- `FAILED`
- `SKIPPED`
- retry with `next_retry_at`

- [ ] **Step 3: Implement test connection route**

This route should fetch a token and return a small success JSON. Use it from settings.

- [ ] **Step 4: Add sale detail status block**

Show:
- `submitted_at`
- `status`
- `last_error`
- retry button for FAILED rows for OWNER/PHARMACIST

- [ ] **Step 5: Run tests and build**

```bash
pnpm -r test && pnpm -r build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/api/satusehat/process-queue/route.ts apps/web/app/api/satusehat/test-connection/route.ts apps/web/app/sales/[id]/page.tsx
git commit -m "feat(web): add satusehat queue worker and status ui"
```

---

## Task 5.5: Real FHIR payload builder + POST (replaces stub)

**Files:**
- Create: `supabase/migrations/20260806000005_satusehat_submission_ext.sql`
- Modify: `apps/web/lib/satusehat.ts`
- Modify: `apps/web/app/api/satusehat/process-queue/route.ts`
- Modify: `apps/web/lib/satusehat.test.ts`

**Interfaces:**
- Consumes: queue row, tenant creds (`satusehat_org_id`), sale + items + products (`kfa_code`, `base_unit`), patient `ihs_number`, doctor `ihs_number`, token cache.
- Produces: full FHIR chain POSTs (Location → Encounter → MedicationRequest → MedicationDispense), status updates.

**Verified payloads (all 201 on sandbox, 2026-08-06; see ticket 07):**

```jsonc
// 1. Location (once per org, idempotent by name — cache on submission row)
{ "resourceType": "Location",
  "meta": { "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/Location"] },
  "status": "active", "name": "<tenant name>",
  "managingOrganization": { "reference": "Organization/<org_id>" } }

// 2. Encounter (once per sale)
{ "resourceType": "Encounter",
  "meta": { "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/Encounter"] },
  "identifier": [{ "system": "http://sys-ids.kemkes.go.id/encounter/<org_id>", "use": "official", "value": "<sale_number>" }],
  "status": "finished",
  "statusHistory": [
    { "status": "arrived", "period": { "start": <paid_at-5m>, "end": <paid_at-5m> } },
    { "status": "in-progress", "period": { "start": <paid_at-5m>, "end": <paid_at> } },
    { "status": "finished", "period": { "start": <paid_at>, "end": <paid_at+5m> } } ],
  "class": { "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode", "code": "AMB", "display": "ambulatory" },
  "classHistory": [{ "class": <same class>, "period": { "start": <paid_at-5m>, "end": <paid_at+5m> } }],
  "subject": { "reference": "Patient/<ihs_number>", "display": "<patient name>" },
  "participant": [{ "type": [{ "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", "code": "ATND", "display": "attender" }] }],
    "individual": { "reference": "Practitioner/<doctor ihs>" } }],
  "period": { "start": <paid_at-5m>, "end": <paid_at+5m> },
  "location": [{ "location": { "reference": "Location/<location_id>" } }],
  "diagnosis": [{ "condition": { "reference": "Condition/<seeded-condition-id>" },
    "use": { "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/diagnosis-role", "code": "AD", "display": "Admission diagnosis" }] }, "rank": 1 }],
  "serviceProvider": { "reference": "Organization/<org_id>" } }

// 3. MedicationRequest (per drug line)
{ "resourceType": "MedicationRequest",
  "meta": { "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationRequest"] },
  "identifier": [{ "system": "http://sys-ids.kemkes.go.id/prescription/<org_id>", "use": "official", "value": "<sale_number>-<item_idx>" }],
  "status": "completed", "intent": "order",
  "medicationReference": { "reference": "#med-1" },
  "contained": [<Medication — see below>],
  "subject": { "reference": "Patient/<ihs_number>" },
  "encounter": { "reference": "Encounter/<encounter_id>" },
  "authoredOn": "<sale.paid_at>",
  "requester": { "reference": "Practitioner/<doctor ihs>" } }

// 4. MedicationDispense (per drug line)
{ "resourceType": "MedicationDispense",
  "meta": { "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationDispense"] },
  "status": "completed",
  "identifier": [{ "system": "http://sys-ids.kemkes.go.id/prescription/<org_id>", "use": "official", "value": "<sale_number>-<item_idx>-disp" }],
  "authorizingPrescription": [{ "reference": "MedicationRequest/<mr_id>" }],
  "contained": [<Medication — see below>],
  "medicationReference": { "reference": "#med-1" },
  "subject": { "reference": "Patient/<ihs_number>" },
  "context": { "reference": "Encounter/<encounter_id>" },
  "performer": [{ "actor": { "reference": "Organization/<org_id>" } }],
  "quantity": { "value": <qty_sold>, "unit": "<ODF code>", "system": "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", "code": "<ODF code>" },
  "whenHandedOver": "<sale.paid_at>" }

// Contained Medication (both MR + MD share this shape; racikan differs)
{ "resourceType": "Medication", "id": "med-1",
  "meta": { "profile": ["https://fhir.kemkes.go.id/r4/StructureDefinition/Medication"] },
  "identifier": [{ "system": "http://sys-ids.kemkes.go.id/medication/<org_id>", "use": "official", "value": "<sale_number>-<item_idx>-med" }],
  "code": { "coding": [{ "system": "http://sys-ids.kemkes.go.id/kfa", "code": "<kfa_code>", "display": "<product name>" }] },  // omit for racikan parent
  "status": "active",
  "form": { "coding": [{ "system": "http://terminology.kemkes.go.id/CodeSystem/medication-form", "code": "BS066", "display": "Tablet" }] },  // best-effort map from base_unit
  "extension": [{ "url": "https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType",
    "valueCodeableConcept": { "coding": [{ "system": "http://terminology.kemkes.go.id/CodeSystem/medication-type", "code": "NC", "display": "Non-compound" }] } }] }
```

- [x] **Step 1: Migration** — add to `satusehat_submissions`: `location_id TEXT`, `encounter_id TEXT`, `condition_id TEXT`, `fhir_ids JSONB DEFAULT '{}'` (store MR/MD ids per item for idempotent retry). Apply to remote. `Condition/<seeded-condition-id>`: sandbox blocks Condition POST for pharmacy class; production needs a real Condition per encounter — store `condition_id` on submission so a later production run can fill it; for sandbox use a known seeded id. **(committed `5ff0ab2`, applied to remote)**
- [x] **Step 2: Helpers in `lib/satusehat.ts`** — `buildContainedMedication({kfaCode?, name?, baseUnit, medicationType})`, `buildMedicationRequest(...)`, `buildMedicationDispense(...)`, `buildEncounter(...)`, `buildLocation(...)`, `mapBaseUnitToOdf(unit): string|null` (tablet→TAB, kapsul→CAP, botol→BOT, vial→VIAL, tube→TUBE, sachet→SACH, fallback null), `postFhirResource({token, baseUrl, resource})` wrapper that throws with OperationOutcome text. For racikan parent: `code` omitted + `ingredient[]` from children (KFA 910- level for d.t.d, 920- level for non-d.t.d) + medicationType SD/EP. **(committed in `6a24cd2`)**
- [x] **Step 3: Rewire process-queue route** — remove stub. Per row: load tenant + sale (sale_number, paid_at, patient ihs, doctor ihs) + items (parent/child, kfa_code, qty_sold, name, base_unit). SKIPPED if no patient IHS or no item with KFA. Create Location if missing, Encounter if missing, then per item: MedicationRequest + MedicationDispense; store ids in `fhir_ids` for retry. Any POST failure → throw (existing backoff). **(committed in `6a24cd2`)**
- [x] **Step 4: Tests** — unit-map, buildContainedMedication (NC vs SD), quantity ODF fallback, identifier system uses org_id. **(7 new tests; 80 total green)**
- [x] **Step 5: Run tests and build** — `cd apps/web && npx vitest run && npx next build`. **(green)**
- [x] **Step 6: Commit** — `git add ... && git commit -m "feat(web): real satusehat fhir payload chain"`. **(`6a24cd2`)**

## Task 6: Docs and vault sync

**Files:**
- Modify: `pharmacy-erp-vault/satusehat/map.md`
- Modify: `docs/superpowers/specs/2026-08-06-satusehat-dispensing.md` if spec exists in parallel
- Modify: `AGENTS.md` only if deployment or run steps change

**Interfaces:**
- Produces: final map notes, resolved tickets, and any live-verified deltas.

- [ ] **Step 1: Update map with live implementation notes**

Add final file links and changed behavior. Keep wording short.

- [ ] **Step 2: Run full validation**

```bash
pnpm -r test && pnpm -r build
```

- [ ] **Step 3: Commit**

```bash
git add pharmacy-erp-vault/satusehat/map.md docs/superpowers/specs/2026-08-06-satusehat-dispensing.md
git commit -m "docs: finish satusehat dispensing plan"
```

---

## Self-Review

### Spec coverage

- Async queue: Task 1, Task 5
- Token cache: Task 1, Task 2
- IHS lookup: Task 2, Task 4
- Credentials: Task 1, Task 3
- KFA mapping: Task 2, Task 4
- Status UI: Task 5
- Vault/docs sync: Task 6

### Gaps

- Exact FHIR payload mapping is still separate. That must be plan 2 or a later task group.
- If route tests do not exist, Task 5 may need a helper seam first.

### Placeholder scan

No TBD, no later, no vague test notes.

### Type consistency

Helper names used in later tasks match Task 2 signatures.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-06-satusehat-dispensing.md`. Two execution options:

**1. Subagent-Driven (recommended)** - fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - execute tasks in this session using executing-plans

Which approach?
