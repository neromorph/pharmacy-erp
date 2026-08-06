# 01 Pemusnahan model

Type: grilling
Status: resolved

Status: resolved

## Answer

1. New tables `stock_destructions` (bap_number, bap_date, witness_names, reason EXPIRED/DAMAGED, notes) + `stock_destruction_items` (product, batch, qty). Never hijack `stock_opname`.
2. Hard decrement: creating a destruction immediately deducts `product_batches.current_qty` (app-level, matches the return flow).
3. Roles: OWNER + PHARMACIST (APJ) only. Cashiers cannot record destruction.
4. BAP required at record time: the action blocks save when bap_number or bap_date is empty.

## Question

How does the pharmacy record drug destruction (Pemusnahan) for SIPNAP?

The official form needs: Status Pemusnahan (Ada/Tidak Ada), Nomor BAP, Tanggal BAP, Jumlah yang Dimusnahkan, and the destroyed qty must leave stock.

Need answer for:
1. Is destruction a new table (e.g. `destructions` with BAP number, BAP date, items, qty), or a stock opname type?
2. Does destroying stock decrement `product_batches.current_qty` (like a sale), or only appear on the report?
3. Who can record a destruction: OWNER only, or PHARMACIST too?
4. Must BAP number/date be required at record time, or can the report hard-block later when missing (like v1 doctor fields)?
