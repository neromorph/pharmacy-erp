# 08 RLS policies modification

Type: task
Status: open
Blocked by: 05-schema-triggers-migration.md

## Question

Which database tables or operations require a secondary guard checking `public.staff.is_active` to block deactivated users?

Need answer for:
1. Identify high-priority tables for write operations (e.g. `sales`, `goods_receipts`, `purchase_orders`, `stock_opnames`).
2. Draft policy modification SQL (e.g., adding `AND EXISTS (SELECT 1 FROM public.staff WHERE id = auth.uid() AND is_active = true)` on INSERT/UPDATE policies).
3. Confirm if read operations should bypass this check for performance.
4. Ensure the trigger on `auth.users` updates `public.staff` correctly to prevent locking out active users.
