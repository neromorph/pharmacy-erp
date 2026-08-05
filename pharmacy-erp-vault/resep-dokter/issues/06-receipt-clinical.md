# 06 Receipt regeneration for clinical sales

Type: task
Status: claimed

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