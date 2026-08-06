# 05 — Research: SATUSEHAT IHS patient lookup API

Type: research
Status: resolved

## Question

SATUSEHAT identifies patients by their IHS (Individual Health Service) number. At POS-time, we look up the IHS number from the patient's NIK (national ID). What are the technical facts needed to design this lookup?

Specifically:

1. **Endpoint**: exact URL (staging + production) for the IHS patient lookup by NIK.
2. **Auth**: does the lookup use the same OAuth2 `client_credentials` token as MedicationDispense, or a different auth scheme?
3. **Request format**: HTTP method, headers, body or query params; does it take NIK only, or also BPJS number / name / birthdate?
4. **Response shape**: what fields are returned? Specifically: IHS number field name, patient name, and any address/demographic fields.
5. **Error cases**: what does the API return if the NIK is not found, not registered in IHS, or the patient has multiple records?
6. **Rate limits**: any known throttling or per-tenant quotas on the lookup endpoint.
7. **UX recommendation**: given the findings, how should the POS handle the case where a RESEP/BPJS patient has no NIK or their NIK lookup returns no result?

## Answer

Sources: satusehat.kemkes.go.id MPI docs, FHIR Patient resource docs, simplifier.net SATUSEHAT FHIR R4 IG.

### 1. Endpoint

**Patient search (NIK lookup):**
- Sandbox: `https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1/Patient`
- Production: `https://api-satusehat.kemkes.go.id/fhir-r4/v1/Patient`

**GET by NIK:** `GET {base}/Patient?identifier=https://fhir.kemkes.go.id/id/nik|<nik-value>`

Example: `GET {base}/Patient?identifier=https://fhir.kemkes.go.id/id/nik|3273246309870001`

**GET by IHS number (once known):** `GET {base}/Patient/100000030009` (direct resource read)

### 2. Auth

**Same token.** The Patient lookup uses the same OAuth2 Bearer token (`Authorization: Bearer <token>`) as the MedicationDispense endpoint. No separate auth scheme.

### 3. Request format

- **Method:** GET
- **Header:** `Authorization: Bearer <token>`
- **Query param:** `identifier=https://fhir.kemkes.go.id/id/nik|<16-digit-nik>`
- NIK is the primary lookup key. BPJS number lookup is not the standard MPI path (MPI is NIK-centric). Name/birthdate search is also available but NIK is the most reliable.

**Alternative lookup by IHS number:** `identifier=https://fhir.kemkes.go.id/id/ihs-number|<ihs-number>`

### 4. Response shape

Returns a FHIR `Bundle` with `entry[]` containing `Patient` resources. The IHS number is the Patient resource `id` (e.g. `"100000030009"`). The IHS number also appears in `identifier[]` with `system: "https://fhir.kemkes.go.id/id/ihs-number"`.

Key fields in the Patient resource:
- `id` — the IHS number (use this as `patient-ihs-number` in MedicationDispense.subject.reference)
- `identifier[].system: "https://fhir.kemkes.go.id/id/nik"`, `value: "<nik>"`
- `name[].text` — full name
- `telecom[]` — phone
- `address[]` — address with `city`, `postalCode`, `province`
- `birthDate`
- `gender`

### 5. Error cases

From the MPI documentation flow ("Pasien dengan NIK"):

- **NIK found → IHS number returned:** use IHS number directly.
- **NIK not found (no existing patient record):** API returns empty Bundle (`entry: []`). Next step per official docs: `POST Patient` to create a new patient record in SATUSEHAT MPI with the NIK and demographic data, then the response contains the new IHS number.
- **Patient not registered in SATUSEHAT:** same as not found — empty Bundle.
- **Multiple records:** FHIR Bundle may return multiple entries; use the first match or prompt staff to disambiguate.

The official flow for pharmacies:
1. `GET Patient?identifier=...nik|<nik>` → if found, cache `patient.id` as `ihs_number`
2. If not found → `POST Patient` (create with NIK + name + address + birthdate) → get new IHS number
3. Store `ihs_number` on `patients` table for all future visits

### 6. Rate limits

No published rate limits found. Same unknown production behaviour as MedicationDispense endpoint. Apply same conservative retry strategy.

### 7. UX recommendation

**If patient has no NIK on record:**
- Show an inline warning in the RESEP/BPJS cart: "No NIK on file — add NIK to patient record to enable SATUSEHAT reporting."
- Allow sale to proceed. Submission job will mark as SKIPPED (no IHS number to resolve).
- Do not block the POS transaction.

**If NIK lookup returns no result (patient not in MPI):**
- Auto-create the patient in SATUSEHAT MPI (`POST Patient`) using name + NIK + address from the local `patients` record.
- Cache the returned IHS number on the patient.
- This is the official recommended flow — not an error condition.

**If `POST Patient` also fails (API error):**
- Warn staff, allow sale, mark submission SKIPPED.

**Implication for schema:**
- `patients.nik TEXT NULL` — NIK for lookup
- `patients.ihs_number TEXT NULL` — cached after first successful lookup or create

**Implication for doctors table (from ticket 03 research):**
- `doctors.nik TEXT NULL` — doctor NIK for Practitioner lookup
- `doctors.ihs_number TEXT NULL` — cached Practitioner IHS number
- Lookup: `GET {base}/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|<nik>`
