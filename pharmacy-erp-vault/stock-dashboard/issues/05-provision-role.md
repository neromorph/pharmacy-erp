# 05 Provision role in app_metadata

Type: grilling
Status: resolved

## Answer

Role lives in **`app_metadata.role`** as a fixed enum, protected from self-edit (only `service_role` admin API writes it), read from the JWT by both the web server client and any future NestJS guard.

1. **Canonical values**: `OWNER`, `PHARMACIST` (APJ), `INVENTORY`, `CASHIER`. Type-safe via `UserRole` enum and `JWTAppMetadata { tenant_id, role }` in `packages/domain`.
2. **First tenant user** (initial provisioning, `provision-tenant.ts`): forced `OWNER`. Without one, a tenant cannot invite staff, approve opnames, or configure the store.
3. **Invited staff**: the owner UI explicitly requires a role choice (`CASHIER`/`INVENTORY`/`PHARMACIST`); if an API call omits `role`, the backend falls back to **`CASHIER`** (least privilege).
4. **Read path**: web server client `(await supabase.auth.getUser()).data.user?.app_metadata?.role`; RLS can use `auth.jwt() -> 'app_metadata' ->> 'role'` if needed.