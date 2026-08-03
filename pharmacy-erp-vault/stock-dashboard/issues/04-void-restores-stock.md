# 04 Void restores stock to batches

Type: grilling
Status: resolved

## Answer

Void **restores stock** and is **privilege-limited**:

1. **Reverse FEFO**: a VOIDED sale returns each `sale_items.qty_sold` to its exact `product_batch_id` (already recorded at payment). An inverse query adds qty back to the original `product_batches` row. Keeps physical vs system stock drift-free.
2. **Actor rule**: only OWNER and PHARMACIST (APJ) may void. CASHIER cannot self-void — void requires supervisor approval (the reason is cash deficit / theft prevention).
3. Depends on ticket 05 for the role field in `app_metadata`. The void action (web + API) is gated on `app_metadata.role`.