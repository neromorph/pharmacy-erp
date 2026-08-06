# 02 Pemasukan and Pengeluaran splits

Type: grilling
Status: resolved

Status: resolved

## Answer

1. Pemasukan Dari PBF = `goods_receipts` from `suppliers.is_pbf = true`. Dari Sarana = receipts from `is_pbf = false` (another apotek/hospital).
2. Pengeluaran Untuk Resep = `sales.sale_type = 'RESEP'`. Untuk Sarana = NEW `sale_type = 'SARANA'` (B2B outbound to clinic/facility; the patient row holds the facility name). OTC is never used for narcotics.
3. Report exports 4 distinct numbers, un-merged, matching the Kemkes template columns.

## Question

The official SIPNAP form splits incoming and outgoing into two sources each. How do we map our data?

Official fields: Pemasukan Dari PBF, Pemasukan Dari Sarana, Pengeluaran Untuk Resep, Pengeluaran Untuk Sarana.

Our data: incoming = `goods_receipts` from `suppliers` (has `is_pbf` flag); outgoing = `sales` (has `sale_type` RESEP/OTC).

Need answer for:
1. Pemasukan: Dari PBF = receipts from `is_pbf = true` suppliers, Dari Sarana = the rest — correct?
2. Pengeluaran: Untuk Resep = `sale_type = RESEP` sales. What is "Untuk Sarana" in our system? Is it OTC sales to walk-in patients, or a new `sale_type` for sales to other facilities (hospitals, clinics, apotek)?
3. Does the split change the report columns (4 numbers instead of 2), or does the CSV keep Pemasukan/Pengeluaran totals and only the validation checks the split?
