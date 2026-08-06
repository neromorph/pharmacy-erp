# Map: Accounts Payable v2

## Destination

Extend AP v1 with purchase returns (retur pembelian), an aging report, and a supplier statement. AP v2 turns payables from a list into the full supplier debt picture: money owed, how old it is, and the per-supplier statement of what happened.

## Notes

- **Tracker**: this vault. Format per `pharmacy-erp-vault/agents/issue-tracker.md`.
- **Domain**: finance follow-up for procurement. Read `CONTEXT.md`, `AGENTS.md`, and `pharmacy-erp-vault/accounts-payable/map.md` (v1) first. ASD-STE100 in all output.
- **Scope lock**: v2 adds the three items above. No general ledger, no double-entry journal, no sales returns, no multi-currency.
- **Users**: store owner, purchasing, finance.

## Decisions so far

- AP v1 (base): one `accounts_payables` header per `goods_receipts` row + `accounts_payable_payments`; due date = `received_at + suppliers.payment_terms_days`; status = `UNPAID` / `PARTIAL` / `PAID` / `OVERDUE`; inbox page at `/finance/payables` with inline payout form. See `pharmacy-erp-vault/accounts-payable/map.md`.
- [Purchase return model](issues/01-purchase-return-model.md) — return = separate `purchase_returns` credit note (total_amount + applied_amount) + `purchase_return_items`; never mutates the original payable. Payout applies unapplied credit first (`credit_applied = min(unapplied, payment)`), payment stores `credit_applied_amount`. Manual `return_number` (RTR-YYMM-NNN), reason EXPIRED/DAMAGED/RECALL, nullable `pbf_credit_note_number`. Batch = user choice, decrement `product_batches.current_qty` in the server action.
- [Aging report](issues/02-aging-report.md) — buckets Belum Jatuh Tempo / 1-30 / 31-60 / 61-90 / >90 days past due; summary cards at top of `/finance/payables`; CSV export of open payables with bucket column; counts all open (non-PAID) payables.
- [Supplier statement](issues/03-supplier-statement.md) — running-balance ledger at `/suppliers/[id]` (Statement tab): opening, invoices (+), payments (− cash only, `amount − credit_applied_amount`), returns (− full total), closing. Print-to-PDF A4 via `@media print`; invoice rows link to `/procurement/[po_id]`.

## Not yet specified

- Return numbering sequence (manual input for now).
- Return approval workflow (none in v2 — direct insert by stock/finance roles).
- Statement date-range filter (full history in v2, opening = 0).
- Credit application history view (applied_amount total only).

## Out of scope

- General ledger / double-entry accounting.
- Sales returns (retur penjualan).
- Multi-currency or foreign suppliers.
- Multi-branch, SATUSEHAT, BPJS/JKN.
- SIPNAP reporting.
