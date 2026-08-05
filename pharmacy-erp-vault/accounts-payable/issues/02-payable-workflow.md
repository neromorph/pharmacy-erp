# 02 Payable workflow

Type: grilling
Status: resolved
Blocked by: 01

## Answer

AP v1 screen follows the inbox-style list.

- List rows: invoice, supplier, due date, total, paid, remaining, status.
- Default sort: due date ascending.
- Actions per row: payout form with amount, method, notes (non-PAID rows only).
- Status derived at render from paid/remaining/due date via `getPayableStatus` (OVERDUE shows even without a payout event).
- Role gate: no explicit role gate in v1; page reads through RLS by tenant.
- Payout action validates amount > 0 and <= remaining, inserts payment, recomputes balances, redirects.

Build plan: `docs/superpowers/plans/2026-08-05-finance-payables.md`.

## Question

What user flow should `/finance/payables` expose for AP v1?

Need answer for:
1. List row shape and detail view
2. Filter and sort defaults
3. Actions for partial payout, full payout, and mark overdue
4. Who can use it
5. Which field the payout form must capture
