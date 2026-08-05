# 01 Payable schema

Type: research
Status: claimed
Blocked by: none

## Answer

AP v1 should use **one payable header table plus one payout table**.

- **Do not extend `goods_receipts`**. Receipt is source data. Payable is finance state.
- **Header table**: `accounts_payables`
  - `id`
  - `tenant_id`
  - `goods_receipt_id` unique FK
  - `supplier_id`
  - `invoice_number`
  - `receipt_total_amount`
  - `paid_amount`
  - `remaining_amount`
  - `due_date`
  - `status` enum: `UNPAID`, `PARTIAL`, `PAID`, `OVERDUE`
  - `notes`
  - `created_at`, `updated_at`
- **Payout table**: `accounts_payable_payments`
  - `id`
  - `tenant_id`
  - `accounts_payable_id` FK
  - `paid_at`
  - `amount`
  - `method` (`CASH`, `TRANSFER`, `OTHER` or same as current payment method style)
  - `notes`
  - `created_at`

Rules:
- `due_date = goods_receipts.received_at + suppliers.payment_terms_days`.
- `paid_amount` and `remaining_amount` update from payout rows.
- `status` is `UNPAID` when paid amount = 0, `PARTIAL` when some balance remains, `PAID` when remaining = 0, `OVERDUE` when due date passed and remaining > 0.
- One payable per goods receipt. Unique FK on `goods_receipt_id`.
- Add indexes on `tenant_id`, `supplier_id`, `due_date`, and `status`.
- Add RLS by `tenant_id` on both tables.

This keeps AP v1 narrow. It tracks debt, due date, and payouts only. It does not model retur pembelian or ledger reversal.

## Question

What is minimal schema for AP v1?

Scope lock:
- source = `goods_receipts`
- target = payable balance per receipt
- supports partial and full payout
- excludes retur pembelian

Need answer for:
1. New table or extend `goods_receipts`
2. Required status set
3. Fields for due date, outstanding balance, paid balance, and notes
4. Relation to supplier `payment_terms_days`
5. Any index or constraint that AP v1 needs now
