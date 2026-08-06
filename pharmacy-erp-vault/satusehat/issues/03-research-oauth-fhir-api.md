# 03 — Research: SATUSEHAT OAuth2 + FHIR MedicationDispense API

Type: research
Status: resolved

## Question

What are the exact technical requirements for the SATUSEHAT OAuth2 token flow and the MedicationDispense submission endpoint?

Specifically:

1. **OAuth2 flow**: exact token endpoint URL (staging + production), request format (`client_credentials` grant, headers, body), token TTL, and whether tokens are scoped per-tenant or per-call.
2. **MedicationDispense endpoint**: URL, HTTP method, required headers (`Authorization`, `X-Organization-Id`, etc.), and whether it accepts a single resource or a FHIR Bundle.
3. **Required FHIR fields** on `MedicationDispense`: status, medication (coded by KFA), subject (Patient reference — IHS number format), performer (Practitioner — doctor IHS/SIP?), authorizingPrescription, quantity, whenHandedOver, and any Indonesia-specific extensions.
4. **Practitioner requirement**: is a `Practitioner` resource required for the prescribing doctor, and if so, how is the doctor's identity expressed (SIP number, IHS number, or both)?
5. **Racikan (compound) handling**: how should compound prescriptions be submitted — one `MedicationDispense` per ingredient, one per compounded batch, or a Bundle?
6. **Token caching**: does the API enforce one token per `client_id` (re-use required) or is a fresh token per call acceptable?
7. **Rate limits and retry guidance**: any published rate limits, backoff recommendations, or idempotency keys.

## Answer

Sources: satusehat.kemkes.go.id official docs, simplifier.net SATUSEHAT FHIR R4 IG, official SATUSEHAT Postman collection.

### 1. OAuth2 flow

**Token endpoint:**
- Sandbox: `https://api-satusehat-stg.dto.kemkes.go.id/oauth2/v1/accesstoken?grant_type=client_credentials`
- Production: `https://api-satusehat.kemkes.go.id/oauth2/v1/accesstoken?grant_type=client_credentials`

**Request:** POST, `Content-Type: application/x-www-form-urlencoded`, body: `client_id=<id>&client_secret=<secret>`

**Token TTL:** live sandbox call returned `expires_in: 14399` (4 hours). `refresh_token_expires_in: 0` — no refresh token; fetch a new token after expiry.

**Token shape (confirmed from docs):**
```json
{
  "token_type": "BearerToken",
  "access_token": "<token>",
  "expires_in": "3599",
  "client_id": "<id>"
}
```

**Caching:** Re-use until expiry is the intended pattern. Cache per tenant keyed by `client_id`; check `expires_at` before each submission.

### 2. MedicationDispense endpoint

**FHIR base:**
- Sandbox: `https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1`
- Production: `https://api-satusehat.kemkes.go.id/fhir-r4/v1`

**Submit:** `POST {base}/MedicationDispense` — header `Authorization: Bearer <token>`, `Content-Type: application/json`.

SATUSEHAT requires submitting `Medication` + `MedicationDispense` as a **paired submission per drug line**. The docs say "dikirimkan secara bersamaan sebagai 1 paket" (sent together as 1 package). The official Postman collection uses a FHIR transaction Bundle. Two drugs in one dispensing = two Medication+MedicationDispense pairs inside one Bundle. For an Apotek with no upstream MedicationRequest: submit `Medication` first (or in Bundle), then reference it in `MedicationDispense.medicationReference`.

### 3. Required FHIR fields on MedicationDispense

Key mandatory fields (from official SATUSEHAT docs):

| Field | Value |
|---|---|
| `resourceType` | `"MedicationDispense"` |
| `identifier[].system` | `http://sys-ids.kemkes.go.id/medicationdispense/{org-ihs-number}` |
| `identifier[].value` | internal dispense ID (sale item UUID) |
| `status` | `"completed"` |
| `medicationReference.reference` | `"Medication/{id}"` — reference to paired Medication resource |
| `subject.reference` | `"Patient/{patient-ihs-number}"` |
| `performer[].actor.reference` | `"Practitioner/{practitioner-ihs-number}"` (doctor) |
| `performer[].actor.reference` | `"Organization/{org-ihs-number}"` (Apotek — tenant's org_id) |
| `quantity.value` | quantity dispensed (numeric) |
| `quantity.unit` | unit string e.g. `"TAB"`, `"CAP"`, `"BOT"` |
| `whenHandedOver` | ISO 8601 datetime e.g. `"2026-08-06T10:00:00+07:00"` |
| `dosageInstruction[].text` | free-text sig e.g. `"3x sehari sesudah makan"` |

`authorizingPrescription` — references a `MedicationRequest`; can be omitted for Apotek-only flow (no electronic prescription upstream).

The `Medication` resource (paired) holds the KFA code:
- `Medication.code.coding[].system`: `"http://sys-ids.kemkes.go.id/kfa"`
- `Medication.code.coding[].code`: `"<93xxxxxx>"` (actual product code)
- For racikan: `Medication.code` may be empty; use `Medication.ingredient[]` instead.

### 4. Practitioner requirement

**Yes — required.** The doctor's IHS number from Master Nakes Index (MNI) must appear in `performer[].actor.reference`. Lookup: `GET {base}/Practitioner?identifier=https://fhir.kemkes.go.id/id/nik|<nik>`. Doctor's NIK is the lookup key.

**Impact on schema:** `doctors` table needs `nik TEXT NULL` and `ihs_number TEXT NULL` — same pattern as patients. Lookup at doctor-select in the RESEP/BPJS cart (mirror of IHS patient lookup design, ticket 08).

### 5. Racikan (compound) handling

KFA code hierarchy: `91xxx` = zat aktif (active ingredient), `92xxx` = produk obat virtual, `93xxx` = produk obat aktual (branded/dispensed).

For racikan (compound): one `Medication` + one `MedicationDispense` per racikan **batch** (the compounded unit, not per ingredient). Ingredients listed inside `Medication.ingredient[].itemCodeableConcept` each with their KFA code (91xxx or 93xxx). `Medication.code` can be empty for the parent compounded item.

This maps cleanly to pharmacy-erp's `sale_items` model: parent `sale_item` (racikan batch) → one Medication+MedicationDispense pair; child `sale_items` (ingredients) → `Medication.ingredient[]` entries.

### 6. Token caching

Re-use until expiry is the standard pattern. Cache per tenant in a `satusehat_tokens` table: `(tenant_id, access_token, expires_at)`. Check `expires_at - now() < 60s` before each job; refresh if near expiry.

### 7. Rate limits and retry

No published rate limits in official docs. For production: exponential backoff with jitter (1s → 2s → 4s, max 3 retries), mark FAILED after exhaustion. Use `identifier.value` (internal UUID) as idempotency signal on re-submission. No official idempotency key header documented.

### Gaps

- Bundle vs sequential POST: docs say "1 paket" but the exact HTTP pattern (one Bundle POST vs POST Medication then POST MedicationDispense) needs Postman collection confirmation.
- `authorizingPrescription` omission for Apotek-only flow: docs are ambiguous; likely acceptable but not explicitly confirmed.
- Production rate limits: unknown until tested with live credentials.
