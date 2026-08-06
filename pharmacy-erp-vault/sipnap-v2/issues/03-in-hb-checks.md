# 03 IN and HB checks

Type: grilling
Status: resolved

Status: resolved

## Answer

Drop IN/HB as stale terminology. Lock three hard-blocks before export:
1. Continuity Block: Stok Awal (current month) MUST equal Stok Akhir of the previous month's snapshot. Divergence (backdated void, rogue edit) hard-blocks and flags the variance. No prior snapshot = no block.
2. Negative Block: Stok Akhir < 0 hard-blocks.
3. BAP Block: destroyed qty in the period without a valid bap_number hard-blocks (safety net behind rule 01.4).

## Question

The previous next-plan note said "harder checks (IN/HB)". The vault and the official SIPNAP manual do not define IN/HB.

The manual defines the report entry state: Status Pelaporan (Nihil / Periodik) and Status Transaksi (Ada Transaksi / Tidak Ada Transaksi).

Need answer for:
1. What did IN/HB mean in that note? Options I can find: (a) it is the Pemasukan/Pengeluaran split (ticket 02); (b) IN = Industri and HB = expired/spoiled stock (links to Pemusnahan); (c) it refers to something in the SIPNAP upload template.
2. If the note is stale, what hard checks should v2 add beyond v1? Candidates: block export when a product has a destruction record without BAP; block when Stok Akhir is negative; block when a period has no report at all; warn when Stok Awal does not match the previous period's Stok Akhir.
3. Which of those are hard blocks, which are warnings?
