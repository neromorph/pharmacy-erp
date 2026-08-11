# Stock opname + batch UX

Type: task
Status: resolved

## Question

What changes make batch count, FEFO, and stock adjustment clear and safe for daily use?

## Answer

Current stock tools already exist: stock opname, kartu stok, batch list, and destruction flow. Main gap is clarity, not missing engine.

Keep scope small for sellable v1:
- Add FEFO and expiry hints on stock opname rows.
- Show batch age / expiry status badge in batch lists and stock views.
- Add guard text before quantity edits so user knows this changes stock balance.
- Make destruction and adjustment actions explain why batch goes out.
- Keep one batch per row. Do not merge opname, kartu stok, and destruction into one screen.
- Do not add scanning or mobile capture now.

Result: daily stock work stays clear and safe without new module shape.
