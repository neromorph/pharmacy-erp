# 07 — Design: FHIR MedicationDispense payload mapping

Type: grilling
Blocked by: 06
Status: resolved

## Question

How does a pharmacy-erp PAID sale translate into a SATUSEHAT FHIR `MedicationDispense` payload?

This ticket resolves:

1. **Field mapping**: for each required FHIR field, what pharmacy-erp source field provides it?
   - `subject`: `Patient` reference using `patients.ihs_number`
   - `performer`: `Practitioner` reference — from what? (doctor IHS number from API research)
   - `medication`: KFA code from `products.kfa_code` (new field, added by KFA ticket)
   - `quantity`: `sale_items.qty_base` in base unit
   - `whenHandedOver`: `sales.paid_at`
   - `authorizingPrescription`: prescription reference — how expressed?
2. **Racikan handling**: how are compound (racikan) `sale_items` submitted? One `MedicationDispense` per child ingredient, or one per parent?
3. **BPJS vs RESEP differentiation**: does the payload differ between `sale_type = 'RESEP'` and `sale_type = 'BPJS'`? Does BPJS number appear in the payload?
4. **Organization reference**: how is `performer.actor` (Apotek org) expressed — using `org_id` from tenant settings?
5. **Submission unit**: single `MedicationDispense` per sale item, or a FHIR `Bundle` per sale?

## Answer

All 9 questions grilled and approved (user: "use Recommended").

**Q1 — Submission unit: per drug line.** One `MedicationDispense` POST per sale_item, each with its `Medication` in `contained`. Matches official docs ("1 paket Medication + MedicationDispense untuk 1 jenis obat; 2 obat = 2 paket"). Simpler retry per line; no Bundle transaction complexity.

**Q2 — Medication placement: `contained`.** Sandbox REQUIRES `medicationReference: {reference: "#med-1"}` with the Medication inside `contained[]`. Verified live: external reference `Medication/test-med-001` was rejected with "Wrong reference ID format".

**Q3 — Doctor (Practitioner): build doctor IHS lookup now.** Same pattern as patient lookup (`Practitioner?identifier=...nik|...`), mirror in `apps/web/lib/satusehat.ts` + `ihs-actions.ts`; `doctors.ihs_number` populated at POS-time on RESEP/BPJS. If doctor IHS missing at submission time → SKIPPED (like missing KFA).

**Q4 — Organization reference: UUID works for performer; identifier system needs real IHS number.** `Organization/{org_id UUID}` resolves in `performer.actor`. The `identifier.system` (`http://sys-ids.kemkes.go.id/medicationdispense/{org-ihs-number}`) requires the numeric IHS number; our sandbox org has `identifier: []`. **LIVE-VERIFIED CORRECTION (2026-08-06):** MedicationDispense `identifier` IS mandatory; the working system is `http://sys-ids.kemkes.go.id/prescription/{org-id}` — the org UUID works in this system (validated 201). The docs' `.../medicationdispense/` system is rejected ("Invalid identifier system").

**Q5 — quantity unit: `v3-orderableDrugForm`.** Sandbox rejected `TAB` in UCUM (`http://unitsofmeasure.org`). Correct: `http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm`, code `TAB`/`CAP`. Map common `products.base_unit` values (tablet→TAB, kapsul→CAP, botol→BOT, vial→VIAL, tube→TUBE, etc.); omit unit on unknown.

**Q6 — `context` (Encounter): create full Encounter per sale. LIVE-VERIFIED CORRECTION.** A minimal Encounter is rejected; sandbox requires: `identifier` (system `http://sys-ids.kemkes.go.id/encounter/{org-id}` — UUID works), `status: finished`, `statusHistory` (arrived/in-progress/finished each with period), `class` + `classHistory` (AMB), `subject`, `participant` (type ATND + individual Practitioner), `period`, `location` (real Location ref — Location POST 201 works: `{status: active, name, managingOrganization}`), `diagnosis` (real Condition ref + use AD + rank — Condition POST is BLOCKED for pharmacy class "Rule 20004"; sandbox has seeded Conditions, reference one), `serviceProvider`. Validated 201 with seeded Condition `7725001a-d023-4e63-8d83-46be3d9dd4f7`.

**Q6b — MedicationRequest chain (NEW, mandatory):** `authorizingPrescription` in MedicationDispense is MANDATORY (Rule 10393) — my earlier "omit" recommendation was wrong. A complete chain per drug line is required and live-validated 201:
1. `POST /Location` (once per org) — `{status: active, name, managingOrganization: Organization/{org}}`
2. `POST /Encounter` (once per sale) — shape above
3. `POST /MedicationRequest` (per drug line) — `identifier` (system `http://sys-ids.kemkes.go.id/prescription/{org-id}`), `status: completed`, `intent: order`, `medicationReference: {reference: "#med-1"}` with contained Medication, `subject`, `encounter`, `authoredOn`, `requester: Practitioner/{ihs}`
4. `POST /MedicationDispense` (per drug line) — `identifier` (system `http://sys-ids.kemkes.go.id/prescription/{org-id}`), `authorizingPrescription: [{reference: MedicationRequest/{id}}]`, contained Medication, `medicationReference #med-1`, `subject`, `context: Encounter/{id}`, `performer: Organization/{org}`, `quantity` (v3-orderableDrugForm), `whenHandedOver`

