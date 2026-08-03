# 02 Stock opname and adjustment flow

Type: grilling
Status: claimed

Blocked by: 01

Type: grilling
Status: resolved

## Answer

Stock opname is **batch-level** and **session-based** with an approval workflow.

1. **Count target**: batch-level. Each `product_batches` row (batch_number + expiry) is counted; variance is applied to that exact row only. Never pro-rata across batches.
2. **Record shape**: two tables — `stock_opnames` (header: tenant_id, opname_number, type FULL_STORE/RACK_BASED/AD_HOC_SINGLE, status, created_by, approved_by, approved_at) and `stock_opname_items` (opname_id, product_id, batch_id, system_qty_base, physical_qty_base, variance_qty_base = physical - system, reason DAMAGE|EXPIRED|LOST|COUNT_ERROR|MISC). Status machine: DRAFT → PENDING_APPROVAL → APPROVED | CANCELLED. `product_batches.current_qty` changes ONLY on APPROVED; the audit log is immutable after posting.
3. **Actors (separation of duties)**: any CASHIER/INVENTORY/PHARMACIST/OWNER may create a session, count, choose reason, and submit. Only OWNER and PHARMACIST (APJ) may approve any opname; INVENTORY and CASHIER can never self-approve. When OWNER/PHARMACIST creates the session, a Submit-And-Approve shortcut skips the 2-step flow.
4. Implementation note: role lives in app `app_metadata.role` (not yet provisioned); the web server client reads it to gate approve. NestJS not deployed, so enforcement is in the web app-action, not an API guard.