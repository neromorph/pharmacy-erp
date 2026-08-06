# 03 Supplier statement

Type: grilling
Status: resolved

Status: resolved

## Answer

1. Rows: all five — opening balance, invoices (goods receipts), payments, returns (credit notes), closing balance — as a running-balance ledger.
2. Location: new page `/suppliers/[id]` with a Statement tab next to the supplier profile.
3. Export: print-to-PDF A4 via `@media print` (matches the receipt page pattern).
4. Linked: each invoice row links to its goods receipt (`/procurement/[po_id]`); payments and returns stay inline.

Ledger rule: invoices = debit (+), payments = credit (− cash only, i.e. `amount − credit_applied_amount`), returns = credit (− full total). Closing = opening + debits − credits; negative closing = supplier owes the pharmacy.

## Question

What should the per-supplier statement show, and where does it live?

Need answer for:
1. Rows: opening balance, invoices (receipts), payments, returns, closing balance — which set for v2?
2. Where: a page per supplier, or a section inside `/suppliers`?
3. Export: print-to-PDF like the receipt page, CSV, or both?
4. Is the statement read-only, or does it link back to each document (receipt, payout, return)?
