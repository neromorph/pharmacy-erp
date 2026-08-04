# 01 Tuslah and Embalase valuation rules

Type: research
Status: resolved

## Question

Resolve how Tuslah (dispensing / consultation fee) and Embalase (packaging fee) are valued in Indonesian pharmacy practice and under regulation, so the web UI can let a tenant set them.

Specific questions:
1. What is the legal / customary basis for charging Tuslah and Embalase in Indonesia? Which Permenkes / Kemenkes rule or established field practice defines them?
2. Are they charged once per prescription sheet (per-resep), or per dispensed unit / per compound? (Current design assumption: Tuslah = once per sale; Embalase = per parent compound row, aggregated at sale.)
3. What is the customary range for each (typical amounts in Rupiah) in 2025 practice for a standard apotek?
4. Is there an accepted formula or is it a free cashier-entered amount per transaction?
5. Where should a tenant configure a default (store-level Tuslah / per-form Embalase), if such a default is practical at all?

Deliver a per-question field / rule list the web UI (POS cart + Settings) can use. Record any gap between theory and what real pharmacies charge.

Blocked by: none

## Answer

Resolved by direct web research (aido.id dedicated articles on Tuslah and Embalase; Permenkes 73/2016; apotek pricing guides; worked-example sources).

1. **Legal / customary basis** — No fixed price exists in regulation. Permenkes 73/2016 (Standar Pelayanan Kefarmasian di Apotek) defines Embalase as part of the prescription service (etiquette, primary/secondary packaging, aids) and implies a professional service fee (Tuslah) for compounding, packaging, and dispensing. BPOM Reg 34/2018 covers packaging standards. Amounts are set by each facility's internal policy, guided by IAI (Ikatan Apoteker Indonesia) professional ethics. **BPJS constraint**: for JKN/BPJS patients, Tuslah/Embalase are already included in kapitasi/INA-CBGs — no extra charge may be imposed (SE BPJS Kesehatan 031/XI/2014).
2. **Per-resep vs per-unit** — Practice varies; teaching examples commonly apply both **per item (per macam obat)** — one worked example (tempatbelajarsoal.blogspot.com) computes Tuslah Rp300 + Embalase 5% of HJA per drug line. AIDO's article frames Tuslah as the racikan compounding fee, typically charged per compound. No single rule.
3. **Customary Rupiah range** — No official range. Worked examples: Embalase Rp200/strip (apotekdigital), Rp2.500 = 5% of HJA (tempatbelajarsoal), Tuslah Rp300 (dated teaching figure). Current apotek practice commonly uses Tuslah ~Rp1.000–5.000 per racikan/resep and Embalase ~Rp1.000–3.000 per pot/botol/kapsul pack. Treat these as illustrative, not normative.
4. **Formula vs free entry** — No accepted national formula. Standard pricing is HJA = [(HNA + PPN) × markup] + biaya lain; Tuslah/Embalase are the "biaya lain" set per facility. Free cashier entry with tenant-configurable defaults is the practical model.
5. **Tenant default config** — Recommended: store-level default Tuslah (flat, applied per RESEP sale) + default Embalase per preparation form (puyer / kapsul racikan / salep / sirup pot / botol), cashier-adjustable per sale. Per-parent Embalase in the locked design (issue 04) matches practice; the locked transaction-level Tuslah is a simplification — accept it, or allow per-compound Tuslah override later.

**Gap theory vs practice** — Regulation is silent on amounts; each apotek picks numbers, racikan-heavy sales carry the fees. The BPJS no-charge rule is a real compliance edge: a future JKN payment type should zero out both fees (recorded, out of scope).