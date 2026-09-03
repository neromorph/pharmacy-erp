# Staff Sync Trigger Blocked Admin User Creation

2026-09-03. Found by the new integration test harness for POS checkout.

## What happened

The integration harness provisions a tenant and a user with the admin API. `createUser` failed with gotrue 500 "Database error creating new user". The same call worked when the staff tables were introduced, so the failure looked random.

## Root cause

Gotrue inserts the `auth.users` row first and writes `app_metadata` in a later UPDATE inside the same request. The staff sync trigger (`sync_staff_from_auth_users`, hotfix `20260806000007`) raised `Staff user must carry app_metadata.tenant_id` on INSERT when `tenant_id` was NULL. The raise aborted every admin-API user creation. Provisioning was broken for all new users, not just tests.

Two findings delayed the fix:

1. The live database is `supabase` on port 5433, not `postgres`. The first fix landed in the wrong database and the error stayed.
2. Gotrue logs carry the real SQLSTATE. The container log for `pharmacy-supabase-auth` named the exact raise. The client-side error was a generic 500.

## Lesson

1. A trigger on `auth.users` must tolerate the metadata-write order of gotrue. INSERT without metadata is normal; the later UPDATE completes the row.
2. Raise exceptions in auth-path triggers only when the state can never recover. A later UPDATE is recovery.
3. A self-hosted Supabase template can split schemas across databases. Check `GOTRUE_DB_DATABASE_URL` before applying a fix.
4. The client error from gotrue says "database error" and nothing more. Read the auth container log first.

## Fix

Migration `20260806000008_staff_trigger_null_tenant_fix.sql` returns early when `tenant_id` is NULL. The trigger fires again on the metadata UPDATE and creates the staff row then. Applied to the remote DB as `supabase_admin`. Verified end to end: provisioning, staff row sync, login, and cleanup.

## Related

- [[boot-gate-caught-missing-validation-deps]] — the other gate that caught a real defect before release
- `apps/web/tests/integration/` — the harness that caught this
