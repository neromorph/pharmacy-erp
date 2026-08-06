# BPJS/JKN Zero-Fee Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `BPJS` as a sale type that enforces zero Tuslah and Embalase (SE 031/XI/2014), stores the patient's BPJS membership number, and groups BPJS with RESEP in SIPNAP reporting.

**Architecture:** One migration adds the enum value, the DB CHECK constraint, and `patients.bpjs_number`; it also drops and recreates `get_sipnap_report` to include BPJS in the RESEP aggregation. The cart builder gains a BPJS mode that locks fees to zero and guards the Pay button when the patient's `bpjs_number` is missing. The patients form, receipt, and sale detail pages display the new field.

**Tech Stack:** Next.js 16 App Router, Supabase (self-hosted), TypeScript 6, pnpm 11, vitest.

## Global Constraints

- Never use service_role in request paths — always the user's JWT.
- Remote migrate via: `ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase'` (the `-i` flag is required).
- `pnpm -r test` and `pnpm -r build` must be green after every task.
- ASD-STE100: short sentences, controlled vocabulary in all copy and comments.
- No new dependencies — use React state and native form elements.

---

## File Map

| File | Change |
|---|---|
| `supabase/migrations/20260806000002_bpjs_sale_type.sql` | **Create** — enum value, `patients.bpjs_number`, CHECK constraint, updated RPC |
| `apps/web/lib/cart.ts` | **Modify** — add `isBpjsCheckoutBlocked` helper; add `'BPJS'` to `SaleDraftPayload.sale_type` |
| `apps/web/lib/cart.test.ts` | **Modify** — add tests for `isBpjsCheckoutBlocked` and BPJS totals |
| `apps/web/app/sales/new/cart-builder.tsx` | **Modify** — BPJS option in selector; fee lock; BPJS Number Guard; pass `bpjs_number` |
| `apps/web/app/patients/actions.ts` | **Modify** — include `bpjs_number` in `fields()` |
| `apps/web/app/patients/page.tsx` | **Modify** — add `bpjs_number` field to create and edit forms; show column in table |
| `apps/web/app/receipts/[saleId]/page.tsx` | **Modify** — BPJS badge and `bpjs_number` in prescription header; extend patient select |
| `apps/web/app/sales/[id]/page.tsx` | **Modify** — BPJS badge and `bpjs_number` in doctor/patient block; extend patient select |

---

## Task 1: Migration — enum, column, constraint, RPC update

**Files:**
- Create: `supabase/migrations/20260806000002_bpjs_sale_type.sql`

**Interfaces:**
- Produces: `sale_type` enum includes `'BPJS'`; `patients.bpjs_number TEXT NULL`; `check_bpjs_zero_fees` constraint on `sales`; `get_sipnap_report` counts `sale_type IN ('RESEP','BPJS')` as `pengeluaran_resep`.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration: BPJS sale type (SE 031/XI/2014 zero-fee rule)
-- Run as supabase_admin.

-- 1. Add BPJS to the sale_type enum (idempotent guard).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'sale_type' AND e.enumlabel = 'BPJS'
  ) THEN
    ALTER TYPE public.sale_type ADD VALUE 'BPJS' AFTER 'RESEP';
  END IF;
END$$;

-- 2. BPJS membership number on patients (nullable — only BPJS patients have one).
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS bpjs_number TEXT;

-- 3. DB guardian for SE 031/XI/2014: BPJS sales must have zero fees.
ALTER TABLE public.sales
  DROP CONSTRAINT IF EXISTS check_bpjs_zero_fees;
ALTER TABLE public.sales
  ADD CONSTRAINT check_bpjs_zero_fees
  CHECK (sale_type <> 'BPJS' OR (tuslah_amount = 0 AND embalase_amount = 0));

