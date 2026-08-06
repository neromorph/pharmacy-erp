# 01 Purchase return model

Type: grilling
Status: resolved

## Answer

Retur pembelian = separate supplier credit note (nota kredit). It never mutates the original `accounts_payables` row.

1. Money: create a `purchase_returns` header (total_amount + applied_amount) with `purchase_return_items`. The credit offsets the supplier's global balance: closing = sum(invoice remaining) − sum(unapplied credit).
2. Already PAID: the credit sits unapplied against the supplier. Payout applies credit first: when paying any invoice of that supplier, `credit_applied = min(unapplied_credit, payment_total)`; cash = payment − credit_applied. Payment row stores `credit_applied_amount`.
3. Metadata: manual `return_number` (format RTR-YYMM-NNN), `reason` (EXPIRED / DAMAGED / RECALL), nullable `pbf_credit_note_number`, `returned_at`, notes.
4. Batch: user choice. The form lists batches with `current_qty > 0` for the product; user picks the exact batch and expiry. The server action checks `qty_returned <= current_qty` and decrements `product_batches.current_qty` (app-level, matches the receive flow).

Build plan: `docs/superpowers/plans/2026-08-06-purchase-returns.md` (AP v2).

When the branch returns goods to the supplier, what happens to the money?

Need answer for:
1. Does the return reduce the payable for the original receipt, or does it create a separate supplier credit balance applied to the next invoice?
2. What if the payable for that receipt is already PAID?
3. Does the return need its own document number and a reason, and does it carry a credit note number from the supplier?
4. Which batch does the return deduct from — the batch from the original receipt, or the oldest batch (FEFO), or user choice?
