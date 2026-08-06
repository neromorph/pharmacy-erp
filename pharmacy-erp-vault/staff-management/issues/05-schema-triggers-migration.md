# 05 Schema and triggers migration

Type: task
Status: resolved
Blocked by: none

## Question

How do we write the migration script to set up the `public.staff` table, triggers on `auth.users`, and populate existing users?

Need answer for:
1. Migration file name and location.
2. Structure of the trigger function to capture raw app and user metadata during inserts/updates.
3. Constraint to prevent users from deactivating/demoting themselves at the database level.
4. Backfill script for current auth.users rows to populate public.staff.
5. RLS policies allowing all tenant members to read staff list, but only Owners to modify.

## Answer

Implemented via SDD plan `docs/superpowers/plans/2026-08-06-staff-management.md`.

1. Migration file: `supabase/migrations/20260806000006_staff_management.sql` (commit `6d2c87d`). Applied to remote `pharmacy-supabase-db` as `supabase_admin`.
2. Trigger function `public.sync_staff_from_auth_users()`: AFTER INSERT OR UPDATE on `auth.users`, extracts `tenant_id`/`role` from `raw_app_meta_data` (real column name — NOT `raw_app_metadata`), `name` from `raw_user_meta_data`; `ON CONFLICT DO UPDATE` for insert path.
3. Self-guard: `public.prevent_staff_self_modification()` BEFORE UPDATE on `public.staff` — RAISE EXCEPTION when `NEW.id = auth.uid()` and role/is_active changed.
4. Backfill: INSERT ... SELECT from `auth.users` filtering `tenant_id IS NOT NULL`; 2 rows populated.
5. RLS two-policy split: `Staff read` (FOR SELECT, tenant-only) + `Staff owner write` (FOR ALL, tenant + OWNER). Corrected from overlapping FOR ALL design (Postgres ORs policies per command type — critical defect caught in pre-flight).
Live verified: remote has 2 staff rows, policies + triggers present, web container healthy. Type guard helpers `apps/web/lib/staff.ts` (85/85 tests).