-- 4. Update get_sipnap_report: group BPJS with RESEP in Pengeluaran Untuk Resep.
--    Drop and recreate (same body as 20260806000001; only the sales_out CTE and
--    the validation block change).
DROP FUNCTION IF EXISTS public.get_sipnap_report(integer, integer);
```

Then copy the full body of `get_sipnap_report` from `supabase/migrations/20260806000001_sipnap_v2.sql` (the `CREATE OR REPLACE FUNCTION public.get_sipnap_report` block to its final `$$;`) and paste it here, making **two targeted changes**:

**Change A** — in the `sales_out` CTE (around line 211 of the v2 migration), replace:
```sql
COALESCE(SUM(CASE WHEN s.sale_type = 'RESEP' THEN si.qty_sold ELSE 0 END), 0) AS pengeluaran_resep,
```
with:
```sql
COALESCE(SUM(CASE WHEN s.sale_type IN ('RESEP', 'BPJS') THEN si.qty_sold ELSE 0 END), 0) AS pengeluaran_resep,
```

**Change B** — in the validation CTE (around lines 175–188 of the v2 migration), the SARANA branch checks `sale_type = 'SARANA'` and the RESEP branch checks `sale_type <> 'SARANA'`. BPJS shares all RESEP requirements, so the existing `sale_type <> 'SARANA'` condition already covers it. No change needed here — verify by reading the block.

- [ ] **Step 2: Apply to remote DB**

```bash
ssh mufid@100.119.164.5 'docker exec -i pharmacy-supabase-db psql -U supabase_admin -d supabase' \
  < supabase/migrations/20260806000002_bpjs_sale_type.sql
```

Expected: `DO`, `ALTER TABLE` (×2), `DROP FUNCTION`, `CREATE FUNCTION` — no errors.

- [ ] **Step 3: Verify constraint and enum live**

```bash
ssh mufid@100.119.164.5 "docker exec pharmacy-supabase-db psql -U supabase_admin -d supabase -c \
  \"SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname='sale_type' ORDER BY enumsortorder;\""
```

Expected rows: `OTC`, `RESEP`, `BPJS`, `SARANA`.

```bash
ssh mufid@100.119.164.5 "docker exec pharmacy-supabase-db psql -U supabase_admin -d supabase -c \
  \"SELECT column_name FROM information_schema.columns WHERE table_name='patients' AND column_name='bpjs_number';\""
```

Expected: 1 row.

- [ ] **Step 4: Run tests and build**

```bash
pnpm -r test && pnpm -r build
```

Expected: all green (schema change only — no app code changed yet).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260806000002_bpjs_sale_type.sql
git commit -m "feat(db): BPJS sale type, bpjs_number on patients, zero-fee CHECK"
```

---

## Task 2: Pure helpers — `isBpjsCheckoutBlocked` and type update

**Files:**
- Modify: `apps/web/lib/cart.ts`
- Modify: `apps/web/lib/cart.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `isBpjsCheckoutBlocked(saleType: string, patient: { bpjs_number?: string | null } | null): boolean` — exported from `apps/web/lib/cart.ts`.
  - `SaleDraftPayload.sale_type` now includes `'BPJS'`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/lib/cart.test.ts`:

```typescript
describe('isBpjsCheckoutBlocked', () => {
  it('blocks when sale_type is BPJS and patient has no bpjs_number', () => {
    expect(isBpjsCheckoutBlocked('BPJS', { bpjs_number: null })).toBe(true)
    expect(isBpjsCheckoutBlocked('BPJS', { bpjs_number: '' })).toBe(true)
    expect(isBpjsCheckoutBlocked('BPJS', null)).toBe(true)
  })
  it('does not block when sale_type is BPJS and patient has a bpjs_number', () => {
    expect(isBpjsCheckoutBlocked('BPJS', { bpjs_number: '0001234567890' })).toBe(false)
  })
  it('does not block for non-BPJS sale types regardless of bpjs_number', () => {
    expect(isBpjsCheckoutBlocked('RESEP', { bpjs_number: null })).toBe(false)
    expect(isBpjsCheckoutBlocked('OTC', null)).toBe(false)
  })
})
```

Also add to the `computeSaleTotals` describe block:

```typescript
  it('BPJS: tuslah 0 and embalase 0 produce correct grand total', () => {
    const lines = [
      { kind: 'item', product_id: 'i', qty: 3, unit_price: 10000 },
      { kind: 'racikan', name: 'R', price: 20000, dosage_count: 5, embalase: 0 },
    ]
    const totals = computeSaleTotals(lines, 0)
    expect(totals.subtotal).toBe(50000)
    expect(totals.embalaseTotal).toBe(0)
    expect(totals.grandTotal).toBe(50000)
  })
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter @pharmacy/web test
```

Expected: `isBpjsCheckoutBlocked is not a function` (or similar import error).

- [ ] **Step 3: Implement**

In `apps/web/lib/cart.ts`:

