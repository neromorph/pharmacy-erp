# 01 Public staff table

Type: grilling
Status: resolved
Blocked by: none

## Answer

We will create a `public.staff` table in the database to allow easy, tenant-scoped querying of employee accounts:

- **Columns**:
  - `id` UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
  - `tenant_id` UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE
  - `email` TEXT NOT NULL
  - `name` TEXT NOT NULL
  - `role` public.user_role NOT NULL (or TEXT matching the UserRole enum)
  - `is_active` BOOLEAN NOT NULL DEFAULT TRUE
  - `created_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `updated_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()

- **Trigger Synchronization**:
  - A database trigger on `auth.users` (specifically on INSERT and UPDATE) will automatically upsert the corresponding row in `public.staff`.
  - The trigger extracts the `tenant_id` and `role` from `new.raw_app_meta_data` (defaults if missing).
  - The trigger extracts the `name` from `new.raw_user_meta_data->>'name'` (defaults to email username if missing).
  - A backfill migration script will populate `public.staff` for all existing auth users.

- **RLS and Indexing**:
  - Enable Row Level Security (RLS) on `public.staff`.
  - Policy: `public.staff` is viewable by authenticated users belonging to the same `tenant_id`.
  - Policy: `public.staff` is writable (INSERT, UPDATE) only by authenticated users with the `OWNER` role belonging to the same `tenant_id`.
  - Add indexes on `tenant_id`, `role`, and `is_active`.

## Question

How do we query and filter staff users safely in a multi-tenant environment without pulling all auth.users?
