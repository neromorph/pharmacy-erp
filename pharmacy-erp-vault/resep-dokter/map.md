# Map: Resep Dokter & Obat Racikan

## Destination

Upgrade the POS from a retail engine to a clinical pharmacy engine: **prescriptions (Resep) and compounded preparations (Racikan) as first-class sales**. One map, one destination. Accounts Payable and SIPNAP reporting are out of scope for this map.

The POS, Cart, and Inventory engine mutate to handle clinical realities: fractional dosage, compound packaging, prescription metadata, and legal drug-category gates.

## Notes

- **Tracker**: this vault. Format per `pharmacy-erp-vault/agents/issue-tracker.md`.
- **Domain**: pharmacy clinical + Indonesian regulatory compliance. Read `CONTEXT.md` and `AGENTS.md` first. ASD-STE100 in all output.
- **Skills**: `/wayfinder`, `/grilling`, `/domain-modeling`, `/prototype`, `/research`. Web queries Supabase directly via the server client.
- **Destination framing**: Path B (Resep & Racikan) was picked over Path A (AP) and Path C (SIPNAP) because compounding and prescriptions are the *daily clinical spine* a pharmacy cannot run without, and the deepest schema mutation (fractional + compound) benefits most from wayfinding. Path A and C remain out of scope.

## Status

**All 6 tickets resolved — Path B (Resep Dokter & Obat Racikan) complete.**

- [01 Tuslah & Embalase valuation resolved](issues/01-tuslah-embalase-valuation.md) — no fixed price in regulation; facility policy per IAI ethics. Tenant sets default Tuslah (flat per RESEP sale) + default Embalase per preparation form; cashier-adjustable. Embalase per-parent matches practice. BPJS/JKN sales must zero both fees (SE 031/XI/2014) — future edge, out of scope.
- [02 Product classification + fractional flags resolved](issues/02-product-classification.md) — `products.allow_fractional` + `products.regulatory_category` landed (migration `20260804000004`, applied + live-verified). New `/products` master-data page (create/edit, OWNER/PHARMACIST/INVENTORY). Kartu Stok Regulatory Category filter now functional.
- [03 Prescription master data resolved](issues/03-prescription-master-data.md) — `doctors`/`patients` tables + `sales.sale_type` (OTC/RESEP) + `sales.doctor_id`/`patient_id` (SET NULL) + `tuslah_amount`/`embalase_amount` landed (migration `20260804000005`, applied + live-verified). `/doctors` + `/patients` OWNER-gated CRUD pages. Cart pick-or-create UI ships with ticket 05.
- [04 Racikan bundle schema resolved](issues/04-racikan-bundle-schema.md) — `sale_items.product_id` nullable, `parent_item_id` self-FK, `embalase_amount`, `check_child_no_embalase` landed (migration `20260804000006`, CHECK verified live). Pay/void FEFO skips parent rows; pay aggregates parent embalase into `sales.embalase_amount`. Helpers + unit tests in `apps/web/lib/compound.ts`.
- [05 POS cart: racikan builder + two-tiered gate resolved](issues/05-pos-racikan-gate.md) — interactive cart (`cart-builder.tsx` + server actions): dynamic item rows, racikan compound builder (parent + per-dose ingredients), fractional entry per `allow_fractional`, KERAS/narcotic auto-flip to RESEP with doctor/patient pick-or-create, narcotic hard gate requires patient address. `sale_items.item_name` added (migration `20260804000007`). Live-verified both flows end-to-end.
- [06 Clinical receipt resolved](issues/06-receipt-clinical.md) — RESEP receipt shows doctor/patient header, parent/child lines with "N bahan" collapsible ingredients (hidden on print), per-parent embalase inline, Embalase + Tuslah fee rows. OTC receipts unchanged. `?w=58|80` preserved. Live-verified on a paid RESEP racikan sale incl FEFO deduction.

## Decisions so far

- [Fractional stock: hybrid rule](issues/) — universal `NUMERIC(14,3)` engine already in place; new `products.allow_fractional BOOLEAN DEFAULT FALSE`. Solids (tablets/capsules/blisters) = integer at POS. Liquids/topicals (syrups/creams) = decimal. Racikan context bypasses the integer guard for split doses (0.5 / 0.333 tablets).
- [Racikan cart: Parent/Child bundle](issues/) — one parent `sale_items` row = dispensed dosage units + compound price; child rows (`parent_item_id` FK, `unit_price = 0`, `product_id` non-null) carry exact ingredient quantities for FEFO deduction. Receipt shows parent with collapsible ingredients; patient receipt hides children.
- [Service fees: per-parent embalase + transaction tuslah](issues/) — `sale_items.embalase_amount` on parent rows (per-compound packaging), aggregated into `sales.embalase_amount`. `sales.tuslah_amount` for the dispensing fee. Both `NUMERIC(18,2) NOT NULL DEFAULT 0`.
- [Prescription metadata: twin-track OTC/RESEP](issues/) — `sales.sale_type` enum `OTC`/`RESEP`. Relational `doctors` + `patients` tables. OTC bypasses metadata. RESEP requires doctor/patient.
- [Two-tiered gate model](issues/) — separated prescription gate from compliance gate: `BEBAS`/`BEBAS_TERBATAS` = OTC or RESEP (no metadata); `KERAS` = RESEP-only auto-flip (doctor + patient soft-prompt, address optional); `PSIKOTROPIKA`/`NARKOTIKA` = RESEP-only auto-flip + hard gate (doctor + patient + patient address required before PAID). Mirrors Permenkes.
- [`regulatory_category` brought into scope as prerequisite](issues/) — `products.regulatory_category` column (BEBAS/BEBAS_TERBATAS/KERAS/PSIKOTROPIKA/NARKOTIKA, default BEBAS) gates the auto-flip. Unblocks the existing Kartu Stok regulatory filter TODO.
- [DDL refinements](issues/) — `uuid_generate_v4()` to match existing migrations; `ON DELETE SET NULL` on `sales.doctor_id`/`sales.patient_id`; DB CHECK `(parent_item_id IS NULL OR embalase_amount = 0)` on `sale_items`; `product_id` nullable on `sale_items` for parent rows.

## Out of scope

- Accounts Payable / hutang PBF — separate follow-up effort.
- SIPNAP compliance *reporting* — separate follow-up effort. This map only lays the data (`regulatory_category`, doctors/patients) it needs.
- Hardware printer driver code — superseded by `window.print()` decision.
- Multi-branch, SATUSEHAT, full OOT dosing rules — later phases.
- BPJS/JKN zero-fee rule for Tuslah/Embalase (SE BPJS Kesehatan 031/XI/2014) — future edge, recorded in ticket 01.