Update `SaleDraftPayload.sale_type`:
```typescript
export interface SaleDraftPayload {
  sale_type: 'OTC' | 'RESEP' | 'BPJS' | 'SARANA'
  // ... rest unchanged
}
```

Add the helper (after `ingredientTotalQty`):
```typescript
// Returns true when a BPJS sale cannot proceed because the patient's
// BPJS membership number (No. Peserta) is missing.
export function isBpjsCheckoutBlocked(
  saleType: string,
  patient: { bpjs_number?: string | null } | null
): boolean {
  if (saleType !== 'BPJS') return false
  return !patient?.bpjs_number
}
```

Add `isBpjsCheckoutBlocked` to the import in `cart.test.ts`.

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter @pharmacy/web test
```

Expected: all pass including the new cases.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/cart.ts apps/web/lib/cart.test.ts
git commit -m "feat(web): isBpjsCheckoutBlocked helper + BPJS sale type"
```

---

## Task 3: Cart builder — BPJS option, fee lock, Number Guard

**Files:**
- Modify: `apps/web/app/sales/new/cart-builder.tsx`

**Interfaces:**
- Consumes: `isBpjsCheckoutBlocked` from `apps/web/lib/cart`.
- Produces: cart supports `sale_type = 'BPJS'`; tuslah and embalase inputs disabled when BPJS; Pay button disabled with toast when patient has no `bpjs_number`.

- [ ] **Step 1: Update `PatientLite` interface and state type**

In `cart-builder.tsx`, change:

```typescript
// Before:
interface PatientLite { id: string; name: string; address: string | null }
// and:
const [saleType, setSaleType] = useState<'OTC' | 'RESEP' | 'SARANA'>('OTC')
```

```typescript
// After:
interface PatientLite { id: string; name: string; address: string | null; bpjs_number: string | null }
// and:
const [saleType, setSaleType] = useState<'OTC' | 'RESEP' | 'BPJS' | 'SARANA'>('OTC')
```

- [ ] **Step 2: Add `isBpjsCheckoutBlocked` import**

Add to the existing import from `'../../../lib/cart'`:
```typescript
import {
  requiresAddress,
  requiresResep,
  computeSaleTotals,
  ingredientTotalQty,
  isBpjsCheckoutBlocked,
  RegulatoryCategory,
} from '../../../lib/cart'
```

- [ ] **Step 3: Derive BPJS guard state**

After the `hardGate` line (line ~112), add:

```typescript
// BPJS Number Guard: cannot pay if the selected patient has no bpjs_number.
const selectedPatient = patientId ? patientById.get(patientId) ?? null : null
const bpjsBlocked = isBpjsCheckoutBlocked(effectiveType, selectedPatient)
```

- [ ] **Step 4: Update submit() for BPJS**

In `submit()`, after the SARANA guard block, add a BPJS guard:

```typescript
if (effectiveType === 'BPJS') {
  const doctorOk = Boolean(doctorId || doctorName.trim())
  const patientOk = Boolean(patientId || patientName.trim())
  if (!doctorOk || !patientOk) {
    setError('A BPJS sale needs a doctor and a patient.')
    return
  }
  if (bpjsBlocked) {
    setError(`Patient is missing No. Peserta BPJS — update the patient record before processing a BPJS sale.`)
    return
  }
}
```

Also extend the `formData.set` calls for BPJS (BPJS is prescription-like):

```typescript
// Change these two lines:
formData.set('doctor_id', effectiveType === 'RESEP' ? doctorId : '')
formData.set('patient_id', effectiveType === 'RESEP' || effectiveType === 'SARANA' ? patientId : '')
formData.set('doctor_name', effectiveType === 'RESEP' ? doctorName : '')
formData.set('patient_name', effectiveType === 'RESEP' || effectiveType === 'SARANA' ? patientName : '')
// To:
formData.set('doctor_id', effectiveType === 'RESEP' || effectiveType === 'BPJS' ? doctorId : '')
formData.set('patient_id', effectiveType === 'RESEP' || effectiveType === 'BPJS' || effectiveType === 'SARANA' ? patientId : '')
formData.set('doctor_name', effectiveType === 'RESEP' || effectiveType === 'BPJS' ? doctorName : '')
formData.set('patient_name', effectiveType === 'RESEP' || effectiveType === 'BPJS' || effectiveType === 'SARANA' ? patientName : '')
```

