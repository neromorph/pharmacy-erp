# 08 — Design: IHS lookup integration at POS

Type: grilling
Status: resolved

## Question

When a staff member selects a RESEP or BPJS patient in the cart, the app must call the SATUSEHAT IHS lookup API (NIK → ihs_number) and cache the result. What is the exact design?

This ticket resolves:

1. **DB schema change**: add `nik TEXT NULL` and `ihs_number TEXT NULL` to `patients`. Any index or constraint?
2. **POS trigger point**: at which moment in the cart flow does the lookup fire — immediately on patient select, or on a dedicated "Verify IHS" action? What if the patient has no NIK yet?
3. **Server action**: how does the lookup call reach SATUSEHAT from Next.js App Router (server action, route handler)?
4. **UX on lookup failure**: if the NIK is not found or the API errors — warn and allow sale to continue (sale still goes through; submission will be SKIPPED for this patient), or block?
5. **Re-lookup**: if `ihs_number` is already cached on the patient, skip the API call. When does a cached value get re-verified?
6. **Patients form**: add `nik` field to the `/patients` create/edit form (OWNER/PHARMACIST only, or all roles)?

## Answer

### 1. DB schema

Add nullable columns only:

```sql
ALTER TABLE patients
  ADD COLUMN nik TEXT NULL,
  ADD COLUMN ihs_number TEXT NULL;
```

No hard constraint. No extra index for v1.

### 2. POS trigger point

Fire lookup **immediately on patient select** for RESEP/BPJS. If `nik` is blank, skip lookup and show inline warning that NIK is needed for SATUSEHAT reporting.

### 3. Server path

Use server side only in Next.js App Router. Put lookup in the same server action / route handler flow that already owns cart patient state. Do not expose token to client.

### 4. Failure UX

Do **not** block sale.

- If NIK not found: warn, keep sale flow open.
- If API errors: warn, keep sale flow open.
- Submission later can be SKIPPED.

### 5. Re-lookup rule

If `ihs_number` exists, skip API call.

Re-verify only when:
- `nik` changes
- user hits a manual refresh action on patient form

No background refresh loop.

### 6. Patients form

Add `nik` field to `/patients` create/edit form.

Access: **OWNER + PHARMACIST only**.

## Answer

- `patients.nik` and `patients.ihs_number` added.
- Lookup fires on patient select.
- Miss or API error warns only.
- Cached IHS skips re-call unless NIK changes.
- NIK edit stays OWNER/PHARMACIST only.
