# 05 POS cart: Racikan builder and two-tiered gate

Type: task
Status: resolved

## Question

Mutate the POS cart (`apps/web/app/sales/new/page.tsx`) to (a) build a Racikan parent/child bundle and (b) enforce the two-tiered prescription gate.

## Scope

- **Fractional entry** — honor `products.allow_fractional` (integer-only stepper for solids, decimal input for liquids/topicals); inside a Racikan context, split-dose decimals (0.5 / 0.333) allowed regardless of flag.
- **Racikan builder** — cashier picks a compound name, sets dispensed dosage-unit count + price (parent), adds ingredient lines (product, per-dose fraction, auto-computed total ingredient qty = fraction × dosage count) as children; per-parent embalase input.
- **Two-tiered gate** — on add-item, scan `regulatory_category`:
  - `KERAS` / `PSIKOTROPIKA` / `NARKOTIKA` → force `sale_type = RESEP` (cart flips; OTC sale cannot hold them).
  - `KERAS` → soft gate: doctor + patient required (address optional).
  - `PSIKOTROPIKA` / `NARKOTIKA` → hard gate: doctor + patient + patient address required before PAID is enabled.

## Acceptance

- A KERAS/narcotic item never persists in an OTC sale.
- PAY disabled until the required gate metadata is satisfied.
- A Racikan line's child ingredient rows deduce split-dose stock.

Blocked by: 02, 03, 04

## Answer

Resolved in session. The POS cart (`apps/web/app/sales/new/`) is now an interactive builder (client component `cart-builder.tsx` + server action `actions.ts`):

- **Fractional entry** — item qty step is `1` when `products.allow_fractional` is false, `0.001` when true; racikan ingredient per-dose fields always accept split doses (0.5 / 2.5 ml).
- **Racikan builder** — `+ Racikan` adds a compound row (name, dosage count, total price, embalase) with ingredient rows (product + per-dose fraction); live "total:" preview = fraction × dosage count (Q2 quantity model). Server writes one parent row (product_id null, item_name, embalase) + child rows (real product, unit_price 0, parent_item_id FK, qty = per-dose × count).
- **Two-tiered gate** — cart resolves every real product's `regulatory_category`; KERAS/PSIKOTROPIKA/NARKOTIKA force `sale_type = RESEP` (selector disables, "Forced RESEP" message). KERAS = soft gate (doctor + patient); narcotic classes = hard gate (patient address required before draft). Doctor/patient pick-or-create inline. Server re-validates all gates; a KERAS/narcotic item can never persist in an OTC sale.
- Sale detail renders parent/child rows (item_name, ↳ children), sale_type badge, and doctor/patient.
- Schema addition: `sale_items.item_name` (migration `20260804000007`) for the compound display name — needed because parent rows have product_id null.

Live-verified (owner, browser): KERAS Amoxicillin auto-flips to RESEP + forces doctor/patient + tuslah 2000 → draft persisted RESEP, grand 17000. Racikan Batuk Anak (10 caps, 50000, embalase 3000) + Paracetamol ingredient 2.5 ml/dose → child total 25 ml, OTC allowed, grand 53000; DB rows correct (parent + child, FK, embalase on parent only). Test sales cleaned. Repo green (web 42/42, api 6/6, builds). Commits `23872b7` + `9729724`, deployed.