Also force tuslah to `'0'` when BPJS:
```typescript
formData.set('tuslah', effectiveType === 'BPJS' ? '0' : String(tuslah || 0))
```

- [ ] **Step 5: Update the sale-type selector UI**

Find the `<select>` that renders `OTC | RESEP | SARANA` options (around line 372). Add the BPJS option and extend the onChange type:

```tsx
<select
  value={effectiveType}
  disabled={forcedResep}
  onChange={(e) => setSaleType(e.target.value as 'OTC' | 'RESEP' | 'BPJS' | 'SARANA')}
  style={inputStyle}
>
  <option value="OTC">OTC</option>
  <option value="RESEP">Resep</option>
  <option value="BPJS">BPJS / JKN</option>
  <option value="SARANA">Sarana (facility)</option>
</select>
```

When `effectiveType === 'BPJS'`, show the badge after the select:

```tsx
{effectiveType === 'BPJS' && (
  <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4 }}>
    BPJS — Tuslah &amp; Embalase waived (SE 031/XI/2014)
  </span>
)}
```

- [ ] **Step 6: Lock Tuslah and Embalase inputs**

Find the Tuslah `<input>` (around line 391). Add `disabled` and force value when BPJS:

```tsx
<input
  type="number"
  value={effectiveType === 'BPJS' ? '0' : tuslah}
  onChange={(e) => { if (effectiveType !== 'BPJS') setTuslah(e.target.value) }}
  disabled={effectiveType === 'BPJS'}
  min="0"
  step="0.01"
  placeholder="0"
  style={inputStyle}
/>
```

Find per-item racikan embalase inputs (around line 293). Add `disabled` when BPJS:

```tsx
<input
  type="number"
  value={effectiveType === 'BPJS' ? '0' : (line.embalase ?? '')}
  onChange={(e) => { if (effectiveType !== 'BPJS') updateLine(idx, { embalase: e.target.value }) }}
  disabled={effectiveType === 'BPJS'}
  min="0"
  step="0.01"
  placeholder="0"
  style={inputStyle}
/>
```

- [ ] **Step 7: Show prescription metadata block for BPJS**

Find the `{effectiveType === 'RESEP' ? (` block (around line 411). Change the condition so BPJS also shows doctor + patient selectors:

```tsx
{(effectiveType === 'RESEP' || effectiveType === 'BPJS') ? (
  // ... existing prescription metadata block unchanged
) : null}
```

- [ ] **Step 8: Disable Pay button when bpjsBlocked**

Find the submit `<button>` (around line 518). Add the `disabled` and a helper text:

```tsx
<button
  type="submit"
  disabled={bpjsBlocked}
  style={{
    // ... existing style unchanged
    opacity: bpjsBlocked ? 0.5 : 1,
    cursor: bpjsBlocked ? 'not-allowed' : 'pointer',
  }}
>
  Pay / Checkout
</button>
{bpjsBlocked && (
  <p style={{ color: '#ef4444', fontSize: 12, margin: '4px 0 0' }}>
    Patient is missing No. Peserta BPJS — update the patient record first.
  </p>
)}
```

- [ ] **Step 9: Include `bpjs_number` in the patients query**

In `apps/web/app/sales/new/page.tsx` (the server component that passes `patients` to `CartBuilder`), find the patients select query and add `bpjs_number`:

```typescript
// Find:
supabase.from('patients').select('id, name, address')
// Change to:
supabase.from('patients').select('id, name, address, bpjs_number')
```

- [ ] **Step 10: Build and test**

```bash
pnpm -r test && pnpm -r build
```

Expected: all green.

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/sales/new/cart-builder.tsx apps/web/app/sales/new/page.tsx
git commit -m "feat(web): BPJS cart mode — fee lock, Number Guard, prescription gate"
```

---

## Task 4: Patients form — `bpjs_number` field

**Files:**
- Modify: `apps/web/app/patients/actions.ts`
- Modify: `apps/web/app/patients/page.tsx`

**Interfaces:**
- Consumes: `patients.bpjs_number` column (Task 1).
- Produces: `bpjs_number` stored and displayed in the patients list; editable in the create and edit forms.

- [ ] **Step 1: Update `fields()` in actions.ts**

```typescript
function fields(formData: FormData) {
  const birth = String(formData.get('birth_date') || '').trim()
  return {
    name: String(formData.get('name') || '').trim(),
    address: String(formData.get('address') || '').trim() || null,
    phone: String(formData.get('phone') || '').trim() || null,
    birth_date: birth ? new Date(birth).toISOString().slice(0, 10) : null,
    bpjs_number: String(formData.get('bpjs_number') || '').trim() || null,
  }
}
```

- [ ] **Step 2: Add field to the Create Patient form in page.tsx**

After the Birth Date `<div>`, before the submit button `<div>`, add:

```tsx
<div>
  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
    No. Peserta BPJS
  </label>
  <input name="bpjs_number" placeholder="e.g. 0001234567890" style={fieldStyle} />
