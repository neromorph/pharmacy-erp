# 06 Receipt regeneration for clinical sales

Type: task
Status: resolved

## Question

Update the receipt (`apps/web/app/receipts/[saleId]/page.tsx`) and sale detail to render clinical lines and fees.

## Scope

- Render Tuslah + Embalase totals from `sales` in the fees section; show per-parent per-line embalase in the line detail.
- Parent/child rendering: parent line visible with price; ingredients collapsible ("3 bahan" expander) on screen, hidden by default on the patient receipt print.
- Sale (RESEP) header shows doctor/patient identity.
- `?w=58|80` dual-width print CSS preserved.

## Acceptance

- Receipt for a Race recipe prints a clean parent line, one Embalase total, and a Tuslah line, with patient mound aggregate stock unaffected.
- OTC receipts unchanged.

Blocked by: 03, 04

## Answer

Resolved in session. The receipt (`apps/web/app/receipts/[saleId]/page.tsx`) and sale detail (`apps/web/app/sales/[id]/page.tsx`) now render clinical lines and fees:

- **RESEP header** — receipt shows `Dokter: <name> (SIP)` and `Pasien: <name>` from the `doctors`/`patients` join (only when `sale.sale_type === 'RESEP'`).
- **Parent/child lines** — parent compound rows render with `item_name`, price, and per-parent embalase inline (`+ Emb Rp…`); children group under a collapsible `<details>` "N bahan" expander (screen) that collapses to just the summary on print (`@media print` rule hides `details > :not(summary)`).
- **Fees section** — Embalase (from `sales.embalase_amount`, aggregated at pay) and Tuslah (`sales.tuslah_amount`) rows appear when non-zero, above TOTAL. OTC receipts unchanged: all additions are conditional.
- **Sale detail** — shows Subtotal/Emb/Tuslah breakdown above Grand Total (parent/child rows + doctor/patient already shipped in ticket 05).
- `?w=58|80` dual-width print CSS preserved untouched.

Live-verified (owner, browser): paid a RESEP racikan sale (Racikan Amoxicillin Anak 10 kapsul, Amoxicillin 0.5/dose → child 5 units, embalase 3000, tuslah 2500, total 50500). Receipt shows Dokter + Pasien, the racikan line with "1 bahan" expander, Embalase + Tuslah rows, TOTAL 50500; status PAID. FEFO deduction correct: batch 50 → 45, child row carries the batch. Test data cleaned. Repo green (web 42/42, api 6/6, builds). Commits `f6de5e3` + `546cdd6`, deployed, container healthy.