Submission unit per drug line now = 2 POSTs (MR + MD), sharing one Location + one Encounter per sale.

**Q7 — BPJS: identical payload.** No BPJS-specific fields in MedicationDispense. SEP/eligibility goes through BPJS systems, not SATUSEHAT dispensing.

**Q8 — `dosageInstruction`: omit.** We don't capture sig at POS; `dosageInstruction` is optional. Add when sig capture exists.

**Q9 — Racikan: one MedicationDispense per compound batch.** `Medication.code` empty + `ingredient[]` with KFA codes (d.t.d: `910xxxxx` active substance, numerator/denominator per docs; non-d.t.d: `920xxxxx` template). `medicationType` extension = SD (compound d.t.d) or EP (compound non-d.t.d); NC for non-compound. Parent compound sale_item (no product_id) carries the MedicationRequest+MedicationDispense pair; children become `ingredient[]`.

**Exact required shape (sandbox-verified 2026-08-06):**

- `meta.profile`: `https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationDispense` (and `.../Medication` on the contained resource)
- `status`: `completed`
- `identifier`: ONE entry, system `http://sys-ids.kemkes.go.id/prescription/{org-id}`, value = local dispense ID — MANDATORY (Rule 10389)
- `authorizingPrescription`: `[{reference: "MedicationRequest/{id}"}]` — MANDATORY (Rule 10393)
- `contained[0].Medication`: `meta.profile` Medication SD; `identifier` (system `http://sys-ids.kemkes.go.id/medication/{org-id}`); `code.coding` = KFA (`http://sys-ids.kemkes.go.id/kfa`, code + display); `status: active`; `form.coding` system `http://terminology.kemkes.go.id/CodeSystem/medication-form` (e.g. BS066 Tablet — NOT the KFA-DosageForm system); `extension: medicationType` url `https://fhir.kemkes.go.id/r4/StructureDefinition/MedicationType`, valueCodeableConcept coding system `http://terminology.kemkes.go.id/CodeSystem/medication-type`, code NC/SD/EP
- `medicationReference`: `{reference: "#med-1"}`
- `subject`: `Patient/{ihs_number}`
- `context`: `Encounter/{encounter_id}` (Q6)
- `performer`: `[{actor: {reference: "Organization/{org_id}"}}]` — Practitioner omitted in performer (org dispenses); Practitioner appears in MR.requester + Encounter.participant
- `quantity`: `{value, unit, system: "http://terminology.hl7.org/CodeSystem/v3-orderableDrugForm", code}`
- `whenHandedOver`: `sales.paid_at` (ISO, UTC)

**Full validated chain (all 201):** Location (`dedd51a2-d35e-4417-8f5f-ced29621ae43`) → Encounter (`6f442441-bbbb-4544-ab89-e76bd117ebac`) → MedicationRequest (`71dccf04-405a-4a02-a625-b57c381c11f4`) → MedicationDispense (`91f18a79-1c64-4c12-b1d0-6d921d0a0989`).

**Sandbox test history** (`/tmp/md_test*.json`): attempt 1 failed — `TAB` not in UCUM for quantity; medicationReference must be `#ref` contained; identifier.system invalid. Attempt 2 failed — contained Medication requires extension + identifier. Attempt 3 failed — `form` system `http://terminology.kemkes.go.id/id/KFA-DosageForm` invalid. Attempt 4 failed — medication-type system needs `http://` not `https://`; quantity system wrong. Attempt 5 failed — org IHS number in identifier system must match token's org (10000004 wrong; UUID also invalid because no IHS number registered); `context` mandatory. Attempt 6 (`md_full.json`) — `identifier` + `authorizingPrescription` mandatory (Rule 10389/10393). Final attempt (contained Medication + prescription-system identifier + authorizingPrescription + context) → **201**.

**Encounter trials:** minimal rejected (missing identifier/statusHistory/participant/location/diagnosis); diagnosis `use` system is `http://terminology.hl7.org/CodeSystem/diagnosis-role` (not `https://www.hl7.org/fhir/Codesystem-diagnosis-role`); placeholder Condition ref rejected (`reference_not_found`); real seeded Condition `7725001a-d023-4e63-8d83-46be3d9dd4f7` accepted → 201. Condition POST itself blocked for pharmacy class (Rule 20004). Practitioner POST blocked (403 consent/privacy); seeded `N10000001`/`N10000002` available.
