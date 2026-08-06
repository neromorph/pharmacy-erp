# BPJS/JKN Zero-Fee Rule — Design Spec

**Regulation**: SE 031/XI/2014 — Tuslah and Embalase fees are waived for BPJS/JKN prescription sales.  
**Date**: 2026-08-06

---

## Destination

A cashier can select `BPJS` as the sale type for a prescription sale. The system enforces zero Tuslah and zero Embalase at the UI level (locked inputs) and the DB level (CHECK constraint). A BPJS sale requires a valid patient with a BPJS membership number (No. Peserta); the Pay button blocks checkout if the number is missing. BPJS sales appear in SIPNAP reporting under Pengeluaran Untuk Resep alongside `RESEP` sales.

---

## Data Model

### Migration `20260806000002_bpjs_sale_type.sql`

**1. Add enum value**

```sql
ALTER TYPE public.sale_type ADD VALUE 'BPJS' AFTER 'RESEP';
```

**2. Add `patients.bpjs_number`**

```sql
ALTER TABLE public.patients
  ADD COLUMN bpjs_number TEXT;
```

Nullable. Only BPJS patients have a membership number.

**3. DB CHECK constraint — SE 031/XI/2014 guardian**

```sql
ALTER TABLE public.sales
  ADD CONSTRAINT check_bpjs_zero_fees
  CHECK (sale_type <> 'BPJS' OR (tuslah_amount = 0 AND embalase_amount = 0));
```

Enforces the zero-fee rule even if a future API call bypasses the UI.

**4. Update `get_sipnap_report` RPC**

Drop and recreate the function. Replace every occurrence of `sale_type = 'RESEP'` with `sale_type IN ('RESEP', 'BPJS')` in:
- The Pengeluaran Untuk Resep aggregation (stock out counts).
- The SIPNAP hard-block validation (doctor + patient required fields check).

BPJS shares all RESEP requirements: doctor name, doctor SIP, patient name, patient address.

---

## UI Changes

### 1. Cart builder (`apps/web/app/sales/new/cart-builder.tsx`)

**BPJS option**: Add `BPJS` as a third prescription mode option alongside `RESEP` in the sale-type selector. Displayed as a toggle/button group: `OTC | RESEP | BPJS`.

**Fee lock**: When `sale_type = 'BPJS'`:
- Tuslah input: disabled, value forced to `0`.
- Per-item embalase input: disabled, value forced to `0`.
- Show a green "BPJS" badge in the cart header.

**Doctor + patient selectors**: required, same as `RESEP`. No change to existing selector logic.

**KERAS auto-flip**: stays as `RESEP` — BPJS is a payment-program choice made consciously by the cashier, not a drug-classification consequence.

**PSIKOTROPIKA / NARKOTIKA hard gates**: unchanged — same rules apply regardless of BPJS status.

**BPJS Number Guard**: When `sale_type = 'BPJS'` and the selected patient has `bpjs_number = null` or `bpjs_number = ''`:
- Pay / Checkout button is disabled.
- Show a toast: *"Patient [name] is missing No. Peserta BPJS — update the patient record before processing a BPJS sale."*
- The patient query in the cart must include `bpjs_number` in the selected columns.

### 2. Patients form (`/patients`)

Add an optional text field **"No. Peserta BPJS"** (`bpjs_number`) to both the create and edit patient forms. Placeholder: `e.g. 0001234567890`. No validation beyond non-empty string — the number format is BPJS-internal.

### 3. Receipt (`/receipts/[saleId]`)

When `sale_type = 'BPJS'`:
- Show a **"BPJS"** badge in the patient/prescription header block.
- Show `bpjs_number` below the patient name (if present).
- Tuslah and Embalase line items render `0` — no logic change needed; they read the stored `tuslah_amount` / `embalase_amount` which are already `0`.

### 4. Sale detail (`/sales/[id]`)

When `sale_type = 'BPJS'`:
- Show the **"BPJS"** badge alongside the existing doctor/patient info block.
- Show `bpjs_number` below the patient name (if present).

---

## SIPNAP Reporting

No new split category. BPJS is grouped with RESEP under **Pengeluaran Untuk Resep** in the `get_sipnap_report` RPC. The RPC is dropped and recreated in the migration; its body is otherwise unchanged.

Hard-block checks: BPJS sales apply the same missing-field rules as RESEP (doctor name, doctor SIP, patient name, patient address).

---

## Error Handling

| Scenario | Handling |
|---|---|
| Checkout with BPJS + missing `bpjs_number` | Pay button disabled; toast shown |
| DB INSERT with non-zero tuslah/embalase on BPJS sale | CHECK constraint rejects; server action surfaces error |
| BPJS sale with PSIKOTROPIKA / NARKOTIKA drug | Hard gate unchanged — requires patient address, same as RESEP |

---

## Testing

Pure helpers in `apps/web/lib/`:
- `computeSaleTotals` already tested — add a case: BPJS sale with racikan lines → tuslah=0, embalaseTotal=0.
- New helper `isBpjsCheckoutBlocked(saleType, patient)` → returns `true` when `saleType === 'BPJS'` and `!patient?.bpjs_number`. Tested with: BPJS+no number (blocked), BPJS+number (not blocked), RESEP+no number (not blocked).

No new DB tests needed — the CHECK constraint is verified by attempting an invalid INSERT in the migration self-test comment.

---

## Out of scope

- BPJS claim submission / electronic claim integration.
- Per-item BPJS coverage tracking.
- Multiple BPJS numbers per patient.
- "Untuk BPJS" as a separate SIPNAP pengeluaran column.
