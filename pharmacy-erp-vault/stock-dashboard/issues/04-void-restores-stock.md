# 04 Void restores stock to batches

Type: grilling
Status: open

## Question

When a sale is VOIDed, does its stock return to `product_batches`?

- Current POS marks a sale VOID but does not restore batch quantity. Should voiding add the sold quantities back to the original batches (reverse the FEFO decrement)?
- Does a voided sale keep its `sale_items` batch references so the exact quantities can be returned?
- Or is void a financial-only flag that keeps stock unchanged (count as a loss)?

Resolve whether void restores stock, and if so, how the reversal is recorded.