</div>
```

- [ ] **Step 3: Add field to the Edit Patient form**

Inside the `<form action={updatePatient}` block, after the Birth Date field:

```tsx
<div>
  <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
    No. Peserta BPJS
  </label>
  <input name="bpjs_number" defaultValue={p.bpjs_number ?? ''} style={fieldStyle} />
</div>
```

- [ ] **Step 4: Add `bpjs_number` column to the patients table**

In the `<thead>` row, add after Birth Date:
```tsx
<th style={thStyle}>No. Peserta BPJS</th>
```

In the `<tbody>` rows, add after Birth Date cell:
```tsx
<td style={tdStyle}>{p.bpjs_number || '-'}</td>
```

- [ ] **Step 5: Build**

```bash
pnpm -r build
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/patients/actions.ts apps/web/app/patients/page.tsx
git commit -m "feat(web): bpjs_number field on patients form and table"
```

---

## Task 5: Receipt and sale detail — BPJS badge and membership number

**Files:**
- Modify: `apps/web/app/receipts/[saleId]/page.tsx`
- Modify: `apps/web/app/sales/[id]/page.tsx`

**Interfaces:**
- Consumes: `patients.bpjs_number` via Supabase join (need to extend the select query).
- Produces: BPJS badge + `bpjs_number` displayed when `sale_type === 'BPJS'`.

- [ ] **Step 1: Extend the Supabase select in the receipt page**

In `apps/web/app/receipts/[saleId]/page.tsx`, find the select query (around line 50):

```typescript
// Find:
'*, sale_items(*, products(name, sku)), sale_payments(*), doctors(name, sip_number), patients(name, address)'
// Change to:
'*, sale_items(*, products(name, sku)), sale_payments(*), doctors(name, sip_number), patients(name, address, bpjs_number)'
```

- [ ] **Step 2: Show BPJS badge and number in the receipt**

Find the `{sale.sale_type === 'RESEP' && (` block (around line 161). Change to also render for BPJS:

```tsx
{(sale.sale_type === 'RESEP' || sale.sale_type === 'BPJS') && (
  <div style={{ fontSize: 11, marginTop: 4 }}>
    {sale.sale_type === 'BPJS' && (
      <span style={{ background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>
        BPJS / JKN
      </span>
    )}
    {sale.doctors && (
      <div>Dokter: {sale.doctors.name}{sale.doctors.sip_number ? ` (${sale.doctors.sip_number})` : ''}</div>
    )}
    {sale.patients && <div>Pasien: {sale.patients.name}</div>}
    {sale.sale_type === 'BPJS' && sale.patients?.bpjs_number && (
      <div>No. Peserta: {sale.patients.bpjs_number}</div>
    )}
  </div>
)}
```

- [ ] **Step 3: Extend the Supabase select in the sale detail page**

In `apps/web/app/sales/[id]/page.tsx`, find (around line 201):

```typescript
// Find:
'*, sale_items (*, products (name, sku)), sale_payments (*), doctors (name, sip_number), patients (name, address)'
// Change to:
'*, sale_items (*, products (name, sku)), sale_payments (*), doctors (name, sip_number), patients (name, address, bpjs_number)'
```

Also extend the patient list select (around line 208) to include `bpjs_number` for future use:

```typescript
// Find:
supabase.from('patients').select('id, name, address')
// Change to:
supabase.from('patients').select('id, name, address, bpjs_number')
```

- [ ] **Step 4: Show BPJS badge and number in the sale detail**

Find the block that renders `sale.sale_type === 'RESEP'` info (around line 232). Change to:

```tsx
{(sale.sale_type === 'RESEP' || sale.sale_type === 'BPJS') && (
  <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
    {sale.sale_type === 'BPJS' && (
      <span style={{ background: '#16a34a', color: '#fff', fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 3, marginRight: 6 }}>
        BPJS / JKN
      </span>
    )}
    Doctor: {sale.doctors?.name || '-'}{sale.doctors?.sip_number ? ` (${sale.doctors.sip_number})` : ''} · Patient:{' '}
    {sale.patients?.name || '-'}
    {sale.sale_type === 'BPJS' && sale.patients?.bpjs_number && (
      <> · No. Peserta: {sale.patients.bpjs_number}</>
    )}
  </div>
)}
```

Also update the void condition to include BPJS (around line 388):

```tsx
// Find:
{sale.status === 'PAID' && sale.sale_type === 'RESEP' && canVoidSale(userRole) && (
// Change to:
{sale.status === 'PAID' && (sale.sale_type === 'RESEP' || sale.sale_type === 'BPJS') && canVoidSale(userRole) && (
```

- [ ] **Step 5: Build and test**

```bash
pnpm -r test && pnpm -r build
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/receipts/\[saleId\]/page.tsx apps/web/app/sales/\[id\]/page.tsx
git commit -m "feat(web): BPJS badge and bpjs_number on receipt and sale detail"
```

---

## Task 6: Deploy and browser E2E

**Interfaces:**
- Consumes: all previous tasks committed and green.
- Produces: BPJS sale verified live on `https://pharmacy.nmrooms.biz.id`.

- [ ] **Step 1: Rsync to VPS**

```bash
rsync -az --delete \
  --exclude='node_modules' --exclude='.next' --exclude='.env*' \
  --exclude='.git' --exclude='.obsidian' --exclude='*.tsbuildinfo' \
  --exclude='.pnpm-store' \
  -e "ssh -o ConnectTimeout=10" \
  ./ mufid@100.119.164.5:~/pharmacy-erp/
```

- [ ] **Step 2: Build and restart the web container**

```bash
ssh mufid@100.119.164.5 'cd ~/pharmacy-erp && docker compose up -d --build web'
```

Wait ~20 s, then:

```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 20 https://pharmacy.nmrooms.biz.id/login
```

Expected: `200`.

- [ ] **Step 3: Seed a BPJS patient via the patients page**

Use firecrawl interact on `https://pharmacy.nmrooms.biz.id`:
1. Log in as `owner@mufid.dev` / `Test1234!`.
2. Navigate to `/patients`.
3. Create patient: Name `E2E BPJS Pasien`, Address `Jl. E2E No. 1`, No. Peserta BPJS `0001234567890`.
4. Confirm the patient appears in the table with the BPJS number.

- [ ] **Step 4: Create a BPJS sale**

1. Navigate to `/sales/new`.
2. Add one item (any non-narcotic product).
3. Change sale type to `BPJS / JKN`.
4. Confirm tuslah and embalase inputs are disabled.
5. Select a doctor and the E2E BPJS patient.
6. Confirm the Pay button is enabled (patient has bpjs_number).
7. Click Pay, complete the sale.

- [ ] **Step 5: Verify receipt**

Navigate to the receipt for the completed sale. Confirm:
- `BPJS / JKN` badge appears.
- `No. Peserta: 0001234567890` shows under the patient name.
- Embalase and Tuslah lines show `0` or are absent.

- [ ] **Step 6: Verify BPJS Number Guard**

1. Navigate to `/patients`, edit E2E BPJS Pasien, clear `bpjs_number`, save.
2. Navigate to `/sales/new`, select BPJS, select that patient.
3. Confirm Pay button is disabled with the warning text.
4. Restore the bpjs_number to `0001234567890`.

- [ ] **Step 7: Clean up E2E seed data**

```bash
ssh mufid@100.119.164.5 "docker exec pharmacy-supabase-db psql -U supabase_admin -d supabase -c \
  \"DELETE FROM public.sales WHERE doctor_name IS NOT NULL AND sale_type = 'BPJS' AND status = 'PAID';\""
```

Also delete the E2E patient and confirm zero BPJS sales remain.

- [ ] **Step 8: Update AGENTS.md and commit**

Update the `## Status / Done` section to record BPJS as complete. Update `## Next plan` to remove the BPJS item and list the remaining phases.

```bash
git add AGENTS.md
git commit -m "docs: BPJS zero-fee implemented and verified live"
```
