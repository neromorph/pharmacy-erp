# 04 — Research: KFA catalog — structure, lookup, and bulk import

Type: research
Status: resolved

## Question

SATUSEHAT's `MedicationDispense` requires a KFA (Katalog Farmasi Alkes) code per medication. What are the technical facts needed to design the KFA soft-gate?

Specifically:

1. **Code format**: what does a KFA code look like (length, prefix, numeric/alphanumeric)?
2. **Lookup API**: is there a SATUSEHAT or Kemenkes API to search KFA codes by drug name or BPOM registration number? If so: endpoint, auth, request/response shape.
3. **Static catalog**: is a downloadable KFA catalog available (CSV, JSON, Excel)? If so: where, how often updated, and what fields does it contain?
4. **Relationship to BPOM reg number**: is the KFA code derivable from the BPOM registration number already stored on products, or is it an independent code?
5. **Mandatory vs optional in payload**: if the KFA code is absent, does the SATUSEHAT API reject the `MedicationDispense`, return a warning, or accept it silently?
6. **Recommendation**: given the findings, what is the lowest-friction path to ship KFA mapping for a pharmacy with ~200 products?

## Answer

Sources: satusehat.kemkes.go.id/platform/docs/id/master-data/kfa/, terminology docs, FHIR resource docs.

### 1. Code format

KFA codes are numeric, 8 digits, with a hierarchical prefix:
- `91xxxxxx` — zat aktif / active ingredient (virtual substance)
- `92xxxxxx` — produk obat virtual (generic formulation)
- `93xxxxxx` — produk obat aktual (branded, dispens-level — use this for `Medication.code` in dispensing)

Examples from official docs: `93000515` (Diazepam 5mg Tablet MERSIFARMA), `93000149` (Methylprednisolone 8mg DEXA MEDICA), `93012829` (Amlodipine/Atorvastatin CADUET). For racikan ingredients at active-substance level: `91000260` (Gabapentin), `91000150` (Methylprednisolone), `91000107` (Ibuprofen).

### 2. Lookup API (KFA REST API)

There is a full KFA REST API with multiple versions:

**Base URLs:**
- Sandbox: `https://api-satusehat-stg.dto.kemkes.go.id/kfa-v2`
- Production: `https://api-satusehat.kemkes.go.id/kfa-v2`

**Product lookup endpoint:** `GET {kfa-base}/products`

**Query parameters:**
- `product_type` (required): `Obat` for medicine
- `code` (required): KFA code or BPOM NIE code
- `page`, `size`: pagination for list endpoints
- `search`: text search by name
- `state`, `active`: filter by catalog state

**KFA lookup:** Pass `product_type=Obat&code=<kfa_code>` to look up by KFA code. The response includes the full product record.

**NIE (BPOM) lookup:** Pass `product_type=Obat&code=<nomor-registrasi-bpom>` to look up by BPOM registration number. The response includes the matched KFA code.

**Auth:** Uses the same OAuth2 Bearer token as FHIR endpoints.

**Response includes:** `kfa_code`, product name, `nie` (BPOM number), `lkpp` data, dosage form, strength.

Also a v3 endpoint for alat kesehatan (medical devices): `{base}/kfa-v3/alkes/products`.

### 3. Static catalog / bulk download

No official downloadable CSV/Excel found in the docs. The KFA API is the official lookup mechanism. However: the KFA API supports paginated retrieval of all products (`GET /kfa-v2/products?identifier=kfa&page=1&size=100`), so a one-time bulk fetch and local cache is feasible. The `updated_from_date` / `updated_to_date` parameters enable incremental sync.

### 4. Relationship to BPOM registration number

**Derivable via lookup, not by formula.** The BPOM Nomor Izin Edar (NIE) is a separate identifier stored in the KFA record alongside the KFA code. You can query `GET /kfa-v2/products?identifier=nie&search=<NIE>` to resolve NIE → KFA code. This is the bridge for products that already have a BPOM number on the `products` table.

### 5. Mandatory vs optional

For **non-racikan** dispensing: `Medication.code.coding` with a KFA code is **mandatory** in the `Medication` resource. The docs state "Medication.code wajib diisi apabila mengirimkan data obat non-racikan." Submitting without a KFA code for a non-racikan drug will likely result in a validation error from the SATUSEHAT API.

For **racikan**: `Medication.code` may be empty; KFA codes appear on ingredients in `Medication.ingredient[].itemCodeableConcept`.

### 6. Recommendation — lowest-friction path for ~200 products

1. **Add `kfa_code TEXT NULL` to `products` table** (soft gate: existing products unaffected).
2. **Add a KFA lookup button on the product edit page**: call the KFA API (`/kfa-v2/products?identifier=nie&search=<bpom_number>`) to auto-populate `kfa_code` from the existing BPOM number where it exists.
3. **Manual fallback**: staff can also search by drug name (`search=<name>`) and pick from results.
4. **Products without `kfa_code`**: submission job skips them (SKIPPED status), shows warning on product detail page.
5. **One-time bulk pre-population**: run a script against KFA API using each product's BPOM number to pre-fill as many codes as possible before go-live.

This path requires no manual KFA catalog management — the KFA API is the source of truth.
