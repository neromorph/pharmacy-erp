# 03 Dashboard data source and day boundary

Type: grilling
Status: claimed

Blocked by: 01

Type: grilling
Status: resolved

## Answer

Dashboard source is a **single live Postgres RPC, SECURITY INVOKER**:

1. **One function**: `get_dashboard_kpis()` returns a single JSON payload with all three KPI numbers — daily-sales amount (PAID minus VOID, WIB Asia/Jakarta calendar day), low-stock product count, near-expiry batch count, per the 01 rules. One HTTP roundtrip from the Next.js server component.
2. **SECURITY INVOKER (RLS passthrough)**: the function does NOT bypass RLS and does NOT use SECURITY DEFINER. Tenant isolation relies on the existing `tenant_id` policies on `sales`, `products`, `product_batches`. Next.js calls it via `createClient()` `.rpc('get_dashboard_kpis')`.