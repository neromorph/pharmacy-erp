# 01 Define the three KPI rules

Type: grilling
Status: claimed

Type: grilling
Status: resolved

## Answer

The three KPI rules are locked:

1. **Near-expiry** (flag-aware): a product is near-expiry when any of its batches expires within **30 days** for `is_expired_sensitive=true` products, or **60 days** for others.
2. **Low stock**: a product is low when `SUM(product_batches.current_qty) <= products.min_stock_level`. Any product with zero total stock (no batches) is always counted as low/out of stock.
3. **Daily sales** (net, WIB): sum of PAID sales minus VOIDed sales for the day, using `sold_at`. Day boundary is the WIB (Asia/Jakarta, UTC+7) calendar day; the query must explicitly convert the UTC `sold_at` to `Asia/Jakarta` — never use UTC or server-local CURRENT_DATE.

All amounts are IDR.