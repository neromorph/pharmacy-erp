# Map: Accounts Payable

## Destination

Track supplier debt from `goods_receipts` to payout. AP v1 covers payable balance, due date, partial payout, full payout, and status. No purchase returns in v1.

## Notes

- **Tracker**: this vault. Format per `pharmacy-erp-vault/agents/issue-tracker.md`.
- **Domain**: finance follow-up for procurement. Read `CONTEXT.md`, `AGENTS.md`, and procurement docs first. ASD-STE100 in all output.
- **Scope lock**: v1 only tracks what the branch received and paid down. No retur pembelian, no ledger reversal, no accounting journal.
- **Users**: store owner, purchasing, finance.

## Decisions so far

- [Payable schema](issues/01-payable-schema.md) — one `accounts_payables` header per `goods_receipts` row plus `accounts_payable_payments`; due date comes from `received_at + suppliers.payment_terms_days`; status = `UNPAID` / `PARTIAL` / `PAID` / `OVERDUE`.
- [Payable workflow](issues/02-payable-workflow.md) — inbox-style list sorted by due date; payout form per non-PAID row (amount/method/notes); status derived at render; no role gate in v1.
- [Payable reporting](issues/03-payable-reporting.md) — no separate report in v1; aging is the in-list status; no export.
- [AP v1 implementation](docs/superpowers/plans/2026-08-05-finance-payables.md) — schema + triggers + backfill applied to remote and live-verified; web page + payout action built; tasks 1-4 complete.

## Not yet specified

- Minimal payable schema: new table vs extension of `goods_receipts`.
- Which status set to use for unpaid, partial, paid, and overdue payables.
- How payout rows should store cash method, notes, and remaining balance.
- Exact `/finance/payables` screen shape and row actions.
- Aging summary rules, if any.

## Out of scope

- Purchase returns / retur pembelian.
- General ledger / double-entry accounting.
- Supplier credit memo flow.
- SIPNAP reporting.
- Multi-branch, SATUSEHAT, BPJS/JKN.
