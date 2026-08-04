# 05 POS cart: Racikan builder and two-tiered gate

Type: task
Status: 

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