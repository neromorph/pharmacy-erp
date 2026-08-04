# 02 Kartu Stok filter surface and granularity

Type: grilling
Status: resolved

## Question

Should the Kartu Stok ledger view operate at batch level or product level? What filters must it expose (product, batch, date range, movement type IN/OUT/ADJUSTMENT)? Does the derived view need a running-balance column, or is per-movement balance sufficient for BPOM audit?

## Answer

Grilled with user, five decisions:
1. **Granularity** — batch-level is ground truth; product-level is a grouping view on top (default product-grouped, batch expandable).
2. **Running balance column** — yes, cumulative balance after each movement, ordered by time; last row must equal `current_qty`.
3. **Movement types** — four: IN (goods_receipt_items), OUT (sale_items), ADJUSTMENT (stock_opname_items), VOID (sale void restore). Opening anchor = first approved opname (per map Q5); variance signed ±.
4. **Filters** — product search, date range, regulatory category are mandatory; batch filter and movement-type filter deferred.
5. **Fresh-tenant edge** — empty-state prompt: "No stock history — run an initial opname first" with a link to `/stock-opname/new`; the ledger renders only once an approved opname exists.